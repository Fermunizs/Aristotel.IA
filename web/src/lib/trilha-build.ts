// Porta de bot/onboarding.py::build_trilha pra o onboarding no painel.
// MANTER EM SINCRONIA com bot/onboarding.py e bot/prompts.py (TRILHA_PLANO/TRILHA_SEMANA).
import { buildPersona } from "./persona";
import { groqJson } from "./coach-llm";

const TRILHA_PLANO =
  "Planeje uma trilha de 4 semanas para o objetivo/nível/tempo da pessoa. " +
  "Progressão real: fundamentos → aplicação. " +
  'Retorne SOMENTE JSON: {"themes":["tema semana 1","tema semana 2","tema semana 3","tema semana 4"]} ' +
  "— cada tema com até 6 palavras.";

const TRILHA_SEMANA =
  "Detalhe UMA semana de uma trilha de aprendizagem. Você recebe: objetivo, nível, minutos/dia, " +
  "o número e o tema desta semana, e os temas de todas as 4 semanas (pra manter a progressão). " +
  "5 dias. Cada dia = tópico ESPECÍFICO (até 10 palavras) + ação concreta cabível no tempo (até 12 palavras). " +
  "Nada genérico. Retorne SOMENTE JSON: " +
  '{"n":N,"theme":"...","days":[{"d":1,"topic":"...","goal":"..."}, ...5 dias]}';

type Day = { d: number; topic: string; goal: string };
export type Week = { n: number; theme: string; days: Day[] };
type Meta = { userId: string; tag: string };

function stubWeek(n: number, theme: string): Week {
  const t = (theme || `Semana ${n}`).slice(0, 80);
  return { n, theme: t, days: [1, 2, 3, 4, 5].map((i) => ({ d: i, topic: `${t} — parte ${i}`, goal: "" })) };
}

async function genWeek(persona: string, base: string, themes: string[], n: number, meta: Meta): Promise<Week | null> {
  const payload =
    `${base}\nTemas das 4 semanas: ${JSON.stringify(themes)}\n` +
    `Detalhe a semana ${n}, tema: ${themes[n - 1]}`;
  try {
    const wk = await groqJson<{ theme?: string; days?: { topic: string; goal?: string }[] }>(
      persona + "\n\n" + TRILHA_SEMANA,
      payload,
      2500,
      meta,
    );
    const days = wk?.days;
    if (!Array.isArray(days) || days.length < 3) return null;
    return {
      n,
      theme: String(wk.theme || themes[n - 1]).slice(0, 80),
      days: days.slice(0, 5).map((d, i) => ({ d: i + 1, topic: String(d.topic), goal: String(d.goal ?? "") })),
    };
  } catch {
    return null;
  }
}

/** null só se NENHUMA semana saiu (LLM totalmente fora). Semana isolada que falha vira stub. */
export async function buildTrilha(
  name: string,
  goal: string,
  level: string,
  minutes: number,
  userId: string,
): Promise<Week[] | null> {
  const persona = await buildPersona({ name });
  const base = `Objetivo: ${goal}\nNível: ${level}\nMinutos por dia: ${minutes}`;
  const meta: Meta = { userId, tag: "trilha" };

  let themes: string[] = [];
  try {
    const plano = await groqJson<{ themes?: string[] }>(persona + "\n\n" + TRILHA_PLANO, base, 1200, meta);
    if (Array.isArray(plano?.themes)) themes = plano.themes.map(String);
  } catch {
    /* usa fallback abaixo */
  }
  if (themes.length < 4) themes = ["Semana 1", "Semana 2", "Semana 3", "Semana 4"];

  const weeks: Week[] = [];
  let real = 0;
  for (let n = 1; n <= 4; n++) {
    let wk = await genWeek(persona, base, themes, n, meta);
    if (!wk) wk = stubWeek(n, themes[n - 1]);
    else real++;
    weeks.push(wk);
  }
  return real ? weeks : null;
}
