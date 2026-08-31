"""As 7 funções diárias. Cada uma pode ser agendada ou chamada sob demanda."""
from __future__ import annotations

import asyncio
import logging

from telegram.constants import ParseMode
from telegram.error import BadRequest
from telegram.ext import ContextTypes

from . import llm, prompts, storage

log = logging.getLogger("aristotelia.jobs")


async def send_text(bot, chat_id: int, text: str) -> None:
    """Tenta Markdown; se o texto do LLM quebrar o parser, manda como texto puro."""
    try:
        await bot.send_message(chat_id=chat_id, text=text, parse_mode=ParseMode.MARKDOWN)
    except BadRequest:
        await bot.send_message(chat_id=chat_id, text=text)


async def _send(context: ContextTypes.DEFAULT_TYPE, text: str) -> bool:
    chat_id = storage.get_chat_id()
    if not chat_id:
        log.warning("Sem chat_id — rode /start no bot. Job ignorado.")
        return False
    await send_text(context.bot, chat_id, text)
    return True


async def _ask(system: str, user: str, **kw) -> str:
    return llm.unlabel(await asyncio.to_thread(llm.generate, system, user, **kw))


def _sys(extra: str) -> str:
    return prompts.PERSONA + "\n\n" + extra


# --- 06:00 ---------------------------------------------------------------
async def daily_motivation(context: ContextTypes.DEFAULT_TYPE) -> None:
    frase = await _ask(_sys(prompts.MOTIVATION), "Gere a frase de hoje.", temperature=1.0, max_tokens=120)
    await _send(context, f"🌅 {frase}")


# --- 08:00 (a função mais importante) ----------------------------------
async def daily_learning_guide(context: ContextTypes.DEFAULT_TYPE) -> None:
    plan = storage.load("learning_plan")
    ctx = prompts.learning_context(plan)
    texto = await _ask(_sys(prompts.LEARNING_GUIDE), ctx, temperature=0.7, max_tokens=250)
    if await _send(context, f"🧭 *Guia do dia*\n\n{texto}"):
        _advance_day(plan)


# --- 09:00 ------------------------------------------------------------
async def micro_learning(context: ContextTypes.DEFAULT_TYPE) -> None:
    plan = storage.load("learning_plan")
    ctx = prompts.learning_context(plan)
    texto = await _ask(_sys(prompts.MICRO_LEARNING), ctx, temperature=0.7, max_tokens=450)
    await _send(context, f"📚 *Conteúdo rápido*\n\n{texto}")


# --- 10:30 ----------------------------------------------------------
async def learning_check(context: ContextTypes.DEFAULT_TYPE) -> None:
    plan = storage.load("learning_plan")
    logd = storage.load("daily_log")
    tops = prompts.recent_topics(plan, logd)
    quiz = await asyncio.to_thread(
        llm.generate_json, _sys(prompts.QUIZ), f"Tópicos recentes: {tops}", max_tokens=500
    )
    if not quiz or "alternativas" not in quiz:
        log.warning("Quiz inválido — pulando.")
        return
    alts = quiz["alternativas"]
    corpo = (
        f"🧠 *Teste rápido*\n\n{quiz.get('pergunta', '')}\n\n"
        f"A) {alts.get('A', '')}\n"
        f"B) {alts.get('B', '')}\n"
        f"C) {alts.get('C', '')}\n\n"
        "_Responda com A, B ou C._"
    )
    if await _send(context, corpo):
        storage.set_pending(
            {
                "type": "quiz",
                "correta": str(quiz.get("correta", "")).strip().upper()[:1],
                "topico": quiz.get("topico", ""),
                "explicacao": quiz.get("explicacao", ""),
            }
        )


# --- 15:00 --------------------------------------------------------
async def daily_insight(context: ContextTypes.DEFAULT_TYPE) -> None:
    texto = await _ask(_sys(prompts.INSIGHT), "Gere o insight de hoje.", temperature=0.9, max_tokens=350)
    await _send(context, f"🧠 *Insight de engenharia*\n\n{texto}")


# --- 16:00 ------------------------------------------------------
async def application_challenge(context: ContextTypes.DEFAULT_TYPE) -> None:
    plan = storage.load("learning_plan")
    ctx = prompts.learning_context(plan)
    texto = await _ask(_sys(prompts.CHALLENGE), ctx, temperature=0.8, max_tokens=250)
    await _send(context, f"🛠️ *Desafio de 10 minutos*\n\n{texto}")


# --- 20:00 ------------------------------------------------------
async def daily_review(context: ContextTypes.DEFAULT_TYPE) -> None:
    corpo = (
        "🌙 *Fechamento do dia*\n\n"
        "Responde em 3 linhas:\n\n"
        "🧠 O que aprendi?\n"
        "🛠️ O que fiz?\n"
        "💡 O que entendi melhor hoje?"
    )
    if await _send(context, corpo):
        storage.set_pending({"type": "review"})


# --- avanço da trilha ------------------------------------------------
def _advance_day(plan: dict) -> None:
    cur = plan.setdefault("current", {"week": 1, "day": 1})
    week = next((w for w in plan.get("weeks", []) if w["n"] == cur["week"]), None)
    total = len(week["days"]) if week else 5
    if cur["day"] < total:
        cur["day"] += 1
    storage.save("learning_plan", plan)


JOBS = {
    "daily_motivation": daily_motivation,
    "daily_learning_guide": daily_learning_guide,
    "micro_learning": micro_learning,
    "learning_check": learning_check,
    "daily_insight": daily_insight,
    "application_challenge": application_challenge,
    "daily_review": daily_review,
}
