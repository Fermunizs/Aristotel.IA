import { and, eq, gte, sql, desc } from "drizzle-orm";
import { db } from "./db";
import { events, focusSessions, learningPlans, streaks, tasks, users } from "./schema";

const todayISO = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const daysAgoISO = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
};

export type Week = { n: number; theme: string; days: { d: number; topic: string; goal: string }[] };

export async function dashboardData(userId: string) {
  const today = todayISO();
  const weekAgo = daysAgoISO(7);

  const [plan] = await db
    .select()
    .from(learningPlans)
    .where(and(eq(learningPlans.userId, userId), eq(learningPlans.active, true)))
    .limit(1);

  const todayTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.day, today)))
    .orderBy(tasks.sortOrder);

  const [streak] = await db
    .select()
    .from(streaks)
    .where(and(eq(streaks.userId, userId), eq(streaks.kind, "diario")))
    .limit(1);

  const evRows = await db
    .select({ kind: events.kind, n: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.userId, userId), gte(events.day, weekAgo)))
    .groupBy(events.kind);
  const counts: Record<string, number> = {};
  for (const r of evRows) counts[r.kind] = r.n;

  const [foco] = await db
    .select({ min: sql<number>`coalesce(sum(minutes),0)::int` })
    .from(focusSessions)
    .where(
      and(
        eq(focusSessions.userId, userId),
        eq(focusSessions.completed, true),
        gte(focusSessions.startedAt, sql`now() - interval '7 days'`),
      ),
    );

  return {
    plan: plan
      ? {
          goal: plan.goal,
          currentWeek: plan.currentWeek,
          currentDay: plan.currentDay,
          weeks: plan.weeks as Week[],
        }
      : null,
    todayTasks,
    streak: streak ?? { current: 0, best: 0 },
    week: {
      quiz: counts["quiz"] ?? 0,
      review: counts["review"] ?? 0,
      desafio: counts["desafio"] ?? 0,
      foco: counts["foco"] ?? 0,
      focoMin: foco?.min ?? 0,
    },
  };
}

export async function adminOverview() {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.telegramUsername,
      status: users.status,
      createdAt: users.createdAt,
      lastSeenAt: users.lastSeenAt,
      streak: sql<number>`coalesce((select current from streaks s where s.user_id = users.id and s.kind='diario'),0)::int`,
      doneToday: sql<number>`(select count(*) from tasks t where t.user_id = users.id and t.day = ${todayISO()} and t.status='done')::int`,
      totalToday: sql<number>`(select count(*) from tasks t where t.user_id = users.id and t.day = ${todayISO()})::int`,
    })
    .from(users)
    .orderBy(desc(users.lastSeenAt));

  const total = rows.length;
  const active = rows.filter((r) => r.status === "active").length;
  const onboarding = rows.filter((r) => r.status === "onboarding").length;
  const seen7 = rows.filter(
    (r) => r.lastSeenAt && Date.now() - new Date(r.lastSeenAt).getTime() < 7 * 864e5,
  ).length;
  const avgStreak =
    active > 0
      ? Math.round(
          (rows.filter((r) => r.status === "active").reduce((s, r) => s + r.streak, 0) / active) * 10,
        ) / 10
      : 0;

  return { rows, stats: { total, active, onboarding, seen7, avgStreak } };
}
