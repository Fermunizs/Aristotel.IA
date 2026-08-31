"""Envio de Web Push (canal 'push' dos lembretes)."""
from __future__ import annotations

import json
import logging

from pywebpush import WebPushException, webpush

from . import config, db

log = logging.getLogger("aristotelia.push")


async def send(user_id, title: str, body: str, url: str | None = None) -> int:
    """Manda uma notificação pra todos os dispositivos do usuário. Devolve quantos deram certo."""
    if not config.VAPID_PRIVATE_KEY:
        log.warning("VAPID não configurado — push ignorado.")
        return 0

    subs = await db.get_push_subs(user_id)
    if not subs:
        return 0

    payload = json.dumps({"title": title, "body": body[:180], "url": url or config.WEB_URL})
    ok = 0
    for s in subs:
        info = {
            "endpoint": s["endpoint"],
            "keys": {"p256dh": s["p256dh"], "auth": s["auth"]},
        }
        try:
            webpush(
                subscription_info=info,
                data=payload,
                vapid_private_key=config.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": "mailto:aristotelia@bot"},
            )
            ok += 1
            await db.mark_push_ok(s["id"])
        except WebPushException as e:
            code = getattr(e.response, "status_code", None)
            if code in (404, 410):  # inscrição morta
                await db.delete_push_sub(s["id"])
                log.info("push sub %s expirada, removida", s["id"])
            else:
                log.warning("push falhou (%s): %s", code, e)
        except Exception:  # noqa: BLE001
            log.exception("push: erro inesperado")
    return ok
