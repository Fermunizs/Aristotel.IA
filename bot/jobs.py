"""As funções de lembrete — por usuário (context.job.data['user_id'])."""
from __future__ import annotations

import logging
import re

from telegram.ext import ContextTypes

from . import db, prompts, push
from .util import ask, ask_json, now_for, send_text

log = logging.getLogger("aristotelia.jobs")

_MD = re.compile(r"[*_`>#]|^\s*[-•]\s?", re.M)


def _plain(text: str) -> str:
    """Markdown do Telegram -> texto limpo pra notificação push."""
    return _MD.sub("", text).strip()


async def _ctx(context: ContextTypes.DEFAULT_TYPE):
    uid = context.job.data["user_id"]
    user = await db.get_user(uid)
    if not user or not user["telegram_chat_id"]:
        return None, None
    return user, user["telegram_chat_id"]


def _note(context) -> str:
    """Instrução personalizada que a pessoa escreveu pra este lembrete (opcional)."""
    data = (getattr(context, "job", None) and context.job.data) or {}
    n = (data.get("custom_text") or "").strip()
    return f"\n\nPedido específico da pessoa pra este lembrete (respeite): {n}" if n else ""


async def _deliver(context, user, chat, title: str, text: str) -> None:
    """Entrega no canal do lembrete: telegram (padrão) ou push."""
    channel = "telegram"
    if getattr(context, "job", None) and context.job.data:
        channel = context.job.data.get("channel", "telegram")
    if channel == "push":
        await push.send(user["id"], title, _plain(text))
    else:
        await send_text(context.bot, chat, text)


async def daily_motivation(context: ContextTypes.DEFAULT_TYPE) -> None:
    user, chat = await _ctx(context)
    if not user:
        return
    plan = await db.get_plan(user["id"])
    goal = plan["goal"] if plan else None
    frase = await ask(prompts.persona(user["name"], goal, user["coach_tone"]) + "\n\n" + prompts.MOTIVATION + _note(context),
                      "Gere a frase de hoje.", temperature=1.0, max_tokens=200)
    await _deliver(context, user, chat, "Provocação da manhã", f"🌅 {frase}")
    await db.log_event(user["id"], "msg:motivation", now_for(user).date())


async def daily_learning_guide(context: ContextTypes.DEFAULT_TYPE) -> None:
    user, chat = await _ctx(context)
    if not user:
        return
    plan = await db.get_plan(user["id"])
    if not plan:
        return
    day = now_for(user).date()
    texto = await ask(prompts.persona(user["name"], plan["goal"], user["coach_tone"]) + "\n\n" + prompts.LEARNING_GUIDE + _note(context),
                      prompts.learning_context(plan), temperature=0.7, max_tokens=300)
    await _deliver(context, user, chat, "O que fazer hoje", f"🧭 *Guia do dia*\n\n{texto}")
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
    texto = await ask(prompts.persona(user["name"], plan["goal"], user["coach_tone"]) + "\n\n" + prompts.MICRO_LEARNING + _note(context),
                      prompts.learning_context(plan), temperature=0.7, max_tokens=450)
    await _deliver(context, user, chat, "Pílula de conteúdo", f"📚 *Conteúdo rápido*\n\n{texto}")
    await db.log_event(user["id"], "msg:micro", now_for(user).date())


async def learning_check(context: ContextTypes.DEFAULT_TYPE) -> None:
    user, chat = await _ctx(context)
    if not user:
        return
    plan = await db.get_plan(user["id"])
    if not plan:
        return
    events = await db.events_since(user["id"], now_for(user).date().replace(day=1))
    tops = prompts.recent_topics(plan, events)
    quiz = await ask_json(prompts.persona(user["name"], plan["goal"], user["coach_tone"]) + "\n\n" + prompts.QUIZ + _note(context),
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
    await _deliver(context, user, chat, "Quiz rápido", corpo)
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
    texto = await ask(prompts.persona(user["name"], goal, user["coach_tone"]) + "\n\n" + prompts.INSIGHT + _note(context),
                      "Gere o insight de hoje.", temperature=0.9, max_tokens=350)
    await _deliver(context, user, chat, "Insight", f"🧠 *Insight*\n\n{texto}")
    await db.log_event(user["id"], "msg:insight", now_for(user).date())


async def application_challenge(context: ContextTypes.DEFAULT_TYPE) -> None:
    user, chat = await _ctx(context)
    if not user:
        return
    plan = await db.get_plan(user["id"])
    if not plan:
        return
    day = now_for(user).date()
    texto = await ask(prompts.persona(user["name"], plan["goal"], user["coach_tone"]) + "\n\n" + prompts.CHALLENGE + _note(context),
                      prompts.learning_context(plan), temperature=0.8, max_tokens=250)
    await _deliver(context, user, chat, "Desafio de 10 min", f"🛠️ *Desafio de 10 minutos*\n\n{texto}")
    await db.add_task(user["id"], day, "desafio", "Desafio de aplicação do dia", texto[:200])
    await db.set_pending(user["id"], {"type": "challenge", "text": texto[:600], "day": str(day)})
    await db.push_history(user["id"], "assistant", f"[Desafio de hoje] {texto}")
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
    await _deliver(context, user, chat, "Fechamento do dia", corpo)
    await db.set_pending(user["id"], {"type": "review"})


async def free_reminder(context: ContextTypes.DEFAULT_TYPE) -> None:
    user, chat = await _ctx(context)
    if not user:
        return
    txt = (context.job.data.get("custom_text") or "").strip()
    if txt:
        await _deliver(context, user, chat, "Lembrete", f"⏰ {txt}")


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
    "free_reminder": free_reminder,
}
