"""Cliente do LLM (Groq / OpenRouter via SDK openai) com rate limit e fallback local."""
from __future__ import annotations

import json
import logging
import random
import re
import threading
import time

from openai import OpenAI, RateLimitError

from . import config

log = logging.getLogger("aristotelia.llm")

_client: OpenAI | None = None
_lock = threading.Lock()          # serializa chamadas (free tier tem TPM baixo)
_cooldown_until = 0.0             # epoch até quando esperar (setado por header/429)

# Frases de emergência caso o LLM esteja indisponível — o bot nunca fica mudo.
_FALLBACK = [
    "Você não precisa mudar sua vida hoje. Precisa fazer uma coisa que torne a sua versão de amanhã mais capaz que a de hoje.",
    "Consistência sem intensidade ainda vence intensidade sem consistência.",
    "O que você evita aprender hoje vira o teto da sua carreira depois.",
    "Ninguém lembra da semana que você quase desistiu. Lembram do que você construiu.",
    "Estudar é entrada. Aplicar é o que conta no extrato.",
]

_LEADING_EMOJI = re.compile(
    r"^[\s]*[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF←-⇿⬀-⯿️‍]+[\s]*"
)


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=config.LLM_API_KEY or "missing", base_url=config.LLM_BASE_URL)
    return _client


def tidy(text: str) -> str:
    text = (text or "").replace("**", "*")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def unlabel(text: str) -> str:
    return _LEADING_EMOJI.sub("", tidy(text)).strip()


def _seconds(v: str | None) -> float:
    """'9.7s' / '1m30s' / '2.5' -> segundos."""
    if not v:
        return 0.0
    m = re.match(r"(?:(\d+)m)?([\d.]+)s?", v.strip())
    if not m:
        return 0.0
    return int(m.group(1) or 0) * 60 + float(m.group(2) or 0)


def _call(messages: list, temperature: float, max_tokens: int) -> str:
    """Chamada bruta com rate-limit adaptativo (headers do Groq) e retry em 429."""
    global _cooldown_until
    kwargs: dict = dict(model=config.LLM_MODEL, messages=messages,
                        temperature=temperature, max_tokens=max_tokens)
    if config.LLM_PROVIDER == "groq" and "gpt-oss" in config.LLM_MODEL:
        kwargs["extra_body"] = {"reasoning_effort": "low"}

    with _lock:
        for attempt in range(3):
            wait = _cooldown_until - time.time()
            if wait > 0:
                time.sleep(min(wait, 30))
            try:
                raw = _get_client().chat.completions.with_raw_response.create(**kwargs)
                resp = raw.parse()
                h = raw.headers
                rem = float(h.get("x-ratelimit-remaining-tokens", "999999"))
                if rem < max_tokens * 1.2:  # não sobra pra próxima — espera o refill
                    _cooldown_until = time.time() + _seconds(h.get("x-ratelimit-reset-tokens"))
                return (resp.choices[0].message.content or "").strip()
            except RateLimitError as e:
                retry_after = _seconds(getattr(e, "response", None)
                                       and e.response.headers.get("retry-after"))
                sleep = retry_after or (5 * (attempt + 1))
                log.warning("Groq 429 — esperando %.1fs (tentativa %d)", sleep, attempt + 1)
                _cooldown_until = time.time() + sleep
        raise RuntimeError("rate limit persistente")


def generate(
    system: str,
    user: str,
    *,
    history: list[dict] | None = None,
    temperature: float = 0.8,
    max_tokens: int = 700,
) -> str:
    if not config.LLM_API_KEY:
        log.warning("Sem API key do LLM (%s) — usando fallback.", config.LLM_PROVIDER)
        return random.choice(_FALLBACK)
    msgs: list[dict] = [{"role": "system", "content": system}]
    for h in (history or [])[-14:]:
        if h.get("role") in ("user", "assistant") and h.get("content"):
            msgs.append({"role": h["role"], "content": h["content"]})
    msgs.append({"role": "user", "content": user})
    try:
        return _call(msgs, temperature, max_tokens)
    except Exception:  # noqa: BLE001
        log.exception("Falha no LLM — usando fallback.")
        return random.choice(_FALLBACK)


def generate_json(system: str, user: str, *, temperature: float = 0.4, max_tokens: int = 2000) -> dict | None:
    sys = system + "\n\nResponda SOMENTE com JSON válido e COMPLETO, sem cercas, sem texto fora do JSON."
    for attempt in range(2):
        tokens = max_tokens + (2000 if attempt else 0)
        parsed = _parse_json(generate(sys, user, temperature=temperature, max_tokens=tokens))
        if parsed is not None:
            return parsed
        log.warning("generate_json: tentativa %d falhou (tokens=%d)", attempt + 1, tokens)
    return None


def _parse_json(raw: str) -> dict | None:
    raw = (raw or "").strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
    start = raw.find("{")
    if start == -1:
        log.warning("Sem JSON na resposta: %r", raw[:150])
        return None
    end = raw.rfind("}")
    candidate = raw[start : end + 1] if end > start else raw[start:]
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        # tenta fechar JSON truncado (arrays/objetos abertos)
        fixed = candidate.rstrip().rstrip(",")
        for _ in range(fixed.count("{") - fixed.count("}") + fixed.count("[") - fixed.count("]")):
            fixed += "]" if fixed.rfind("[") > fixed.rfind("{") else "}"
        try:
            return json.loads(fixed)
        except json.JSONDecodeError:
            log.warning("Resposta do LLM não é JSON: %r", candidate[:200])
            return None
