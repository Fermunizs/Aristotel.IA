import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { learningPlans, preferences, users } from "@/lib/schema";
import { getSession } from "@/lib/session";
import { buildTrilha } from "@/lib/trilha-build";

export const maxDuration = 60; // 5 chamadas de LLM

const LEVELS: Record<string, string> = {
  "1": "do zero",
  "2": "sei o básico",
  "3": "intermediário, quero aprofundar",
};
const TONES = new Set(["gentil", "equilibrada", "durona"]);

// espelha bot/db.py::_DEFAULT_REMINDERS — mas channel='push' (usuário web não tem Telegram)
const DEFAULT_REMINDERS: [string, string, number][] = [
  ["motivacao", "06:00", 0],
  ["guia", "08:00", 1],
  ["pilula", "09:00", 2],
  ["quiz", "10:30", 3],
  ["insight", "15:00", 4],
  ["desafio", "16:00", 5],
  ["checkin_noite", "20:00", 6],
];

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const user = session.viewing;
  if (user.status !== "onboarding") {
    return NextResponse.json({ error: "onboarding já concluído" }, { status: 409 });
  }

  const b = await req.json().catch(() => ({}));
  const goal = String(b.goal ?? "").trim().slice(0, 400);
  const level = LEVELS[String(b.level)] ?? "do zero";
  const minutes = Math.max(10, Math.min(180, parseInt(String(b.minutes), 10) || 30));
  const tone = TONES.has(b.tone) ? b.tone : "equilibrada";
  const context = String(b.context ?? "").trim().slice(0, 1000);
  const refs = String(b.refs ?? "").trim().slice(0, 1000);
  if (goal.length < 3) return NextResponse.json({ error: "diz o que você quer aprender" }, { status: 400 });

  let weeks;
  try {
    weeks = await buildTrilha(user.name ?? "", goal, level, minutes, user.id, context, refs);
  } catch (e) {
    console.error("onboarding buildTrilha", e);
    weeks = null;
  }
  if (!weeks) {
    return NextResponse.json(
      { error: "O gerador de trilha tá congestionado. Espera 1 min e tenta de novo." },
      { status: 502 },
    );
  }

  // trilha (transacional — respeita o índice único learning_plans_one_active)
  await db.transaction(async (tx) => {
    await tx.update(learningPlans).set({ active: false }).where(eq(learningPlans.userId, user.id));
    await tx.insert(learningPlans).values({
      userId: user.id,
      goal,
      level,
      weeks,
      currentWeek: 1,
      currentDay: 1,
      knownTopics: [],
      active: true,
    });
  });

  await db.update(preferences).set({ minutesPerDay: minutes, coachTone: tone }).where(eq(preferences.userId, user.id));

  // lembretes padrão via push + marca dirty pro bot agendar
  for (const [kind, at, ord] of DEFAULT_REMINDERS) {
    await db.execute(sql`
      INSERT INTO reminders (user_id, kind, at_time, sort_order, channel)
      VALUES (${user.id}, ${kind}, ${at}::time, ${ord}, 'push')
      ON CONFLICT DO NOTHING`);
  }
  await db.execute(sql`UPDATE bot_state SET reminders_dirty = true WHERE user_id = ${user.id}`);
  await db.execute(sql`UPDATE bot_state SET history = '[]'::jsonb WHERE user_id = ${user.id}`);

  await db.update(users).set({ status: "active" }).where(eq(users.id, user.id));

  return NextResponse.json({ ok: true });
}
