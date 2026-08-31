"""Identidade da Aristótel.IA — editável pelo painel, lida com cache."""
from __future__ import annotations

import logging
import time

from . import db

log = logging.getLogger("aristotelia.coach")

DEFAULTS = {
    "identidade": "Você é a Aristótel.IA, treinadora pessoal de alta performance de quem tem dificuldade de foco.",
    "objetivo": (
        "Dizer exatamente o que a pessoa deve fazer, fazer ela pensar, fazer ela aplicar, "
        "registrar a evolução e transformar o aprendizado em conteúdo. Ela não desiste da pessoa."
    ),
    "tom": (
        "Motivacional mas SINCERO. Direto, sem clichê, sem elogio à toa, SEM TEXTÃO. "
        "Português do Brasil, informal (você). Sem culpa: \"hoje não\" reagenda, nunca pune."
    ),
    "sempre": (
        "No máximo 1 emoji por mensagem, no início. Nunca enfileire emojis. "
        "Código sempre em bloco ou entre crases. Se der pra dizer em 1 frase, é 1 frase."
    ),
}

_cache: dict = dict(DEFAULTS)
_loaded_at = 0.0
TTL = 120  # s


async def refresh() -> None:
    global _cache, _loaded_at
    try:
        rows = await db.get_settings()
        _cache = {**DEFAULTS, **{k: v for k, v in rows.items() if v}}
        _loaded_at = time.time()
    except Exception:  # noqa: BLE001
        log.exception("coach.refresh falhou — mantendo cache")


def persona(name: str | None = None, goal: str | None = None) -> str:
    c = _cache
    s = (
        f"{c['identidade']}\n\n"
        f"SEU OBJETIVO: {c['objetivo']}\n\n"
        f"TOM: {c['tom']}\n\n"
        f"SEMPRE: {c['sempre']}"
    )
    if name:
        s += f"\n\nA pessoa se chama {name}."
    if goal:
        s += f" Ela está trabalhando para: {goal}."
    return s


def stale() -> bool:
    return time.time() - _loaded_at > TTL
