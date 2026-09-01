"""Agenda os jobs de cada usuário no JobQueue do PTB, a partir dos lembretes."""
from __future__ import annotations

import logging
from datetime import time

from telegram.ext import Application

from . import config, db
from .jobs import JOBS
from .util import user_tz
from .weekly import WEEKLY_JOBS

log = logging.getLogger("aristotelia.scheduling")


def unschedule_user(app: Application, user_id) -> None:
    for job in app.job_queue.jobs():
        if job.name and job.name.startswith(f"{user_id}:"):
            job.schedule_removal()


_JITTER_WINDOW = 25  # min — espalha o "pico" (todo mundo às 08:00 vira 08:00–08:24)


def _jitter(user_id) -> int:
    """Deslocamento estável (0..window-1 min) por usuário. Mesma pessoa, mesmo offset sempre."""
    return int(str(user_id).replace("-", "")[:8], 16) % _JITTER_WINDOW


def _shift(t: time, minutes: int) -> time:
    total = (t.hour * 60 + t.minute + minutes) % (24 * 60)
    return time(total // 60, total % 60)


def _reminder_time(rem: dict) -> time | None:
    if rem["schedule_type"] == "fixo" and rem["at_time"]:
        return rem["at_time"]
    if rem["schedule_type"] == "periodo" and rem["period"]:
        return config.PERIOD_TIMES.get(rem["period"])
    return None


def _in_quiet(t: time, start: time | None, end: time | None) -> bool:
    """t cai na janela de silêncio [start, end)? (a janela pode cruzar a meia-noite)."""
    if not start or not end or start == end:
        return False
    tm, sm, em = t.hour * 60 + t.minute, start.hour * 60 + start.minute, end.hour * 60 + end.minute
    return sm <= tm < em if sm < em else (tm >= sm or tm < em)


async def schedule_user(app: Application, user) -> None:
    """(Re)agenda os lembretes do usuário + os jobs semanais fixos."""
    unschedule_user(app, user["id"])
    if user["status"] != "active" or not user["telegram_chat_id"]:
        return

    tz = user_tz(user)
    off = _jitter(user["id"])
    prefs = await db.get_prefs(user["id"])
    q_start, q_end = prefs.get("quiet_start"), prefs.get("quiet_end")  # janela de silêncio (opt-in no painel)
    reminders = await db.get_reminders(user["id"])
    n = 0
    for rem in reminders:
        if rem["channel"] not in ("telegram", "push"):
            continue  # e-mail: Fase 2 item 3
        fn = JOBS.get(config.REMINDER_JOBS.get(rem["kind"]))
        t = _reminder_time(rem)
        if not fn or not t:
            continue
        t = _shift(t, off)  # espalha o pico
        if _in_quiet(t, q_start, q_end):
            continue  # dentro do horário de silêncio da pessoa — não agenda
        days = tuple(sorted(int(d) for d in rem["days"]))
        app.job_queue.run_daily(
            fn,
            time=t.replace(tzinfo=tz),
            days=days if len(days) < 7 else tuple(range(7)),
            name=f"{user['id']}:rem:{rem['id']}",
            data={
                "user_id": str(user["id"]),
                "kind": rem["kind"],
                "channel": rem["channel"],
                "custom_text": rem.get("custom_text"),
            },
        )
        n += 1

    for fn_name, t in config.WEEKLY_TIMES.items():
        app.job_queue.run_daily(
            WEEKLY_JOBS[fn_name],
            time=_shift(t, off).replace(tzinfo=tz),
            name=f"{user['id']}:wk:{fn_name}",
            data={"user_id": str(user["id"])},
        )

    await db.clear_reminders_dirty(user["id"])
    log.info("Agendado usuário %s — %d lembretes", user["id"], n)


async def schedule_all(app: Application) -> None:
    users = await db.active_users()
    for u in users:
        await schedule_user(app, u)
    log.info("Agendados %d usuários ativos", len(users))


async def resync_dirty(app: Application) -> int:
    """Re-agenda quem mexeu nos lembretes pelo painel."""
    users = await db.dirty_reminder_users()
    for u in users:
        await schedule_user(app, u)
    return len(users)
