"""Asserções da resiliência do onboarding (bot/onboarding.py — Backlog.md B05).

Roda com: ./.venv/Scripts/python.exe scripts/check_onboarding.py
Não toca no banco nem no LLM real — stub de ask_json controla o que "o LLM"
devolve e a gente confere que build_trilha degrada em vez de perder a trilha.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import onboarding as O  # noqa: E402

GOOD_WEEK = {"theme": "Tema X", "days": [{"topic": f"t{i}", "goal": "g"} for i in range(5)]}
THEMES = {"themes": ["A", "B", "C", "D"]}


def stub(seq):
    """seq: lista de valores a devolver em sequência (por chamada de ask_json)."""
    calls = iter(seq)

    async def _fake(system, user, **kw):
        try:
            return next(calls)
        except StopIteration:
            return None

    O.ask_json = _fake


def run(coro):
    return asyncio.run(coro)


def test_all_weeks_ok():
    stub([THEMES, GOOD_WEEK, GOOD_WEEK, GOOD_WEEK, GOOD_WEEK])
    weeks = run(O.build_trilha("F", "aprender vendas", "do zero", 30))
    assert weeks is not None and len(weeks) == 4, weeks
    assert all(len(w["days"]) == 5 for w in weeks), weeks
    print("ok  4 semanas geradas normalmente")


def test_one_week_fails_gets_stub():
    stub([THEMES, GOOD_WEEK, None, GOOD_WEEK, GOOD_WEEK])  # semana 2 falha
    weeks = run(O.build_trilha("F", "x", "do zero", 30))
    assert weeks is not None and len(weeks) == 4, weeks
    wk2 = weeks[1]
    assert wk2["days"][0]["topic"].endswith("parte 1"), wk2  # é o stub
    assert wk2["theme"] == "B", wk2
    print("ok  semana que falha vira stub do tema (trilha inteira preservada)")


def test_themes_call_fails():
    stub([None, GOOD_WEEK, GOOD_WEEK, GOOD_WEEK, GOOD_WEEK])  # sem temas
    weeks = run(O.build_trilha("F", "x", "do zero", 30))
    assert weeks is not None and len(weeks) == 4, weeks
    print("ok  falha na chamada de temas -> usa 'Semana N' e segue")


def test_total_failure_returns_none():
    stub([None, None, None, None, None])
    weeks = run(O.build_trilha("F", "x", "do zero", 30))
    assert weeks is None, weeks
    print("ok  LLM totalmente fora -> None (chamador agenda retry)")


def test_stub_week_shape():
    wk = O._stub_week(3, "Fechamento de vendas")
    assert wk["n"] == 3 and len(wk["days"]) == 5
    assert all(d["d"] == i + 1 for i, d in enumerate(wk["days"]))
    print("ok  _stub_week bem formada")


if __name__ == "__main__":
    for fn in [test_all_weeks_ok, test_one_week_fails_gets_stub, test_themes_call_fails,
               test_total_failure_returns_none, test_stub_week_shape]:
        fn()
    print("\nTODOS OS CHECKS DO ONBOARDING PASSARAM")
