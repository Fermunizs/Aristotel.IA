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


if __name__ == "__main__":
    for fn in [test_curve_bounds, test_points_for, test_daily_caps_and_engaged_bonus,
               test_empty, test_stages]:
        fn()
    print("\nTODOS OS CHECKS DE XP PASSARAM")
