"""Comandos do bot e roteamento das respostas de texto — multiusuário."""
from __future__ import annotations

import logging

from telegram import Update
from telegram.ext import ContextTypes

from . import config, db, llm, onboarding, prompts, usage
from .util import ask, ask_json, now_for, send_text

CHAT_DAILY_CAP = 40  # mensagens de conversa livre por usuário por dia

log = logging.getLogger("aristotelia.handlers")


async def _reply(update: Update, text: str) -> None:
    await send_text(update.get_bot(), update.effective_chat.id, text)


async def _me(update: Update):
    u = update.effective_user
    return await db.get_or_create_user(update.effective_chat.id, u.username if u else None,
                                       (u.full_name if u else None))


# ── comandos ─────────────────────────────────────────────────────────
async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = await _me(update)
    if config.SUPERADMIN_CHAT_ID and user["telegram_chat_id"] == config.SUPERADMIN_CHAT_ID \
            and user["role"] != "superadmin":
        await db.pool().execute("UPDATE users SET role='superadmin' WHERE id=$1", user["id"])
    if user["status"] == "onboarding":
        await onboarding.start(update, context, user)
    else:
        await _reply(update, "🌅 Já tá tudo rodando. /hoje pra ver o de hoje, /plano pra ver a trilha.")


async def cmd_recomecar(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Refaz o onboarding e gera uma trilha nova. Mantém streak, evolução e conteúdo."""
    user = await _me(update)
    log.info("/recomecar de %s (%s)", user["id"], user.get("name"))
    plan = await db.get_plan(user["id"])
    if not plan:
        await db.set_status(user["id"], "onboarding")
        return await onboarding.start(update, context, user)
    await db.set_pending(user["id"], {"type": "recomecar_confirm"})
    await _reply(
        update,
        "🔄 Isso apaga sua trilha atual e monta uma nova do zero "
        "(seu streak, evolução e banco de conteúdo continuam).\n\n"
        "Manda *sim* pra confirmar.",
    )


async def _recomecar_confirm(update: Update, context: ContextTypes.DEFAULT_TYPE, user, text: str) -> None:
    if not text.strip().lower().startswith(("s", "y")):
        await db.set_pending(user["id"], None)
        return await _reply(update, "Deixa quieto — trilha atual mantida.")
    log.info("recomecar confirmado por %s — desativando trilha e refazendo onboarding", user["id"])
    await db.deactivate_plan(user["id"])
    await db.set_status(user["id"], "onboarding")
    await onboarding.start(update, context, user)


async def cmd_pausar(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Pausa TODOS os lembretes sem quebrar o streak. /voltar retoma."""
    user = await _me(update)
    if user["status"] != "active":
        return await _reply(update, "Nada rodando pra pausar. /start monta sua trilha.")
    await db.set_status(user["id"], "paused")
    from .scheduling import schedule_user
    await schedule_user(context.application, await db.get_user(user["id"]))
    await _reply(update, "⏸️ Pausei tudo. Seu streak e sua trilha ficam parados esperando. "
                         "Quando quiser voltar, manda /voltar. Sem culpa.")


async def cmd_voltar(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = await _me(update)
    if user["status"] == "onboarding":
        return await _reply(update, "Você ainda não terminou o onboarding. Manda /start.")
    if user["status"] == "active":
        return await _reply(update, "Já tá tudo rodando. /hoje pra ver o de hoje.")
    await db.set_status(user["id"], "active")
    from .scheduling import schedule_user
    await schedule_user(context.application, await db.get_user(user["id"]))
    await _reply(update, "▶️ Voltamos. Os lembretes retomam amanhã no horário. Bora de onde parou.")


async def cmd_hoje(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    from .jobs import daily_learning_guide
    user = await _me(update)
    if user["status"] != "active":
        return await _reply(update, "Manda /start pra montar sua trilha primeiro.")

    class _J:  # mini-shim pro job callback — advance=False: /hoje mostra, não pula o dia
        data = {"user_id": str(user["id"]), "advance": False}
    context.job = _J()
    await daily_learning_guide(context)


async def cmd_jasei(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = await _me(update)
    plan = await db.get_plan(user["id"])
    if not plan:
        return await _reply(update, "Você ainda não tem trilha. /start")
    topic = prompts.today_topic(plan)
    if topic:
        await db.add_known_topic(user["id"], topic["topic"])
    _advance(plan)
    await db.update_plan_position(user["id"], plan["current"]["week"], plan["current"]["day"])
    await _reply(update, "✅ Pulei esse. Próximo tópico vem no /hoje.")


async def cmd_skip(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = await _me(update)
    plan = await db.get_plan(user["id"])
    if not plan:
        return await _reply(update, "Você ainda não tem trilha. /start")
    _advance(plan)
    await db.update_plan_position(user["id"], plan["current"]["week"], plan["current"]["day"])
    await _reply(update, "⏭️ Pulei pro próximo dia da trilha.")


async def cmd_plano(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = await _me(update)
    plan = await db.get_plan(user["id"])
    if not plan:
        return await _reply(update, "Você ainda não tem trilha. /start")
    cur = plan["current"]
    linhas = [f"🗺️ *Trilha* — {plan['goal']}\n"]
    for w in plan["weeks"]:
        marca = "👉" if w["n"] == cur["week"] else "  "
        linhas.append(f"{marca} *Semana {w['n']}* — {w['theme']}")
        for d in w["days"]:
            aqui = " ⬅️ hoje" if (w["n"] == cur["week"] and d["d"] == cur["day"]) else ""
            linhas.append(f"     {d['d']}. {d['topic']}{aqui}")
    await _reply(update, "\n".join(linhas))


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = await _me(update)
    plan = await db.get_plan(user["id"])
    streak = await db.get_streak(user["id"])
    day = now_for(user).date()
    tasks = await db.get_tasks(user["id"], day)
    done = sum(1 for t in tasks if t["status"] == "done")
    pos = f"semana {plan['current']['week']}, dia {plan['current']['day']}" if plan else "sem trilha"
    await _reply(
        update,
        f"📊 *Status*\n\nStreak: {streak['current']} dia(s) (recorde {streak['best']})\n"
        f"Trilha: {pos}\nChecklist de hoje: {done}/{len(tasks)}",
    )


async def cmd_conteudo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = await _me(update)
    await db.set_pending(user["id"], {"type": "content_idea"})
    await _reply(update, "💡 Qual é a ideia de conteúdo? Manda em 1 frase.")


async def cmd_foco(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = await _me(update)
    args = context.args or []
    minutes = 25
    if args and args[0].isdigit():
        minutes = max(5, min(90, int(args[0])))
    sid = await db.start_focus(user["id"], minutes)
    context.job_queue.run_once(
        _focus_done, minutes * 60,
        data={"user_id": str(user["id"]), "sid": str(sid), "minutes": minutes, "chat": user["telegram_chat_id"]},
        name=f"{user['id']}:focus",
    )
    await _reply(update, f"⏳ Foco de {minutes} min começando. Silêncio até acabar. Bora.")


async def _focus_done(context: ContextTypes.DEFAULT_TYPE) -> None:
    d = context.job.data
    await db.end_focus(d["sid"], completed=True)
    user = await db.get_user(d["user_id"])
    await db.log_event(user["id"], "foco", now_for(user).date(), {"minutos": d["minutes"]})
    await send_text(context.bot, d["chat"], f"✅ {d['minutes']} min de foco no bolso. Anota o que avançou.")


async def cmd_painel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = await _me(update)
    code = await db.create_auth_code(user["id"])
    await _reply(
        update,
        "🔑 *Painel web* — checklist do dia, cronômetro de foco, árvore de evolução e a "
        "trilha inteira desenhada.\n\n"
        f"1. Abre {config.WEB_URL}/entrar\n"
        f"2. Cola este código (vale 10 min):\n\n`{code}`",
    )


# ── roteamento de texto ─────────────────────────────────────────────
async def on_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = await _me(update)
    text = (update.message.text or "").strip()
    pending = await db.get_pending(user["id"]) or {}
    ptype = pending.get("type")

    if ptype == "onboarding":
        return await onboarding.handle(update, context, user, pending)

    if ptype == "recomecar_confirm":
        return await _recomecar_confirm(update, context, user, text)

    await db.push_history(user["id"], "user", text)

    if ptype == "quiz":
        usage.set_context(user["id"], "quiz")
        await _quiz(update, user, pending, text)
    elif ptype == "quiz2":
        usage.set_context(user["id"], "quiz")
        await _quiz2(update, user, pending, text)
    elif ptype == "micro_q":
        usage.set_context(user["id"], "micro")
        await _micro_q(update, user, pending, text)
    elif ptype in ("challenge", "challenge_done"):
        usage.set_context(user["id"], "desafio")
        await _challenge(update, user, pending, text)
    elif ptype == "review":
        usage.set_context(user["id"], "review")
        await _review(update, user, text)
    elif ptype == "content_confirm":
        await _content_confirm(update, user, text)
    elif ptype == "content_idea":
        usage.set_context(user["id"], "conteudo")
        await _content_idea(update, user, text)
    else:
        day = now_for(user).date()
        if await db.chat_count_today(user["id"], day) >= CHAT_DAILY_CAP:
            return await _reply(
                update,
                f"😌 Você bateu o limite de {CHAT_DAILY_CAP} mensagens de conversa hoje. "
                "As da trilha (quiz, desafio, fechamento) seguem normais — amanhã a gente retoma o papo.",
            )
        await db.log_event(user["id"], "msg:chat", day)
        usage.set_context(user["id"], "chat")
        plan = await db.get_plan(user["id"])
        goal = plan["goal"] if plan else None
        topic = prompts.today_topic(plan)["topic"] if plan else None
        hist = await db.get_history(user["id"])
        resp = await ask(
            prompts.persona(user["name"], goal, user["coach_tone"], user["coach_note"])
            + f"\n\nVocê está numa conversa com a pessoa. O tópico de hoje na trilha dela é: "
            f"{topic or 'ainda sem trilha'}. Responda direto, sincero, sem textão, sempre dentro do "
            "objetivo dela. Use o histórico pra manter o contexto.",
            text, history=hist[:-1], max_tokens=500,
        )
        await db.push_history(user["id"], "assistant", resp)
        await _reply(update, resp)


async def _quiz(update: Update, user, pending: dict, text: str) -> None:
    escolha = next((c for c in text.upper() if c in "ABC"), None)
    if not escolha:
        return await _reply(update, "Responde só com A, B ou C.")
    acertou = escolha == pending.get("correta", "")
    day = now_for(user).date()
    topico = pending.get("topico", "")
    await db.log_event(user["id"], "quiz", day,
                       {"topico": topico, "resultado": "acerto" if acertou else "erro"})
    if not acertou:  # trilha adaptativa: entra na fila de revisão do dia do guia
        await db.add_review_topic(user["id"], topico)
    exp = pending.get("explicacao", "")
    head = f"✅ Isso. {exp}" if acertou else f"❌ Era *{pending.get('correta')}*. {exp}"

    reforco = (pending.get("reforco") or "").strip()
    if reforco:
        await db.set_pending(user["id"], {
            "type": "quiz2",
            "topico": pending.get("topico", ""),
            "pergunta": reforco,
            "resposta": pending.get("reforco_resposta", ""),
            "explicacao": pending.get("reforco_explicacao", ""),
        })
        await _reply(update, f"{head}\n\nAgora reforça: {reforco}\n_Pensa aí, sem rodar._ 👀")
    else:
        await db.set_pending(user["id"], None)
        await _reply(update, head)


async def _quiz2(update: Update, user, pending: dict, text: str) -> None:
    plan = await db.get_plan(user["id"])
    goal = plan["goal"] if plan else None
    resp = await ask(
        prompts.persona(user["name"], goal, user["coach_tone"], user["coach_note"])
        + f"\n\nPergunta de reforço: {pending.get('pergunta', '')}\n"
        f"Resposta certa: {pending.get('resposta', '')}\n"
        f"Motivo: {pending.get('explicacao', '')}\n\n"
        "A pessoa respondeu abaixo. Em no máximo 3 linhas: se acertou, confirma e dá 1 linha ligando "
        "ao uso real; se errou, corrige gentil apontando só o que faltou. "
        "Fecha dizendo que o próximo desafio prático é às 16h.",
        text, max_tokens=220,
    )
    await db.set_pending(user["id"], None)
    await db.log_event(user["id"], "quiz_reforco", now_for(user).date(),
                       {"topico": pending.get("topico", "")})
    await db.push_history(user["id"], "assistant", resp)
    await _reply(update, resp)


async def _micro_q(update: Update, user, pending: dict, text: str) -> None:
    plan = await db.get_plan(user["id"])
    goal = plan["goal"] if plan else None
    resp = await ask(
        prompts.persona(user["name"], goal, user["coach_tone"], user["coach_note"])
        + f"\n\nVocê perguntou sobre '{pending.get('topico', '')}': {pending.get('pergunta', '')}\n\n"
        "A pessoa respondeu abaixo. Em no máximo 3 linhas: diz se está certo, corrige só o que estiver "
        "errado (sem reescrever tudo) e, se fizer sentido, faz UMA pergunta de reforço curta.",
        text, max_tokens=220,
    )
    await db.set_pending(user["id"], None)
    await db.push_history(user["id"], "assistant", resp)
    await _reply(update, resp)


_DONE_WORDS = ("terminei", "terminado", "consegui", "feito", "pronto", "acabei", "fiz",
               "concluí", "conclui", "resolvi", "deu certo", "funcionou")


async def _challenge(update: Update, user, pending: dict, text: str) -> None:
    day = now_for(user).date()
    desafio = pending.get("text", "o desafio de hoje")
    plan = await db.get_plan(user["id"])
    goal = plan["goal"] if plan else None
    hist = await db.get_history(user["id"])

    if any(w in text.lower() for w in _DONE_WORDS):
        await db.auto_complete(user["id"], day, "desafio")
        await db.log_event(user["id"], "desafio", day, {"nota": text[:300]})
        await db.set_pending(user["id"], None)
        resp = await ask(
            prompts.persona(user["name"], goal, user["coach_tone"], user["coach_note"])
            + f"\n\nO desafio era:\n{desafio}\n\nA pessoa disse que terminou. "
            "Dê um retorno curto e sincero — se ela colou a solução, comente 1 ponto; se não, só reconheça e provoque a continuar.",
            text, history=hist, max_tokens=350,
        )
        await db.push_history(user["id"], "assistant", resp)
        return await _reply(update, f"🛠️ {resp}")

    # ainda no desafio: ajuda, sem marcar como feito
    resp = await ask(
        prompts.persona(user["name"], goal, user["coach_tone"], user["coach_note"])
        + f"\n\nA pessoa está fazendo este desafio AGORA:\n{desafio}\n\n"
        "Ela te mandou uma mensagem. Se for dúvida, ajude com uma pista — NÃO entregue a solução pronta. "
        "Se for uma tentativa, dê feedback. Mantenha o desafio em pé. Curto, sem textão.",
        text, history=hist, max_tokens=450,
    )
    await db.push_history(user["id"], "assistant", resp)
    await _reply(update, resp)


async def _review(update: Update, user, text: str) -> None:
    data_str = now_for(user).strftime("%d/%m")
    plan = await db.get_plan(user["id"])
    goal = plan["goal"] if plan else None
    card = await ask(prompts.persona(user["name"], goal, user["coach_tone"], user["coach_note"], light=True) + "\n\n" + prompts.REVIEW_FORMAT.replace("{data}", data_str),
                     f"Resposta da pessoa:\n{text}", label=True, temperature=0.6, max_tokens=450)
    day = now_for(user).date()
    new_streak = await db.bump_streak(user["id"], day)
    await db.log_event(user["id"], "review", day, {"raw": text[:500]})
    await db.auto_complete(user["id"], day, "trilha")
    await _reply(update, card)
    await _reply(update, f"🔥 Streak: {new_streak} dia(s).\n\n💡 Isso pode virar conteúdo? (sim / não)")
    await db.set_pending(user["id"], {"type": "content_confirm"})


async def _content_confirm(update: Update, user, text: str) -> None:
    if text.lower().startswith(("s", "y")):
        await db.set_pending(user["id"], {"type": "content_idea"})
        await _reply(update, "Qual foi a ideia? Manda em 1 frase.")
    else:
        await db.set_pending(user["id"], None)
        await _reply(update, "Fechado. Amanhã a gente sobe 1%.")


async def _content_idea(update: Update, user, text: str) -> None:
    info = await ask_json(prompts.persona(user["name"], None, user["coach_tone"], user["coach_note"], light=True) + "\n\n" + prompts.CONTENT_CLASSIFY, text,
                          max_tokens=300) or {}
    await db.add_content_idea(
        user["id"], theme=info.get("tema") or text[:60], type=info.get("tipo", ""),
        format=info.get("formato", ""), title=info.get("titulo", ""), note=text,
        origin_date=now_for(user).date(),
    )
    await db.set_pending(user["id"], None)
    await _reply(update, f"📦 Salvo no banco de conteúdo.\nSugestão: *{info.get('formato', 'post')}* — "
                         f"\"{info.get('titulo', '')}\"")


# ── helper de trilha ────────────────────────────────────────────────
def _advance(plan: dict) -> None:
    cur = plan["current"]
    week = next((w for w in plan["weeks"] if w["n"] == cur["week"]), None)
    total = len(week["days"]) if week else 5
    max_week = max((w["n"] for w in plan["weeks"]), default=cur["week"])
    if cur["day"] < total:
        cur["day"] += 1
    elif cur["week"] < max_week:
        cur["week"] += 1
        cur["day"] = 1
