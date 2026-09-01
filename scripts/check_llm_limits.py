"""Asserções do cálculo de pressão de rate-limit (bot/llm_limits.py).

Roda com: ./.venv/Scripts/python.exe scripts/check_llm_limits.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import llm_limits as L  # noqa: E402


def approx(a, b, tol=1e-6):
    assert abs(a - b) < tol, f"{a} != {b}"


# 1) header exato ganha da estimativa
m = {"rl_limit_requests": 100, "rl_remaining_requests": 10,  # 90% usado
     "req_day": 1, "req_min": 0, "tok_day": 0, "tok_min": 0}
approx(L.pressure_pct("groq", m), 0.9)
assert L.worst_window("groq", m) == "requests (header)"

# 2) sem header -> estima por rpd conhecido (gemini rpd=250)
m = {"req_day": 200, "req_min": 0, "tok_day": 0, "tok_min": 0}
approx(L.pressure_pct("gemini", m), 200 / 250)
assert "dia" in L.worst_window("gemini", m)

# 3) pega a MAIOR das janelas (tpm de gemini=250k)
m = {"req_day": 10, "req_min": 2, "tok_day": 0, "tok_min": 240_000}
approx(L.pressure_pct("gemini", m), 240_000 / 250_000)

# 4) provedor desconhecido e sem header -> 0
approx(L.pressure_pct("desconhecido", {"req_day": 999, "req_min": 9,
                                       "tok_day": 0, "tok_min": 0}), 0.0)

# 5) limite None (sambanova rpd) não explode
m = {"req_day": 5000, "req_min": 1, "tok_day": 0, "tok_min": 0}
approx(L.pressure_pct("sambanova", m), 1 / 20)  # só rpm=20 conta

# 6) header de tokens: 5% restante -> 95%
m = {"rl_limit_tokens": 1000, "rl_remaining_tokens": 50,
     "req_day": 0, "req_min": 0, "tok_day": 0, "tok_min": 0}
approx(L.pressure_pct("groq", m), 0.95)

# 7) threshold
assert L.NEAR_LIMIT_PCT == 0.8

print("check_llm_limits: OK")
