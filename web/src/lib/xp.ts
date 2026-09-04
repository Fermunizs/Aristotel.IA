// Espelho de bot/xp.py — mapa evento→XP, tetos, curva, estágios.
// MANTER EM SINCRONIA com bot/xp.py.
import { and, eq, gte } from "drizzle-orm";
import { db } from "./db";
import { events } from "./schema";

export const POINTS: Record<string, number> = { quiz_reforco: 10, desafio: 30, review: 20 };
export const FOCO_CAP_MIN = 30;
const FOCO_CAP_SESSIONS = 2;
const DAILY_CAP_1 = new Set(["quiz", "quiz_reforco", "desafio", "review"]);
const ENGAGED_KINDS = new Set(["quiz", "quiz_reforco", "review", "desafio", "foco"]);
const ENGAGED_DAY_XP = 10;

const STAGES: [number, string][] = [
  [1, "Começando"], [3, "Na trilha"], [5, "Em ritmo"], [7, "Consistente"],
  [10, "Aprofundando"], [13, "Praticante"], [16, "Dominando"], [20, "Referência"],
];

type Row = { kind: string; payload: unknown; day: string };

export function pointsFor(kind: string, payload: unknown): number {
  const p = (payload ?? {}) as Record<string, unknown>;
  if (kind === "quiz") return p.resultado === "acerto" ? 15 : 5;
  if (kind === "foco") {
    const m = Number(p.minutos ?? 0);
    return Number.isFinite(m) && m > 0 ? Math.min(m, FOCO_CAP_MIN) : 0;
  }
  return POINTS[kind] ?? 0;
}

/** Soma o XP das linhas dadas aplicando os tetos diários por (day, kind).
 *  `withEngagedBonus`: adiciona +10 por dia distinto com evento em ENGAGED_KINDS. */
function sumWithCaps(rows: Row[], withEngagedBonus: boolean): number {
  const byDayKind = new Map<string, number[]>();
  const engagedDays = new Set<string>();
  for (const r of rows) {
    if (withEngagedBonus && ENGAGED_KINDS.has(r.kind)) engagedDays.add(r.day);
    const pts = pointsFor(r.kind, r.payload);
    if (!pts) continue;
    const key = `${r.day}|${r.kind}`;
    const arr = byDayKind.get(key);
    if (arr) arr.push(pts);
    else byDayKind.set(key, [pts]);
  }
  let total = 0;
  for (const [key, lst] of byDayKind) {
    const kind = key.split("|")[1];
    if (kind === "foco") {
      total += [...lst].sort((a, b) => b - a).slice(0, FOCO_CAP_SESSIONS).reduce((a, b) => a + b, 0);
    } else if (DAILY_CAP_1.has(kind)) {
      total += Math.max(...lst);
    } else {
      total += lst.reduce((a, b) => a + b, 0);
    }
  }
  return total + (withEngagedBonus ? ENGAGED_DAY_XP * engagedDays.size : 0);
}

export function xpTotal(rows: Row[]): number {
  return sumWithCaps(rows, true);
}

export function xpToReach(level: number): number {
  return 50 * (level - 1) * level;
}

export function levelForXp(xp: number): number {
  let lvl = 1;
  while (xpToReach(lvl + 1) <= xp) lvl++;
  return lvl;
}

export function stageForLevel(level: number): string {
  let name = STAGES[0][1];
  for (const [min, n] of STAGES) if (level >= min) name = n;
  return name;
}

const daysAgoISO = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
};

export type Progress = {
  xp: number; level: number; stage: string;
  xpInLevel: number; xpForLevel: number; xpToNext: number;
  bySource: { quiz: number; desafio: number; foco: number; constancia: number };
};

export async function computeProgress(userId: string): Promise<Progress> {
  const rows = (await db
    .select({ kind: events.kind, payload: events.payload, day: events.day })
    .from(events)
    .where(eq(events.userId, userId))) as unknown as Row[];

  const xp = xpTotal(rows);
  const level = levelForXp(xp);
  const base = xpToReach(level);
  const next = xpToReach(level + 1);

  const weekAgo = daysAgoISO(6);
  const wk = rows.filter((r) => r.day >= weekAgo);
  const bucket = (kinds: string[]) =>
    sumWithCaps(wk.filter((r) => kinds.includes(r.kind)), false);
  const engagedWeek = new Set(
    wk.filter((r) => ENGAGED_KINDS.has(r.kind)).map((r) => r.day),
  ).size;

  return {
    xp,
    level,
    stage: stageForLevel(level),
    xpInLevel: xp - base,
    xpForLevel: next - base,
    xpToNext: next - xp,
    bySource: {
      quiz: bucket(["quiz", "quiz_reforco"]),
      desafio: bucket(["desafio"]),
      foco: bucket(["foco"]),
      constancia: ENGAGED_DAY_XP * engagedWeek,
    },
  };
}
