"""Limites de free tier por provedor + cálculo de "pressão" (quão perto do teto).

Os provedores que mandam headers `x-ratelimit-*` (Groq, OpenRouter, Cerebras) dão
o número exato; os que NÃO mandam (Gemini, às vezes Mistral) a gente estima a partir
do que foi gravado em `llm_usage` contra os limites abaixo.

Os números são APROXIMADOS e mudam sem aviso — confira na doc de cada provedor e
ajuste aqui. Chaves: rpm = requests/min, rpd = requests/dia, tpm = tokens/min,
tpd = tokens/dia. `None` = sem limite conhecido nessa janela.
"""
from __future__ import annotations

PROVIDER_LIMITS: dict[str, dict[str, int | None]] = {
    # https://ai.google.dev/gemini-api/docs/rate-limits  (free, gemini-2.5-flash)
    "gemini":     {"rpm": 10,  "rpd": 250,   "tpm": 250_000, "tpd": None},
    # https://console.groq.com/docs/rate-limits  (free varia MUITO por modelo)
    "groq":       {"rpm": 30,  "rpd": 1_000, "tpm": 15_000,  "tpd": 500_000},
    # https://inference-docs.cerebras.ai/support/rate-limits  (free)
    "cerebras":   {"rpm": 30,  "rpd": 14_400, "tpm": 60_000, "tpd": 1_000_000},
    # https://docs.sambanova.ai/cloud/docs/get-started/rate-limits  (free)
    "sambanova":  {"rpm": 20,  "rpd": None,  "tpm": None,    "tpd": None},
    # https://docs.mistral.ai/deployment/laplateforme/tier/  (free "Experiment")
    "mistral":    {"rpm": 60,  "rpd": None,  "tpm": 500_000, "tpd": 1_000_000_000},
    # https://docs.github.com/en/github-models  (free, low tier)
    "github":     {"rpm": 15,  "rpd": 150,   "tpm": 8_000,   "tpd": None},
    # https://openrouter.ai/docs/api-reference/limits  (free models: 50/dia sem crédito)
    "openrouter": {"rpm": 20,  "rpd": 50,    "tpm": None,    "tpd": None},
}

NEAR_LIMIT_PCT = 0.80  # a partir daqui grava evento llm:near_limit:<provider>


def pressure_pct(provider: str, m: dict) -> float:
    """Maior fração de uso conhecida do provedor (0.0 .. 1.0+).

    `m` traz (todos opcionais): rl_remaining_requests / rl_limit_requests /
    rl_remaining_tokens / rl_limit_tokens (headers), e req_day / tok_day /
    req_min / tok_min (contados de llm_usage).
    """
    pcts: list[float] = []

    # 1) headers — a fonte mais confiável quando existe
    lr, rr = m.get("rl_limit_requests"), m.get("rl_remaining_requests")
    if lr and lr > 0 and rr is not None:
        pcts.append(1 - rr / lr)
    lt, rt = m.get("rl_limit_tokens"), m.get("rl_remaining_tokens")
    if lt and lt > 0 and rt is not None:
        pcts.append(1 - rt / lt)

    # 2) estimativa a partir dos limites conhecidos
    lim = PROVIDER_LIMITS.get(provider, {})
    for key_lim, key_use in (("rpm", "req_min"), ("rpd", "req_day"),
                             ("tpm", "tok_min"), ("tpd", "tok_day")):
        cap = lim.get(key_lim)
        used = m.get(key_use)
        if cap and used is not None:
            pcts.append(used / cap)

    return max(pcts, default=0.0)


def worst_window(provider: str, m: dict) -> str:
    """Rótulo curto da janela que está mais apertada (pro dashboard/evento)."""
    lim = PROVIDER_LIMITS.get(provider, {})
    cand: list[tuple[float, str]] = []
    lr, rr = m.get("rl_limit_requests"), m.get("rl_remaining_requests")
    if lr and lr > 0 and rr is not None:
        cand.append((1 - rr / lr, "requests (header)"))
    lt, rt = m.get("rl_limit_tokens"), m.get("rl_remaining_tokens")
    if lt and lt > 0 and rt is not None:
        cand.append((1 - rt / lt, "tokens (header)"))
    for key_lim, key_use, label in (("rpm", "req_min", "requests/min"),
                                    ("rpd", "req_day", "requests/dia"),
                                    ("tpm", "tok_min", "tokens/min"),
                                    ("tpd", "tok_day", "tokens/dia")):
        cap, used = lim.get(key_lim), m.get(key_use)
        if cap and used is not None:
            cand.append((used / cap, label))
    return max(cand, default=(0.0, "—"))[1]
