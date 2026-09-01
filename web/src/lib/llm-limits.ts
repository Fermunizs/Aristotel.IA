// Espelho de bot/llm_limits.py — limites de free tier por provedor + cálculo de
// "pressão" (quão perto do teto). Mantenha os dois arquivos em sincronia.
//
// Números APROXIMADOS e mudam sem aviso — confira na doc de cada provedor e ajuste.
// rpm = requests/min · rpd = requests/dia · tpm = tokens/min · tpd = tokens/dia.
// null = sem limite conhecido nessa janela.

export type Limits = { rpm: number | null; rpd: number | null; tpm: number | null; tpd: number | null };

export const PROVIDER_LIMITS: Record<string, Limits> = {
  // https://ai.google.dev/gemini-api/docs/rate-limits  (free, gemini-2.5-flash)
  gemini: { rpm: 10, rpd: 250, tpm: 250_000, tpd: null },
  // https://console.groq.com/docs/rate-limits  (free varia MUITO por modelo)
  groq: { rpm: 30, rpd: 1_000, tpm: 15_000, tpd: 500_000 },
  // https://inference-docs.cerebras.ai/support/rate-limits  (free)
  cerebras: { rpm: 30, rpd: 14_400, tpm: 60_000, tpd: 1_000_000 },
  // https://docs.sambanova.ai/cloud/docs/get-started/rate-limits  (free)
  sambanova: { rpm: 20, rpd: null, tpm: null, tpd: null },
  // https://docs.mistral.ai/deployment/laplateforme/tier/  (free "Experiment")
  mistral: { rpm: 60, rpd: null, tpm: 500_000, tpd: 1_000_000_000 },
  // https://docs.github.com/en/github-models  (free, low tier)
  github: { rpm: 15, rpd: 150, tpm: 8_000, tpd: null },
  // https://openrouter.ai/docs/api-reference/limits  (free: 50/dia sem crédito)
  openrouter: { rpm: 20, rpd: 50, tpm: null, tpd: null },
};

export const NEAR_LIMIT_PCT = 0.8;

export type Pressure = {
  reqDay: number;
  tokDay: number;
  reqMin: number;
  tokMin: number;
  rlRemainingRequests: number | null;
  rlLimitRequests: number | null;
  rlRemainingTokens: number | null;
  rlLimitTokens: number | null;
};

/** Maior fração de uso conhecida do provedor (0..1+). */
export function pressurePct(provider: string, m: Pressure): number {
  const pcts: number[] = [];

  if (m.rlLimitRequests && m.rlLimitRequests > 0 && m.rlRemainingRequests != null) {
    pcts.push(1 - m.rlRemainingRequests / m.rlLimitRequests);
  }
  if (m.rlLimitTokens && m.rlLimitTokens > 0 && m.rlRemainingTokens != null) {
    pcts.push(1 - m.rlRemainingTokens / m.rlLimitTokens);
  }

  const lim = PROVIDER_LIMITS[provider];
  if (lim) {
    const pairs: [number | null, number][] = [
      [lim.rpm, m.reqMin],
      [lim.rpd, m.reqDay],
      [lim.tpm, m.tokMin],
      [lim.tpd, m.tokDay],
    ];
    for (const [cap, used] of pairs) if (cap && cap > 0) pcts.push(used / cap);
  }

  return pcts.length ? Math.max(...pcts) : 0;
}

/** cor/tom pro dashboard: âmbar > 70%, vermelho > 90%. */
export function pressureTone(pct: number): "ok" | "amber" | "red" {
  if (pct >= 0.9) return "red";
  if (pct >= 0.7) return "amber";
  return "ok";
}
