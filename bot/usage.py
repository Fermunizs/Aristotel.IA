"""Telemetria de consumo de LLM.

O llm.py roda dentro de uma thread (via asyncio.to_thread) e o DB é async, então
não dá pra gravar direto. Fluxo:
  1. os entry points (jobs, handlers) chamam set_context(user_id, tag)
  2. o llm.py chama record(...) a cada chamada — vai pra uma fila thread-safe
  3. um tick em main.py (_usage_tick) drena a fila e faz bulk insert
"""
from __future__ import annotations

import contextvars
import queue

_ctx: contextvars.ContextVar[dict] = contextvars.ContextVar("llm_ctx", default={})


def set_context(user_id=None, tag: str | None = None, source: str = "bot") -> None:
    _ctx.set({"user_id": str(user_id) if user_id else None, "tag": tag, "source": source})


def get_context() -> dict:
    c = _ctx.get()
    return {"user_id": c.get("user_id"), "tag": c.get("tag"), "source": c.get("source", "bot")}


_q: "queue.Queue[dict]" = queue.Queue(maxsize=20000)


def record(**row) -> None:
    try:
        _q.put_nowait(row)
    except queue.Full:  # telemetria nunca derruba o bot
        pass


def drain(limit: int = 500) -> list[dict]:
    out: list[dict] = []
    while len(out) < limit:
        try:
            out.append(_q.get_nowait())
        except queue.Empty:
            break
    return out
