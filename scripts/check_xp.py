"""Asserções de bot/xp.py (gamificação — docs/.../2026-09-04-gamificacao-xp-niveis-design.md).
Roda com: python scripts/check_xp.py  (só stdlib — não toca banco nem LLM)."""
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import xp  # noqa: E402


def ev(kind, day, **payload):
    return {"kind": kind, "day": day, "payload": payload}


def test_curve_bounds():
    assert xp.xp_to_reach(1) == 0
    assert xp.xp_to_reach(2) == 100
    assert xp.xp_to_reach(3) == 300
    assert xp.xp_to_reach(5) == 1000
    assert xp.level_for_xp(0) == 1
    assert xp.level_for_xp(99) == 1
    assert xp.level_for_xp(100) == 2
    assert xp.level_for_xp(299) == 2
    assert xp.level_for_xp(300) == 3
    assert xp.level_for_xp(4500) == 10
    print("ok  curva de nível nas bordas")


def test_points_for():
    assert xp.points_for("quiz", {"resultado": "acerto"}) == 15
    assert xp.points_for("quiz", {"resultado": "erro"}) == 5
    assert xp.points_for("quiz", {}) == 5
    assert xp.points_for("quiz_reforco", {}) == 10
    assert xp.points_for("desafio", {}) == 30
    assert xp.points_for("review", {}) == 20
    assert xp.points_for("foco", {"minutos": 25}) == 25
    assert xp.points_for("foco", {"minutos": 50}) == 30  # teto
    assert xp.points_for("foco", {"minutos": "x"}) == 0
    assert xp.points_for("jasei", {}) == 0
    assert xp.points_for("msg:guide", {}) == 0
    assert xp.points_for("xp:levelup", {"level": 3}) == 0
    print("ok  points_for")


def test_daily_caps_and_engaged_bonus():
    d1, d2 = date(2026, 9, 1), date(2026, 9, 2)
    rows = [
        ev("quiz", d1, resultado="erro"),      # 5, mas...
        ev("quiz", d1, resultado="acerto"),    # ...vale 15 (maior do dia)
        ev("desafio", d1),                     # 30
        ev("review", d1),                      # 20
        ev("foco", d1, minutos=25),            # 25
        ev("foco", d1, minutos=25),            # 25
        ev("foco", d1, minutos=25),            # 3ª sessão NÃO conta (teto 2)
        ev("quiz", d2, resultado="acerto"),    # 15
    ]
    # d1: 15 + 30 + 20 + (25+25) = 115 ; d2: 15 ; dias engajados: 2 -> +20
    assert xp.xp_total(rows) == 115 + 15 + 20, xp.xp_total(rows)
    print("ok  tetos diários + bônus de dia engajado")


def test_empty():
    assert xp.xp_total([]) == 0
    print("ok  sem eventos -> 0 XP")


def test_stages():
    assert xp.stage_for_level(1) == "Começando"
    assert xp.stage_for_level(2) == "Começando"
    assert xp.stage_for_level(3) == "Na trilha"
    assert xp.stage_for_level(9) == "Consistente"
    assert xp.stage_for_level(25) == "Referência"
    assert xp.level_up_line(4) == "📈 Nível 4 — Na trilha. Você tá andando."
    print("ok  estágios + linha de level-up")


def test_sync_and_maybe_announce():
    import asyncio
    from datetime import date

    state = {"events": [], "logged": []}

    async def fake_events_all(uid):
        return list(state["events"])

    async def fake_log_event(uid, kind, day, payload=None):
        state["logged"].append({"kind": kind, "payload": payload or {}})
        state["events"].append({"kind": kind, "day": day, "payload": payload or {}})

    import types
    xp_db = types.SimpleNamespace(events_all=fake_events_all, log_event=fake_log_event)
    import bot
    sys.modules["bot.db"] = xp_db  # o import lazy `from . import db` pega este

    d = date(2026, 9, 1)
    # 0 XP -> nível 1, nunca anunciado -> sem linha (nível 1 não "sobe")
    assert asyncio.run(xp.sync_and_maybe_announce("u", d)) is None

    # empurra pra ~nível 3 (>= 300 XP): 10 desafios (300) + dias -> passa de 300
    state["events"] = [{"kind": "desafio", "day": date(2026, 8, i + 1), "payload": {}} for i in range(12)]
    line = asyncio.run(xp.sync_and_maybe_announce("u", d))
    assert line and "Nível" in line, line
    assert state["logged"] and state["logged"][-1]["kind"] == "xp:levelup"
    lvl = state["logged"][-1]["payload"]["level"]

    # chamar de novo sem novos eventos -> não reanuncia
    assert asyncio.run(xp.sync_and_maybe_announce("u", d)) is None
    print(f"ok  sync_and_maybe_announce (anunciou nível {lvl} uma vez só)")


if __name__ == "__main__":
    for fn in [test_curve_bounds, test_points_for, test_daily_caps_and_engaged_bonus,
               test_empty, test_stages, test_sync_and_maybe_announce]:
        fn()
    print("\nTODOS OS CHECKS DE XP PASSARAM")
