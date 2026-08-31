"""Helpers compartilhados: envio ao Telegram e chamada de LLM."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from telegram.constants import ParseMode
from telegram.error import BadRequest

from . import config, llm

log = logging.getLogger("aristotelia.util")


async def send_text(bot, chat_id: int, text: str) -> None:
    """Tenta Markdown; se o texto do LLM quebrar o parser, manda como texto puro."""
    try:
        await bot.send_message(chat_id=chat_id, text=text, parse_mode=ParseMode.MARKDOWN)
    except BadRequest:
        await bot.send_message(chat_id=chat_id, text=text)


async def ask(system: str, user: str, *, label: bool = False, history: list | None = None, **kw) -> str:
    raw = await asyncio.to_thread(lambda: llm.generate(system, user, history=history, **kw))
    return llm.tidy(raw) if label else llm.unlabel(raw)


async def ask_json(system: str, user: str, **kw) -> dict | None:
    return await asyncio.to_thread(llm.generate_json, system, user, **kw)


def user_tz(user) -> ZoneInfo:
    try:
        return ZoneInfo(user["timezone"])
    except Exception:
        return config.DEFAULT_TZ


def now_for(user) -> datetime:
    return datetime.now(user_tz(user))
