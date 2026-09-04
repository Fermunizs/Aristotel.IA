"""Funções de domingo — por usuário. Checam weekday() no fuso do usuário."""
from __future__ import annotations

import logging
from datetime import timedelta

from telegram.ext import ContextTypes

from . import config, db, prompts, xp
from .jobs import _ctx, _deliver
from .util import ask, now_for

log = logging.getLogger("aristotelia.weekly")


async def weekly_review(context: ContextTypes.DEFAULT_TYPE, *, force: bool = False) -> None:
    user, chat = await _ctx(context)
    if not user:
        return
    if not force and now_for(user).weekday() != config.SUNDAY:
        return
    since = (now_for(user) - timedelta(days=7)).date()
    events = await db.events_since(user["id"], since)
    if not events:
        await _deliver(context, user, chat, "Sua semana",
                       "📊 *SUA SEMANA*\n\nSem registros essa semana. Semana que vem começa o placar.")
        return
    resumo = "\n".join(
        f"- {e['day']} [{e['kind']}] {e['payload']}" for e in events
    )
    plan = await db.get_plan(user["id"])
    goal = plan["goal"] if plan else None
    texto = await ask(prompts.persona(user["name"], goal, user["coach_tone"], user["coach_note"], light=True) + "\n\n" + prompts.WEEKLY_REVIEW,
                      f"Registros:\n{resumo}", label=True, temperature=0.7, max_tokens=450)
    rows = await db.events_all(user["id"])
    lvl = xp.level_for_xp(xp.xp_total(rows))
    since_dt = (now_for(user) - timedelta(days=7)).date()
    wk_rows = [r for r in rows if r["day"] >= since_dt]
    wk_xp = xp.xp_total(wk_rows)
    texto += f"\n\n📈 Nível {lvl} — {xp.stage_for_level(lvl)} · +{wk_xp} XP essa semana"
    await _deliver(context, user, chat, "Sua semana", texto)


async def content_planner(context: ContextTypes.DEFAULT_TYPE, *, force: bool = False) -> None:
    user, chat = await _ctx(context)
    if not user:
        return
    if not force and now_for(user).weekday() != config.SUNDAY:
        return
    plan = await db.get_plan(user["id"])
    if not plan:
        return
    since = (now_for(user) - timedelta(days=10)).date()
    events = await db.events_since(user["id"], since)
    tops = prompts.recent_topics(plan, events, n=8)
    ideias = await db.content_ideas(user["id"])
    ideias_txt = "; ".join(i["theme"] for i in ideias[:10]) or "nenhuma ainda"
    texto = await ask(
        prompts.persona(user["name"], plan["goal"], user["coach_tone"], user["coach_note"], light=True) + "\n\n" + prompts.CONTENT_PLANNER,
        f"Tópicos da semana: {tops}\nIdeias salvas: {ideias_txt}",
        label=True, temperature=0.9, max_tokens=350,
    )
    await _deliver(context, user, chat, "Ideias de conteúdo", texto)


async def advance_week(context: ContextTypes.DEFAULT_TYPE, *, force: bool = False) -> None:
    user, chat = await _ctx(context)
    if not user:
        return
    if not force and now_for(user).weekday() != config.SUNDAY:
        return
    plan = await db.get_plan(user["id"])
    if not plan:
        return
    cur = plan["current"]
    max_week = max((w["n"] for w in plan["weeks"]), default=cur["week"])
    if cur["week"] < max_week:
        await db.update_plan_position(user["id"], cur["week"] + 1, 1)
    else:
        await _deliver(context, user, chat, "Fim da trilha",
                       "🗺️ Você chegou ao fim da trilha atual. Manda `/plano` e a gente monta as próximas semanas.")


WEEKLY_JOBS = {
    "weekly_review": weekly_review,
    "content_planner": content_planner,
    "advance_week": advance_week,
}
