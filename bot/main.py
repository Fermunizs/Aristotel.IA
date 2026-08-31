"""Entrypoint: conecta o banco, agenda os usuários, roda o polling."""
from __future__ import annotations

import logging

from telegram.ext import Application, CommandHandler, MessageHandler, filters

from . import config, db, handlers, scheduling

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s: %(message)s", level=logging.INFO
)
log = logging.getLogger("aristotelia")


async def _post_init(app: Application) -> None:
    await db.connect()
    await scheduling.schedule_all(app)
    app.job_queue.run_repeating(_outbox_tick, interval=15, first=10, name="outbox")
    app.job_queue.run_repeating(_resync_tick, interval=60, first=30, name="resync")
    log.info("Aristótel.IA no ar. LLM: %s (%s)", config.LLM_PROVIDER, config.LLM_MODEL)


async def _resync_tick(context) -> None:
    n = await scheduling.resync_dirty(context.application)
    if n:
        log.info("Re-agendados %d usuários (lembretes mudaram)", n)


async def _post_shutdown(app: Application) -> None:
    await db.close()


async def _outbox_tick(context) -> None:
    for row in await db.pop_outbox():
        try:
            await context.bot.send_message(chat_id=row["telegram_chat_id"], text=row["text"])
            await db.mark_outbox_sent(row["id"])
        except Exception:  # noqa: BLE001
            log.exception("outbox: falha ao enviar %s", row["id"])


async def _on_error(update: object, context) -> None:
    log.error("Erro no handler/job: %s", context.error, exc_info=context.error)


def build_app() -> Application:
    if not config.TELEGRAM_TOKEN:
        raise SystemExit("TELEGRAM_TOKEN não definido. Preencha o .env.")

    app = (
        Application.builder()
        .token(config.TELEGRAM_TOKEN)
        .post_init(_post_init)
        .post_shutdown(_post_shutdown)
        .build()
    )

    app.add_handler(CommandHandler("start", handlers.cmd_start))
    app.add_handler(CommandHandler("hoje", handlers.cmd_hoje))
    app.add_handler(CommandHandler("jasei", handlers.cmd_jasei))
    app.add_handler(CommandHandler("skip", handlers.cmd_skip))
    app.add_handler(CommandHandler("plano", handlers.cmd_plano))
    app.add_handler(CommandHandler("status", handlers.cmd_status))
    app.add_handler(CommandHandler("conteudo", handlers.cmd_conteudo))
    app.add_handler(CommandHandler("foco", handlers.cmd_foco))
    app.add_handler(CommandHandler("painel", handlers.cmd_painel))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handlers.on_text))
    app.add_error_handler(_on_error)
    return app


def main() -> None:
    build_app().run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
