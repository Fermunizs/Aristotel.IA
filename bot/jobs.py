"""As funções de lembrete — por usuário (context.job.data['user_id'])."""
from __future__ import annotations

import logging
import re

from telegram.ext import ContextTypes

from . import db, prompts, push, usage, xp
from .util import ask, ask_json, now_for, send_text

log = logging.getLogger("aristotelia.jobs")

_MD = re.compile(r"[*_`>#]|^\s*[-•]\s?", re.M)


def _plain(text: str) -> str:
    """Markdown do Telegram -> texto limpo pra notificação push."""
    return _MD.sub("", text).strip()


async def _ctx(context: ContextTypes.DEFAULT_TYPE):
    uid = context.job.data["user_id"]
    user = await db.get_user(uid)
    if not user or user["status"] != "active":  # ex.: refazendo o onboarding (/recomecar)
        return None, None
    chat = user["telegram_chat_id"]
    if not chat and not await db.has_push(uid):  # nem Telegram nem push → sem canal
        return None, None
    data = (getattr(context, "job", None) and context.job.data) or {}
    usage.set_context(user["id"], data.get("kind") or "job")
    return user, chat  # chat pode ser None (usuário só-push)


def _note(context) -> str:
    """Instrução personalizada que a pessoa escreveu pra este lembrete (opcional)."""
    data = (getattr(context, "job", None) and context.job.data) or {}
    n = (data.get("custom_text") or "").strip()
    return f"\n\nPedido específico da pessoa pra este lembrete (respeite): {n}" if n else ""


async def _deliver(context, user, chat, title: str, text: str) -> None:
    """Entrega no canal do lembrete: telegram (padrão) ou push.
    Sem chat_id (usuário só-push) cai sempre em push, seja qual for o channel."""
    channel = "telegram"
    if getattr(context, "job", None) and context.job.data:
        channel = context.job.data.get("channel", "telegram")
    if channel == "push" or not chat:
        await push.send(user["id"], title, _plain(text))
    else:
        await send_text(context.bot, chat, text)


async def _shared_daily(user, kind: str, prompt_body: str, user_msg: str, temperature: float) -> str:
    """Conteúdo genérico do dia: gera 1x e compartilha entre todos (escala melhor).
    Se o lembrete tem instrução própria, o chamador NÃO usa isto — gera personalizado."""
    day = now_for(user).date()
    cached = await db.get_cached_content(kind, day)
    if cached:
        return cached
    text = await ask(prompts.persona(light=True) + "\n\n" + prompt_body, user_msg,
                     temperature=temperature, max_tokens=220)
    return await db.save_cached_content(kind, day, text)


async def daily_motivation(context: ContextTypes.DEFAULT_TYPE) -> None:
    user, chat = await _ctx(context)
    if not user:
        return
    note = _note(context)
    if note:  # lembrete com pedido específico → frase pra essa pessoa
        frase = await ask(prompts.persona(user["name"], None, user["coach_tone"], user["coach_note"], light=True) + "\n\n" + prompts.MOTIVATION + note,
                          "Gere a frase de hoje.", temperature=1.0, max_tokens=200)
    else:
        frase = await _shared_daily(user, "motivation", prompts.MOTIVATION, "Gere a frase de hoje.", 1.0)
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
    should_advance = (getattr(context, "job", None) and context.job.data or {}).get("advance", True)

    # trilha adaptativa: errou um quiz → hoje é revisão desse tópico, não o próximo da trilha.
    # não consome a fila em /hoje (should_advance=False) pra não "gastar" a revisão só de olhar.
    review_topic = await db.pop_review_topic(user["id"]) if should_advance else None
    if review_topic:
        texto = await ask(
            prompts.persona(user["name"], plan["goal"], user["coach_tone"], user["coach_note"])
            + "\n\n" + prompts.REVIEW_GUIDE + _note(context),
            f"Tópico pra revisar: {review_topic}", temperature=0.7, max_tokens=200,
        )
        await _deliver(context, user, chat, "Dia de revisão", texto)
        await db.add_task(user["id"], day, "trilha", f"Revisão: {review_topic}", None)
        await db.log_event(user["id"], "msg:guide", day, {"revisao": review_topic})
        return  # não avança o dia — o tópico novo espera a revisão passar

    texto = await ask(prompts.persona(user["name"], plan["goal"], user["coach_tone"], user["coach_note"]) + "\n\n" + prompts.LEARNING_GUIDE + _note(context),
                      prompts.learning_context(plan), temperature=0.7, max_tokens=170)
    await _deliver(context, user, chat, "O que fazer hoje", f"🧭 *Guia do dia*\n\n{texto}")
    topic = prompts.today_topic(plan)
    if topic:
        await db.add_task(user["id"], day, "trilha", topic["topic"], topic["goal"])
    await db.log_event(user["id"], "msg:guide", day)
    lvl = await xp.sync_and_maybe_announce(user["id"], day)
    if lvl:
        await _deliver(context, user, chat, "Subiu de nível", lvl)
    if should_advance:
        _advance_day(plan)
        await db.update_plan_position(user["id"], plan["current"]["week"], plan["current"]["day"])


async def micro_learning(context: ContextTypes.DEFAULT_TYPE) -> None:
    user, chat = await _ctx(context)
    if not user:
        return
    plan = await db.get_plan(user["id"])
    if not plan:
        return
    texto = await ask(prompts.persona(user["name"], plan["goal"], user["coach_tone"], user["coach_note"]) + "\n\n" + prompts.MICRO_LEARNING + _note(context),
                      prompts.learning_context(plan), temperature=0.7, max_tokens=280)
    await _deliver(context, user, chat, "Pílula de conteúdo", f"📚 *Conteúdo rápido*\n\n{texto}")
    if "🎯" in texto:  # só espera resposta se a pílula realmente terminou com pergunta
        topic = prompts.today_topic(plan)
        await db.set_pending(user["id"], {
            "type": "micro_q",
            "topico": (topic or {}).get("topic", plan["goal"]),
            "pergunta": texto.split("🎯")[-1].strip()[:300],
        })
    await db.log_event(user["id"], "msg:micro", now_for(user).date())


async def learning_check(context: ContextTypes.DEFAULT_TYPE) -> None:
    user, chat = await _ctx(context)
    if not user:
        return
    plan = await db.get_plan(user["id"])
    if not plan:
        return
    # só tópicos desta trilha (evita misturar com uma trilha antiga após /recomecar)
    since = now_for(user).date().replace(day=1)
    made = plan.get("created_at")
    if made is not None:
        since = max(since, made.date() if hasattr(made, "date") else since)
    events = await db.events_since(user["id"], since)
    tops = prompts.recent_topics(plan, events)
    quiz = await ask_json(prompts.persona(user["name"], plan["goal"], user["coach_tone"], user["coach_note"]) + "\n\n" + prompts.QUIZ + _note(context),
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
        "reforco": (quiz.get("reforco") or "").strip()[:300],
        "reforco_resposta": (quiz.get("reforco_resposta") or "").strip()[:200],
        "reforco_explicacao": (quiz.get("reforco_explicacao") or "").strip()[:300],
    })


async def daily_insight(context: ContextTypes.DEFAULT_TYPE) -> None:
    user, chat = await _ctx(context)
    if not user:
        return
    # SEMPRE personalizado — o insight tem que ser da área da pessoa (goal). Compartilhar
    # 1 texto/dia entre todo mundo (como faz a motivação) misturava tópicos de gente com
    # objetivos diferentes (ex.: quem quer aprender vendas recebendo insight de programação).
    plan = await db.get_plan(user["id"])
    goal = plan["goal"] if plan else None
    texto = await ask(prompts.persona(user["name"], goal, user["coach_tone"], user["coach_note"], light=True) + "\n\n" + prompts.INSIGHT + _note(context),
                      "Gere o insight de hoje.", temperature=0.9, max_tokens=260)
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
    texto = await ask(prompts.persona(user["name"], plan["goal"], user["coach_tone"], user["coach_note"]) + "\n\n" + prompts.CHALLENGE + _note(context),
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
