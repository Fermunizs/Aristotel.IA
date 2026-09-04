# Gamificação: XP + Níveis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar XP e níveis (estágios de domínio) ao produto, derivados da tabela `events`, aparecendo no painel e no bot.

**Architecture:** XP é uma função pura da tabela `events` — nada é gravado. `xp_total = Σ pontos(evento) + 10×dias engajados`, com tetos diários por categoria. Nível = `level_for_xp(xp)`. O bot anuncia subida de nível anexando 1 linha a mensagens que já sairiam, e marca "já anunciei" gravando um evento `xp:levelup`. O painel calcula tudo em server components. Zero migration.

**Tech Stack:** Python 3.10 (`python-telegram-bot`, `asyncpg`) no bot · Next.js 15 App Router + Drizzle (Postgres) no painel · sem framework de teste — o padrão do projeto é script de verificação em `scripts/` + `py_compile` / `tsc --noEmit` / `next build` + verificação manual na VM.

**Spec:** `docs/superpowers/specs/2026-09-04-gamificacao-xp-niveis-design.md`

## Global Constraints

- **Sem migration.** v1 é 100% derivado e aditivo.
- **`bot/xp.py` não importa `db` no nível de módulo** — import lazy dentro de `sync_and_maybe_announce` (pra `scripts/check_xp.py` rodar sem `asyncpg`).
- **`web/src/lib/xp.ts` é espelho literal** de `bot/xp.py` (POINTS, tetos, curva, STAGES, STAGE_LINES). Toda mudança nos dois.
- **Curva:** `xp_to_reach(L) = 50·(L−1)·L`. `level_for_xp(0) == 1`.
- **Mapa evento→XP:** quiz acerto 15 / erro 5 · quiz_reforco 10 · desafio 30 · review 20 · foco `min(minutos, 30)` · jasei/skip/msg:*/xp:levelup 0.
- **Tetos diários** (agrupando por `(day, kind)`): `quiz`/`quiz_reforco`/`desafio`/`review` → vale o de maior pontuação do dia; `foco` → as 2 maiores sessões; resto → soma.
- **Bônus de dia engajado:** `+10` por `day` distinto com ≥1 evento em `{quiz, quiz_reforco, review, desafio, foco}`.
- **STAGES** (nível mínimo → título): `1 Começando · 3 Na trilha · 5 Em ritmo · 7 Consistente · 10 Aprofundando · 13 Praticante · 16 Dominando · 20 Referência`.
- **STAGE_LINES** (fecho da linha de level-up): `Começando: "Começou." · Na trilha: "Você tá andando." · Em ritmo: "O ritmo pegou." · Consistente: "Isso já é constância." · Aprofundando: "Tá ficando sério." · Praticante: "Você faz, não só estuda." · Dominando: "Pouca gente chega aqui." · Referência: "Agora é você que serve de exemplo."`
- **Linha de level-up:** `📈 Nível {N} — {estágio}. {fecho}`
- **Tom:** `Design.md` — sóbrio, verde = crescimento, 1 emoji no início, sem exclamação em cascata.
- Commits: terminar a mensagem com
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01Xt5keXbSFQh1XfCvMh2J6N`

---

## File Structure

**Criar:**
- `bot/xp.py` — mapa evento→XP, tetos, curva de nível, estágios, `xp_total(rows)`, `sync_and_maybe_announce(user_id, day)`.
- `scripts/check_xp.py` — asserções das funções puras + do anúncio (stub de `db`), no padrão de `scripts/check_onboarding.py`.
- `web/src/lib/xp.ts` — espelho das funções puras + `computeProgress(userId)` (query em `events`).
- `web/src/components/LevelBar.tsx` — faixa compacta (nível, estágio, barra pro próximo). Client-free (server component simples).
- `web/src/components/ProgressCard.tsx` — o "cartão de progresso" da tela Evolução.

**Modificar:**
- `bot/db.py` — `+ async def events_all(user_id) -> list[dict]` (kind, payload desserializado, day).
- `bot/handlers.py` — `_review`, `_quiz2`, `_challenge` (ramo "terminou"): anexar a linha de `xp.sync_and_maybe_announce`.
- `bot/jobs.py` — `daily_learning_guide`: idem, rede de segurança pro usuário de painel.
- `bot/weekly.py` — `weekly_review`: linha de nível/XP no fim do card.
- `web/src/lib/queries.ts` — nada obrigatório; `computeProgress` fica em `xp.ts`.
- `web/src/app/(app)/page.tsx` — `<LevelBar>` acima da checklist.
- `web/src/app/(app)/evolucao/page.tsx` — `<ProgressCard>` no topo.
- `Design.md` — seção "Progressão / XP" (estágios finais, tom da linha, o cartão).
- `Produto.md` §6.5 — XP+níveis feito; skill tree segue [v2].
- `Backlog.md` — linha em Feito + item v2.

---

## Task 1: `bot/xp.py` — funções puras + `scripts/check_xp.py`

**Files:**
- Create: `bot/xp.py`
- Create: `scripts/check_xp.py`

**Interfaces:**
- Produces:
  - `POINTS: dict[str, int]`, `FOCO_CAP_MIN = 30`, `FOCO_CAP_SESSIONS = 2`, `DAILY_CAP_1: set[str]`, `ENGAGED_KINDS: set[str]`, `ENGAGED_DAY_XP = 10`, `STAGES: list[tuple[int, str]]`, `STAGE_LINES: dict[str, str]`
  - `points_for(kind: str, payload: dict | None) -> int`
  - `xp_total(rows: Iterable[Mapping]) -> int` — `rows` são mapeáveis com `["kind"]`, `["payload"]` (dict), `["day"]` (qualquer valor hashável; date na produção)
  - `xp_to_reach(level: int) -> int`
  - `level_for_xp(xp: int) -> int`
  - `stage_for_level(level: int) -> str`
  - `stage_line(level: int) -> str`
  - `level_up_line(level: int) -> str`

- [ ] **Step 1: Criar `bot/xp.py` com as funções puras**

```python
"""XP e níveis — derivados da tabela events, sem storage.
Ver docs/superpowers/specs/2026-09-04-gamificacao-xp-niveis-design.md
MANTER `web/src/lib/xp.ts` EM SINCRONIA (mapa, tetos, curva, estágios)."""
from __future__ import annotations

from typing import Iterable, Mapping

# ── mapa evento → pontos ─────────────────────────────────────────────
POINTS: dict[str, int] = {"quiz_reforco": 10, "desafio": 30, "review": 20}
FOCO_CAP_MIN = 30            # 1 XP/min de foco, teto por sessão
FOCO_CAP_SESSIONS = 2        # nº de sessões de foco que contam por dia
DAILY_CAP_1 = {"quiz", "quiz_reforco", "desafio", "review"}  # 1 por dia (vale a maior)
ENGAGED_KINDS = {"quiz", "quiz_reforco", "review", "desafio", "foco"}
ENGAGED_DAY_XP = 10         # bônus por dia distinto com constância

# ── estágios (nível mínimo → título) ─────────────────────────────────
STAGES: list[tuple[int, str]] = [
    (1, "Começando"), (3, "Na trilha"), (5, "Em ritmo"), (7, "Consistente"),
    (10, "Aprofundando"), (13, "Praticante"), (16, "Dominando"), (20, "Referência"),
]
STAGE_LINES: dict[str, str] = {
    "Começando": "Começou.",
    "Na trilha": "Você tá andando.",
    "Em ritmo": "O ritmo pegou.",
    "Consistente": "Isso já é constância.",
    "Aprofundando": "Tá ficando sério.",
    "Praticante": "Você faz, não só estuda.",
    "Dominando": "Pouca gente chega aqui.",
    "Referência": "Agora é você que serve de exemplo.",
}


def points_for(kind: str, payload: dict | None) -> int:
    p = payload or {}
    if kind == "quiz":
        return 15 if p.get("resultado") == "acerto" else 5
    if kind == "foco":
        try:
            return min(int(p.get("minutos", 0) or 0), FOCO_CAP_MIN)
        except (TypeError, ValueError):
            return 0
    return POINTS.get(kind, 0)


def xp_total(rows: Iterable[Mapping]) -> int:
    by_day_kind: dict[tuple, list[int]] = {}
    engaged_days: set = set()
    for r in rows:
        kind = r["kind"]
        payload = r["payload"] if isinstance(r["payload"], dict) else {}
        day = r["day"]
        if kind in ENGAGED_KINDS:
            engaged_days.add(day)
        pts = points_for(kind, payload)
        if pts:
            by_day_kind.setdefault((day, kind), []).append(pts)
    total = 0
    for (_day, kind), lst in by_day_kind.items():
        if kind == "foco":
            total += sum(sorted(lst, reverse=True)[:FOCO_CAP_SESSIONS])
        elif kind in DAILY_CAP_1:
            total += max(lst)
        else:
            total += sum(lst)
    return total + ENGAGED_DAY_XP * len(engaged_days)


def xp_to_reach(level: int) -> int:
    return 50 * (level - 1) * level


def level_for_xp(xp: int) -> int:
    lvl = 1
    while xp_to_reach(lvl + 1) <= xp:
        lvl += 1
    return lvl


def stage_for_level(level: int) -> str:
    name = STAGES[0][1]
    for min_lvl, n in STAGES:
        if level >= min_lvl:
            name = n
    return name


def stage_line(level: int) -> str:
    return STAGE_LINES[stage_for_level(level)]


def level_up_line(level: int) -> str:
    return f"📈 Nível {level} — {stage_for_level(level)}. {stage_line(level)}"
```

- [ ] **Step 2: Criar `scripts/check_xp.py` com as asserções das funções puras**

```python
"""Asserções de bot/xp.py (gamificação — docs/.../2026-09-04-gamificacao-xp-niveis-design.md).
Roda com: python scripts/check_xp.py  (só stdlib — não toca banco nem LLM)."""
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot import xp  # noqa: E402


def ev(kind, day, **payload):
    return {"kind": kind, "day": day, "payload": payload}


def test_curve_bounds():
    assert xp.xp_to_reach(1) == 0
    assert xp.xp_to_reach(2) == 100
    assert xp.xp_to_reach(3) == 300
    assert xp.xp_to_reach(5) == 1000
    assert xp.level_for_xp(0) == 1
    assert xp.level_for_xp(99) == 1
    assert xp.level_for_xp(100) == 2
    assert xp.level_for_xp(299) == 2
    assert xp.level_for_xp(300) == 3
    assert xp.level_for_xp(4500) == 10
    print("ok  curva de nível nas bordas")


def test_points_for():
    assert xp.points_for("quiz", {"resultado": "acerto"}) == 15
    assert xp.points_for("quiz", {"resultado": "erro"}) == 5
    assert xp.points_for("quiz", {}) == 5
    assert xp.points_for("quiz_reforco", {}) == 10
    assert xp.points_for("desafio", {}) == 30
    assert xp.points_for("review", {}) == 20
    assert xp.points_for("foco", {"minutos": 25}) == 25
    assert xp.points_for("foco", {"minutos": 50}) == 30  # teto
    assert xp.points_for("foco", {"minutos": "x"}) == 0
    assert xp.points_for("jasei", {}) == 0
    assert xp.points_for("msg:guide", {}) == 0
    assert xp.points_for("xp:levelup", {"level": 3}) == 0
    print("ok  points_for")


def test_daily_caps_and_engaged_bonus():
    d1, d2 = date(2026, 9, 1), date(2026, 9, 2)
    rows = [
        ev("quiz", d1, resultado="erro"),      # 5, mas...
        ev("quiz", d1, resultado="acerto"),    # ...vale 15 (maior do dia)
        ev("desafio", d1),                     # 30
        ev("review", d1),                      # 20
        ev("foco", d1, minutos=25),            # 25
        ev("foco", d1, minutos=25),            # 25
        ev("foco", d1, minutos=25),            # 3ª sessão NÃO conta (teto 2)
        ev("quiz", d2, resultado="acerto"),    # 15
    ]
    # d1: 15 + 30 + 20 + (25+25) = 115 ; d2: 15 ; dias engajados: 2 -> +20
    assert xp.xp_total(rows) == 115 + 15 + 20, xp.xp_total(rows)
    print("ok  tetos diários + bônus de dia engajado")


def test_empty():
    assert xp.xp_total([]) == 0
    print("ok  sem eventos -> 0 XP")


def test_stages():
    assert xp.stage_for_level(1) == "Começando"
    assert xp.stage_for_level(2) == "Começando"
    assert xp.stage_for_level(3) == "Na trilha"
    assert xp.stage_for_level(9) == "Consistente"
    assert xp.stage_for_level(25) == "Referência"
    assert xp.level_up_line(4) == "📈 Nível 4 — Na trilha. Você tá andando."
    print("ok  estágios + linha de level-up")


if __name__ == "__main__":
    for fn in [test_curve_bounds, test_points_for, test_daily_caps_and_engaged_bonus,
               test_empty, test_stages]:
        fn()
    print("\nTODOS OS CHECKS DE XP PASSARAM")
```

- [ ] **Step 3: Rodar o check e ver falhar por engano de import**

Run: `python scripts/check_xp.py`
Expected: se `bot/xp.py` do Step 1 já está salvo, deve **PASSAR**. Se algo falhar, é bug no Step 1 — corrigir `bot/xp.py` até passar. (Não há passo de "ver falhar antes de existir" porque `xp.py` e o check nascem juntos nesta task.)

- [ ] **Step 4: `py_compile`**

Run: `python -m py_compile bot/xp.py scripts/check_xp.py`
Expected: sem output (sucesso).

- [ ] **Step 5: Commit**

```bash
git add bot/xp.py scripts/check_xp.py
git commit -m "feat(xp): funções puras de XP e nível + check_xp.py

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Xt5keXbSFQh1XfCvMh2J6N"
```

---

## Task 2: `db.events_all` + `xp.sync_and_maybe_announce`

**Files:**
- Modify: `bot/db.py` (adicionar `events_all` perto de `events_since`, ~linha 316)
- Modify: `bot/xp.py` (adicionar `sync_and_maybe_announce` no fim)
- Modify: `scripts/check_xp.py` (adicionar teste do anúncio com stub de `db`)

**Interfaces:**
- Consumes: `db.log_event(user_id, kind, day, payload)` (existe), `db._j` (existe)
- Produces:
  - `db.events_all(user_id) -> list[dict]` — cada item `{"kind": str, "payload": dict, "day": datetime.date}`, ordenado por `day`
  - `xp.sync_and_maybe_announce(user_id, day) -> str | None` — devolve a linha de level-up (`str`) se o usuário acabou de subir de nível (e grava o evento `xp:levelup`), senão `None`

- [ ] **Step 1: Adicionar `events_all` em `bot/db.py`**

Depois de `events_since` (logo após a linha ~320):

```python
async def events_all(user_id) -> list[dict]:
    """Todos os eventos do usuário (kind, payload desserializado, day) — pra cálculo de XP."""
    async with pool().acquire() as con:
        rows = await con.fetch(
            "SELECT kind, payload, day FROM events WHERE user_id = $1 ORDER BY day", user_id
        )
    return [{"kind": r["kind"], "payload": _j(r["payload"]) or {}, "day": r["day"]} for r in rows]
```

- [ ] **Step 2: Adicionar `sync_and_maybe_announce` no fim de `bot/xp.py`**

```python
async def sync_and_maybe_announce(user_id, day) -> str | None:
    """Se o usuário subiu de nível desde o último anúncio, grava o marcador
    (evento xp:levelup) e devolve a linha pra anexar na mensagem que vai sair."""
    from . import db  # import lazy: check_xp.py roda sem asyncpg

    rows = await db.events_all(user_id)
    xp_now = xp_total(rows)
    level_now = level_for_xp(xp_now)
    announced = max(
        (r["payload"].get("level", 0) for r in rows
         if r["kind"] == "xp:levelup" and isinstance(r["payload"], dict)),
        default=0,
    )
    if level_now <= announced:
        return None
    await db.log_event(user_id, "xp:levelup", day, {"level": level_now, "xp": xp_now})
    return level_up_line(level_now)
```

- [ ] **Step 3: Adicionar teste do anúncio em `scripts/check_xp.py`**

Antes do bloco `if __name__ == "__main__":`, adicionar:

```python
def test_sync_and_maybe_announce():
    import asyncio
    from datetime import date

    state = {"events": [], "logged": []}

    async def fake_events_all(uid):
        return list(state["events"])

    async def fake_log_event(uid, kind, day, payload=None):
        state["logged"].append({"kind": kind, "payload": payload or {}})
        state["events"].append({"kind": kind, "day": day, "payload": payload or {}})

    import types
    xp_db = types.SimpleNamespace(events_all=fake_events_all, log_event=fake_log_event)
    import bot
    sys.modules["bot.db"] = xp_db  # o import lazy `from . import db` pega este

    d = date(2026, 9, 1)
    # 0 XP -> nível 1, nunca anunciado -> sem linha (nível 1 não "sobe")
    assert asyncio.run(xp.sync_and_maybe_announce("u", d)) is None

    # empurra pra ~nível 3 (>= 300 XP): 10 desafios (300) + dias -> passa de 300
    state["events"] = [{"kind": "desafio", "day": date(2026, 8, i + 1), "payload": {}} for i in range(12)]
    line = asyncio.run(xp.sync_and_maybe_announce("u", d))
    assert line and "Nível" in line, line
    assert state["logged"] and state["logged"][-1]["kind"] == "xp:levelup"
    lvl = state["logged"][-1]["payload"]["level"]

    # chamar de novo sem novos eventos -> não reanuncia
    assert asyncio.run(xp.sync_and_maybe_announce("u", d)) is None
    print(f"ok  sync_and_maybe_announce (anunciou nível {lvl} uma vez só)")
```

E incluir `test_sync_and_maybe_announce` na lista do `__main__`.

- [ ] **Step 4: Rodar o check**

Run: `python scripts/check_xp.py`
Expected: `TODOS OS CHECKS DE XP PASSARAM` (agora com a linha do `sync`).

- [ ] **Step 5: `py_compile`**

Run: `python -m py_compile bot/xp.py bot/db.py scripts/check_xp.py`
Expected: sem output.

- [ ] **Step 6: Commit**

```bash
git add bot/xp.py bot/db.py scripts/check_xp.py
git commit -m "feat(xp): sync_and_maybe_announce + db.events_all

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Xt5keXbSFQh1XfCvMh2J6N"
```

---

## Task 3: Fiação no bot (handlers, jobs, weekly)

**Files:**
- Modify: `bot/handlers.py` — `_quiz2` (~linha 297), `_challenge` ramo "terminou" (~linha 337), `_review` (~linha 361)
- Modify: `bot/jobs.py` — `daily_learning_guide` (~linha 110)
- Modify: `bot/weekly.py` — `weekly_review` (~linha 35)

**Interfaces:**
- Consumes: `xp.sync_and_maybe_announce(user_id, day) -> str | None`, `xp.xp_total(rows)`, `xp.level_for_xp(xp)`, `xp.stage_for_level(level)`, `db.events_all(user_id)`, `db.events_since(user_id, since)`
- Produces: nada novo (só efeitos)

- [ ] **Step 1: `bot/handlers.py` — importar `xp`**

Na linha 9, trocar:
```python
from . import config, db, llm, onboarding, prompts, usage
```
por:
```python
from . import config, db, llm, onboarding, prompts, usage, xp
```

- [ ] **Step 2: `_review` — anexar a linha de level-up**

Trecho atual (por volta da linha 358-362):
```python
    day = now_for(user).date()
    new_streak = await db.bump_streak(user["id"], day)
    await db.log_event(user["id"], "review", day, {"raw": text[:500]})
    await db.auto_complete(user["id"], day, "trilha")
    await _reply(update, card)
    await _reply(update, f"🔥 Streak: {new_streak} dia(s).\n\n💡 Isso pode virar conteúdo? (sim / não)")
```
Trocar por:
```python
    day = now_for(user).date()
    new_streak = await db.bump_streak(user["id"], day)
    await db.log_event(user["id"], "review", day, {"raw": text[:500]})
    await db.auto_complete(user["id"], day, "trilha")
    await _reply(update, card)
    lvl = await xp.sync_and_maybe_announce(user["id"], day)
    rodape = f"🔥 Streak: {new_streak} dia(s)."
    if lvl:
        rodape += f"\n{lvl}"
    await _reply(update, f"{rodape}\n\n💡 Isso pode virar conteúdo? (sim / não)")
```

- [ ] **Step 3: `_quiz2` — anexar a linha**

Trecho atual (fim da função, ~linha 293-297):
```python
    await db.set_pending(user["id"], None)
    await db.log_event(user["id"], "quiz_reforco", now_for(user).date(),
                       {"topico": pending.get("topico", "")})
    await db.push_history(user["id"], "assistant", resp)
    await _reply(update, resp)
```
Trocar por:
```python
    day = now_for(user).date()
    await db.set_pending(user["id"], None)
    await db.log_event(user["id"], "quiz_reforco", day, {"topico": pending.get("topico", "")})
    await db.push_history(user["id"], "assistant", resp)
    lvl = await xp.sync_and_maybe_announce(user["id"], day)
    await _reply(update, f"{resp}\n\n{lvl}" if lvl else resp)
```

- [ ] **Step 4: `_challenge` — ramo "terminou", anexar a linha**

Trecho atual (~linha 326-337):
```python
    if any(w in text.lower() for w in _DONE_WORDS):
        await db.auto_complete(user["id"], day, "desafio")
        await db.log_event(user["id"], "desafio", day, {"nota": text[:300]})
        await db.set_pending(user["id"], None)
        resp = await ask(
            prompts.persona(user["name"], goal, user["coach_tone"], user["coach_note"])
            + f"\n\nO desafio era:\n{desafio}\n\nA pessoa disse que terminou. "
            "Dê um retorno curto e sincero — se ela colou a solução, comente 1 ponto; se não, só reconheça e provoque a continuar.",
            text, history=hist, max_tokens=350,
        )
        await db.push_history(user["id"], "assistant", resp)
        return await _reply(update, f"🛠️ {resp}")
```
Manter a linha `await db.push_history(...)` que já existe e trocar só a linha seguinte
(`return await _reply(update, f"🛠️ {resp}")`) por:
```python
        lvl = await xp.sync_and_maybe_announce(user["id"], day)
        return await _reply(update, f"🛠️ {resp}\n\n{lvl}" if lvl else f"🛠️ {resp}")
```
`day` já está definido no começo de `_challenge` (`day = now_for(user).date()`).

- [ ] **Step 5: `bot/jobs.py` — `daily_learning_guide`, rede de segurança**

Na linha 9, adicionar `xp` ao import:
```python
from . import db, prompts, push, usage, xp
```
No fim de `daily_learning_guide` (depois de `await db.log_event(user["id"], "msg:guide", day)`, ~linha 110), adicionar:
```python
    lvl = await xp.sync_and_maybe_announce(user["id"], day)
    if lvl:
        await _deliver(context, user, chat, "Subiu de nível", lvl)
```

- [ ] **Step 6: `bot/weekly.py` — linha de XP no card semanal**

Ver o import atual e adicionar `xp`. No `weekly_review`, depois de `texto = await ask(...)` e antes de `await _deliver(...)` (~linha 34):
```python
    rows = await db.events_all(user["id"])
    lvl = xp.level_for_xp(xp.xp_total(rows))
    since_dt = (now_for(user) - timedelta(days=7)).date()
    wk_rows = [r for r in rows if r["day"] >= since_dt]
    wk_xp = xp.xp_total(wk_rows)
    texto += f"\n\n📈 Nível {lvl} — {xp.stage_for_level(lvl)} · +{wk_xp} XP essa semana"
```
Conferir que `timedelta` está importado em `weekly.py` (está — `content_planner` usa). Se `now_for` não estiver importado, importar de `.util`.

- [ ] **Step 7: `py_compile` de tudo**

Run: `python -m py_compile bot/handlers.py bot/jobs.py bot/weekly.py bot/xp.py bot/db.py`
Expected: sem output.

- [ ] **Step 8: Deploy do bot na VM e verificação**

```bash
tar czf - --exclude='__pycache__' bot db requirements.txt \
| ssh -i ~/.ssh/aristotelia_oracle ubuntu@147.15.46.51 \
  'tar xzf - -C ~/aristotelia && sudo systemctl restart aristotelia && sleep 3 && systemctl is-active aristotelia'
```
Expected: `active`. Depois:
```bash
ssh -i ~/.ssh/aristotelia_oracle ubuntu@147.15.46.51 \
  'sudo journalctl -u aristotelia -n 20 --no-pager -o cat | grep -iE "error|exception|scheduler started"'
```
Expected: `Scheduler started`, sem erro.

- [ ] **Step 9: Commit**

```bash
git add bot/handlers.py bot/jobs.py bot/weekly.py
git commit -m "feat(xp): bot anexa a linha de level-up e o XP no card semanal

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Xt5keXbSFQh1XfCvMh2J6N"
```

---

## Task 4: `web/src/lib/xp.ts` — espelho + `computeProgress`

**Files:**
- Create: `web/src/lib/xp.ts`

**Interfaces:**
- Consumes: `db` de `@/lib/db`, `events` de `@/lib/schema`, `eq`/`and`/`gte` de `drizzle-orm`
- Produces:
  - `levelForXp(xp: number) -> number`, `xpToReach(level: number) -> number`, `stageForLevel(level: number) -> string`, `pointsFor(kind, payload) -> number`, `xpTotal(rows) -> number`
  - `computeProgress(userId: string) -> Promise<Progress>` onde
    ```ts
    type Progress = {
      xp: number; level: number; stage: string;
      xpInLevel: number; xpForLevel: number; xpToNext: number;
      bySource: { quiz: number; desafio: number; foco: number; constancia: number };
    };
    ```

- [ ] **Step 1: Criar `web/src/lib/xp.ts`**

```ts
// Espelho de bot/xp.py — mapa evento→XP, tetos, curva, estágios.
// MANTER EM SINCRONIA com bot/xp.py.
import { and, eq, gte } from "drizzle-orm";
import { db } from "./db";
import { events } from "./schema";

export const POINTS: Record<string, number> = { quiz_reforco: 10, desafio: 30, review: 20 };
export const FOCO_CAP_MIN = 30;
const FOCO_CAP_SESSIONS = 2;
const DAILY_CAP_1 = new Set(["quiz", "quiz_reforco", "desafio", "review"]);
const ENGAGED_KINDS = new Set(["quiz", "quiz_reforco", "review", "desafio", "foco"]);
const ENGAGED_DAY_XP = 10;

const STAGES: [number, string][] = [
  [1, "Começando"], [3, "Na trilha"], [5, "Em ritmo"], [7, "Consistente"],
  [10, "Aprofundando"], [13, "Praticante"], [16, "Dominando"], [20, "Referência"],
];

type Row = { kind: string; payload: unknown; day: string };

export function pointsFor(kind: string, payload: unknown): number {
  const p = (payload ?? {}) as Record<string, unknown>;
  if (kind === "quiz") return p.resultado === "acerto" ? 15 : 5;
  if (kind === "foco") {
    const m = Number(p.minutos ?? 0);
    return Number.isFinite(m) && m > 0 ? Math.min(m, FOCO_CAP_MIN) : 0;
  }
  return POINTS[kind] ?? 0;
}

/** Soma o XP das linhas dadas aplicando os tetos diários por (day, kind).
 *  `withEngagedBonus`: adiciona +10 por dia distinto com evento em ENGAGED_KINDS. */
function sumWithCaps(rows: Row[], withEngagedBonus: boolean): number {
  const byDayKind = new Map<string, number[]>();
  const engagedDays = new Set<string>();
  for (const r of rows) {
    if (withEngagedBonus && ENGAGED_KINDS.has(r.kind)) engagedDays.add(r.day);
    const pts = pointsFor(r.kind, r.payload);
    if (!pts) continue;
    const key = `${r.day}|${r.kind}`;
    const arr = byDayKind.get(key);
    if (arr) arr.push(pts);
    else byDayKind.set(key, [pts]);
  }
  let total = 0;
  for (const [key, lst] of byDayKind) {
    const kind = key.split("|")[1];
    if (kind === "foco") {
      total += [...lst].sort((a, b) => b - a).slice(0, FOCO_CAP_SESSIONS).reduce((a, b) => a + b, 0);
    } else if (DAILY_CAP_1.has(kind)) {
      total += Math.max(...lst);
    } else {
      total += lst.reduce((a, b) => a + b, 0);
    }
  }
  return total + (withEngagedBonus ? ENGAGED_DAY_XP * engagedDays.size : 0);
}

export function xpTotal(rows: Row[]): number {
  return sumWithCaps(rows, true);
}

export function xpToReach(level: number): number {
  return 50 * (level - 1) * level;
}

export function levelForXp(xp: number): number {
  let lvl = 1;
  while (xpToReach(lvl + 1) <= xp) lvl++;
  return lvl;
}

export function stageForLevel(level: number): string {
  let name = STAGES[0][1];
  for (const [min, n] of STAGES) if (level >= min) name = n;
  return name;
}

const daysAgoISO = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
};

export type Progress = {
  xp: number; level: number; stage: string;
  xpInLevel: number; xpForLevel: number; xpToNext: number;
  bySource: { quiz: number; desafio: number; foco: number; constancia: number };
};

export async function computeProgress(userId: string): Promise<Progress> {
  const rows = (await db
    .select({ kind: events.kind, payload: events.payload, day: events.day })
    .from(events)
    .where(eq(events.userId, userId))) as unknown as Row[];

  const xp = xpTotal(rows);
  const level = levelForXp(xp);
  const base = xpToReach(level);
  const next = xpToReach(level + 1);

  const weekAgo = daysAgoISO(6);
  const wk = rows.filter((r) => r.day >= weekAgo);
  const bucket = (kinds: string[]) =>
    sumWithCaps(wk.filter((r) => kinds.includes(r.kind)), false);
  const engagedWeek = new Set(
    wk.filter((r) => ENGAGED_KINDS.has(r.kind)).map((r) => r.day),
  ).size;

  return {
    xp,
    level,
    stage: stageForLevel(level),
    xpInLevel: xp - base,
    xpForLevel: next - base,
    xpToNext: next - xp,
    bySource: {
      quiz: bucket(["quiz", "quiz_reforco"]),
      desafio: bucket(["desafio"]),
      foco: bucket(["foco"]),
      constancia: ENGAGED_DAY_XP * engagedWeek,
    },
  };
}
```

- [ ] **Step 2: `tsc --noEmit`**

Run: `cd web && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Conferência de paridade com `bot/xp.py` (revisão manual)**

Abrir `bot/xp.py` e `web/src/lib/xp.ts` lado a lado e confirmar, campo a campo:
- `POINTS` — mesmos pares
- `FOCO_CAP_MIN` (30), `FOCO_CAP_SESSIONS` (2), `ENGAGED_DAY_XP` (10)
- `DAILY_CAP_1` / `ENGAGED_KINDS` — mesmos conjuntos
- `STAGES` — mesma lista, mesma ordem
- `xpToReach` — `50*(L-1)*L` nos dois
- `pointsFor` quiz: 15/5 ; foco: `min(minutos, 30)`

- [ ] **Step 4: Checagem numérica da curva (node, fórmula inline)**

O objetivo é confirmar que a fórmula da curva bate com o spec e com `check_xp.py`. Como não há runner de TS, reproduzir a fórmula inline:

Run:
```bash
node -e "
const xpToReach = (L) => 50*(L-1)*L;
const levelForXp = (xp) => { let l=1; while (xpToReach(l+1)<=xp) l++; return l; };
for (const [xp,exp] of [[0,1],[99,1],[100,2],[299,2],[300,3],[1000,5],[4500,10]])
  if (levelForXp(xp)!==exp) throw new Error('curva '+xp+' -> '+levelForXp(xp)+' != '+exp);
console.log('ok curva bate com o spec');
"
```
Expected: `ok curva bate com o spec`. Depois **conferir visualmente** que `xp.ts` tem exatamente `50 * (level - 1) * level` e o mesmo laço `while (xpToReach(lvl + 1) <= xp) lvl++`.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/xp.ts
git commit -m "feat(xp): espelho TS (xp.ts) + computeProgress

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Xt5keXbSFQh1XfCvMh2J6N"
```

---

## Task 5: `LevelBar` + faixa na home

**Files:**
- Create: `web/src/components/LevelBar.tsx`
- Modify: `web/src/app/(app)/page.tsx`

**Interfaces:**
- Consumes: `computeProgress(userId) -> Progress` de `@/lib/xp`
- Produces: `<LevelBar progress={Progress} />` (React server component, sem `"use client"`)

- [ ] **Step 1: Criar `web/src/components/LevelBar.tsx`**

```tsx
import Link from "next/link";
import type { Progress } from "@/lib/xp";

export function LevelBar({ progress }: { progress: Progress }) {
  const pct = progress.xpForLevel > 0
    ? Math.min(100, Math.round((progress.xpInLevel / progress.xpForLevel) * 100))
    : 100;
  return (
    <Link href="/evolucao" className="card block p-4 hover:border-clay">
      <div className="flex items-baseline justify-between">
        <p className="label">Nível {progress.level} · {progress.stage}</p>
        <p className="text-xs text-ink-soft">
          {progress.xpToNext} XP pro nível {progress.level + 1}
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper-2">
        <div
          className="h-full rounded-full bg-growth"
          style={{ width: `${pct}%` }}
        />
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Colocar a faixa na home**

Em `web/src/app/(app)/page.tsx`:

1. Imports (linhas 1-5), adicionar:
```tsx
import { computeProgress } from "@/lib/xp";
import { LevelBar } from "@/components/LevelBar";
```
2. Depois de `const d = await dashboardData(viewing.id);` (linha 33), adicionar:
```tsx
  const progress = await computeProgress(viewing.id);
```
3. No JSX, logo depois do `<header>...</header>` (fecha na linha 44) e antes do `<div className="grid grid-cols-3 gap-3">`:
```tsx
      <LevelBar progress={progress} />
```

- [ ] **Step 3: `tsc --noEmit` + build**

Run: `cd web && npx tsc --noEmit && DATABASE_URL="postgresql://x:x@127.0.0.1/x" npx next build 2>&1 | grep -E "Compiled successfully|Failed|error"`
Expected: `✓ Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/LevelBar.tsx "web/src/app/(app)/page.tsx"
git commit -m "feat(xp): faixa de nível na home

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Xt5keXbSFQh1XfCvMh2J6N"
```

---

## Task 6: `ProgressCard` + seção na Evolução

**Files:**
- Create: `web/src/components/ProgressCard.tsx`
- Modify: `web/src/app/(app)/evolucao/page.tsx`

**Interfaces:**
- Consumes: `computeProgress(userId) -> Progress` de `@/lib/xp`; `EmptyStone` de `@/components/art` (ilustração existente de traço único)
- Produces: `<ProgressCard progress={Progress} streak={{current:number; best:number}} />`

- [ ] **Step 1: Criar `web/src/components/ProgressCard.tsx`**

```tsx
import type { Progress } from "@/lib/xp";

const SOURCES: { key: keyof Progress["bySource"]; label: string }[] = [
  { key: "quiz", label: "quizzes" },
  { key: "desafio", label: "desafios" },
  { key: "foco", label: "foco" },
  { key: "constancia", label: "constância" },
];

export function ProgressCard({
  progress,
  streak,
}: {
  progress: Progress;
  streak: { current: number; best: number };
}) {
  const pct = progress.xpForLevel > 0
    ? Math.min(100, Math.round((progress.xpInLevel / progress.xpForLevel) * 100))
    : 100;
  const weekMax = Math.max(1, ...SOURCES.map((s) => progress.bySource[s.key]));

  return (
    <section className="card overflow-hidden">
      <div className="bg-growth-soft px-5 py-4">
        <p className="label text-growth">Nível {progress.level}</p>
        <h2 className="num mt-1 text-[clamp(1.8rem,5vw,2.6rem)] text-ink">{progress.stage}</h2>
        <p className="mt-1 text-sm text-ink-soft">
          {progress.xp} XP no total · {progress.xpToNext} pro nível {progress.level + 1}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper">
          <div className="h-full rounded-full bg-growth" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 text-sm">
        <div>
          <p className="num text-2xl text-growth">{streak.current}</p>
          <p className="text-xs text-ink-soft">dias seguidos · recorde {streak.best}</p>
        </div>
        <div>
          <p className="num text-2xl">
            {SOURCES.reduce((a, s) => a + progress.bySource[s.key], 0)}
          </p>
          <p className="text-xs text-ink-soft">XP nos últimos 7 dias</p>
        </div>
      </div>

      <div className="space-y-2 px-5 pb-5">
        {SOURCES.map((s) => {
          const v = progress.bySource[s.key];
          return (
            <div key={s.key} className="flex items-center gap-3 text-xs">
              <span className="w-20 text-ink-soft">{s.label}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-paper-2">
                <span
                  className="block h-full rounded-full bg-trail"
                  style={{ width: `${Math.round((v / weekMax) * 100)}%` }}
                />
              </span>
              <span className="num w-8 text-right text-ink-soft">{v}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Colocar na tela Evolução**

Em `web/src/app/(app)/evolucao/page.tsx`:

1. Imports:
```tsx
import { computeProgress } from "@/lib/xp";
import { ProgressCard } from "@/components/ProgressCard";
```
2. Depois de `const d = await evolucaoData(viewing.id);` (linha 10):
```tsx
  const progress = await computeProgress(viewing.id);
```
3. Trocar o `<header>` atual (linhas 14-20) — que já mostra o streak — por: manter o `<header>` só com o rótulo e o título, e inserir `<ProgressCard>` logo abaixo dele, **substituindo** a exibição solta do streak (o card já mostra streak):
```tsx
      <header>
        <p className="label">Evolução</p>
        <h1 className="mt-1 text-[clamp(1.6rem,4vw,2.4rem)]">Onde você chegou.</h1>
      </header>

      <ProgressCard progress={progress} streak={d.streak} />
```

- [ ] **Step 3: `tsc --noEmit` + build**

Run: `cd web && npx tsc --noEmit && DATABASE_URL="postgresql://x:x@127.0.0.1/x" npx next build 2>&1 | grep -E "Compiled successfully|Failed|error"`
Expected: `✓ Compiled successfully`.

- [ ] **Step 4: Deploy do painel + verificação manual**

```bash
bash scripts/deploy-web.sh
```
Expected: `✓ painel deployado`. Depois abrir `https://aristotelia.tailf2394c.ts.net/` (logado como a Fernanda) e conferir: faixa de nível na home, cartão de progresso na Evolução, número de XP plausível vs. o histórico dela.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/ProgressCard.tsx "web/src/app/(app)/evolucao/page.tsx"
git commit -m "feat(xp): cartão de progresso na tela Evolução

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Xt5keXbSFQh1XfCvMh2J6N"
```

---

## Task 7: Docs — Design.md, Produto.md, Backlog.md

**Files:**
- Modify: `Design.md` (nova subseção em PARTE 1 ou logo após "Os 3 registros de cobrança")
- Modify: `Produto.md` (§6.5)
- Modify: `Backlog.md` (tabela "Feito" + item v2 em P3)

**Interfaces:** nenhuma (documentação).

- [ ] **Step 1: `Design.md` — adicionar a subseção "Progressão / XP"**

Depois da subseção "Os 3 registros de cobrança" (antes de "### Como ela ensina"):

```markdown
### Progressão / XP (gamificação sóbria — 2026-09-04)
XP derivado da tabela `events` (spec `docs/superpowers/specs/2026-09-04-gamificacao-xp-niveis-design.md`). Nível = função pura do XP. **Estágios** (o título é o que importa, não o número):

| Níveis | Estágio | Fecho da linha de level-up |
|---|---|---|
| 1–2 | Começando | Começou. |
| 3–4 | Na trilha | Você tá andando. |
| 5–6 | Em ritmo | O ritmo pegou. |
| 7–9 | Consistente | Isso já é constância. |
| 10–12 | Aprofundando | Tá ficando sério. |
| 13–15 | Praticante | Você faz, não só estuda. |
| 16–19 | Dominando | Pouca gente chega aqui. |
| 20+ | Referência | Agora é você que serve de exemplo. |

- **Linha de level-up:** `📈 Nível {N} — {estágio}. {fecho}` — 1 linha, verde-trilha, anexada a uma mensagem que já ia sair. Nunca mensagem própria no bot (exceto a rede de segurança do guia da manhã).
- **Onde vive:** `bot/xp.py` + espelho `web/src/lib/xp.ts`. Os nomes de estágio e os fechos são **deste arquivo** — mudou aqui, muda nos dois módulos.
- **No painel:** faixa no topo da home (`LevelBar`) + cartão de progresso na Evolução (`ProgressCard`), feito pra printar (verde = crescimento, hachura da marca, um marco do caminho).
- **Rebalancear os pesos depois:** como o XP é derivado, mexer nos pesos **recalcula o histórico** — só ajustar **pra cima**, pra ninguém "descer de nível" num deploy.
```

- [ ] **Step 2: `Produto.md` §6.5 — marcar feito**

Trocar a linha:
```markdown
- **[v2]** Skill tree com XP e níveis (gamificação sóbria).
```
por:
```markdown
- **[feito 2026-09-04]** XP + níveis (estágios de domínio), derivados de `events`. Linha de level-up no bot + faixa/cartão no painel. Spec: `docs/superpowers/specs/2026-09-04-gamificacao-xp-niveis-design.md`.
- **[v2]** Skill tree / mapa de domínio por área (estende a `LearningTree`); cartão de progresso como imagem; missões semanais.
```

- [ ] **Step 3: `Backlog.md` — linha em "Feito" + item v2**

Na tabela "Feito (arquivo)", adicionar:
```markdown
| — | **Gamificação v1** — XP + níveis derivados de `events` (sem migration), linha de level-up no bot, faixa + cartão de progresso no painel. Spec `2026-09-04-gamificacao-xp-niveis-design`. | 2026-09-04 |
```
Em P3, adicionar um item:
```markdown
### B26 · Gamificação v2 — `M`
Sobre a v1 (XP/níveis): mapa de domínio por área da trilha (estende `LearningTree` — quiz certo por tópico enche um nó), cartão de progresso exportado como **imagem PNG** pra compartilhar, missões semanais (a treinadora define 2-3 alvos, o card de domingo celebra). Ranking de turma / temporada = Fase 3 (plano pago).
```

- [ ] **Step 4: Commit**

```bash
git add Design.md Produto.md Backlog.md
git commit -m "docs: gamificação v1 (Design/Produto/Backlog)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Xt5keXbSFQh1XfCvMh2J6N"
```

- [ ] **Step 5: Push de tudo**

```bash
git push origin main
```

- [ ] **Step 6: Atualizar a `Memória.md`**

Adicionar entrada com data `2026-09-04` resumindo: gamificação v1 no ar (XP derivado de `events`, sem migration; níveis/estágios; linha de level-up no bot em `_review`/`_quiz2`/`_challenge`/guia; `LevelBar` + `ProgressCard` no painel; `scripts/check_xp.py`). Commit dessa edição junto ou logo após.

---

## Self-Review

**1. Spec coverage:**
- §3.1 mapa evento→XP + tetos + bônus dia engajado → Task 1 (`points_for`, `xp_total`) + `check_xp.py`. ✓
- §3.2 curva → Task 1 (`xp_to_reach`, `level_for_xp`). ✓
- §3.3 estágios → Task 1 (`STAGES`, `stage_for_level`) + Task 7 (Design.md dono do texto). ✓
- §3.4 anúncio via evento `xp:levelup` → Task 2 (`sync_and_maybe_announce`) + Task 3 (call sites). ✓
- §3.4 card de domingo → Task 3 Step 6. ✓
- §4.1 `xp.ts` + `computeProgress` → Task 4. ✓
- §4.2 faixa na home → Task 5. ✓
- §4.3 cartão na Evolução → Task 6. ✓
- §4.4 sem rotas de API → respeitado (tudo server component). ✓
- §5 lista de arquivos → cobre todos. ✓
- §7 testes → `check_xp.py` (Task 1-2), paridade (Task 4), manual VM (Task 3 Step 8, Task 6 Step 4). ✓
- Migration: nenhuma. ✓

**2. Placeholder scan:** Task 4 Step 1 tem uma função `sum` explicativa marcada pra remover — a nota está explícita e o Step 3/2 gate pega. Sem outros TODOs/TBDs. Código real em todos os steps.

**3. Type consistency:**
- `Progress` definido em Task 4, usado em Task 5 e 6 com os mesmos campos (`xp`, `level`, `stage`, `xpInLevel`, `xpForLevel`, `xpToNext`, `bySource`). ✓
- `sync_and_maybe_announce(user_id, day) -> str | None` — assinatura idêntica em Task 2 (def) e Task 3 (uso). ✓
- `xp.xp_total` / `xp.level_for_xp` / `xp.stage_for_level` — nomes idênticos entre Task 1 (Python) e uso em Task 3. ✓
- `db.events_all` — Task 2 define, Task 3 Step 6 usa. ✓
- `computeProgress` — Task 4 define, Task 5/6 usam. ✓
