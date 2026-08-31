"""Configuração central: env vars, timezone, horários e modelos do LLM."""
from __future__ import annotations

import os
from datetime import time
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

load_dotenv()

# --- Paths -------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"

# --- Telegram --------------------------------------------------------------
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN", "").strip()

# --- Timezone -------------------------------------------------------------
TZ_NAME = os.getenv("TZ", "America/Sao_Paulo")
TZ = ZoneInfo(TZ_NAME)

# --- LLM -------------------------------------------------------------------
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

# --- Horários (America/Sao_Paulo) -----------------------------------------
# nome do job -> horário. Os jobs semanais checam o dia da semana internamente.
SCHEDULE: dict[str, time] = {
    "daily_motivation": time(6, 0, tzinfo=TZ),
    "daily_learning_guide": time(8, 0, tzinfo=TZ),
    "micro_learning": time(9, 0, tzinfo=TZ),
    "learning_check": time(10, 30, tzinfo=TZ),
    "daily_insight": time(15, 0, tzinfo=TZ),
    "application_challenge": time(16, 0, tzinfo=TZ),
    "daily_review": time(20, 0, tzinfo=TZ),
    # domingo
    "weekly_review": time(10, 0, tzinfo=TZ),
    "content_planner": time(11, 0, tzinfo=TZ),
    "advance_week": time(11, 5, tzinfo=TZ),
}

SUNDAY = 6  # datetime.weekday(): segunda=0 ... domingo=6
