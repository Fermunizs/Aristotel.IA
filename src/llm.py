"""Cliente do LLM (Groq / OpenRouter via SDK openai) com fallback local."""
from __future__ import annotations

import json
import logging
import random
import re

from openai import OpenAI

from . import config

log = logging.getLogger("aristotelia.llm")

_client: OpenAI | None = None

# Frases de emergência caso o LLM esteja indisponível — o bot nunca fica mudo.
_FALLBACK = [
    "Você não precisa mudar sua vida hoje. Precisa fazer uma coisa que torne a sua versão de amanhã mais capaz que a de hoje.",
    "Consistência sem intensidade ainda vence intensidade sem consistência.",
    "O que você evita aprender hoje vira o teto da sua carreira depois.",
    "Ninguém lembra da semana que você quase desistiu. Lembram do que você construiu.",
    "Estudar é entrada. Aplicar é o que conta no extrato.",
]

# emoji no início do texto (o modelo gosta de prefixar 🚀/👊) — a gente controla o emoji.
_LEADING_EMOJI = re.compile(
    r"^[\s]*[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF←-⇿⬀-⯿️‍]+[\s]*"
)


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=config.LLM_API_KEY or "missing", base_url=config.LLM_BASE_URL)
    return _client


def tidy(text: str) -> str:
    """Normaliza a saída do LLM para o Telegram Markdown legado (bold, sem linhões)."""
    text = (text or "").replace("**", "*")    # Telegram Markdown legado usa 1 asterisco
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def unlabel(text: str) -> str:
    """tidy() + remove o emoji que o modelo põe no começo (a gente controla o emoji)."""
    return _LEADING_EMOJI.sub("", tidy(text)).strip()


def generate(system: str, user: str, *, temperature: float = 0.8, max_tokens: int = 700) -> str:
    """Uma resposta de texto. Em caso de erro, devolve um fallback curto."""
    if not config.LLM_API_KEY:
        log.warning("Sem API key do LLM (%s) — usando fallback.", config.LLM_PROVIDER)
        return random.choice(_FALLBACK)
    kwargs = dict(
        model=config.LLM_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    if config.LLM_PROVIDER == "groq" and "gpt-oss" in config.LLM_MODEL:
        # gpt-oss "gasta" tokens de raciocínio; manter baixo evita truncar a resposta.
        kwargs["extra_body"] = {"reasoning_effort": "low"}
    try:
        resp = _get_client().chat.completions.create(**kwargs)
        return (resp.choices[0].message.content or "").strip()
    except Exception:  # noqa: BLE001 — resiliência importa mais que precisão aqui
        log.exception("Falha no LLM — usando fallback.")
        return random.choice(_FALLBACK)


def generate_json(system: str, user: str, *, temperature: float = 0.5, max_tokens: int = 1600) -> dict | None:
    """Espera um objeto JSON na resposta. Devolve dict ou None."""
    raw = generate(
        system + "\n\nResponda SOMENTE com JSON válido, sem cercas de código, sem texto antes ou depois.",
        user,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return _parse_json(raw)


def _parse_json(raw: str) -> dict | None:
    raw = (raw or "").strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
    start, end = raw.find("{"), raw.rfind("}")
    if start != -1 and end != -1:
        raw = raw[start : end + 1]
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        log.warning("Resposta do LLM não é JSON: %r", raw[:200])
        return None
