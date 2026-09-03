// Porta de bot/onboarding.py::build_trilha pra o onboarding no painel.
// MANTER EM SINCRONIA com bot/onboarding.py e bot/prompts.py (TRILHA_PLANO/TRILHA_SEMANA).
import { buildPersona } from "./persona";
import { groqJson } from "./coach-llm";

const TRILHA_PLANO =
  "Você é consultora montando a trilha de 4 semanas de UMA pessoa específica. " +
  "Recebe: objetivo, nível, minutos/dia, o contexto que ela deu (uso prático, o que já conhece, " +
  "o resultado que quer) e qualquer material de referência que ela colou. " +
  "Progressão do concreto pro avançado — nunca 'fundamentos genéricos'. " +
  "Se ela citou uma ferramenta/produto, os temas são sobre USAR essa ferramenta pra chegar no " +
  "resultado dela, não teoria ao redor. " +
  "Cada tema: específico, com o nome real do que vai ser feito " +
  "(ex.: 'Primeiro clipe com image-to-video e controle de câmera', não 'Introdução a vídeo com IA'). " +
  "Até 9 palavras. " +
  'Retorne SOMENTE JSON: {"themes":["...","...","...","..."]}';

const TRILHA_SEMANA =
  "Detalhe UMA semana da trilha desta pessoa. Você recebe: objetivo, nível, minutos/dia, o contexto " +
  "que ela deu, o material de referência, o número e o tema desta semana e os temas das 4 semanas. " +
  "5 dias. Cada dia:\n" +
  "- topic: o que ela vai fazer nesse dia, ESPECÍFICO — nome real de recurso, tela, parâmetro ou " +
  "técnica (até 14 palavras). Proibido genérico: 'introdução a X', 'entender os fundamentos', " +
  "'explorar a interface', 'pesquisar sobre'.\n" +
  "- goal: a ação concreta que cabe nos minutos/dia + o resultado esperado (até 22 palavras).\n" +
  "Se a pessoa citou uma ferramenta específica, TODO dia é mão na ferramenta produzindo algo — " +
  "nunca teoria solta. Seja fiel ao que a ferramenta realmente faz (use o material de referência). " +
  "Retorne SOMENTE JSON: " +
  '{"n":N,"theme":"...","days":[{"d":1,"topic":"...","goal":"..."}, ...5 dias]}';

type Day = { d: number; topic: string; goal: string };
export type Week = { n: number; theme: string; days: Day[] };
type Meta = { userId: string; tag: string };

function stubWeek(n: number, theme: string): Week {
  const t = (theme || `Semana ${n}`).slice(0, 80);
  return { n, theme: t, days: [1, 2, 3, 4, 5].map((i) => ({ d: i, topic: `${t} — parte ${i}`, goal: "" })) };
}

async function genWeekOnce(persona: string, payload: string, n: number, themes: string[], tokens: number, meta: Meta): Promise<Week | null> {
  try {
    const wk = await groqJson<{ theme?: string; days?: { topic: string; goal?: string }[] }>(
      persona + "\n\n" + TRILHA_SEMANA,
      payload,
      tokens,
      meta,
    );
    const days = wk?.days;
    if (!Array.isArray(days) || days.length < 2) return null;
    const theme = String(wk.theme || themes[n - 1]).slice(0, 80);
    const out = days.slice(0, 5).map((d, i) => ({
      d: i + 1,
      topic: String(d.topic || `${theme} — parte ${i + 1}`),
      goal: String(d.goal ?? ""),
    }));
    while (out.length < 5) out.push({ d: out.length + 1, topic: `${theme} — continuação ${out.length + 1}`, goal: "" });
    return { n, theme, days: out };
  } catch {
    return null;
  }
}

async function genWeek(persona: string, base: string, themes: string[], n: number, meta: Meta): Promise<Week | null> {
  const payload =
    `${base}\nTemas das 4 semanas: ${JSON.stringify(themes)}\n` +
    `Detalhe a semana ${n}, tema: ${themes[n - 1]}`;
  // 1 retry com mais tokens antes de desistir — espelha bot/llm.py::generate_json
  return (
    (await genWeekOnce(persona, payload, n, themes, 3500, meta)) ||
    (await genWeekOnce(persona, payload, n, themes, 4500, meta))
  );
}

/** null só se NENHUMA semana saiu (LLM totalmente fora). Semana isolada que falha vira stub. */
export async function buildTrilha(
  name: string,
  goal: string,
  level: string,
  minutes: number,
  userId: string,
  context = "",
  refs = "",
): Promise<Week[] | null> {
  const persona = await buildPersona({ name });
  let base = `Objetivo: ${goal}\nNível: ${level}\nMinutos por dia: ${minutes}`;
  if (context.trim()) base += `\nContexto da pessoa: ${context.trim().slice(0, 800)}`;
  if (refs.trim()) base += `\nMaterial de referência que ela colou: ${refs.trim().slice(0, 800)}`;
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
