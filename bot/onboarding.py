"""Onboarding no Telegram: 4 perguntas → LLM gera a trilha → usuário fica ativo.

À prova de bala (ver Backlog.md B05):
- durante a geração da trilha o pending vai pra step='building' — mensagens nesse
  estado não disparam outra geração (era o bug que criava planos duplicados);
- semana que o LLM não consegue gerar vira uma versão mínima do tema, em vez de
  perder a trilha inteira;
- falha total agenda um retry automático (Groq free estoura TPM quando vários
  entram juntos), até 3 tentativas.
"""
from __future__ import annotations

import asyncio
import logging

from telegram import Update
from telegram.ext import ContextTypes

from . import db, prompts, scheduling, usage
from .util import ask_json, send_text

log = logging.getLogger("aristotelia.onboarding")

_LEVELS = {"1": "do zero", "2": "sei o básico", "3": "intermediário, quero aprofundar"}
_TONES = {"1": "gentil", "2": "equilibrada", "3": "durona"}
_MAX_BUILD_ATTEMPTS = 3
ONB_TONE = (
    "Última: como você quer que eu te cobre?\n\n"
    "1 — gentil, no meu ritmo\n2 — equilibrada\n3 — durona: pega no pé de verdade, sem amaciar"
)


def _stub_week(n: int, theme: str) -> dict:
    """Semana mínima quando o LLM não gera — melhor que perder a trilha inteira.
    O guia diário e o detalhamento sob demanda preenchem o resto depois."""
    theme = (theme or f"Semana {n}")[:80]
    return {
        "n": n,
        "theme": theme,
        "days": [{"d": i, "topic": f"{theme} — parte {i}", "goal": ""} for i in range(1, 6)],
    }


async def _gen_week(name: str | None, base: str, themes: list, n: int) -> dict | None:
    payload = f"{base}\nTemas das 4 semanas: {themes}\nDetalhe a semana {n}, tema: {themes[n - 1]}"
    wk = await ask_json(prompts.persona(name) + "\n\n" + prompts.TRILHA_SEMANA, payload, max_tokens=2500)
    days = (wk or {}).get("days")
    if not days or len(days) < 3:
        return None
    return {
        "n": n,
        "theme": (wk.get("theme") or themes[n - 1])[:80],
        "days": [{"d": i + 1, "topic": d["topic"], "goal": d.get("goal", "")}
                 for i, d in enumerate(days[:5])],
    }


async def build_trilha(name: str | None, goal: str, level: str, minutes: int) -> list | None:
    """Gera a trilha semana a semana (evita o limite de tokens/min do Groq free).

    Devolve None só se NENHUMA semana saiu (LLM totalmente fora) — aí o chamador
    agenda retry. Semana isolada que falha vira _stub_week."""
    base = f"Objetivo: {goal}\nNível: {level}\nMinutos por dia: {minutes}"
    plano = await ask_json(prompts.persona(name) + "\n\n" + prompts.TRILHA_PLANO, base, max_tokens=1200)
    themes = (plano or {}).get("themes") or []
    if len(themes) < 4:
        themes = [f"Semana {i}" for i in range(1, 5)]

    weeks: list = []
    real = 0
    for n in range(1, 5):
        wk = await _gen_week(name, base, themes, n)
        if wk is None:
            log.warning("build_trilha: semana %d falhou — usando stub do tema", n)
            wk = _stub_week(n, themes[n - 1])
        else:
            real += 1
        weeks.append(wk)
        await asyncio.sleep(1)  # respeita TPM do Groq free

    return weeks if real else None


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE, user) -> None:
    await db.set_pending(user["id"], {"type": "onboarding", "step": "goal", "answers": {}})
    await send_text(context.bot, user["telegram_chat_id"],
                    "🌅 Bom te ver aqui. Vou montar seu plano em 4 perguntas.\n\n" + prompts.ONB_GOAL)


async def handle(update: Update, context: ContextTypes.DEFAULT_TYPE, user, pending: dict) -> None:
    text = (update.message.text or "").strip()
    step = pending.get("step")
    answers = pending.get("answers", {})
    chat = user["telegram_chat_id"]

    if step == "building":
        # trilha sendo gerada agora — não dispara outra geração (era o bug dos planos duplicados)
        await send_text(context.bot, chat, "⏳ Tô montando tua trilha, chega já.")
        return

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
        answers["minutes"] = max(10, min(180, int(digits) if digits else 30))
        await db.set_pending(user["id"], {"type": "onboarding", "step": "tone", "answers": answers})
        await send_text(context.bot, chat, ONB_TONE)

    elif step == "tone":
        answers["tone"] = _TONES.get(next((c for c in text if c in "123"), "2"), "equilibrada")
        await _finish(context, user, answers)


async def _finish(context: ContextTypes.DEFAULT_TYPE, user, answers: dict, attempt: int = 1) -> None:
    chat = user["telegram_chat_id"]

    # idempotência: se já tem trilha (retry/duplo /start), só ativa e avisa
    existing = await db.get_plan(user["id"])
    if existing:
        await _activate(context, user, existing)
        return

    # trava: qualquer mensagem daqui pra frente cai no ramo step='building' do handle
    await db.set_pending(user["id"], {"type": "onboarding", "step": "building", "answers": answers})

    if attempt == 1:
        await send_text(context.bot, chat, "🧭 Fechado. Montando sua trilha... (uns segundos)")
    usage.set_context(user["id"], "trilha")

    try:
        weeks = await build_trilha(user["name"], answers["goal"], answers["level"], answers["minutes"])
    except Exception:  # noqa: BLE001
        log.exception("build_trilha explodiu (tentativa %d) p/ %s", attempt, user["id"])
        weeks = None

    if not weeks:
        await _schedule_retry(context, user, answers, attempt)
        return

    await db.create_plan(user["id"], answers["goal"], answers["level"], weeks)
    await db.clear_history(user["id"])  # trilha nova → conversa começa limpa
    await db.clear_future_trilha_tasks(user["id"])  # some com a checklist da trilha antiga
    await db.save_prefs(user["id"], minutes_per_day=answers["minutes"],
                        coach_tone=answers.get("tone", "equilibrada"))
    plan = await db.get_plan(user["id"])
    await _activate(context, user, plan)


async def _schedule_retry(context: ContextTypes.DEFAULT_TYPE, user, answers: dict, attempt: int) -> None:
    chat = user["telegram_chat_id"]
    if attempt >= _MAX_BUILD_ATTEMPTS or context.job_queue is None:
        # volta pro step 'tone': a próxima mensagem dela retenta na hora
        await db.set_pending(user["id"], {"type": "onboarding", "step": "tone", "answers": answers})
        await send_text(context.bot, chat,
                        "O gerador de trilha tá congestionado agora. Me manda qualquer mensagem "
                        "daqui a alguns minutos que eu tento de novo (ou /recomecar).")
        return

    delay = 60 * attempt
    await send_text(context.bot, chat,
                    f"Tô com fila pra gerar tua trilha. Tento de novo automático em ~{delay // 60} min.")
    context.job_queue.run_once(
        _retry_job, delay,
        data={"user_id": user["id"], "answers": answers, "attempt": attempt + 1},
        name=f"onb-retry-{user['id']}",
    )


async def _retry_job(context: ContextTypes.DEFAULT_TYPE) -> None:
    d = context.job.data
    user = await db.get_user(d["user_id"])
    if user is None or user["status"] == "active":
        return
    await _finish(context, user, d["answers"], attempt=d["attempt"])


async def _activate(context: ContextTypes.DEFAULT_TYPE, user, plan: dict) -> None:
    """Ativa o usuário: limpa pending, cria lembretes, agenda, manda a boas-vindas."""
    already_active = user["status"] == "active"
    await db.set_pending(user["id"], None)
    await db.set_status(user["id"], "active")
    # cria e agenda em passos separados: se o agendamento falhar, os lembretes
    # ainda existem (o painel mostra) e o _resync_tick pega via reminders_dirty.
    try:
        await db.create_default_reminders(user["id"])
    except Exception:  # noqa: BLE001
        log.exception("Falha ao criar lembretes de %s", user["id"])
    try:
        fresh = await db.get_user(user["id"])
        await scheduling.schedule_user(context.application, fresh)
    except Exception:  # noqa: BLE001
        log.exception("Falha ao agendar lembretes de %s", user["id"])

    if already_active:
        return  # re-entrada (duplo /start já ativo) — não repete a boas-vindas

    w1 = plan["weeks"][0]
    d1 = w1["days"][0]
    await send_text(
        context.bot, user["telegram_chat_id"],
        f"✅ Trilha pronta: *{len(plan['weeks'])} semanas*.\n\n"
        f"*Semana 1 — {w1['theme']}*\n"
        f"Começa hoje: {d1['topic']}\n_{d1.get('goal', '')}_\n\n"
        "Todo dia eu te mando aqui: motivação (06h), o que estudar (08h), pílula (09h), "
        "quiz (10h30), insight (15h), desafio (16h) e o fechamento (20h).\n\n"
        "📊 *E tem um painel web:* a checklist do dia, o cronômetro de foco, a árvore de "
        "evolução e a trilha inteira desenhada — dá pra marcar tarefa, ver o progresso e "
        "mexer nos horários por lá. Manda /painel que eu te passo o link e o código.\n\n"
        "Comandos: /hoje /jasei /plano /status /foco /painel /pausar /recomecar",
    )
