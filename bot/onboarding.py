"""Onboarding no Telegram: 3 perguntas → LLM gera a trilha → usuário fica ativo."""
from __future__ import annotations

import asyncio
import logging

from telegram import Update
from telegram.ext import ContextTypes

from . import db, prompts, scheduling
from .util import ask_json, send_text

log = logging.getLogger("aristotelia.onboarding")

_LEVELS = {"1": "do zero", "2": "sei o básico", "3": "intermediário, quero aprofundar"}


async def build_trilha(name: str | None, goal: str, level: str, minutes: int) -> list | None:
    """Gera a trilha semana a semana (evita o limite de tokens/min do Groq free)."""
    base = f"Objetivo: {goal}\nNível: {level}\nMinutos por dia: {minutes}"
    plano = await ask_json(prompts.persona(name) + "\n\n" + prompts.TRILHA_PLANO, base, max_tokens=1200)
    themes = (plano or {}).get("themes") or []
    if len(themes) < 4:
        themes = [f"Semana {i}" for i in range(1, 5)]
    weeks: list = []
    for n in range(1, 5):
        payload = f"{base}\nTemas das 4 semanas: {themes}\nDetalhe a semana {n}, tema: {themes[n - 1]}"
        wk = await ask_json(prompts.persona(name) + "\n\n" + prompts.TRILHA_SEMANA, payload, max_tokens=2500)
        days = (wk or {}).get("days")
        if not days or len(days) < 3:
            return None
        weeks.append({"n": n, "theme": (wk.get("theme") or themes[n - 1])[:80],
                      "days": [{"d": i + 1, "topic": d["topic"], "goal": d.get("goal", "")}
                               for i, d in enumerate(days[:5])]})
        await asyncio.sleep(1)  # respeita TPM do Groq free
    return weeks


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE, user) -> None:
    await db.set_pending(user["id"], {"type": "onboarding", "step": "goal", "answers": {}})
    await send_text(context.bot, user["telegram_chat_id"],
                    "🌅 Bom te ver aqui. Vou montar seu plano em 3 perguntas.\n\n" + prompts.ONB_GOAL)


async def handle(update: Update, context: ContextTypes.DEFAULT_TYPE, user, pending: dict) -> None:
    text = (update.message.text or "").strip()
    step = pending.get("step")
    answers = pending.get("answers", {})
    chat = user["telegram_chat_id"]

    if step == "goal":
        answers["goal"] = text
        await db.set_pending(user["id"], {"type": "onboarding", "step": "level", "answers": answers})
        await send_text(context.bot, chat, prompts.ONB_LEVEL)

    elif step == "level":
        key = next((c for c in text if c in "123"), "1")
        answers["level"] = _LEVELS[key]
        await db.set_pending(user["id"], {"type": "onboarding", "step": "minutes", "answers": answers})
        await send_text(context.bot, chat, prompts.ONB_MINUTES)

    elif step == "minutes":
        digits = "".join(c for c in text if c.isdigit())
        minutes = max(10, min(180, int(digits) if digits else 30))
        answers["minutes"] = minutes
        await _finish(context, user, answers)


async def _finish(context: ContextTypes.DEFAULT_TYPE, user, answers: dict) -> None:
    chat = user["telegram_chat_id"]
    await send_text(context.bot, chat, "🧭 Fechado. Montando sua trilha... (uns segundos)")

    weeks = await build_trilha(user["name"], answers["goal"], answers["level"], answers["minutes"])
    if not weeks:
        await send_text(context.bot, chat,
                        "Tive um problema pra gerar a trilha agora. Manda /start de novo em 1 minuto.")
        return

    await db.create_plan(user["id"], answers["goal"], answers["level"], weeks)
    await db.save_prefs(user["id"], minutes_per_day=answers["minutes"])
    await db.set_pending(user["id"], None)
    await db.set_status(user["id"], "active")

    fresh = await db.get_user(user["id"])
    await scheduling.schedule_user(context.application, fresh)

    w1 = weeks[0]
    d1 = w1["days"][0]
    await send_text(
        context.bot, chat,
        f"✅ Trilha pronta: *{len(weeks)} semanas*.\n\n"
        f"*Semana 1 — {w1['theme']}*\n"
        f"Começa hoje: {d1['topic']}\n_{d1['goal']}_\n\n"
        "Todo dia eu te mando: motivação (06h), o que estudar (08h), pílula (09h), "
        "quiz (10h30), insight (15h), desafio (16h) e o fechamento (20h).\n\n"
        "Comandos: /hoje /jasei /plano /status /foco /painel",
    )
