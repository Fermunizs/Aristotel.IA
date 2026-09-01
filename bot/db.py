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
        row = await con.fetchrow("SELECT id FROM users WHERE telegram_chat_id = $1", chat_id)
        if row is None:
            row = await con.fetchrow(
                """INSERT INTO users (telegram_chat_id, telegram_username, name, last_seen_at)
                   VALUES ($1, $2, $3, now()) RETURNING id""",
                chat_id, username, name,
            )
            await con.execute("INSERT INTO preferences (user_id) VALUES ($1)", row["id"])
            await con.execute("INSERT INTO streaks (user_id) VALUES ($1)", row["id"])
            await con.execute("INSERT INTO bot_state (user_id) VALUES ($1)", row["id"])
        else:
            await con.execute("UPDATE users SET last_seen_at = now() WHERE id = $1", row["id"])
    return await get_user(row["id"])


_USER_COLS = (
    "u.*, coalesce(p.coach_tone, 'equilibrada') AS coach_tone, "
    "coalesce(p.coach_note, '') AS coach_note"
)


async def get_user(user_id) -> asyncpg.Record | None:
    async with pool().acquire() as con:
        return await con.fetchrow(
            f"SELECT {_USER_COLS} FROM users u LEFT JOIN preferences p ON p.user_id = u.id WHERE u.id = $1",
            user_id,
        )


async def user_by_chat(chat_id: int) -> asyncpg.Record | None:
    async with pool().acquire() as con:
        return await con.fetchrow(
            f"SELECT {_USER_COLS} FROM users u LEFT JOIN preferences p ON p.user_id = u.id "
            "WHERE u.telegram_chat_id = $1",
            chat_id,
        )


async def set_status(user_id, status: str) -> None:
    async with pool().acquire() as con:
        await con.execute("UPDATE users SET status = $2 WHERE id = $1", user_id, status)


async def active_users() -> list[asyncpg.Record]:
    async with pool().acquire() as con:
        return await con.fetch(
            f"SELECT {_USER_COLS} FROM users u LEFT JOIN preferences p ON p.user_id = u.id "
            "WHERE u.status = 'active' AND u.telegram_chat_id IS NOT NULL"
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
    d["review_queue"] = _j(d.get("review_queue")) or []
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


async def deactivate_plan(user_id) -> None:
    """Desativa a trilha atual — usado no /recomecar antes de gerar uma nova."""
    async with pool().acquire() as con:
        await con.execute("UPDATE learning_plans SET active = false WHERE user_id = $1", user_id)


async def clear_future_trilha_tasks(user_id) -> None:
    """Some com tarefas de trilha ainda pendentes (hoje em diante) — a trilha nova traz as dela.
    Evita a checklist de hoje mostrar o tópico da trilha antiga junto do 'Foco de hoje' novo."""
    async with pool().acquire() as con:
        await con.execute(
            "DELETE FROM tasks WHERE user_id = $1 AND source = 'trilha' "
            "AND status = 'pending' AND day >= current_date",
            user_id,
        )


async def update_plan_position(user_id, week: int, day: int) -> None:
    async with pool().acquire() as con:
        await con.execute(
            """UPDATE learning_plans SET current_week = $2, current_day = $3, updated_at = now()
               WHERE user_id = $1 AND active""",
            user_id, week, day,
        )


async def add_review_topic(user_id, topic: str) -> None:
    """Trilha adaptativa: errou o quiz de um tópico → entra na fila de revisão."""
    if not topic:
        return
    async with pool().acquire() as con:
        exists = await con.fetchval(
            """SELECT review_queue @> $2::jsonb FROM learning_plans
               WHERE user_id = $1 AND active""",
            user_id, json.dumps([topic]),
        )
        if not exists:
            await con.execute(
                """UPDATE learning_plans SET review_queue = review_queue || $2::jsonb, updated_at = now()
                   WHERE user_id = $1 AND active""",
                user_id, json.dumps([topic]),
            )


async def pop_review_topic(user_id) -> str | None:
    """Tira e devolve o próximo tópico da fila de revisão (None se vazia)."""
    async with pool().acquire() as con:
        async with con.transaction():
            row = await con.fetchrow(
                "SELECT id, review_queue FROM learning_plans WHERE user_id = $1 AND active FOR UPDATE",
                user_id,
            )
            if not row:
                return None
            queue = _j(row["review_queue"]) or []
            if not queue:
                return None
            topic, rest = queue[0], queue[1:]
            await con.execute(
                "UPDATE learning_plans SET review_queue = $2::jsonb WHERE id = $1",
                row["id"], json.dumps(rest),
            )
            return topic


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


# ── memória curta de conversa ───────────────────────────────────────
_HISTORY_MAX = 14


async def get_history(user_id) -> list[dict]:
    async with pool().acquire() as con:
        r = await con.fetchval("SELECT history FROM bot_state WHERE user_id = $1", user_id)
    return _j(r) or []


async def clear_history(user_id) -> None:
    """Zera a memória de conversa — usado ao gerar uma trilha nova (/recomecar)."""
    async with pool().acquire() as con:
        await con.execute("UPDATE bot_state SET history = '[]'::jsonb WHERE user_id = $1", user_id)


async def push_history(user_id, role: str, content: str) -> None:
    hist = await get_history(user_id)
    hist.append({"role": role, "content": content[:1500]})
    hist = hist[-_HISTORY_MAX:]
    async with pool().acquire() as con:
        await con.execute(
            "UPDATE bot_state SET history = $2 WHERE user_id = $1", user_id, json.dumps(hist)
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
    ("motivacao", time(6, 0), 0), ("guia", time(8, 0), 1), ("pilula", time(9, 0), 2),
    ("quiz", time(10, 30), 3), ("insight", time(15, 0), 4), ("desafio", time(16, 0), 5),
    ("checkin_noite", time(20, 0), 6),
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


# ── conteúdo compartilhado do dia (motivação / insight) ────────────
async def get_cached_content(kind: str, day: date) -> str | None:
    async with pool().acquire() as con:
        return await con.fetchval(
            "SELECT text FROM content_cache WHERE kind = $1 AND day = $2", kind, day
        )


async def save_cached_content(kind: str, day: date, text: str) -> str:
    """Grava (idempotente) e devolve o texto que ficou — se outro worker gravou antes, é o dele."""
    async with pool().acquire() as con:
        await con.execute(
            "INSERT INTO content_cache (kind, day, text) VALUES ($1, $2, $3) "
            "ON CONFLICT (kind, day) DO NOTHING",
            kind, day, text,
        )
        return await con.fetchval(
            "SELECT text FROM content_cache WHERE kind = $1 AND day = $2", kind, day
        )


# ── settings (identidade da Aristótel.IA) ───────────────────────────
async def get_settings() -> dict:
    async with pool().acquire() as con:
        rows = await con.fetch("SELECT key, value FROM app_settings")
    return {r["key"]: r["value"] for r in rows}


# ── web push ────────────────────────────────────────────────────────
async def get_push_subs(user_id) -> list[asyncpg.Record]:
    async with pool().acquire() as con:
        return await con.fetch("SELECT * FROM push_subscriptions WHERE user_id = $1", user_id)


async def mark_push_ok(sub_id) -> None:
    async with pool().acquire() as con:
        await con.execute("UPDATE push_subscriptions SET last_ok_at = now() WHERE id = $1", sub_id)


async def delete_push_sub(sub_id) -> None:
    async with pool().acquire() as con:
        await con.execute("DELETE FROM push_subscriptions WHERE id = $1", sub_id)


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


# ── telemetria de LLM ───────────────────────────────────────────────
async def record_llm_usage(rows: list[dict]) -> None:
    if not rows:
        return
    async with pool().acquire() as con:
        await con.executemany(
            """INSERT INTO llm_usage
                 (user_id, source, tag, provider, model,
                  prompt_tokens, completion_tokens, fallback, ok, status)
               VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10)""",
            [(
                r.get("user_id"), r.get("source", "bot"), r.get("tag"), r["provider"], r.get("model"),
                int(r.get("prompt_tokens", 0)), int(r.get("completion_tokens", 0)),
                bool(r.get("fallback", False)), bool(r.get("ok", True)), r.get("status"),
            ) for r in rows],
        )


async def chat_count_today(user_id, day: date) -> int:
    async with pool().acquire() as con:
        n = await con.fetchval(
            "SELECT count(*) FROM events WHERE user_id = $1 AND day = $2 AND kind = 'msg:chat'",
            user_id, day,
        )
    return n or 0


# ── faxina (roda 1x/dia) ────────────────────────────────────────────
async def cleanup_expired() -> str:
    async with pool().acquire() as con:
        a = await con.execute("DELETE FROM auth_codes WHERE expires_at < now() - interval '1 day'")
        s = await con.execute("DELETE FROM web_sessions WHERE expires_at < now()")
        o = await con.execute("DELETE FROM outbox WHERE sent_at IS NOT NULL AND sent_at < now() - interval '7 days'")
        c = await con.execute("DELETE FROM content_cache WHERE day < current_date - 14")
        u = await con.execute("DELETE FROM llm_usage WHERE created_at < now() - interval '90 days'")
    return f"auth_codes[{a}] web_sessions[{s}] outbox[{o}] content_cache[{c}] llm_usage[{u}]"
