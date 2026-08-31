"""Comandos do bot e roteamento das respostas de texto."""
from __future__ import annotations

import asyncio
import logging

from telegram import Update
from telegram.ext import ContextTypes

from . import jobs, llm, prompts, storage

log = logging.getLogger("aristotelia.handlers")

WELCOME = (
    "🌅 *Aristótel.IA* — sua treinadora de evolução 1%.\n\n"
    "A partir de agora eu te acompanho todo dia:\n"
    "06:00 motivação · 08:00 o que estudar · 09:00 pílula · 10:30 quiz · "
    "15:00 insight · 16:00 desafio · 20:00 fechamento.\n\n"
    "Domingo: revisão da semana e ideias de conteúdo.\n\n"
    "Comandos: /hoje /jasei /skip /plano /status /conteudo"
)


async def _reply(update: Update, text: str) -> None:
    await jobs.send_text(update.get_bot(), update.effective_chat.id, text)


# --- comandos ----------------------------------------------------------
async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    prog = storage.load("progress")
    prog["chat_id"] = update.effective_chat.id
    if not prog.get("started_at"):
        prog["started_at"] = storage.now().isoformat()
    storage.save("progress", prog)
    await _reply(update, WELCOME)


async def cmd_hoje(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await jobs.daily_learning_guide(context)


async def cmd_jasei(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    plan = storage.load("learning_plan")
    day = _current_day(plan)
    if day:
        known = plan.setdefault("known_topics", [])
        if day["topic"] not in known:
            known.append(day["topic"])
    _advance(plan)
    storage.save("learning_plan", plan)
    await _reply(update, "✅ Beleza, pulei esse. Próximo tópico vem no /hoje.")


async def cmd_skip(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    plan = storage.load("learning_plan")
    _advance(plan)
    storage.save("learning_plan", plan)
    await _reply(update, "⏭️ Pulei pro próximo dia da trilha.")


async def cmd_plano(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    plan = storage.load("learning_plan")
    cur = plan.get("current", {"week": 1, "day": 1})
    linhas = ["🗺️ *Trilha*\n"]
    for w in plan.get("weeks", []):
        marca = "👉" if w["n"] == cur["week"] else "  "
        linhas.append(f"{marca} *Semana {w['n']}* — {w['theme']}")
        for d in w.get("days", []):
            aqui = " ⬅️ hoje" if (w["n"] == cur["week"] and d["d"] == cur["day"]) else ""
            linhas.append(f"     {d['d']}. {d['topic']}{aqui}")
    await _reply(update, "\n".join(linhas))


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    prog = storage.load("progress")
    plan = storage.load("learning_plan")
    cur = plan.get("current", {"week": 1, "day": 1})
    n = len(storage.load("daily_log").get("entries", []))
    await _reply(
        update,
        f"📊 *Status*\n\n"
        f"Streak: {prog.get('streak', 0)} dia(s)\n"
        f"Trilha: semana {cur['week']}, dia {cur['day']}\n"
        f"Registros: {n}",
    )


async def cmd_conteudo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    storage.set_pending({"type": "content_idea"})
    await _reply(update, "💡 Qual é a ideia de conteúdo? Manda em 1 frase.")


# --- roteamento de texto --------------------------------------------
async def on_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = (update.message.text or "").strip()
    pending = storage.get_pending() or {}
    ptype = pending.get("type")

    if ptype == "quiz":
        await _handle_quiz(update, pending, text)
    elif ptype == "review":
        await _handle_review(update, text)
    elif ptype == "content_confirm":
        await _handle_content_confirm(update, text)
    elif ptype == "content_idea":
        await _handle_content_idea(update, text)
    else:
        resposta = await asyncio.to_thread(
            llm.generate,
            prompts.PERSONA,
            f"A Fernanda te mandou: {text}\nResponda como treinadora: direto, sincero, sem textão.",
            max_tokens=500,
        )
        await _reply(update, llm.tidy(resposta))


async def _handle_quiz(update: Update, pending: dict, text: str) -> None:
    escolha = next((c for c in text.upper() if c in "ABC"), None)
    if not escolha:
        await _reply(update, "Responde só com A, B ou C.")
        return
    correta = pending.get("correta", "")
    acertou = escolha == correta
    storage.log_event("quiz", topic=pending.get("topico", ""), result="acerto" if acertou else "erro")
    storage.set_pending(None)
    exp = pending.get("explicacao", "")
    if acertou:
        await _reply(update, f"✅ Isso. {exp}")
    else:
        await _reply(update, f"❌ Era *{correta}*. {exp}")


async def _handle_review(update: Update, text: str) -> None:
    data = storage.now().strftime("%d/%m")
    card = llm.tidy(
        await asyncio.to_thread(
            llm.generate,
            prompts.PERSONA + "\n\n" + prompts.REVIEW_FORMAT.replace("{data}", data),
            f"Resposta da Fernanda:\n{text}",
            temperature=0.6,
            max_tokens=500,
        )
    )
    prog = storage.load("progress")
    hoje = storage.today_str()
    if prog.get("last_review_date") != hoje:
        prog["streak"] = prog.get("streak", 0) + 1
        prog["last_review_date"] = hoje
    storage.save("progress", prog)
    storage.log_event("review", raw=text)
    await _reply(update, card)
    storage.set_pending({"type": "content_confirm"})
    await _reply(update, "💡 Isso pode virar conteúdo? (sim / não)")


async def _handle_content_confirm(update: Update, text: str) -> None:
    if text.lower().startswith(("s", "sim", "y")):
        storage.set_pending({"type": "content_idea"})
        await _reply(update, "Qual foi a ideia? Manda em 1 frase.")
    else:
        storage.set_pending(None)
        await _reply(update, "Fechado. Amanhã a gente sobe 1%.")


async def _handle_content_idea(update: Update, text: str) -> None:
    info = await asyncio.to_thread(
        llm.generate_json, prompts.PERSONA + "\n\n" + prompts.CONTENT_CLASSIFY, text, max_tokens=250
    ) or {}
    bank = storage.load("content_bank")
    bank["ideas"].append(
        {
            "tema": info.get("tema") or text[:60],
            "tipo": info.get("tipo", ""),
            "formato": info.get("formato", ""),
            "titulo": info.get("titulo", ""),
            "origem": storage.today_str(),
            "nota": text,
        }
    )
    storage.save("content_bank", bank)
    storage.set_pending(None)
    titulo = info.get("titulo", "")
    fmt = info.get("formato", "post")
    await _reply(update, f"📦 Salvo no banco de conteúdo.\nSugestão: *{fmt}* — \"{titulo}\"")


# --- helpers de trilha --------------------------------------------
def _current_day(plan: dict):
    cur = plan.get("current", {"week": 1, "day": 1})
    week = next((w for w in plan.get("weeks", []) if w["n"] == cur["week"]), None)
    if not week:
        return None
    return next((d for d in week["days"] if d["d"] == cur["day"]), None)


def _advance(plan: dict) -> None:
    cur = plan.setdefault("current", {"week": 1, "day": 1})
    week = next((w for w in plan.get("weeks", []) if w["n"] == cur["week"]), None)
    total = len(week["days"]) if week else 5
    max_week = max((w["n"] for w in plan.get("weeks", [])), default=cur["week"])
    if cur["day"] < total:
        cur["day"] += 1
    elif cur["week"] < max_week:
        cur["week"] += 1
        cur["day"] = 1
