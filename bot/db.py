"""Camada de acesso ao Postgres (asyncpg). Estado por usuário — Fase 1."""
from __future__ import annotations

import json
import logging
from datetime import date, datetime, time
from pathlib import Path
from typing import Any

import asyncpg

from . import config

log = logging.getLogger("aristotelia.db")

_pool: asyncpg.Pool | None = None
MIGRATIONS_DIR = config.ROOT / "db" / "migrations"


# ── ciclo de vida ────────────────────────────────────────────────────
async def connect() -> None:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(config.DATABASE_URL, min_size=1, max_size=8)
        await _run_migrations()


async def close() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def pool() -> asyncpg.Pool:
    assert _pool is not None, "db.connect() não foi chamado"
    return _pool


async def _run_migrations() -> None:
    async with _pool.acquire() as con:
        await con.execute(
            "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())"
        )
        done = {r["name"] for r in await con.fetch("SELECT name FROM _migrations")}
        for f in sorted(MIGRATIONS_DIR.glob("*.sql")):
            if f.name in done:
                continue
            log.info("Aplicando migration %s", f.name)
            async with con.transaction():
                await con.execute(f.read_text(encoding="utf-8"))
                await con.execute("INSERT INTO _migrations (name) VALUES ($1)", f.name)


def _j(v: Any) -> Any:
    """asyncpg devolve jsonb como str — desserializa."""
    return json.loads(v) if isinstance(v, str) else v


# ── usuários ─────────────────────────────────────────────────────────
async def get_or_create_user(chat_id: int, username: str | None, name: str | None) -> asyncpg.Record:
    async with pool().acquire() as con:
        row = await con.fetchrow("SELECT * FROM users WHERE telegram_chat_id = $1", chat_id)
        if row is None:
            row = await con.fetchrow(
                """INSERT INTO users (telegram_chat_id, telegram_username, name, last_seen_at)
                   VALUES ($1, $2, $3, now()) RETURNING *""",
                chat_id, username, name,
            )
            await con.execute("INSERT INTO preferences (user_id) VALUES ($1)", row["id"])
            await con.execute("INSERT INTO streaks (user_id) VALUES ($1)", row["id"])
            await con.execute("INSERT INTO bot_state (user_id) VALUES ($1)", row["id"])
        else:
            await con.execute("UPDATE users SET last_seen_at = now() WHERE id = $1", row["id"])
    return row


async def get_user(user_id) -> asyncpg.Record | None:
    async with pool().acquire() as con:
        return await con.fetchrow("SELECT * FROM users WHERE id = $1", user_id)


async def user_by_chat(chat_id: int) -> asyncpg.Record | None:
    async with pool().acquire() as con:
        return await con.fetchrow("SELECT * FROM users WHERE telegram_chat_id = $1", chat_id)


async def set_status(user_id, status: str) -> None:
    async with pool().acquire() as con:
        await con.execute("UPDATE users SET status = $2 WHERE id = $1", user_id, status)


async def active_users() -> list[asyncpg.Record]:
    async with pool().acquire() as con:
        return await con.fetch(
            "SELECT * FROM users WHERE status = 'active' AND telegram_chat_id IS NOT NULL"
        )


# ── preferências ─────────────────────────────────────────────────────
async def get_prefs(user_id) -> dict:
    async with pool().acquire() as con:
        r = await con.fetchrow("SELECT * FROM preferences WHERE user_id = $1", user_id)
    d = dict(r)
    d["enabled_functions"] = _j(d["enabled_functions"])
    return d


async def save_prefs(user_id, **fields) -> None:
    if not fields:
        return
    cols = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(fields))
    vals = [
        json.dumps(v) if k == "enabled_functions" else v
        for k, v in fields.items()
    ]
    async with pool().acquire() as con:
        await con.execute(
            f"UPDATE preferences SET {cols}, updated_at = now() WHERE user_id = $1", user_id, *vals
        )


# ── trilha ───────────────────────────────────────────────────────────
async def get_plan(user_id) -> dict | None:
    async with pool().acquire() as con:
        r = await con.fetchrow(
            "SELECT * FROM learning_plans WHERE user_id = $1 AND active ORDER BY created_at DESC LIMIT 1",
            user_id,
        )
    if r is None:
        return None
    d = dict(r)
    d["weeks"] = _j(d["weeks"])
    d["known_topics"] = _j(d["known_topics"])
    d["current"] = {"week": d["current_week"], "day": d["current_day"]}
    return d


async def create_plan(user_id, goal: str, level: str, weeks: list) -> None:
    async with pool().acquire() as con:
        await con.execute("UPDATE learning_plans SET active = false WHERE user_id = $1", user_id)
        await con.execute(
            """INSERT INTO learning_plans (user_id, goal, level, weeks)
               VALUES ($1, $2, $3, $4)""",
            user_id, goal, level, json.dumps(weeks),
        )


async def update_plan_position(user_id, week: int, day: int) -> None:
    async with pool().acquire() as con:
        await con.execute(
            """UPDATE learning_plans SET current_week = $2, current_day = $3, updated_at = now()
               WHERE user_id = $1 AND active""",
            user_id, week, day,
        )


async def add_known_topic(user_id, topic: str) -> None:
    async with pool().acquire() as con:
        await con.execute(
            """UPDATE learning_plans
               SET known_topics = known_topics || $2::jsonb, updated_at = now()
               WHERE user_id = $1 AND active""",
            user_id, json.dumps([topic]),
        )


# ── estado da conversa ───────────────────────────────────────────────
async def get_pending(user_id) -> dict | None:
    async with pool().acquire() as con:
        r = await con.fetchval("SELECT pending FROM bot_state WHERE user_id = $1", user_id)
    return _j(r) if r is not None else None


async def set_pending(user_id, pending: dict | None) -> None:
    async with pool().acquire() as con:
        await con.execute(
            "UPDATE bot_state SET pending = $2, updated_at = now() WHERE user_id = $1",
            user_id, json.dumps(pending) if pending is not None else None,
        )


# ── eventos / streak ─────────────────────────────────────────────────
async def log_event(user_id, kind: str, day: date, payload: dict | None = None) -> None:
    async with pool().acquire() as con:
        await con.execute(
            "INSERT INTO events (user_id, day, kind, payload) VALUES ($1, $2, $3, $4)",
            user_id, day, kind, json.dumps(payload or {}),
        )


async def events_since(user_id, since: date) -> list[asyncpg.Record]:
    async with pool().acquire() as con:
        return await con.fetch(
            "SELECT * FROM events WHERE user_id = $1 AND day >= $2 ORDER BY created_at", user_id, since
        )


async def get_streak(user_id) -> asyncpg.Record:
    async with pool().acquire() as con:
        return await con.fetchrow(
            "SELECT * FROM streaks WHERE user_id = $1 AND kind = 'diario'", user_id
        )


async def bump_streak(user_id, today: date) -> int:
    async with pool().acquire() as con:
        r = await con.fetchrow(
            "SELECT current, last_date FROM streaks WHERE user_id = $1 AND kind = 'diario'", user_id
        )
        if r and r["last_date"] == today:
            return r["current"]
        new = (r["current"] if r else 0) + 1
        await con.execute(
            """UPDATE streaks SET current = $2, best = GREATEST(best, $2), last_date = $3
               WHERE user_id = $1 AND kind = 'diario'""",
            user_id, new, today,
        )
        return new


# ── tarefas (checklist) ──────────────────────────────────────────────
async def add_task(user_id, day: date, source: str, title: str, detail: str | None = None) -> None:
    async with pool().acquire() as con:
        exists = await con.fetchval(
            "SELECT 1 FROM tasks WHERE user_id = $1 AND day = $2 AND source = $3 AND title = $4",
            user_id, day, source, title,
        )
        if not exists:
            n = await con.fetchval(
                "SELECT count(*) FROM tasks WHERE user_id = $1 AND day = $2", user_id, day
            )
            await con.execute(
                """INSERT INTO tasks (user_id, day, source, title, detail, sort_order)
                   VALUES ($1, $2, $3, $4, $5, $6)""",
                user_id, day, source, title, detail, n,
            )


async def get_tasks(user_id, day: date) -> list[asyncpg.Record]:
    async with pool().acquire() as con:
        return await con.fetch(
            "SELECT * FROM tasks WHERE user_id = $1 AND day = $2 ORDER BY sort_order", user_id, day
        )


async def complete_task(task_id, via: str) -> None:
    async with pool().acquire() as con:
        await con.execute(
            "UPDATE tasks SET status = 'done', done_via = $2, done_at = now() WHERE id = $1",
            task_id, via,
        )


async def auto_complete(user_id, day: date, source: str) -> None:
    """Marca a 1ª tarefa pendente daquele source como feita (auto-check via Telegram)."""
    async with pool().acquire() as con:
        await con.execute(
            """UPDATE tasks SET status = 'done', done_via = 'auto', done_at = now()
               WHERE id = (SELECT id FROM tasks
                           WHERE user_id = $1 AND day = $2 AND source = $3 AND status = 'pending'
                           ORDER BY sort_order LIMIT 1)""",
            user_id, day, source,
        )


# ── foco (pomodoro) ──────────────────────────────────────────────────
async def start_focus(user_id, minutes: int) -> str:
    async with pool().acquire() as con:
        return await con.fetchval(
            "INSERT INTO focus_sessions (user_id, minutes) VALUES ($1, $2) RETURNING id",
            user_id, minutes,
        )


async def end_focus(session_id, completed: bool) -> None:
    async with pool().acquire() as con:
        await con.execute(
            "UPDATE focus_sessions SET ended_at = now(), completed = $2 WHERE id = $1",
            session_id, completed,
        )


# ── conteúdo ─────────────────────────────────────────────────────────
async def add_content_idea(user_id, **f) -> None:
    async with pool().acquire() as con:
        await con.execute(
            """INSERT INTO content_ideas (user_id, theme, type, format, title, note, origin_date)
               VALUES ($1, $2, $3, $4, $5, $6, $7)""",
            user_id, f.get("theme"), f.get("type"), f.get("format"),
            f.get("title"), f.get("note"), f.get("origin_date"),
        )


async def content_ideas(user_id) -> list[asyncpg.Record]:
    async with pool().acquire() as con:
        return await con.fetch(
            "SELECT * FROM content_ideas WHERE user_id = $1 ORDER BY created_at DESC", user_id
        )


# ── auth (código do painel web) ──────────────────────────────────────
async def create_auth_code(user_id) -> str:
    import secrets

    code = f"{secrets.randbelow(1_000_000):06d}"
    async with pool().acquire() as con:
        await con.execute(
            "INSERT INTO auth_codes (code, user_id, expires_at) VALUES ($1, $2, now() + interval '10 minutes')",
            code, user_id,
        )
    return code


# ── lembretes ───────────────────────────────────────────────────────
_DEFAULT_REMINDERS = [
    ("motivacao", "06:00", 0), ("guia", "08:00", 1), ("pilula", "09:00", 2),
    ("quiz", "10:30", 3), ("insight", "15:00", 4), ("desafio", "16:00", 5),
    ("checkin_noite", "20:00", 6),
]


async def get_reminders(user_id) -> list[asyncpg.Record]:
    async with pool().acquire() as con:
        rows = await con.fetch(
            "SELECT * FROM reminders WHERE user_id = $1 AND enabled ORDER BY sort_order", user_id
        )
    out = []
    for r in rows:
        d = dict(r)
        d["days"] = _j(d["days"])
        out.append(d)
    return out


async def create_default_reminders(user_id) -> None:
    async with pool().acquire() as con:
        exists = await con.fetchval("SELECT 1 FROM reminders WHERE user_id = $1 LIMIT 1", user_id)
        if exists:
            return
        await con.executemany(
            "INSERT INTO reminders (user_id, kind, at_time, sort_order) VALUES ($1, $2, $3, $4)",
            [(user_id, k, t, o) for k, t, o in _DEFAULT_REMINDERS],
        )


async def dirty_reminder_users() -> list[asyncpg.Record]:
    async with pool().acquire() as con:
        return await con.fetch(
            """SELECT u.* FROM users u JOIN bot_state b ON b.user_id = u.id
               WHERE b.reminders_dirty AND u.status = 'active' AND u.telegram_chat_id IS NOT NULL"""
        )


async def clear_reminders_dirty(user_id) -> None:
    async with pool().acquire() as con:
        await con.execute("UPDATE bot_state SET reminders_dirty = false WHERE user_id = $1", user_id)


# ── outbox (web → bot) ───────────────────────────────────────────────
async def pop_outbox() -> list[asyncpg.Record]:
    async with pool().acquire() as con:
        rows = await con.fetch(
            "SELECT o.*, u.telegram_chat_id FROM outbox o JOIN users u ON u.id = o.user_id "
            "WHERE o.sent_at IS NULL ORDER BY o.created_at LIMIT 20"
        )
        return rows


async def mark_outbox_sent(outbox_id) -> None:
    async with pool().acquire() as con:
        await con.execute("UPDATE outbox SET sent_at = now() WHERE id = $1", outbox_id)
