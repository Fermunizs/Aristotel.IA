import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { botState, events, learningPlans, preferences } from "@/lib/schema";
import { getSession } from "@/lib/session";
import { buildPersona } from "@/lib/persona";
import { coachChat } from "@/lib/coach-llm";

const HISTORY_MAX = 14; // == bot/db.py::_HISTORY_MAX
const CHAT_DAILY_CAP = 40; // == bot/handlers.py::CHAT_DAILY_CAP
const todayISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

type Turn = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const uid = session.viewing.id;

  const text = String((await req.json().catch(() => ({}))).text ?? "").trim().slice(0, 1500);
  if (!text) return NextResponse.json({ error: "mensagem vazia" }, { status: 400 });

  const day = todayISO();
  const [{ n: usedToday }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.userId, uid), eq(events.day, day), eq(events.kind, "msg:chat")));
  if (usedToday >= CHAT_DAILY_CAP) {
    return NextResponse.json(
      { error: `Você bateu o limite de ${CHAT_DAILY_CAP} mensagens de conversa hoje. Amanhã a gente retoma.` },
      { status: 429 },
    );
  }

  const [state] = await db.select().from(botState).where(eq(botState.userId, uid)).limit(1);
  const history = (Array.isArray(state?.history) ? state!.history : []) as Turn[];

  const [plan] = await db
    .select()
    .from(learningPlans)
    .where(and(eq(learningPlans.userId, uid), eq(learningPlans.active, true)))
    .limit(1);
  const [pref] = await db.select().from(preferences).where(eq(preferences.userId, uid)).limit(1);

  let topic = "ainda sem trilha";
  if (plan) {
    const weeks = plan.weeks as { n: number; days: { d: number; topic: string }[] }[];
    topic =
      weeks.find((w) => w.n === plan.currentWeek)?.days.find((x) => x.d === plan.currentDay)?.topic ??
      topic;
  }

  const persona = await buildPersona({
    name: session.viewing.name,
    goal: plan?.goal ?? null,
    tone: pref?.coachTone ?? null,
    note: pref?.coachNote ?? null,
  });
  const system =
    persona +
    `\n\nVocê está numa conversa com a pessoa NO PAINEL (não é o Telegram, mas é a mesma conversa). ` +
    `O tópico de hoje na trilha dela é: ${topic}. Responda direto, sincero, sem textão, sempre ` +
    `dentro do objetivo dela. Use o histórico pra manter o contexto.`;

  // o histórico guardado ainda NÃO tem a mensagem atual — anexa antes de mandar pro LLM
  const turns: Turn[] = [
    ...history.slice(-(HISTORY_MAX - 1)),
    { role: "user", content: text },
  ];

  let reply: string;
  try {
    reply = await coachChat(system, turns, 500, { userId: uid, tag: "chat-painel" });
  } catch {
    return NextResponse.json({ error: "A treinadora não respondeu agora. Tenta de novo." }, { status: 502 });
  }
  reply = (reply || "").replace(/\*\*/g, "*").trim() || "…";

  // append atômico (user + assistant) na memória compartilhada, cortando no cap
  const add = JSON.stringify([
    { role: "user", content: text },
    { role: "assistant", content: reply.slice(0, 1500) },
  ]);
  await db
    .update(botState)
    .set({
      history: sql`(
        SELECT coalesce(jsonb_agg(e), '[]'::jsonb) FROM (
          SELECT e FROM jsonb_array_elements(coalesce(${botState.history}, '[]'::jsonb) || ${add}::jsonb) e
          OFFSET greatest(0, jsonb_array_length(coalesce(${botState.history}, '[]'::jsonb) || ${add}::jsonb) - ${HISTORY_MAX})
        ) s
      )`,
    })
    .where(eq(botState.userId, uid));

  await db.insert(events).values({
    userId: uid,
    day,
    kind: "msg:chat",
    payload: { via: "painel" },
    createdAt: new Date(),
  });

  return NextResponse.json({ reply });
}
