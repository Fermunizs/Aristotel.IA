import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { learningPlans, preferences } from "./schema";
import { groqJson } from "./coach-llm";

export type ChecklistItem = { t: string; min: number; done: boolean };
export type DayDetail = {
  resumo: string;
  checklist: ChecklistItem[];
  entrega: string;
  dica: string;
};

type Day = { d: number; topic: string; goal: string; detail?: DayDetail };
type Week = { n: number; theme: string; days: Day[] };

const SYSTEM =
  "Você é a Aristótel.IA, treinadora de alta performance. Monta o passo a passo de UM dia de estudo. " +
  "Seja concreto e específico do tópico — nada de 'leia sobre o assunto' ou 'faça exercícios'. " +
  "Cada passo é uma ação verificável (abrir tal coisa, escrever tal função, desenhar tal diagrama, testar tal caso). " +
  "Sem clichê, sem encher linguiça, português do Brasil.";

function prompt(goal: string, level: string, theme: string, day: Day, minutes: number) {
  return (
    `Objetivo geral da pessoa: ${goal}\n` +
    `Nível: ${level}\n` +
    `Semana (tema): ${theme}\n` +
    `Tópico do dia: ${day.topic}\n` +
    `Meta do dia: ${day.goal || "(sem meta escrita — deduza do tópico)"}\n` +
    `Tempo disponível: ${minutes} min\n\n` +
    `Devolva JSON:\n` +
    `{\n` +
    `  "resumo": "2-3 frases: o que a pessoa vai fazer hoje e por que isso importa pro objetivo",\n` +
    `  "checklist": [ { "t": "passo específico e acionável", "min": 15 }, ... 4 a 7 passos, a soma dos min ≈ ${minutes} ],\n` +
    `  "entrega": "o artefato concreto que deve existir no fim (arquivo, anotação, diagrama, commit...)",\n` +
    `  "dica": "uma armadilha comum nesse tópico ou um atalho que poupa tempo"\n` +
    `}`
  );
}

function normalize(raw: unknown, minutes: number): DayDetail {
  const o = (raw ?? {}) as Record<string, unknown>;
  const list = Array.isArray(o.checklist) ? o.checklist : [];
  const checklist: ChecklistItem[] = list.slice(0, 8).map((it) => {
    const x = (it ?? {}) as Record<string, unknown>;
    return {
      t: String(x.t ?? x.texto ?? x.passo ?? "").trim(),
      min: Math.max(1, Math.round(Number(x.min ?? x.minutos ?? minutes / list.length) || 10)),
      done: false,
    };
  }).filter((c) => c.t);
  return {
    resumo: String(o.resumo ?? "").trim(),
    checklist,
    entrega: String(o.entrega ?? "").trim(),
    dica: String(o.dica ?? "").trim(),
  };
}

async function loadPlan(userId: string) {
  const [plan] = await db
    .select()
    .from(learningPlans)
    .where(and(eq(learningPlans.userId, userId), eq(learningPlans.active, true)))
    .limit(1);
  return plan ?? null;
}

/** Retorna o detalhamento do dia; gera e cacheia no JSON do plano na 1ª vez. */
export async function getOrMakeDetail(userId: string, week: number, day: number): Promise<DayDetail | null> {
  const plan = await loadPlan(userId);
  if (!plan) return null;
  const weeks = plan.weeks as Week[];
  const w = weeks.find((x) => x.n === week);
  const d = w?.days.find((x) => x.d === day);
  if (!w || !d) return null;
  if (d.detail && d.detail.checklist?.length) return d.detail;

  const [pref] = await db.select().from(preferences).where(eq(preferences.userId, userId)).limit(1);
  const minutes = pref?.minutesPerDay ?? 30;

  const raw = await groqJson<unknown>(
    SYSTEM,
    prompt(plan.goal, plan.level, w.theme, d, minutes),
    1400,
    { userId, tag: "trilha-detalhe" },
  );
  const detail = normalize(raw, minutes);
  if (!detail.checklist.length) return null;

  d.detail = detail;
  await db.update(learningPlans).set({ weeks }).where(eq(learningPlans.id, plan.id));
  return detail;
}

/** Marca/desmarca um item do checklist do dia. */
export async function toggleChecklistItem(
  userId: string,
  week: number,
  day: number,
  index: number,
  done: boolean,
): Promise<DayDetail | null> {
  const plan = await loadPlan(userId);
  if (!plan) return null;
  const weeks = plan.weeks as Week[];
  const d = weeks.find((x) => x.n === week)?.days.find((x) => x.d === day);
  if (!d?.detail?.checklist?.[index]) return null;
  d.detail.checklist[index].done = done;
  await db.update(learningPlans).set({ weeks }).where(eq(learningPlans.id, plan.id));
  return d.detail;
}
