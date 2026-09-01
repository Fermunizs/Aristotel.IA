import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { botState, learningPlans, outbox, users } from "@/lib/schema";
import { getSession } from "@/lib/session";

/**
 * Recomeçar a trilha pelo painel: desativa a trilha atual, volta o usuário pro
 * onboarding e deixa a 1ª pergunta esperando no Telegram. A geração da trilha
 * nova roda no bot quando a pessoa responde (bot/onboarding.py).
 *
 * Mantém streak, evolução, tarefas e banco de conteúdo.
 * Texto abaixo espelha bot/prompts.py::ONB_GOAL.
 */
const FIRST_QUESTION =
  "🔄 Bora remontar sua trilha do zero (seu streak, evolução e conteúdo continuam).\n\n" +
  "🎯 O que você quer aprender ou desenvolver?\n\n" +
  'Responde específico. Ex: "JavaScript pra backend", "design de produto", ' +
  '"inglês pra reuniões", "disciplina pra estudar todo dia".';

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const uid = session.viewing.id;

  const [plan] = await db
    .select({ id: learningPlans.id })
    .from(learningPlans)
    .where(eq(learningPlans.userId, uid))
    .limit(1);
  if (!plan) return NextResponse.json({ error: "sem trilha" }, { status: 404 });

  await db.update(learningPlans).set({ active: false }).where(eq(learningPlans.userId, uid));
  await db.update(users).set({ status: "onboarding" }).where(eq(users.id, uid));
  await db
    .update(botState)
    .set({ pending: { type: "onboarding", step: "goal", answers: {} } })
    .where(eq(botState.userId, uid));
  await db.insert(outbox).values({ userId: uid, text: FIRST_QUESTION, createdAt: new Date() });

  return NextResponse.json({ ok: true });
}
