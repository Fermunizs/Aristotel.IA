import { and, eq, gte, sql, desc } from "drizzle-orm";
import { db } from "./db";
import { contentIdeas, events, focusSessions, learningPlans, llmUsage, streaks, systemVitals, tasks, users } from "./schema";
import { llmChain } from "./coach-llm";
import { PROVIDER_LIMITS, pressurePct, pressureTone, type Pressure } from "./llm-limits";

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

// ── D1: pressão nas chaves de LLM (aviso de quase-limite) ────────────
export type LimiteProvider = {
  provider: string;
  model: string | null;
  inChain: boolean;
  reqDay: number;
  tokDay: number;
  reqMin: number;
  tokMin: number;
  peakRpm: number;
  peakTpm: number;
  limits: (typeof PROVIDER_LIMITS)[string] | null;
  snap: {
    remReq: number | null;
    limReq: number | null;
    remTok: number | null;
    limTok: number | null;
    resetSeconds: number | null;
    at: Date;
  } | null;
  pct: number;
  tone: "ok" | "amber" | "red";
  lastNearLimit: Date | null;
  cooldownLikely: boolean;
};

export async function llmLimites(): Promise<LimiteProvider[]> {
  const chain = llmChain();

  const rows = (await db.execute(sql`
    WITH lm AS (
      SELECT provider, count(*)::int AS c,
             coalesce(sum(prompt_tokens + completion_tokens), 0)::int AS tok
      FROM llm_usage WHERE created_at > now() - interval '60 seconds' GROUP BY provider
    ),
    day AS (
      SELECT provider, count(*)::int AS c,
             coalesce(sum(prompt_tokens + completion_tokens), 0)::int AS tok
      FROM llm_usage WHERE created_at > now() - interval '24 hours' GROUP BY provider
    ),
    permin AS (
      SELECT provider, date_trunc('minute', created_at) AS m,
             count(*) AS c, sum(prompt_tokens + completion_tokens) AS tok
      FROM llm_usage WHERE created_at > now() - interval '24 hours' GROUP BY provider, m
    ),
    peak AS (
      SELECT provider, max(c)::int AS peak_rpm, coalesce(max(tok), 0)::int AS peak_tpm
      FROM permin GROUP BY provider
    ),
    snap AS (
      SELECT DISTINCT ON (provider) provider,
        rl_remaining_requests, rl_limit_requests,
        rl_remaining_tokens::float8 AS rl_remaining_tokens,
        rl_limit_tokens::float8 AS rl_limit_tokens,
        rl_reset_seconds, created_at AS snap_at
      FROM llm_usage
      WHERE created_at > now() - interval '1 hour'
        AND (rl_remaining_requests IS NOT NULL OR rl_remaining_tokens IS NOT NULL)
      ORDER BY provider, created_at DESC
    ),
    cool AS (
      SELECT provider, max(created_at) AS last_429
      FROM llm_usage WHERE status = '429' AND created_at > now() - interval '5 minutes'
      GROUP BY provider
    )
    SELECT d.provider,
      d.c AS req_day, d.tok AS tok_day,
      coalesce(lm.c, 0) AS req_min, coalesce(lm.tok, 0) AS tok_min,
      coalesce(pk.peak_rpm, 0) AS peak_rpm, coalesce(pk.peak_tpm, 0) AS peak_tpm,
      s.rl_remaining_requests, s.rl_limit_requests,
      s.rl_remaining_tokens, s.rl_limit_tokens, s.rl_reset_seconds, s.snap_at,
      cool.last_429
    FROM day d
    LEFT JOIN lm ON lm.provider = d.provider
    LEFT JOIN peak pk ON pk.provider = d.provider
    LEFT JOIN snap s ON s.provider = d.provider
    LEFT JOIN cool ON cool.provider = d.provider
  `)) as unknown as Array<Record<string, unknown>>;

  const nearRows = (await db.execute(sql`
    SELECT kind, max(created_at) AS at FROM events
    WHERE kind LIKE 'llm:near_limit:%' AND created_at > now() - interval '60 days'
    GROUP BY kind
  `)) as unknown as Array<{ kind: string; at: string | Date }>;
  const near = new Map<string, Date>();
  for (const r of nearRows) near.set(r.kind.replace("llm:near_limit:", ""), new Date(r.at as string));

  const byProvider = new Map<string, Record<string, unknown>>();
  for (const r of rows) byProvider.set(String(r.provider), r);

  // ordem: a cadeia primeiro; depois qualquer provedor com tráfego fora dela (menos 'fallback')
  const names = [
    ...chain.map((c) => c.name),
    ...[...byProvider.keys()].filter(
      (n) => n !== "fallback" && !chain.some((c) => c.name === n),
    ),
  ];

  const num = (v: unknown): number | null =>
    v == null ? null : typeof v === "number" ? v : Number(v);

  return names.map((provider) => {
    const r = byProvider.get(provider) ?? {};
    const chainEntry = chain.find((c) => c.name === provider) ?? null;
    const limits = PROVIDER_LIMITS[provider] ?? null;

    const m: Pressure = {
      reqDay: num(r.req_day) ?? 0,
      tokDay: num(r.tok_day) ?? 0,
      reqMin: num(r.req_min) ?? 0,
      tokMin: num(r.tok_min) ?? 0,
      rlRemainingRequests: num(r.rl_remaining_requests),
      rlLimitRequests: num(r.rl_limit_requests),
      rlRemainingTokens: num(r.rl_remaining_tokens),
      rlLimitTokens: num(r.rl_limit_tokens),
    };
    const pct = pressurePct(provider, m);

    const snapAt = r.snap_at ? new Date(r.snap_at as string) : null;
    const resetSeconds = num(r.rl_reset_seconds);
    const last429 = r.last_429 ? new Date(r.last_429 as string) : null;
    const cooldownLikely =
      (!!last429 && Date.now() - last429.getTime() < 90_000) ||
      (!!snapAt &&
        m.rlLimitTokens != null &&
        m.rlRemainingTokens != null &&
        m.rlLimitTokens > 0 &&
        m.rlRemainingTokens / m.rlLimitTokens < 0.05 &&
        resetSeconds != null &&
        snapAt.getTime() + resetSeconds * 1000 > Date.now());

    return {
      provider,
      model: chainEntry?.model ?? null,
      inChain: !!chainEntry,
      reqDay: m.reqDay,
      tokDay: m.tokDay,
      reqMin: m.reqMin,
      tokMin: m.tokMin,
      peakRpm: num(r.peak_rpm) ?? 0,
      peakTpm: num(r.peak_tpm) ?? 0,
      limits,
      snap: snapAt
        ? {
            remReq: m.rlRemainingRequests,
            limReq: m.rlLimitRequests,
            remTok: m.rlRemainingTokens,
            limTok: m.rlLimitTokens,
            resetSeconds,
            at: snapAt,
          }
        : null,
      pct,
      tone: pressureTone(pct),
      lastNearLimit: near.get(provider) ?? null,
      cooldownLikely,
    };
  });
}

export async function serverVitals() {
  const [v] = await db.select().from(systemVitals).where(eq(systemVitals.id, 1)).limit(1);
  return v ?? null;
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

// ── Retenção (Backlog.md B06 · métricas de Produto.md §8) ─────────────
// "Dia engajado" = a pessoa fez algo (quiz, review, desafio, foco, jasei,
// skip, conversa livre) OU concluiu uma tarefa naquele dia. Mensagens que o
// bot MANDA (msg:guide, msg:micro…) não contam.
const ENG_SQL = sql`
  SELECT user_id, day FROM events
   WHERE kind IN ('quiz','quiz_reforco','review','desafio','foco','jasei','skip','msg:chat')
  UNION
  SELECT user_id, day FROM tasks WHERE status = 'done'`;

export type Retencao = Awaited<ReturnType<typeof retencao>>;

export async function retencao() {
  const [funnelRows, dnRows, dailyRows, quietRows] = await Promise.all([
    db.execute(sql`
      WITH eng AS (${ENG_SQL}),
           u AS (SELECT id, created_at::date AS signup, status FROM users WHERE telegram_chat_id IS NOT NULL)
      SELECT
        (SELECT count(*)::int FROM u) AS total,
        (SELECT count(*)::int FROM u WHERE status='active') AS active,
        (SELECT count(*)::int FROM u WHERE status='onboarding') AS onboarding,
        (SELECT count(DISTINCT user_id)::int FROM eng WHERE day >= current_date - 6) AS engaged_7d,
        (SELECT count(DISTINCT user_id)::int FROM eng WHERE day >= current_date - 1) AS engaged_2d,
        (SELECT count(*)::int FROM u JOIN learning_plans lp ON lp.user_id=u.id AND lp.active
           WHERE u.signup <= current_date - 7) AS w2_elig,
        (SELECT count(*)::int FROM u JOIN learning_plans lp ON lp.user_id=u.id AND lp.active
           WHERE u.signup <= current_date - 7 AND lp.current_week >= 2) AS w2_reached
    `) as unknown as Array<Record<string, number>>,

    db.execute(sql`
      WITH eng AS (${ENG_SQL}),
           u AS (SELECT id, created_at::date AS signup FROM users WHERE telegram_chat_id IS NOT NULL)
      SELECT
        count(*) FILTER (WHERE signup <= current_date - 1)::int  AS elig_d1,
        count(*) FILTER (WHERE signup <= current_date - 1  AND EXISTS
          (SELECT 1 FROM eng e WHERE e.user_id=u.id AND e.day >= u.signup + 1))::int  AS ret_d1,
        count(*) FILTER (WHERE signup <= current_date - 7)::int  AS elig_d7,
        count(*) FILTER (WHERE signup <= current_date - 7  AND EXISTS
          (SELECT 1 FROM eng e WHERE e.user_id=u.id AND e.day >= u.signup + 7))::int  AS ret_d7,
        count(*) FILTER (WHERE signup <= current_date - 30)::int AS elig_d30,
        count(*) FILTER (WHERE signup <= current_date - 30 AND EXISTS
          (SELECT 1 FROM eng e WHERE e.user_id=u.id AND e.day >= u.signup + 30))::int AS ret_d30
      FROM u
    `) as unknown as Array<Record<string, number>>,

    db.execute(sql`
      WITH eng AS (${ENG_SQL})
      SELECT d::date::text AS day,
        (SELECT count(DISTINCT user_id)::int FROM eng WHERE day = d::date) AS active,
        (SELECT count(DISTINCT user_id)::int FROM tasks WHERE day = d::date AND status='done') AS done
      FROM generate_series(current_date - 13, current_date, interval '1 day') d
      ORDER BY day
    `) as unknown as Array<{ day: string; active: number; done: number }>,

    db.execute(sql`
      WITH eng AS (${ENG_SQL})
      SELECT u.name, u.telegram_username AS username, u.created_at::date::text AS signup,
        (SELECT max(day)::text FROM eng WHERE user_id = u.id) AS last_eng
      FROM users u
      WHERE u.telegram_chat_id IS NOT NULL AND u.status='active'
        AND coalesce((SELECT max(day) FROM eng WHERE user_id = u.id), DATE '1970-01-01') < current_date - 2
      ORDER BY last_eng NULLS FIRST
      LIMIT 30
    `) as unknown as Array<{ name: string | null; username: string | null; signup: string; last_eng: string | null }>,
  ]);

  const f = funnelRows[0] ?? {};
  const dn = dnRows[0] ?? {};
  const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : null);

  return {
    funnel: {
      total: f.total ?? 0,
      active: f.active ?? 0,
      onboarding: f.onboarding ?? 0,
      engaged7d: f.engaged_7d ?? 0,
      engaged2d: f.engaged_2d ?? 0,
    },
    dn: [
      { label: "D1", elig: dn.elig_d1 ?? 0, ret: dn.ret_d1 ?? 0, pct: pct(dn.ret_d1 ?? 0, dn.elig_d1 ?? 0), good: 50, weak: 30 },
      { label: "D7", elig: dn.elig_d7 ?? 0, ret: dn.ret_d7 ?? 0, pct: pct(dn.ret_d7 ?? 0, dn.elig_d7 ?? 0), good: 50, weak: 30 },
      { label: "D30", elig: dn.elig_d30 ?? 0, ret: dn.ret_d30 ?? 0, pct: pct(dn.ret_d30 ?? 0, dn.elig_d30 ?? 0), good: 30, weak: 15 },
    ],
    trilhaW2: { elig: f.w2_elig ?? 0, reached: f.w2_reached ?? 0, pct: pct(f.w2_reached ?? 0, f.w2_elig ?? 0), good: 40, weak: 20 },
    daily: dailyRows.map((r) => ({ ...r, pct: pct(r.done, r.active) })),
    quiet: quietRows,
  };
}
