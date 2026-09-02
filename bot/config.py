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

# --- LLM (cadeia de provedores com fallback) --------------------------
# A ordem = prioridade. O 1º com API key configurada é o primário; os outros
# são fallback automático quando o de cima estoura rate limit / cai.
# Sobrescreva a ordem com LLM_PROVIDER=gemini,cerebras,groq  (csv).
# Modelo por provedor: <PROVEDOR>_MODEL no .env (ex: GROQ_MODEL=llama-3.3-70b-versatile).
# LLM_MODEL (legado) força o modelo só do 1º provedor da lista.
# Todos são OpenAI-compat — pra adicionar um provedor, basta uma linha aqui + a key.

_PROVIDER_SPECS = {
    "gemini": {
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "api_key_env": "GEMINI_API_KEY",
        "model_env": "GEMINI_MODEL",
        # os nomes datados (gemini-2.5-flash) dão 404 "no longer available to new" em key nova;
        # usar os aliases -latest. gemini-flash-lite-latest testado OK 2026-09-02.
        "default_model": "gemini-flash-lite-latest",
    },
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "api_key_env": "GROQ_API_KEY",
        "model_env": "GROQ_MODEL",
        # alternativas nesta conta: qwen/qwen3.8-27b (PT mais natural), openai/gpt-oss-20b
        "default_model": "openai/gpt-oss-120b",
    },
    # 2026-09-02: Cerebras e SambaNova passaram a exigir billing (402 Payment required)
    # com key nova; GitHub Models está em "retirement brownout" (410). Fora da cadeia
    # padrão até terem plano grátis de novo — specs mantidos p/ religar rápido.
    "cerebras": {
        "base_url": "https://api.cerebras.ai/v1",
        "api_key_env": "CEREBRAS_API_KEY",
        "model_env": "CEREBRAS_MODEL",
        "default_model": "gpt-oss-120b",  # tb: llama-3.3-70b, qwen-3-235b-a22b-instruct-2507
    },
    "sambanova": {
        "base_url": "https://api.sambanova.ai/v1",
        "api_key_env": "SAMBANOVA_API_KEY",
        "model_env": "SAMBANOVA_MODEL",
        "default_model": "Meta-Llama-3.3-70B-Instruct",  # DeepSeek-V3-0324 saiu do catálogo
    },
    "mistral": {
        "base_url": "https://api.mistral.ai/v1",
        "api_key_env": "MISTRAL_API_KEY",
        "model_env": "MISTRAL_MODEL",
        "default_model": "mistral-small-latest",
    },
    "github": {
        "base_url": "https://models.github.ai/inference",
        "api_key_env": "GITHUB_MODELS_TOKEN",  # PAT com escopo models:read
        "model_env": "GITHUB_MODELS_MODEL",
        "default_model": "openai/gpt-4o-mini",  # tb: microsoft/Phi-3.5-mini-instruct, meta/Llama-3.3-70B-Instruct
    },
    "openrouter": {
        "base_url": "https://openrouter.ai/api/v1",
        "api_key_env": "OPENROUTER_API_KEY",
        "model_env": "OPENROUTER_MODEL",
        "default_model": "meta-llama/llama-3.3-70b-instruct:free",
    },
}

_order = [
    p.strip().lower()
    for p in os.getenv("LLM_PROVIDER", "groq,gemini,mistral").split(",")
    if p.strip()
]
_forced_model = os.getenv("LLM_MODEL", "").strip()

# lista final: só provedores conhecidos e com key; mantém a ordem pedida
LLM_CHAIN: list[dict] = []
for i, name in enumerate(_order):
    spec = _PROVIDER_SPECS.get(name)
    if not spec:
        continue
    key = os.getenv(spec["api_key_env"], "").strip()
    if not key:
        continue
    model = os.getenv(spec.get("model_env", ""), "").strip() or spec["default_model"]
    if i == 0 and _forced_model:
        model = _forced_model
    LLM_CHAIN.append({
        "name": name,
        "base_url": spec["base_url"],
        "api_key": key,
        "model": model,
    })

# compat com código/scripts que ainda leem os nomes antigos
LLM_PROVIDER = LLM_CHAIN[0]["name"] if LLM_CHAIN else _order[0] if _order else "groq"
LLM_BASE_URL = LLM_CHAIN[0]["base_url"] if LLM_CHAIN else _PROVIDER_SPECS["groq"]["base_url"]
LLM_API_KEY = LLM_CHAIN[0]["api_key"] if LLM_CHAIN else ""
LLM_MODEL = LLM_CHAIN[0]["model"] if LLM_CHAIN else _PROVIDER_SPECS["groq"]["default_model"]

# concorrência máxima de chamadas ao LLM POR PROVEDOR (free tier tem RPM baixo)
LLM_CONCURRENCY = max(1, int(os.getenv("LLM_CONCURRENCY", "2")))

# --- Painel web ------------------------------------------------------
WEB_URL = os.getenv("WEB_URL", "http://localhost:3000").strip().rstrip("/")

# --- Superadmin (promovido no /start se o chat_id bater) ----------------
_sa = os.getenv("SUPERADMIN_CHAT_ID", "").strip()
SUPERADMIN_CHAT_ID = int(_sa) if _sa.lstrip("-").isdigit() else None

# --- Web Push (canal 'push' dos lembretes) -----------------------------
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "").strip()
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "").strip()

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
