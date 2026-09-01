"""Coleta de vitais da VM Oracle (1 OCPU / 1 GB RAM / 1 GB swap — apertado).

Tudo best-effort: cada métrica é isolada num try/except, então uma que falha não
derruba as outras nem o job. Em dev (Windows, sem /proc, sem systemctl) degrada
retornando o que der e segue a vida — não quebra py_compile nem build_app().
"""
from __future__ import annotations

import logging
import os
import shutil
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

log = logging.getLogger("aristotelia.vitals")

_STARTED = time.time()

# unidades systemd checadas (ver scripts/systemd/README.md) + o Postgres em Docker
_UNITS = ("aristotelia", "aristotelia-web", "aristotelia-backup.timer")
_PG_CONTAINER = "arist-pg"
_BACKUP_DIR = Path(os.path.expanduser("~/backups"))


def _loadavg() -> dict:
    try:
        a, b, c = Path("/proc/loadavg").read_text().split()[:3]
        return {"cpu_load_1": float(a), "cpu_load_5": float(b), "cpu_load_15": float(c)}
    except Exception:  # noqa: BLE001
        return {}


def _meminfo() -> dict:
    try:
        kb: dict[str, int] = {}
        for line in Path("/proc/meminfo").read_text().splitlines():
            key, _, rest = line.partition(":")
            parts = rest.strip().split()
            if parts:
                kb[key.strip()] = int(parts[0])  # valores em kB
        return {
            "mem_total_mb": kb.get("MemTotal", 0) // 1024,
            "mem_available_mb": kb.get("MemAvailable", 0) // 1024,
            "swap_total_mb": kb.get("SwapTotal", 0) // 1024,
            "swap_free_mb": kb.get("SwapFree", 0) // 1024,
        }
    except Exception:  # noqa: BLE001
        return {}


def _disk() -> dict:
    try:
        u = shutil.disk_usage("/")
        return {"disk_total_gb": round(u.total / 1e9, 1), "disk_free_gb": round(u.free / 1e9, 1)}
    except Exception:  # noqa: BLE001
        return {}


def _run(cmd: list[str]) -> str | None:
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        return r.stdout.strip()
    except Exception:  # noqa: BLE001
        return None


def _services() -> dict:
    out: dict[str, bool] = {}
    for unit in _UNITS:
        v = _run(["systemctl", "is-active", unit])
        if v is not None:
            out[unit] = v == "active"
    d = _run(["docker", "inspect", "-f", "{{.State.Running}}", _PG_CONTAINER])
    if d is not None:
        out[_PG_CONTAINER] = d == "true"
    return out


def _backup() -> dict:
    try:
        files = sorted(_BACKUP_DIR.glob("*.sql.gz"), key=lambda p: p.stat().st_mtime, reverse=True)
        if not files:
            return {}
        st = files[0].stat()
        return {
            "last_backup_at": datetime.fromtimestamp(st.st_mtime, timezone.utc),
            "last_backup_bytes": st.st_size,
        }
    except Exception:  # noqa: BLE001
        return {}


def collect() -> dict:
    """Snapshot dos vitais. `pg_size_bytes` é preenchido pelo db.save_vitals (tem a conexão)."""
    row: dict = {
        "cpu_load_1": None, "cpu_load_5": None, "cpu_load_15": None,
        "mem_total_mb": None, "mem_available_mb": None,
        "swap_total_mb": None, "swap_free_mb": None,
        "disk_total_gb": None, "disk_free_gb": None,
        "services": {},
        "last_backup_at": None, "last_backup_bytes": None,
        "bot_uptime_seconds": int(time.time() - _STARTED),
    }
    for part in (_loadavg(), _meminfo(), _disk(), _backup()):
        row.update(part)
    try:
        row["services"] = _services()
    except Exception:  # noqa: BLE001
        log.exception("vitals: falha ao checar serviços")
    return row
