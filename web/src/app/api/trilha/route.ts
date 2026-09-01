import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { learningPlans } from "@/lib/schema";
import { getSession } from "@/lib/session";

type Day = { d: number; topic: string; goal: string };
type Week = { n: number; theme: string; days: Day[] };

/** Espelha bot/handlers.py::_advance — anda 1 passo na trilha. */
function advance(weeks: Week[], week: number, day: number) {
  const w = weeks.find((x) => x.n === week);
  const total = w?.days.length ?? 5;
  const maxWeek = weeks.reduce((m, x) => Math.max(m, x.n), week);
  if (day < total) return { week, day: day + 1 };
  if (week < maxWeek) return { week: week + 1, day: 1 };
  return { week, day };
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { action } = await req.json().catch(() => ({}));
  if (action !== "jasei" && action !== "skip") {
    return NextResponse.json({ error: "ação inválida" }, { status: 400 });
  }

  const [plan] = await db
    .select()
    .from(learningPlans)
    .where(and(eq(learningPlans.userId, session.viewing.id), eq(learningPlans.active, true)))
    .limit(1);
  if (!plan) return NextResponse.json({ error: "sem trilha" }, { status: 404 });

  const weeks = plan.weeks as Week[];
  const next = advance(weeks, plan.currentWeek, plan.currentDay);

  if (action === "jasei") {
    const cur = weeks.find((w) => w.n === plan.currentWeek);
    const topic = cur?.days.find((d) => d.d === plan.currentDay)?.topic;
    if (topic) {
      await db
        .update(learningPlans)
        .set({ knownTopics: sql`${learningPlans.knownTopics} || ${JSON.stringify([topic])}::jsonb` })
        .where(and(eq(learningPlans.id, plan.id)));
    }
  }

  await db
    .update(learningPlans)
    .set({ currentWeek: next.week, currentDay: next.day })
    .where(and(eq(learningPlans.id, plan.id)));

  return NextResponse.json({ ok: true, currentWeek: next.week, currentDay: next.day });
}
