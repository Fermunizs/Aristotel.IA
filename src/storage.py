"""Leitura/escrita dos arquivos JSON em data/. Cria defaults se faltar."""
from __future__ import annotations

import json
from datetime import datetime

from .config import DATA_DIR, ROOT, TZ

SEEDS_DIR = ROOT / "seeds"

_DEFAULTS: dict[str, dict] = {
    "progress": {
        "chat_id": None,
        "started_at": None,
        "streak": 0,
        "last_review_date": None,
        "pending": None,
    },
    "content_bank": {"ideas": []},
    "daily_log": {"entries": []},
}


def now() -> datetime:
    return datetime.now(TZ)


def today_str() -> str:
    return now().strftime("%Y-%m-%d")


def _path(name: str):
    return DATA_DIR / f"{name}.json"


def load(name: str) -> dict:
    p = _path(name)
    if not p.exists():
        seed = SEEDS_DIR / f"{name}.json"
        if seed.exists():
            with seed.open(encoding="utf-8") as f:
                data = json.load(f)
        else:
            data = _DEFAULTS.get(name, {})
        save(name, data)
        return json.loads(json.dumps(data))  # cópia
    with p.open(encoding="utf-8") as f:
        return json.load(f)


def save(name: str, data: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = _path(name).with_suffix(".json.tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    tmp.replace(_path(name))


# --- helpers de progresso ------------------------------------------------

def get_chat_id():
    return load("progress").get("chat_id")


def set_pending(pending: dict | None) -> None:
    prog = load("progress")
    prog["pending"] = pending
    save("progress", prog)


def get_pending() -> dict | None:
    return load("progress").get("pending")


def log_event(kind: str, **fields) -> None:
    log = load("daily_log")
    log["entries"].append({"date": today_str(), "kind": kind, **fields})
    save("daily_log", log)
