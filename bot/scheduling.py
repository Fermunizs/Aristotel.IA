"""Agenda os jobs de cada usuário no JobQueue do PTB."""
from __future__ import annotations

import logging

from telegram.ext import Application

from . import config, db
from .jobs import JOBS
from .util import user_tz
from .weekly import WEEKLY_JOBS

log = logging.getLogger("aristotelia.scheduling")

_ALL = {**JOBS, **WEEKLY_JOBS}


def _job_name(user_id, fn: str) -> str:
    return f"{user_id}:{fn}"


def unschedule_user(app: Application, user_id) -> None:
    for job in app.job_queue.jobs():
        if job.name and job.name.startswith(f"{user_id}:"):
            job.schedule_removal()


async def schedule_user(app: Application, user) -> None:
    """(Re)agenda todos os jobs do usuário conforme fuso + funções ligadas."""
    unschedule_user(app, user["id"])
    if user["status"] != "active" or not user["telegram_chat_id"]:
        return
    prefs = await db.get_prefs(user["id"])
    enabled = set(prefs["enabled_functions"])
    tz = user_tz(user)
    data = {"user_id": str(user["id"])}

    for fn in config.DAILY_FUNCTIONS:
        if fn not in enabled:
            continue
        app.job_queue.run_daily(
            JOBS[fn], time=config.DEFAULT_TIMES[fn].replace(tzinfo=tz),
            name=_job_name(user["id"], fn), data=data,
        )
    for fn in config.WEEKLY_FUNCTIONS:
        app.job_queue.run_daily(
            WEEKLY_JOBS[fn], time=config.DEFAULT_TIMES[fn].replace(tzinfo=tz),
            name=_job_name(user["id"], fn), data=data,
        )
    log.info("Agendado usuário %s (%s) — %d funções", user["id"], tz, len(enabled))


async def schedule_all(app: Application) -> None:
    users = await db.active_users()
    for u in users:
        await schedule_user(app, u)
    log.info("Agendados %d usuários ativos", len(users))
