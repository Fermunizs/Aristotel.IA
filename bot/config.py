"""Configuração central: env vars, timezone, horários e modelos do LLM."""
from __future__ import annotations

import os
from datetime import time
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

load_dotenv()

# --- Paths -----------------------------------------------------------------
ROOT = Path(__file__).resolve().parent.parent

# --- Telegram ------------------------------------------------------------
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN", "").strip()

# --- Banco -------------------------------------------------------------
DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://arist:arist_local_dev@127.0.0.1:5432/aristotelia"
).strip()

# --- Timezone padrão (cada usuário tem o seu em users.timezone) ----------
DEFAULT_TZ_NAME = os.getenv("TZ", "America/Sao_Paulo")
DEFAULT_TZ = ZoneInfo(DEFAULT_TZ_NAME)

# --- LLM ---------------------------------------------------------------
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "groq").strip().lower()

_PROVIDERS = {
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "api_key_env": "GROQ_API_KEY",
        # alternativas nesta conta: qwen/qwen3.8-27b (PT mais natural), openai/gpt-oss-20b
        "default_model": "openai/gpt-oss-120b",
    },
    "openrouter": {
        "base_url": "https://openrouter.ai/api/v1",
        "api_key_env": "OPENROUTER_API_KEY",
        "default_model": "meta-llama/llama-3.3-70b-instruct:free",
    },
}

_p = _PROVIDERS.get(LLM_PROVIDER, _PROVIDERS["groq"])
LLM_BASE_URL = _p["base_url"]
LLM_API_KEY = os.getenv(_p["api_key_env"], "").strip()
LLM_MODEL = os.getenv("LLM_MODEL", "").strip() or _p["default_model"]

# --- Painel web ------------------------------------------------------
WEB_URL = os.getenv("WEB_URL", "http://localhost:3000").strip().rstrip("/")

# --- Superadmin (promovido no /start se o chat_id bater) ----------------
_sa = os.getenv("SUPERADMIN_CHAT_ID", "").strip()
SUPERADMIN_CHAT_ID = int(_sa) if _sa.lstrip("-").isdigit() else None

# --- Lembretes: kind do lembrete -> função que executa -----------------
REMINDER_JOBS: dict[str, str] = {
    "motivacao": "daily_motivation",
    "guia": "daily_learning_guide",
    "pilula": "micro_learning",
    "quiz": "learning_check",
    "insight": "daily_insight",
    "desafio": "application_challenge",
    "checkin_manha": "daily_motivation",
    "checkin_noite": "daily_review",
    "livre": "free_reminder",
}

# schedule_type='periodo' -> hora local
PERIOD_TIMES: dict[str, time] = {
    "manha": time(8, 0),
    "tarde": time(15, 0),
    "noite": time(20, 0),
}

# jobs de domingo continuam fixos (não são lembretes configuráveis por ora)
WEEKLY_TIMES: dict[str, time] = {
    "weekly_review": time(10, 0),
    "content_planner": time(11, 0),
    "advance_week": time(11, 5),
}
WEEKLY_FUNCTIONS = list(WEEKLY_TIMES)

SUNDAY = 6  # datetime.weekday(): segunda=0 ... domingo=6
