"""Funções de domingo. Agendadas todo dia — checam o weekday() aqui dentro."""
from __future__ import annotations

import asyncio
import logging

from telegram.ext import ContextTypes

from . import config, llm, prompts, storage
from .jobs import _send, _sys

log = logging.getLogger("aristotelia.weekly")


def _is_sunday() -> bool:
    return storage.now().weekday() == config.SUNDAY


def _week_entries(days: int = 7) -> list[dict]:
    from datetime import timedelta

    limit = (storage.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    return [e for e in storage.load("daily_log").get("entries", []) if e.get("date", "") >= limit]


async def weekly_review(context: ContextTypes.DEFAULT_TYPE, *, force: bool = False) -> None:
    if not force and not _is_sunday():
        return
    entries = _week_entries()
    if not entries:
        await _send(context, "📊 *SUA SEMANA*\n\nSem registros essa semana. Semana que vem começa o placar.")
        return
    resumo = "\n".join(
        f"- {e['date']} [{e['kind']}] {e.get('topic', '')} {e.get('result', '')}".rstrip() for e in entries
    )
    texto = await asyncio.to_thread(
        llm.generate, _sys(prompts.WEEKLY_REVIEW), f"Registros:\n{resumo}", temperature=0.7, max_tokens=400
    )
    await _send(context, texto)


async def content_planner(context: ContextTypes.DEFAULT_TYPE, *, force: bool = False) -> None:
    if not force and not _is_sunday():
        return
    plan = storage.load("learning_plan")
    bank = storage.load("content_bank")
    tops = prompts.recent_topics(plan, storage.load("daily_log"), n=8)
    ideias = "; ".join(i.get("tema", "") for i in bank.get("ideas", [])) or "nenhuma ainda"
    user = f"Tópicos da semana: {tops}\nIdeias salvas no banco: {ideias}"
    texto = await asyncio.to_thread(
        llm.generate, _sys(prompts.CONTENT_PLANNER), user, temperature=0.9, max_tokens=350
    )
    await _send(context, texto)


async def advance_week(context: ContextTypes.DEFAULT_TYPE, *, force: bool = False) -> None:
    if not force and not _is_sunday():
        return
    plan = storage.load("learning_plan")
    cur = plan.setdefault("current", {"week": 1, "day": 1})
    max_week = max((w["n"] for w in plan.get("weeks", [])), default=cur["week"])
    if cur["week"] < max_week:
        cur["week"] += 1
        cur["day"] = 1
        storage.save("learning_plan", plan)
        log.info("Trilha avançou para a semana %s", cur["week"])
    else:
        await _send(
            context,
            "🗺️ Você chegou ao fim da trilha atual. Me manda `/plano` e a gente monta as próximas semanas.",
        )


WEEKLY_JOBS = {
    "weekly_review": weekly_review,
    "content_planner": content_planner,
    "advance_week": advance_week,
}
