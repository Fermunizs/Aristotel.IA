"""As 7 funções diárias — agora por usuário (context.job.data['user_id'])."""
from __future__ import annotations

import logging

from telegram.ext import ContextTypes

from . import db, prompts
from .util import ask, ask_json, now_for, send_text

log = logging.getLogger("aristotelia.jobs")


async def _ctx(context: ContextTypes.DEFAULT_TYPE):
    """Devolve (user, chat_id) ou (None, None) se o usuário sumiu."""
    uid = context.job.data["user_id"]
    user = await db.get_user(uid)
    if not user or not user["telegram_chat_id"]:
        return None, None
    return user, user["telegram_chat_id"]


async def daily_motivation(context: ContextTypes.DEFAULT_TYPE) -> None:
    user, chat = await _ctx(context)
    if not user:
        return
    plan = await db.get_plan(user["id"])
    goal = plan["goal"] if plan else None
    frase = await ask(prompts.persona(user["name"], goal) + "\n\n" + prompts.MOTIVATION,
                      "Gere a frase de hoje.", temperature=1.0, max_tokens=200)
    await send_text(context.bot, chat, f"🌅 {frase}")
    await db.log_event(user["id"], "msg:motivation", now_for(user).date())


async def daily_learning_guide(context: ContextTypes.DEFAULT_TYPE) -> None:
    user, chat = await _ctx(context)
    if not user:
        return
    plan = await db.get_plan(user["id"])
    if not plan:
        return
    day = now_for(user).date()
    ctx_txt = prompts.learning_context(plan)
    texto = await ask(prompts.persona(user["name"], plan["goal"]) + "\n\n" + prompts.LEARNING_GUIDE,
                      ctx_txt, temperature=0.7, max_tokens=300)
    await send_text(context.bot, chat, f"🧭 *Guia do dia*\n\n{texto}")
    # checklist do dia
    topic = prompts.today_topic(plan)
    if topic:
        await db.add_task(user["id"], day, "trilha", topic["topic"], topic["goal"])
    await db.log_event(user["id"], "msg:guide", day)
    _advance_day(plan)
    await db.update_plan_position(user["id"], plan["current"]["week"], plan["current"]["day"])


async def micro_learning(context: ContextTypes.DEFAULT_TYPE) -> None:
    user, chat = await _ctx(context)
    if not user:
        return
    plan = await db.get_plan(user["id"])
    if not plan:
        return
    texto = await ask(prompts.persona(user["name"], plan["goal"]) + "\n\n" + prompts.MICRO_LEARNING,
                      prompts.learning_context(plan), temperature=0.7, max_tokens=450)
    await send_text(context.bot, chat, f"📚 *Conteúdo rápido*\n\n{texto}")
    await db.log_event(user["id"], "msg:micro", now_for(user).date())


async def learning_check(context: ContextTypes.DEFAULT_TYPE) -> None:
    user, chat = await _ctx(context)
    if not user:
        return
    plan = await db.get_plan(user["id"])
    if not plan:
        return
    day = now_for(user).date()
    events = await db.events_since(user["id"], day.replace(day=1))
    tops = prompts.recent_topics(plan, events)
    quiz = await ask_json(prompts.persona(user["name"], plan["goal"]) + "\n\n" + prompts.QUIZ,
                          f"Tópicos recentes: {tops}", max_tokens=1600)
    if not quiz or "alternativas" not in quiz:
        log.warning("Quiz inválido p/ user %s", user["id"])
        return
    alts = quiz["alternativas"]
    corpo = (
        f"🧠 *Teste rápido*\n\n{quiz.get('pergunta', '')}\n\n"
        f"A) {alts.get('A', '')}\nB) {alts.get('B', '')}\nC) {alts.get('C', '')}\n\n"
        "_Responda com A, B ou C._"
    )
    await send_text(context.bot, chat, corpo)
    await db.set_pending(user["id"], {
        "type": "quiz",
        "correta": str(quiz.get("correta", "")).strip().upper()[:1],
        "topico": quiz.get("topico", ""),
        "explicacao": quiz.get("explicacao", ""),
    })


async def daily_insight(context: ContextTypes.DEFAULT_TYPE) -> None:
    user, chat = await _ctx(context)
    if not user:
        return
    plan = await db.get_plan(user["id"])
    goal = plan["goal"] if plan else None
    texto = await ask(prompts.persona(user["name"], goal) + "\n\n" + prompts.INSIGHT,
                      "Gere o insight de hoje.", temperature=0.9, max_tokens=350)
    await send_text(context.bot, chat, f"🧠 *Insight*\n\n{texto}")
    await db.log_event(user["id"], "msg:insight", now_for(user).date())


async def application_challenge(context: ContextTypes.DEFAULT_TYPE) -> None:
    user, chat = await _ctx(context)
    if not user:
        return
    plan = await db.get_plan(user["id"])
    if not plan:
        return
    day = now_for(user).date()
    texto = await ask(prompts.persona(user["name"], plan["goal"]) + "\n\n" + prompts.CHALLENGE,
                      prompts.learning_context(plan), temperature=0.8, max_tokens=250)
    await send_text(context.bot, chat, f"🛠️ *Desafio de 10 minutos*\n\n{texto}")
    await db.add_task(user["id"], day, "desafio", "Desafio de aplicação do dia", texto[:200])
    await db.set_pending(user["id"], {"type": "challenge_done"})
    await db.log_event(user["id"], "msg:challenge", day)


async def daily_review(context: ContextTypes.DEFAULT_TYPE) -> None:
    user, chat = await _ctx(context)
    if not user:
        return
    corpo = (
        "🌙 *Fechamento do dia*\n\n"
        "Responde em 3 linhas:\n\n"
        "🧠 O que aprendi?\n🛠️ O que fiz?\n💡 O que entendi melhor hoje?"
    )
    await send_text(context.bot, chat, corpo)
    await db.set_pending(user["id"], {"type": "review"})


def _advance_day(plan: dict) -> None:
    cur = plan["current"]
    week = next((w for w in plan["weeks"] if w["n"] == cur["week"]), None)
    total = len(week["days"]) if week else 5
    if cur["day"] < total:
        cur["day"] += 1


JOBS = {
    "daily_motivation": daily_motivation,
    "daily_learning_guide": daily_learning_guide,
    "micro_learning": micro_learning,
    "learning_check": learning_check,
    "daily_insight": daily_insight,
    "application_challenge": application_challenge,
    "daily_review": daily_review,
}
