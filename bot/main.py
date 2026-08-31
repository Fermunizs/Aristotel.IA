"""Entrypoint: cria o bot, registra handlers, agenda os jobs e roda."""
from __future__ import annotations

import logging

from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    filters,
)

from . import config, handlers, weekly
from .jobs import JOBS

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    level=logging.INFO,
)
log = logging.getLogger("aristotelia")


async def _on_error(update: object, context) -> None:
    log.error("Erro no handler/job: %s", context.error, exc_info=context.error)


def build_app() -> Application:
    if not config.TELEGRAM_TOKEN:
        raise SystemExit("TELEGRAM_TOKEN não definido. Preencha o .env.")

    app = Application.builder().token(config.TELEGRAM_TOKEN).build()

    # comandos
    app.add_handler(CommandHandler("start", handlers.cmd_start))
    app.add_handler(CommandHandler("hoje", handlers.cmd_hoje))
    app.add_handler(CommandHandler("jasei", handlers.cmd_jasei))
    app.add_handler(CommandHandler("skip", handlers.cmd_skip))
    app.add_handler(CommandHandler("plano", handlers.cmd_plano))
    app.add_handler(CommandHandler("status", handlers.cmd_status))
    app.add_handler(CommandHandler("conteudo", handlers.cmd_conteudo))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handlers.on_text))
    app.add_error_handler(_on_error)

    # agendamento
    jq = app.job_queue
    for name, fn in JOBS.items():
        jq.run_daily(fn, time=config.SCHEDULE[name], name=name)
        log.info("Agendado %s às %s", name, config.SCHEDULE[name].strftime("%H:%M"))

    for name, fn in weekly.WEEKLY_JOBS.items():
        # roda todo dia; a função checa se é domingo
        jq.run_daily(fn, time=config.SCHEDULE[name], name=name)
        log.info("Agendado %s (domingo) às %s", name, config.SCHEDULE[name].strftime("%H:%M"))

    return app


def main() -> None:
    app = build_app()
    log.info("Aristótel.IA no ar. Provider LLM: %s (%s)", config.LLM_PROVIDER, config.LLM_MODEL)
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
