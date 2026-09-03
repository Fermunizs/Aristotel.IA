"""Cliente do LLM — cadeia de provedores (Groq → Gemini → OpenRouter) com fallback local."""
from __future__ import annotations

import json
import logging
import random
import re
import threading
import time

from openai import APIError, APIConnectionError, OpenAI, RateLimitError

from . import config, usage

log = logging.getLogger("aristotelia.llm")

# Frases de emergência caso TODOS os provedores estejam indisponíveis — o bot nunca fica mudo.
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


class _ProviderFailed(Exception):
    """Provedor esgotou as tentativas — a cadeia tenta o próximo."""


class _Provider:
    """Estado de um provedor: cliente, limite de concorrência e cooldown próprios."""

    def __init__(self, spec: dict):
        self.name: str = spec["name"]
        self.model: str = spec["model"]
        self._client = OpenAI(api_key=spec["api_key"], base_url=spec["base_url"])
        self._sem = threading.Semaphore(config.LLM_CONCURRENCY)
        self._cooldown_until = 0.0

    def call(self, messages: list, temperature: float, max_tokens: int) -> tuple[str, object, dict]:
        kwargs: dict = dict(model=self.model, messages=messages,
                            temperature=temperature, max_tokens=max_tokens)
        if "gpt-oss" in self.model:  # groq e cerebras aceitam reasoning_effort
            kwargs["extra_body"] = {"reasoning_effort": "low"}

        with self._sem:
            for attempt in range(3):
                wait = self._cooldown_until - time.time()
                if wait > 0:
                    time.sleep(min(wait, 30))
                try:
                    raw = self._client.chat.completions.with_raw_response.create(**kwargs)
                    resp = raw.parse()
                    h = raw.headers
                    snap = _rl_snapshot(h)
                    rem = float(h.get("x-ratelimit-remaining-tokens", "999999"))
                    if rem < max_tokens * 1.2:
                        self._cooldown_until = time.time() + _seconds(h.get("x-ratelimit-reset-tokens"))
                    return (resp.choices[0].message.content or "").strip(), getattr(resp, "usage", None), snap
                except RateLimitError as e:
                    retry_after = _seconds(getattr(e, "response", None)
                                           and e.response.headers.get("retry-after"))
                    sleep = retry_after or (4 * (attempt + 1))
                    log.warning("%s: 429 — cooldown %.1fs (tentativa %d)", self.name, sleep, attempt + 1)
                    self._cooldown_until = time.time() + sleep
            raise _ProviderFailed(f"{self.name}: rate limit persistente")


_providers: list[_Provider] | None = None
_providers_lock = threading.Lock()


def _chain() -> list[_Provider]:
    global _providers
    if _providers is None:
        with _providers_lock:
            if _providers is None:
                _providers = [_Provider(s) for s in config.LLM_CHAIN]
                if _providers:
                    log.info("LLM: %s", " → ".join(f"{p.name}({p.model})" for p in _providers))
    return _providers


def tidy(text: str) -> str:
    text = (text or "").replace("**", "*")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def unlabel(text: str) -> str:
    return _LEADING_EMOJI.sub("", tidy(text)).strip()


def _rl_snapshot(h) -> dict:
    """Extrai TODOS os headers x-ratelimit-* que o provedor mandou (requests e tokens,
    limit e remaining e reset). Groq/Cerebras usam os nomes *-requests/*-tokens;
    OpenRouter usa os genéricos x-ratelimit-{limit,remaining,reset}; Gemini não manda
    nada — nesse caso as chaves vêm None e a estimativa fica por conta do llm_limits."""
    def num(*keys: str) -> float | None:
        for k in keys:
            v = h.get(k)
            if v is None:
                continue
            try:
                return float(v)
            except (TypeError, ValueError):
                continue
        return None

    rem_req = num("x-ratelimit-remaining-requests", "x-ratelimit-remaining")
    lim_req = num("x-ratelimit-limit-requests", "x-ratelimit-limit")
    rem_tok = num("x-ratelimit-remaining-tokens")
    lim_tok = num("x-ratelimit-limit-tokens")
    reset = _seconds(h.get("x-ratelimit-reset-tokens")
                     or h.get("x-ratelimit-reset-requests")
                     or h.get("x-ratelimit-reset")) or None
    return {
        "rl_remaining_requests": int(rem_req) if rem_req is not None else None,
        "rl_remaining_tokens": int(rem_tok) if rem_tok is not None else None,
        "rl_limit_requests": int(lim_req) if lim_req is not None else None,
        "rl_limit_tokens": int(lim_tok) if lim_tok is not None else None,
        "rl_reset_seconds": reset,
    }


def _seconds(v: str | None) -> float:
    """'9.7s' / '1m30s' / '2.5' -> segundos."""
    if not v:
        return 0.0
    m = re.match(r"(?:(\d+)m)?([\d.]+)s?", str(v).strip())
    if not m:
        return 0.0
    return int(m.group(1) or 0) * 60 + float(m.group(2) or 0)


def _call(messages: list, temperature: float, max_tokens: int) -> str:
    """Tenta cada provedor da cadeia em ordem; cai pro próximo quando um falha."""
    chain = _chain()
    if not chain:
        raise RuntimeError("nenhum provedor de LLM configurado")
    ctx = usage.get_context()
    last: Exception | None = None
    for i, p in enumerate(chain):
        try:
            text, u, rl = p.call(messages, temperature, max_tokens)
            usage.record(
                provider=p.name, model=p.model,
                prompt_tokens=int(getattr(u, "prompt_tokens", 0) or 0),
                completion_tokens=int(getattr(u, "completion_tokens", 0) or 0),
                fallback=(i > 0), ok=True, status="ok", **rl, **ctx,
            )
            return text
        except _ProviderFailed as e:
            last = e
            usage.record(provider=p.name, model=p.model, fallback=(i > 0), ok=False, status="429", **ctx)
            log.warning("provedor %s: 429 — próximo da cadeia", p.name)
        except (RateLimitError, APIError, APIConnectionError, OSError) as e:
            last = e
            usage.record(provider=p.name, model=p.model, fallback=(i > 0), ok=False, status="error", **ctx)
            log.warning("provedor %s indisponível (%s) — próximo da cadeia", p.name, type(e).__name__)
    raise RuntimeError(f"todos os provedores falharam: {last}")


def generate(
    system: str,
    user: str,
    *,
    history: list[dict] | None = None,
    temperature: float = 0.8,
    max_tokens: int = 700,
) -> str:
    if not _chain():
        log.warning("Sem provedor de LLM — usando fallback local.")
        return random.choice(_FALLBACK)
    msgs: list[dict] = [{"role": "system", "content": system}]
    for h in (history or [])[-14:]:
        if h.get("role") in ("user", "assistant") and h.get("content"):
            msgs.append({"role": h["role"], "content": h["content"]})
    msgs.append({"role": "user", "content": user})
    try:
        return _call(msgs, temperature, max_tokens)
    except Exception:  # noqa: BLE001
        log.exception("Falha em toda a cadeia de LLM — usando fallback local.")
        usage.record(provider="fallback", model=None, fallback=True, ok=False,
                     status="fallback", **usage.get_context())
        return random.choice(_FALLBACK)


def generate_json(system: str, user: str, *, temperature: float = 0.4, max_tokens: int = 2000) -> dict | None:
    sys = system + "\n\nResponda SOMENTE com JSON válido e COMPLETO, sem cercas, sem texto fora do JSON."
    for attempt in range(2):
        tokens = max_tokens + (1500 if attempt else 0)
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
        try:
            return json.loads(_repair_truncated(candidate))
        except json.JSONDecodeError:
            log.warning("Resposta do LLM não é JSON: %r", candidate[:200])
            return None


def _repair_truncated(s: str) -> str:
    """Fecha string/colchetes abertos quando a resposta veio cortada (limite de tokens)."""
    stack: list[str] = []
    in_str = esc = False
    for ch in s:
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch in "{[":
            stack.append(ch)
        elif ch in "}]" and stack:
            stack.pop()
    fixed = s + ('"' if in_str else "")
    fixed = fixed.rstrip().rstrip(",")
    for opener in reversed(stack):
        fixed += "}" if opener == "{" else "]"
    return fixed
