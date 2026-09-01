import { and, eq, gte, sql, desc } from "drizzle-orm";
import { db } from "./db";
import { contentIdeas, events, focusSessions, learningPlans, llmUsage, streaks, tasks, users } from "./schema";

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

export async function evolucaoData(userId: string) {
  const since = daysAgoISO(13);

  const evRows = await db
    .select({ day: events.day, kind: events.kind, n: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.userId, userId), gte(events.day, since)))
    .groupBy(events.day, events.kind);

  const map = new Map<string, { estudo: number; pratica: number; foco: number }>();
  for (let i = 13; i >= 0; i--) map.set(daysAgoISO(i), { estudo: 0, pratica: 0, foco: 0 });
  for (const r of evRows) {
    const slot = map.get(r.day);
    if (!slot) continue;
    if (r.kind.startsWith("msg:") || r.kind === "quiz") slot.estudo += r.n;
    else if (r.kind === "desafio" || r.kind === "review") slot.pratica += r.n;
    else if (r.kind === "foco") slot.foco += r.n;
  }
  const series = [...map.entries()].map(([day, v]) => ({ day: day.slice(8), ...v }));

  const [streak] = await db
    .select()
    .from(streaks)
    .where(and(eq(streaks.userId, userId), eq(streaks.kind, "diario")))
    .limit(1);

  const totals = await db
    .select({ kind: events.kind, n: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.userId, userId), gte(events.day, since)))
    .groupBy(events.kind);
  const t: Record<string, number> = {};
  for (const r of totals) t[r.kind] = r.n;

  const ideas = await db
    .select()
    .from(contentIdeas)
    .where(eq(contentIdeas.userId, userId))
    .orderBy(desc(contentIdeas.createdAt))
    .limit(8);

  return {
    series,
    streak: streak ?? { current: 0, best: 0 },
    totals: {
      quiz: t["quiz"] ?? 0,
      desafio: t["desafio"] ?? 0,
      review: t["review"] ?? 0,
      foco: t["foco"] ?? 0,
    },
    ideas,
  };
}

export async function llmConsumo() {
  const since7 = sql`now() - interval '7 days'`;
  const tok = sql<number>`coalesce(sum(prompt_tokens + completion_tokens),0)::int`;

  const [tot] = await db
    .select({
      calls: sql<number>`count(*)::int`,
      tokens: tok,
      ok: sql<number>`count(*) filter (where ok)::int`,
      fallbackCalls: sql<number>`count(*) filter (where fallback)::int`,
      rate429: sql<number>`count(*) filter (where status = '429')::int`,
      localFallback: sql<number>`count(*) filter (where provider = 'fallback')::int`,
    })
    .from(llmUsage)
    .where(gte(llmUsage.createdAt, since7));

  const byProvider = await db
    .select({ provider: llmUsage.provider, calls: sql<number>`count(*)::int`, tokens: tok })
    .from(llmUsage)
    .where(gte(llmUsage.createdAt, since7))
    .groupBy(llmUsage.provider)
    .orderBy(desc(sql`count(*)`));

  const byTag = await db
    .select({ tag: sql<string>`coalesce(tag,'—')`, calls: sql<number>`count(*)::int`, tokens: tok })
    .from(llmUsage)
    .where(gte(llmUsage.createdAt, since7))
    .groupBy(sql`coalesce(tag,'—')`)
    .orderBy(desc(sql`sum(prompt_tokens + completion_tokens)`));

  const nameExpr = sql<string>`coalesce(${users.name}, ${users.telegramUsername}, 'sistema')`;
  const byUser = await db
    .select({ name: nameExpr, calls: sql<number>`count(*)::int`, tokens: tok })
    .from(llmUsage)
    .leftJoin(users, eq(users.id, llmUsage.userId))
    .where(gte(llmUsage.createdAt, since7))
    .groupBy(nameExpr)
    .orderBy(desc(sql`sum(${llmUsage.promptTokens} + ${llmUsage.completionTokens})`))
    .limit(12);

  const byDay = await db
    .select({
      day: sql<string>`to_char(created_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`,
      tokens: tok,
      calls: sql<number>`count(*)::int`,
    })
    .from(llmUsage)
    .where(gte(llmUsage.createdAt, sql`now() - interval '14 days'`))
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  return {
    total: tot ?? { calls: 0, tokens: 0, ok: 0, fallbackCalls: 0, rate429: 0, localFallback: 0 },
    byProvider,
    byTag,
    byUser,
    byDay,
  };
}

export async function adminOverview() {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.telegramUsername,
      status: users.status,
      role: users.role,
      plan: users.plan,
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
