"""XP e níveis — derivados da tabela events, sem storage.
Ver docs/superpowers/specs/2026-09-04-gamificacao-xp-niveis-design.md
MANTER `web/src/lib/xp.ts` EM SINCRONIA (mapa, tetos, curva, estágios)."""
from __future__ import annotations

from typing import Iterable, Mapping

# ── mapa evento → pontos ─────────────────────────────────────────────
POINTS: dict[str, int] = {"quiz_reforco": 10, "desafio": 30, "review": 20}
FOCO_CAP_MIN = 30            # 1 XP/min de foco, teto por sessão
FOCO_CAP_SESSIONS = 2        # nº de sessões de foco que contam por dia
DAILY_CAP_1 = {"quiz", "quiz_reforco", "desafio", "review"}  # 1 por dia (vale a maior)
ENGAGED_KINDS = {"quiz", "quiz_reforco", "review", "desafio", "foco"}
ENGAGED_DAY_XP = 10         # bônus por dia distinto com constância

# ── estágios (nível mínimo → título) ─────────────────────────────────
STAGES: list[tuple[int, str]] = [
    (1, "Começando"), (3, "Na trilha"), (5, "Em ritmo"), (7, "Consistente"),
    (10, "Aprofundando"), (13, "Praticante"), (16, "Dominando"), (20, "Referência"),
]
STAGE_LINES: dict[str, str] = {
    "Começando": "Começou.",
    "Na trilha": "Você tá andando.",
    "Em ritmo": "O ritmo pegou.",
    "Consistente": "Isso já é constância.",
    "Aprofundando": "Tá ficando sério.",
    "Praticante": "Você faz, não só estuda.",
    "Dominando": "Pouca gente chega aqui.",
    "Referência": "Agora é você que serve de exemplo.",
}


def points_for(kind: str, payload: dict | None) -> int:
    p = payload or {}
    if kind == "quiz":
        return 15 if p.get("resultado") == "acerto" else 5
    if kind == "foco":
        try:
            return min(int(p.get("minutos", 0) or 0), FOCO_CAP_MIN)
        except (TypeError, ValueError):
            return 0
    return POINTS.get(kind, 0)


def xp_total(rows: Iterable[Mapping]) -> int:
    by_day_kind: dict[tuple, list[int]] = {}
    engaged_days: set = set()
    for r in rows:
        kind = r["kind"]
        payload = r["payload"] if isinstance(r["payload"], dict) else {}
        day = r["day"]
        if kind in ENGAGED_KINDS:
            engaged_days.add(day)
        pts = points_for(kind, payload)
        if pts:
            by_day_kind.setdefault((day, kind), []).append(pts)
    total = 0
    for (_day, kind), lst in by_day_kind.items():
        if kind == "foco":
            total += sum(sorted(lst, reverse=True)[:FOCO_CAP_SESSIONS])
        elif kind in DAILY_CAP_1:
            total += max(lst)
        else:
            total += sum(lst)
    return total + ENGAGED_DAY_XP * len(engaged_days)


def xp_to_reach(level: int) -> int:
    return 50 * (level - 1) * level


def level_for_xp(xp: int) -> int:
    lvl = 1
    while xp_to_reach(lvl + 1) <= xp:
        lvl += 1
    return lvl


def stage_for_level(level: int) -> str:
    name = STAGES[0][1]
    for min_lvl, n in STAGES:
        if level >= min_lvl:
            name = n
    return name


def stage_line(level: int) -> str:
    return STAGE_LINES[stage_for_level(level)]


def level_up_line(level: int) -> str:
    return f"📈 Nível {level} — {stage_for_level(level)}. {stage_line(level)}"
