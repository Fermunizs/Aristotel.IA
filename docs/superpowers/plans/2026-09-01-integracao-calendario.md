# Integração Google Calendar / Outlook + Lembretes Multicanal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada lembrete passa a ter uma lista de canais (`telegram`/`push`/`agenda`); com `agenda`, o lembrete vira um evento recorrente no calendário secundário "Aristótel.IA" que a pessoa conecta via OAuth (Google e/ou Microsoft).

**Architecture:** Toda a lógica de OAuth e API de calendário vive no app web (Next). Um evento recorrente (RRULE) por lembrete, num calendário secundário dedicado que só o app toca. Sync dispara inline após editar lembrete + um timer systemd a cada 10 min (rede de segurança). O bot Python só ganha entrega multicanal (telegram+push juntos) e ignora `agenda`.

**Tech Stack:** Next 15 (App Router, standalone), Drizzle ORM, `postgres` (pg driver), Node `crypto` (AES-256-GCM), Google Calendar API v3, Microsoft Graph. Bot: `python-telegram-bot` + APScheduler. Testes web: **vitest** (novo devDependency). Testes bot: script de asserção via `.venv` (o projeto não tem pytest).

**Spec:** `docs/superpowers/specs/2026-09-01-integracao-calendario-design.md`

## Global Constraints

- Docs e strings de UI em **português do Brasil**, tom de `Design.md` (sincero, sem textão, no máx. 1 emoji no início).
- `reminders.days`: `0 = segunda … 6 = domingo` (ver `db/migrations/0002_reminders.sql`).
- `DAY_LABELS = ["seg","ter","qua","qui","sex","sáb","dom"]` — não mudar.
- Schema é lockstep: migration + bot + web sobem juntos. `reminders.channel` **some** nesta entrega.
- Base URL de produção: `https://147-15-46-51.sslip.io`.
- `PERIOD_TIMES`: `manha=08:00`, `tarde=15:00`, `noite=20:00` (fonte: `bot/config.py:106`).
- Escopo Google: `https://www.googleapis.com/auth/calendar.app.created` (+ `openid email`). Escopo Microsoft: `offline_access Calendars.ReadWrite openid email`.
- Tokens **nunca** em log nem em `calendar_connections.last_error`.
- Nenhum deploy nem migration rodada como parte da implementação — só código + testes locais. Deploy é passo manual no fim (§Rollout do spec), depende da config da Fernanda.
- Commits frequentes, um por task no mínimo. Mensagens em português, com o rodapé `Co-Authored-By` / `Claude-Session` do projeto.

---

## File Structure

**Novos — web**
- `web/src/lib/crypto.ts` — cifra/decifra token (AES-256-GCM), `calendarConfigured()`.
- `web/src/lib/calendar/provider.ts` — `interface CalProvider`, tipos `DesiredEvent`, `CalendarAuthError`.
- `web/src/lib/calendar/rrule.ts` — `toRRule(days)`, `toGraphRecurrence(days, startDate)`.
- `web/src/lib/calendar/event-shape.ts` — `reminderToEvent(rem, user)`, `eventHash(rem)`, `SHAPE_VER`.
- `web/src/lib/calendar/google.ts` — `GoogleCal implements CalProvider`.
- `web/src/lib/calendar/microsoft.ts` — `MsCal implements CalProvider`.
- `web/src/lib/calendar/oauth.ts` — `authUrl(provider, state)`, `exchangeCode(provider, code)`, `refreshAccess(conn)`, `getAccessToken(conn)`.
- `web/src/lib/calendar/sync.ts` — `reconcileConnection`, `reconcileUser`, `reconcileDirty`, `markCalendarDirty`.
- `web/src/lib/calendar/config.ts` — leitura tipada das env vars de calendário.
- `web/src/app/api/oauth/[provider]/start/route.ts`
- `web/src/app/api/oauth/[provider]/callback/route.ts`
- `web/src/app/api/oauth/[provider]/disconnect/route.ts`
- `web/src/app/api/internal/calendar/sync/route.ts`
- `web/src/app/privacidade/page.tsx`
- `web/src/components/CalendarConnections.tsx`
- `web/src/lib/calendar/__tests__/*.test.ts` — vitest.
- `web/vitest.config.ts`

**Novos — infra**
- `db/migrations/0013_calendar.sql`
- `scripts/systemd/aristotelia-calsync.service`
- `scripts/systemd/aristotelia-calsync.timer`

**Alterados**
- `bot/db.py` — `cleanup_expired()` (+`oauth_states`), `get_reminders` (garantir `channels` no `_j`).
- `bot/scheduling.py` — checagem de canal por `channels`.
- `bot/jobs.py` — `_deliver` multicanal.
- `web/src/lib/schema.ts` — `reminders.channels`, tabelas novas.
- `web/src/lib/reminders.ts` — `getReminders` mapeia `channels`; `markDirty` já existe.
- `web/src/lib/reminder-kinds.ts` — `CHANNELS.agenda`, `PERIOD_TIMES`, `KIND` labels reexport.
- `web/src/app/api/reminders/route.ts` — `channels` no POST/PATCH, dispara reconcile.
- `web/src/components/RemindersEditor.tsx` — chips multi-canal.
- `web/src/app/(app)/lembretes/page.tsx` — card de conexões.
- `web/package.json` — vitest.
- `scripts/systemd/README.md`, `CLAUDE.md`, `Memória.md`.

---

## Task 1: Migration + schema (DB foundations)

**Files:**
- Create: `db/migrations/0013_calendar.sql`
- Modify: `web/src/lib/schema.ts`
- Modify: `bot/db.py` (`cleanup_expired`, `get_reminders`)

**Interfaces:**
- Produces (web schema): `reminders.channels` (`jsonb`, `$type<string[]>()`); tables `calendarConnections`, `calendarEvents`, `oauthStates` exported from `schema.ts` with camelCase columns.
- Produces (SQL): tables per spec §3.

- [ ] **Step 1: Write the migration**

`db/migrations/0013_calendar.sql` — copiar exatamente o bloco SQL do spec §3 (as 4 partes: `ALTER reminders`, `calendar_connections`, `calendar_events`, `oauth_states`). Prefixar com o comentário de cabeçalho no estilo das outras migrations:

```sql
-- 0013 — Integração de calendário (Google/Outlook) + lembretes multicanal.
-- reminders.channel (texto único) vira reminders.channels (lista jsonb).
```

- [ ] **Step 2: Verificar a migration contra um Postgres real (throwaway)**

Se houver Docker local:
```bash
docker run -d --rm --name arist-mig-test -e POSTGRES_PASSWORD=x -p 55432:5432 postgres:16
sleep 4
for f in db/migrations/0001_init.sql db/migrations/0002_reminders.sql db/migrations/0003_push.sql db/migrations/0004_history.sql db/migrations/0005_settings.sql db/migrations/0006_coach_tone.sql db/migrations/0007_limits.sql db/migrations/0008_roles_plans.sql db/migrations/0009_content_cache.sql db/migrations/0010_llm_usage.sql db/migrations/0011_review_queue.sql db/migrations/0013_calendar.sql; do
  echo "== $f =="; PGPASSWORD=x psql -h localhost -p 55432 -U postgres -d postgres -v ON_ERROR_STOP=1 -f "$f" || break
done
PGPASSWORD=x psql -h localhost -p 55432 -U postgres -d postgres -c "\d reminders" -c "\d calendar_connections"
docker stop arist-mig-test
```
Expected: todas aplicam sem erro; `reminders` não tem mais `channel`, tem `channels jsonb`; `calendar_connections` existe.
Se não houver Docker: revisar o SQL à mão contra o `0001_init.sql` (tipos, FKs) e seguir — o runner do bot valida no deploy.

- [ ] **Step 3: Drizzle schema — `web/src/lib/schema.ts`**

Trocar em `preferences`? Não. Em `reminders`:
```ts
// remover: channel: text("channel").notNull(),
channels: jsonb("channels").notNull().$type<string[]>(),
```
Adicionar ao fim do arquivo (importar `timestamp` se ainda não estiver):
```ts
export const calendarConnections = pgTable("calendar_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  provider: text("provider").notNull(),               // 'google' | 'microsoft'
  externalCalId: text("external_cal_id"),
  accessTokenEnc: text("access_token_enc"),
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  status: text("status").notNull(),                   // 'active' | 'broken'
  lastError: text("last_error"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  dirty: boolean("dirty").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const calendarEvents = pgTable("calendar_events", {
  connectionId: uuid("connection_id").notNull(),
  reminderId: uuid("reminder_id").notNull(),
  externalEventId: text("external_event_id").notNull(),
  syncedHash: text("synced_hash").notNull(),
});

export const oauthStates = pgTable("oauth_states", {
  state: text("state").primaryKey(),
  userId: uuid("user_id").notNull(),
  provider: text("provider").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});
```

- [ ] **Step 4: `bot/db.py` — cleanup + get_reminders**

Em `cleanup_expired()` adicionar a linha (junto das outras `DELETE`):
```python
await con.execute("DELETE FROM oauth_states WHERE created_at < now() - interval '1 hour'")
```
Em `get_reminders`, garantir parse de `channels` (é `jsonb`). Se a função hoje devolve `asyncpg.Record` cru, o `channels` vem como string JSON — no consumidor (`scheduling.py`) fazer `_j`. Anotar: **o parse acontece na Task 3**, aqui só confirmar que `SELECT *` inclui a coluna nova (inclui, é `SELECT *`).

- [ ] **Step 5: tsc + commit**

```bash
cd web && npx tsc --noEmit   # vai quebrar em quem usa reminders.channel — OK, as Tasks 3-4 arrumam; se quiser, seguir e só rodar tsc verde no fim da Task 4
cd .. && git add db/migrations/0013_calendar.sql web/src/lib/schema.ts bot/db.py
git commit -m "feat(calendar): migration 0013 + schema (channels, calendar_connections/events, oauth_states)"
```

---

## Task 2: `crypto.ts` — cifra de token

**Files:**
- Create: `web/src/lib/crypto.ts`
- Create: `web/vitest.config.ts`
- Create: `web/src/lib/__tests__/crypto.test.ts`
- Modify: `web/package.json` (vitest)

**Interfaces:**
- Produces: `encryptToken(plain: string): string`, `decryptToken(blob: string): string` (lança em blob adulterado / chave errada), `calendarConfigured(): boolean`.

- [ ] **Step 1: Instalar vitest**

```bash
cd web && npm i -D vitest
```
`web/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: ["src/**/*.test.ts"] } });
```
Adicionar em `web/package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 2: Write the failing test — `web/src/lib/__tests__/crypto.test.ts`**

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";

beforeAll(() => {
  process.env.CALENDAR_TOKEN_KEY = randomBytes(32).toString("base64");
});

describe("crypto", () => {
  it("round-trips", async () => {
    const { encryptToken, decryptToken } = await import("../crypto");
    const secret = "1//refresh-token-abc.def_ghi";
    expect(decryptToken(encryptToken(secret))).toBe(secret);
  });

  it("produces a different blob each call (random IV)", async () => {
    const { encryptToken } = await import("../crypto");
    expect(encryptToken("x")).not.toBe(encryptToken("x"));
  });

  it("throws on a tampered blob", async () => {
    const { encryptToken, decryptToken } = await import("../crypto");
    const blob = encryptToken("hello");
    const parts = blob.split(":");
    const bad = [parts[0], parts[1], Buffer.from("garbage").toString("base64")].join(":");
    expect(() => decryptToken(bad)).toThrow();
  });

  it("calendarConfigured() reflects the key", async () => {
    const { calendarConfigured } = await import("../crypto");
    expect(calendarConfigured()).toBe(true);
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

```bash
cd web && npx vitest run src/lib/__tests__/crypto.test.ts
```
Expected: FAIL (`Cannot find module '../crypto'`).

- [ ] **Step 4: Implement `web/src/lib/crypto.ts`**

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key(): Buffer {
  const raw = process.env.CALENDAR_TOKEN_KEY ?? "";
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("CALENDAR_TOKEN_KEY ausente ou != 32 bytes");
  return buf;
}

/** base64(iv):base64(tag):base64(ciphertext) */
export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString("base64")).join(":");
}

export function decryptToken(blob: string): string {
  const [iv, tag, ct] = blob.split(":").map((s) => Buffer.from(s, "base64"));
  if (!iv || !tag || !ct) throw new Error("blob de token malformado");
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

export function calendarConfigured(): boolean {
  try { key(); return true; } catch { return false; }
}
```

- [ ] **Step 5: Run — expect PASS**

```bash
cd web && npx vitest run src/lib/__tests__/crypto.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add web/package.json web/package-lock.json web/vitest.config.ts web/src/lib/crypto.ts web/src/lib/__tests__/crypto.test.ts
git commit -m "feat(calendar): crypto.ts — cifra AES-256-GCM de token + vitest"
```

---

## Task 3: Bot — agendamento por `channels`

**Files:**
- Modify: `bot/scheduling.py` (`schedule_user`)
- Create: `scripts/check_channels.py` (asserção throwaway, fica no repo como doc)

**Interfaces:**
- Consumes: `db.get_reminders` (linhas com coluna `channels` jsonb).
- Produces: job data agora tem `data["channels"]: list[str]` em vez de `data["channel"]`.

- [ ] **Step 1: Editar `bot/scheduling.py`**

No topo do loop de `reminders` em `schedule_user`, trocar:
```python
        if rem["channel"] not in ("telegram", "push"):
            continue  # e-mail: Fase 2 item 3
```
por:
```python
        chans = set(rem["channels"] if isinstance(rem["channels"], list) else json.loads(rem["channels"] or "[]"))
        if not (chans & {"telegram", "push"}):
            continue  # só 'agenda' (ou nada) — o painel cuida do calendário
```
E no `data=` do `run_daily`, trocar `"channel": rem["channel"]` por `"channels": sorted(chans)`.
Adicionar `import json` se não houver no arquivo.

- [ ] **Step 2: Asserção — `scripts/check_channels.py`**

```python
"""Sanidade da checagem de canal do scheduling (roda com a .venv)."""
chans_cases = [
    (["telegram"], True),
    (["push"], True),
    (["telegram", "push", "agenda"], True),
    (["agenda"], False),
    ([], False),
]
for chans, should_schedule in chans_cases:
    got = bool(set(chans) & {"telegram", "push"})
    assert got == should_schedule, (chans, got)
print("OK", len(chans_cases), "casos")
```

- [ ] **Step 3: Rodar**

```bash
./.venv/Scripts/python.exe scripts/check_channels.py
./.venv/Scripts/python.exe -m py_compile bot/scheduling.py
```
Expected: `OK 5 casos` + compile limpo.

- [ ] **Step 4: Commit**

```bash
git add bot/scheduling.py scripts/check_channels.py
git commit -m "feat(calendar): bot agenda job por channels (telegram/push); ignora 'agenda'"
```

---

## Task 4: Bot — entrega multicanal + web reminders API/UI

**Files:**
- Modify: `bot/jobs.py` (`_deliver`)
- Modify: `web/src/lib/reminder-kinds.ts`
- Modify: `web/src/lib/reminders.ts` (`getReminders`)
- Modify: `web/src/app/api/reminders/route.ts`
- Modify: `web/src/components/RemindersEditor.tsx`

**Interfaces:**
- Consumes: nada de tasks anteriores além do schema.
- Produces: `reminder-kinds.ts` exporta `PERIOD_TIMES: Record<"manha"|"tarde"|"noite", string>` (`"HH:MM"`), `KIND_LABEL: Record<string,string>`, `CHANNELS.agenda`.

- [ ] **Step 1: `bot/jobs.py::_deliver`**

Trocar o corpo por:
```python
async def _deliver(context, user, chat, title: str, text: str) -> None:
    """Entrega nos canais do lembrete: telegram e/ou push. 'agenda' é do painel."""
    data = (getattr(context, "job", None) and context.job.data) or {}
    chans = set(data.get("channels") or ["telegram"])
    if "telegram" in chans and chat:
        await send_text(context.bot, chat, text)
    if "push" in chans:
        await push.send(user["id"], title, _plain(text))
```
`py_compile bot/jobs.py`.

- [ ] **Step 2: `web/src/lib/reminder-kinds.ts`**

Adicionar:
```ts
export const CHANNELS = {
  telegram: { label: "Telegram", ready: true },
  push: { label: "Navegador", ready: true },
  agenda: { label: "Agenda", ready: true },
  email: { label: "E-mail", ready: false },
} as const;

export const PERIOD_TIMES = { manha: "08:00", tarde: "15:00", noite: "20:00" } as const;

export const KIND_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(KINDS).map(([k, v]) => [k, v.label]),
);
```
(Ajustar o `CHANNELS` existente — adicionar `agenda`.)

- [ ] **Step 3: `web/src/lib/reminders.ts::getReminders`**

No `.map`, adicionar normalização:
```ts
return rows.map((r) => ({
  ...r,
  days: (r.days as number[]) ?? [0, 1, 2, 3, 4, 5, 6],
  channels: (Array.isArray(r.channels) ? r.channels : ["telegram"]) as string[],
}));
```

- [ ] **Step 4: `web/src/app/api/reminders/route.ts`**

- POST `values({...})`: trocar `channel: "telegram"` por `channels: ["telegram"]`.
- PATCH: remover o bloco `if (["telegram","push","email"].includes(b.channel)) patch.channel = b.channel;` e pôr:
```ts
if (Array.isArray(b.channels)) {
  const valid = b.channels.filter((c: unknown): c is string =>
    typeof c === "string" && ["telegram", "push", "agenda"].includes(c));
  if (valid.length === 0)
    return NextResponse.json({ error: "escolha ao menos um canal" }, { status: 400 });
  patch.channels = Array.from(new Set(valid));
}
```
- Nos três métodos, depois de `await markDirty(uid);` adicionar:
```ts
import { markCalendarDirty, reconcileUser } from "@/lib/calendar/sync"; // no topo
// ...
await markCalendarDirty(uid);
void reconcileUser(uid).catch(() => {});
```
**Nota:** `markCalendarDirty`/`reconcileUser` são da Task 8 — se implementar fora de ordem, criar stubs que não quebrem o build (`export async function markCalendarDirty(_: string) {}`), a Task 8 preenche. Rodar `tsc` só verde no fim da Task 8.

- [ ] **Step 5: `RemindersEditor.tsx` — chips multicanal**

O tipo `R` já tem `channel: string` — trocar por `channels: string[]`. Onde hoje há um `<select>`/botão de canal único, pôr:
```tsx
{(["telegram", "push", "agenda"] as const).map((c) => {
  const on = r.channels.includes(c);
  return (
    <button
      key={c}
      type="button"
      disabled={readOnly}
      onClick={() => {
        const next = on ? r.channels.filter((x) => x !== c) : [...r.channels, c];
        if (next.length === 0) return; // não deixa zerar
        patch(r.id, { channels: next });
      }}
      className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-clay bg-clay-soft text-clay" : "border-line text-ink-soft"}`}
    >
      {CHANNELS[c].label}
    </button>
  );
})}
```
Ajustar a chamada `patch`/`api("PATCH", ...)` pra mandar `channels`. Onde o editor cria um lembrete novo, default `channels: ["telegram"]`.

- [ ] **Step 6: Verificar**

```bash
./.venv/Scripts/python.exe -m py_compile bot/jobs.py
cd web && npx tsc --noEmit   # pode faltar sync.ts stubs — ok até Task 8
```

- [ ] **Step 7: Commit**

```bash
git add bot/jobs.py web/src/lib/reminder-kinds.ts web/src/lib/reminders.ts web/src/app/api/reminders/route.ts web/src/components/RemindersEditor.tsx
git commit -m "feat(calendar): entrega multicanal no bot + chips de canal no editor de lembretes"
```

---

## Task 5: `rrule.ts` + `event-shape.ts` + `provider.ts` (lógica pura)

**Files:**
- Create: `web/src/lib/calendar/provider.ts`
- Create: `web/src/lib/calendar/rrule.ts`
- Create: `web/src/lib/calendar/event-shape.ts`
- Create: `web/src/lib/calendar/__tests__/rrule.test.ts`
- Create: `web/src/lib/calendar/__tests__/event-shape.test.ts`

**Interfaces:**
- Produces `provider.ts`:
```ts
export type DesiredEvent = {
  clientKey: string; summary: string; description: string;
  startTime: string; durationMin: number; byday: number[];
  reminderMinutes: number; timeZone: string;
};
export interface CalProvider {
  createCalendar(name: string): Promise<string>;
  deleteCalendar(calId: string): Promise<void>;
  upsertEvent(calId: string, ev: DesiredEvent, existingId?: string): Promise<string>;
  deleteEvent(calId: string, eventId: string): Promise<void>;
}
export class CalendarAuthError extends Error {}
```
- Produces `rrule.ts`: `toRRule(days: number[]): string`, `toGraphRecurrence(days: number[], startDate: string): object`.
- Produces `event-shape.ts`: `SHAPE_VER: number`, `reminderToEvent(rem: ReminderRow, user: {timezone: string}): DesiredEvent`, `eventHash(rem: ReminderRow): string`. `ReminderRow` = `{ id, kind, atTime, period, days, customText }`.

- [ ] **Step 1: `provider.ts`** — colar o bloco acima. Sem lógica, só tipos.

- [ ] **Step 2: Failing test — `__tests__/rrule.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { toRRule, toGraphRecurrence } from "../rrule";

describe("toRRule", () => {
  it("weekdays", () => {
    expect(toRRule([0, 1, 2, 3, 4])).toBe("RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
  });
  it("all seven days -> daily", () => {
    expect(toRRule([0, 1, 2, 3, 4, 5, 6])).toBe("RRULE:FREQ=DAILY");
  });
  it("order-independent", () => {
    expect(toRRule([4, 0, 2])).toBe("RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR");
  });
  it("sunday only", () => {
    expect(toRRule([6])).toBe("RRULE:FREQ=WEEKLY;BYDAY=SU");
  });
});

describe("toGraphRecurrence", () => {
  it("maps to Graph object", () => {
    expect(toGraphRecurrence([0, 2, 4], "2026-09-01")).toEqual({
      pattern: { type: "weekly", interval: 1, daysOfWeek: ["monday", "wednesday", "friday"] },
      range: { type: "noEnd", startDate: "2026-09-01" },
    });
  });
});
```

- [ ] **Step 3: Run — FAIL**, then implement `rrule.ts`:

```ts
const BYDAY = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
const GRAPH_DAY = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

const uniqSorted = (days: number[]) => Array.from(new Set(days)).sort((a, b) => a - b);

export function toRRule(days: number[]): string {
  const d = uniqSorted(days);
  if (d.length === 7) return "RRULE:FREQ=DAILY";
  return `RRULE:FREQ=WEEKLY;BYDAY=${d.map((i) => BYDAY[i]).join(",")}`;
}

export function toGraphRecurrence(days: number[], startDate: string) {
  return {
    pattern: { type: "weekly", interval: 1, daysOfWeek: uniqSorted(days).map((i) => GRAPH_DAY[i]) },
    range: { type: "noEnd", startDate },
  };
}
```
Run — PASS.

- [ ] **Step 4: Failing test — `__tests__/event-shape.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { reminderToEvent, eventHash } from "../event-shape";

const user = { timezone: "America/Sao_Paulo" };
const base = { id: "r1", kind: "guia", atTime: "08:00:00", period: null, days: [0, 1, 2, 3, 4], customText: null };

describe("reminderToEvent", () => {
  it("fixed-time guia", () => {
    const ev = reminderToEvent(base, user);
    expect(ev.summary).toBe("🧭 Aristótel.IA — O que fazer hoje");
    expect(ev.startTime).toBe("08:00");
    expect(ev.byday).toEqual([0, 1, 2, 3, 4]);
    expect(ev.reminderMinutes).toBe(10);
    expect(ev.timeZone).toBe("America/Sao_Paulo");
    expect(ev.clientKey).toBe("r1");
  });
  it("period reminder uses PERIOD_TIMES", () => {
    const ev = reminderToEvent({ ...base, atTime: null, period: "tarde" }, user);
    expect(ev.startTime).toBe("15:00");
  });
  it("livre with text", () => {
    const ev = reminderToEvent({ ...base, kind: "livre", customText: "alongar 2 min" }, user);
    expect(ev.summary).toBe("⏰ alongar 2 min");
  });
  it("livre without text", () => {
    const ev = reminderToEvent({ ...base, kind: "livre", customText: null }, user);
    expect(ev.summary).toBe("⏰ Lembrete");
  });
});

describe("eventHash", () => {
  it("stable regardless of day order", () => {
    expect(eventHash(base)).toBe(eventHash({ ...base, days: [4, 3, 2, 1, 0] }));
  });
  it("changes when time changes", () => {
    expect(eventHash(base)).not.toBe(eventHash({ ...base, atTime: "09:00:00" }));
  });
});
```

- [ ] **Step 5: Run — FAIL**, then implement `event-shape.ts`:

```ts
import { createHash } from "node:crypto";
import { KIND_LABEL, PERIOD_TIMES } from "@/lib/reminder-kinds";
import type { DesiredEvent } from "./provider";

export const SHAPE_VER = 1;

const BOT = process.env.TELEGRAM_BOT ?? "AristotelIA_bot";
const BASE = process.env.PUBLIC_BASE_URL ?? "https://147-15-46-51.sslip.io";

export type ReminderRow = {
  id: string; kind: string;
  atTime: string | null; period: string | null;
  days: number[]; customText: string | null;
};

function startTime(rem: ReminderRow): string {
  if (rem.atTime) return rem.atTime.slice(0, 5);
  return PERIOD_TIMES[(rem.period ?? "manha") as keyof typeof PERIOD_TIMES] ?? "09:00";
}

function summary(rem: ReminderRow): string {
  if (rem.kind === "livre") return `⏰ ${rem.customText?.trim() || "Lembrete"}`;
  return `🧭 Aristótel.IA — ${KIND_LABEL[rem.kind] ?? "Lembrete"}`;
}

export function reminderToEvent(rem: ReminderRow, user: { timezone: string }): DesiredEvent {
  return {
    clientKey: rem.id,
    summary: summary(rem),
    description: `Abra o Telegram pra ver o de hoje: https://t.me/${BOT}\nou o painel: ${BASE}/`,
    startTime: startTime(rem),
    durationMin: 15,
    byday: Array.from(new Set(rem.days)).sort((a, b) => a - b),
    reminderMinutes: 10,
    timeZone: user.timezone,
  };
}

export function eventHash(rem: ReminderRow): string {
  const days = Array.from(new Set(rem.days)).sort((a, b) => a - b);
  const key = JSON.stringify([SHAPE_VER, rem.kind, startTime(rem), days, rem.customText ?? ""]);
  return createHash("sha1").update(key).digest("hex");
}
```
Run — PASS. (Se o `KIND_LABEL` de `guia` não for exatamente "O que fazer hoje", ajustar o teste pro label real de `KINDS.guia.label` em `reminder-kinds.ts`.)

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/calendar/provider.ts web/src/lib/calendar/rrule.ts web/src/lib/calendar/event-shape.ts web/src/lib/calendar/__tests__/
git commit -m "feat(calendar): rrule + event-shape + interface CalProvider (lógica pura, testada)"
```

---

## Task 6: `config.ts` + `oauth.ts` (handshake e tokens)

**Files:**
- Create: `web/src/lib/calendar/config.ts`
- Create: `web/src/lib/calendar/oauth.ts`

**Interfaces:**
- Produces `config.ts`: `CAL = { google: {clientId, clientSecret, authUrl, tokenUrl, scope}, microsoft: {...}, baseUrl, internalSecret }`, `type Provider = "google" | "microsoft"`.
- Produces `oauth.ts`:
  - `authUrl(provider: Provider, state: string): string`
  - `exchangeCode(provider: Provider, code: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date; scope: string }>`
  - `getAccessToken(conn: CalendarConnectionRow): Promise<string>` — refaz o refresh se `tokenExpiresAt` perto de expirar; grava o novo access cifrado; em `invalid_grant` marca `status='broken'` e lança `CalendarAuthError`.
  - `CalendarConnectionRow` = `typeof calendarConnections.$inferSelect`.

- [ ] **Step 1: `config.ts`**

```ts
export type Provider = "google" | "microsoft";

const base = process.env.PUBLIC_BASE_URL ?? "https://147-15-46-51.sslip.io";

export const CAL = {
  baseUrl: base,
  internalSecret: process.env.INTERNAL_SYNC_SECRET ?? "",
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid email https://www.googleapis.com/auth/calendar.app.created",
    redirect: `${base}/api/oauth/google/callback`,
  },
  microsoft: {
    clientId: process.env.MS_CLIENT_ID ?? "",
    clientSecret: process.env.MS_CLIENT_SECRET ?? "",
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scope: "offline_access openid email Calendars.ReadWrite",
    redirect: `${base}/api/oauth/microsoft/callback`,
  },
} as const;

export function providerConfigured(p: Provider): boolean {
  return Boolean(CAL[p].clientId && CAL[p].clientSecret);
}
```

- [ ] **Step 2: `oauth.ts`**

```ts
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { calendarConnections } from "@/lib/schema";
import { encryptToken, decryptToken } from "@/lib/crypto";
import { CAL, type Provider } from "./config";
import { CalendarAuthError } from "./provider";

type Conn = typeof calendarConnections.$inferSelect;

export function authUrl(provider: Provider, state: string): string {
  const c = CAL[provider];
  const p = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: c.redirect,
    response_type: "code",
    scope: c.scope,
    state,
    access_type: "offline",
    prompt: "consent",
  });
  return `${c.authUrl}?${p}`;
}

async function tokenRequest(provider: Provider, body: Record<string, string>) {
  const c = CAL[provider];
  const res = await fetch(c.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, ...body }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = String(json.error ?? res.status);
    if (err === "invalid_grant") throw new CalendarAuthError(err);
    throw new Error(`token ${provider} ${res.status}: ${err}`);
  }
  return json as { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
}

export async function exchangeCode(provider: Provider, code: string) {
  const j = await tokenRequest(provider, {
    grant_type: "authorization_code",
    code,
    redirect_uri: CAL[provider].redirect,
  });
  if (!j.refresh_token) throw new Error(`${provider} não devolveu refresh_token`);
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    expiresAt: new Date(Date.now() + (j.expires_in - 60) * 1000),
    scope: j.scope ?? CAL[provider].scope,
  };
}

export async function getAccessToken(conn: Conn): Promise<string> {
  const fresh = conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() > Date.now() + 60_000;
  if (fresh && conn.accessTokenEnc) return decryptToken(conn.accessTokenEnc);

  try {
    const j = await tokenRequest(conn.provider as Provider, {
      grant_type: "refresh_token",
      refresh_token: decryptToken(conn.refreshTokenEnc),
    });
    const expiresAt = new Date(Date.now() + (j.expires_in - 60) * 1000);
    await db.update(calendarConnections).set({
      accessTokenEnc: encryptToken(j.access_token),
      tokenExpiresAt: expiresAt,
      refreshTokenEnc: j.refresh_token ? encryptToken(j.refresh_token) : conn.refreshTokenEnc,
    }).where(eq(calendarConnections.id, conn.id));
    return j.access_token;
  } catch (e) {
    if (e instanceof CalendarAuthError) {
      await db.update(calendarConnections)
        .set({ status: "broken", lastError: "acesso revogado ou expirado" })
        .where(eq(calendarConnections.id, conn.id));
    }
    throw e;
  }
}
```

- [ ] **Step 3: tsc**

```bash
cd web && npx tsc --noEmit   # ainda pode faltar sync.ts stub
```

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/calendar/config.ts web/src/lib/calendar/oauth.ts
git commit -m "feat(calendar): config + fluxo OAuth (authUrl, exchangeCode, getAccessToken com refresh)"
```

---

## Task 7: Providers — `google.ts` e `microsoft.ts`

**Files:**
- Create: `web/src/lib/calendar/google.ts`
- Create: `web/src/lib/calendar/microsoft.ts`

**Interfaces:**
- Consumes: `CalProvider`, `DesiredEvent`, `CalendarAuthError` (Task 5); `getAccessToken` (Task 6).
- Produces: `class GoogleCal implements CalProvider` e `class MsCal implements CalProvider`, ambos `constructor(private conn: Conn)`. Erros HTTP 401 → `CalendarAuthError`; 404 no calendário → `class CalendarGoneError extends Error` (exportada de `provider.ts` — **adicionar na Task 5 se ainda não existir; adicionar agora**).

- [ ] **Step 1: adicionar `CalendarGoneError` em `provider.ts`**

```ts
export class CalendarGoneError extends Error {}
```

- [ ] **Step 2: `google.ts`**

```ts
import { getAccessToken } from "./oauth";
import { CalendarAuthError, CalendarGoneError, type CalProvider, type DesiredEvent } from "./provider";
import { toRRule } from "./rrule";
import type { calendarConnections } from "@/lib/schema";

type Conn = typeof calendarConnections.$inferSelect;
const API = "https://www.googleapis.com/calendar/v3";

export class GoogleCal implements CalProvider {
  constructor(private conn: Conn) {}

  private async req(path: string, init: RequestInit = {}) {
    const token = await getAccessToken(this.conn);
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
    });
    if (res.status === 401) throw new CalendarAuthError("google 401");
    if (res.status === 404) throw new CalendarGoneError("google 404");
    if (!res.ok) throw new Error(`google ${res.status}: ${await res.text().catch(() => "")}`);
    return res.status === 204 ? null : res.json();
  }

  async createCalendar(name: string): Promise<string> {
    const j = await this.req("/calendars", { method: "POST", body: JSON.stringify({ summary: name }) });
    return j.id as string;
  }
  async deleteCalendar(calId: string): Promise<void> {
    await this.req(`/calendars/${encodeURIComponent(calId)}`, { method: "DELETE" }).catch(() => {});
  }

  private body(ev: DesiredEvent) {
    const [h, m] = ev.startTime.split(":").map(Number);
    const pad = (n: number) => String(n).padStart(2, "0");
    const endH = h + Math.floor((m + ev.durationMin) / 60);
    const endM = (m + ev.durationMin) % 60;
    // data-base fixa; o RRULE define a recorrência real. Usa a próxima segunda p/ estabilidade.
    const d = "2026-01-05"; // segunda-feira
    return {
      summary: ev.summary,
      description: ev.description,
      start: { dateTime: `${d}T${pad(h)}:${pad(m)}:00`, timeZone: ev.timeZone },
      end: { dateTime: `${d}T${pad(endH)}:${pad(endM)}:00`, timeZone: ev.timeZone },
      recurrence: [toRRule(ev.byday)],
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: ev.reminderMinutes }] },
    };
  }

  async upsertEvent(calId: string, ev: DesiredEvent, existingId?: string): Promise<string> {
    const c = encodeURIComponent(calId);
    if (existingId) {
      await this.req(`/calendars/${c}/events/${existingId}`, { method: "PATCH", body: JSON.stringify(this.body(ev)) });
      return existingId;
    }
    const j = await this.req(`/calendars/${c}/events`, { method: "POST", body: JSON.stringify(this.body(ev)) });
    return j.id as string;
  }
  async deleteEvent(calId: string, eventId: string): Promise<void> {
    await this.req(`/calendars/${encodeURIComponent(calId)}/events/${eventId}`, { method: "DELETE" }).catch(() => {});
  }
}
```

- [ ] **Step 3: `microsoft.ts`**

```ts
import { getAccessToken } from "./oauth";
import { CalendarAuthError, CalendarGoneError, type CalProvider, type DesiredEvent } from "./provider";
import { toGraphRecurrence } from "./rrule";
import type { calendarConnections } from "@/lib/schema";

type Conn = typeof calendarConnections.$inferSelect;
const API = "https://graph.microsoft.com/v1.0";

export class MsCal implements CalProvider {
  constructor(private conn: Conn) {}

  private async req(path: string, init: RequestInit = {}) {
    const token = await getAccessToken(this.conn);
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
    });
    if (res.status === 401) throw new CalendarAuthError("ms 401");
    if (res.status === 404) throw new CalendarGoneError("ms 404");
    if (!res.ok) throw new Error(`ms ${res.status}: ${await res.text().catch(() => "")}`);
    return res.status === 204 ? null : res.json();
  }

  async createCalendar(name: string): Promise<string> {
    const j = await this.req("/me/calendars", { method: "POST", body: JSON.stringify({ name }) });
    return j.id as string;
  }
  async deleteCalendar(calId: string): Promise<void> {
    await this.req(`/me/calendars/${calId}`, { method: "DELETE" }).catch(() => {});
  }

  private body(ev: DesiredEvent) {
    const pad = (n: number) => String(n).padStart(2, "0");
    const [h, m] = ev.startTime.split(":").map(Number);
    const endH = h + Math.floor((m + ev.durationMin) / 60);
    const endM = (m + ev.durationMin) % 60;
    const d = "2026-01-05";
    return {
      subject: ev.summary,
      body: { contentType: "text", content: ev.description },
      start: { dateTime: `${d}T${pad(h)}:${pad(m)}:00`, timeZone: ev.timeZone },
      end: { dateTime: `${d}T${pad(endH)}:${pad(endM)}:00`, timeZone: ev.timeZone },
      recurrence: toGraphRecurrence(ev.byday, d),
      isReminderOn: true,
      reminderMinutesBeforeStart: ev.reminderMinutes,
    };
  }

  async upsertEvent(calId: string, ev: DesiredEvent, existingId?: string): Promise<string> {
    if (existingId) {
      await this.req(`/me/calendars/${calId}/events/${existingId}`, { method: "PATCH", body: JSON.stringify(this.body(ev)) });
      return existingId;
    }
    const j = await this.req(`/me/calendars/${calId}/events`, { method: "POST", body: JSON.stringify(this.body(ev)) });
    return j.id as string;
  }
  async deleteEvent(calId: string, eventId: string): Promise<void> {
    await this.req(`/me/calendars/${calId}/events/${eventId}`, { method: "DELETE" }).catch(() => {});
  }
}
```

- [ ] **Step 4: tsc + commit**

```bash
cd web && npx tsc --noEmit   # sync.ts stub ainda pode faltar
cd .. && git add web/src/lib/calendar/google.ts web/src/lib/calendar/microsoft.ts web/src/lib/calendar/provider.ts
git commit -m "feat(calendar): providers Google Calendar v3 e Microsoft Graph"
```

---

## Task 8: `sync.ts` — reconciliação (testada com fake provider)

**Files:**
- Create: `web/src/lib/calendar/sync.ts`
- Create: `web/src/lib/calendar/__tests__/sync.test.ts`

**Interfaces:**
- Consumes: `CalProvider` (Task 5), `reminderToEvent`/`eventHash` (Task 5), providers (Task 7), `db`/schema.
- Produces:
  - `reconcileWith(provider: CalProvider, ctx: SyncCtx): Promise<SyncResult>` — **núcleo puro**, recebe o provider e um contexto com os dados já carregados; é o que o teste exercita.
  - `reconcileConnection(connId: string): Promise<SyncResult>` — carrega tudo do DB, escolhe o provider real, chama `reconcileWith`, grava `calendar_events` e `calendar_connections`.
  - `reconcileUser(userId: string): Promise<void>`
  - `reconcileDirty(limit?: number): Promise<{ reconciled: number; broken: number; errors: number }>`
  - `markCalendarDirty(userId: string): Promise<void>`
  - Tipos:
    ```ts
    type SyncCtx = {
      calId: string;
      user: { timezone: string };
      reminders: ReminderRow[];               // já filtrados: enabled && channels inclui 'agenda'
      existing: { reminderId: string; externalEventId: string; syncedHash: string }[];
    };
    type SyncOp =
      | { kind: "create"; reminderId: string; externalEventId: string; hash: string }
      | { kind: "patch"; reminderId: string; externalEventId: string; hash: string }
      | { kind: "delete"; reminderId: string }
      | { kind: "noop"; reminderId: string };
    type SyncResult = { ops: SyncOp[]; error?: string };
    ```

- [ ] **Step 1: Failing test — `__tests__/sync.test.ts`**

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";
import type { CalProvider, DesiredEvent } from "../provider";
import { CalendarAuthError } from "../provider";

beforeAll(() => { process.env.CALENDAR_TOKEN_KEY = randomBytes(32).toString("base64"); });

class FakeProvider implements CalProvider {
  events = new Map<string, DesiredEvent>();
  calls: string[] = [];
  seq = 0;
  authFail = false;
  async createCalendar() { return "cal-fake"; }
  async deleteCalendar() {}
  async upsertEvent(_c: string, ev: DesiredEvent, existingId?: string) {
    if (this.authFail) throw new CalendarAuthError("boom");
    const id = existingId ?? `ev${++this.seq}`;
    this.events.set(id, ev);
    this.calls.push(existingId ? `patch:${id}` : `create:${id}`);
    return id;
  }
  async deleteEvent(_c: string, id: string) { this.events.delete(id); this.calls.push(`delete:${id}`); }
}

const rem = (over: Partial<any> = {}) => ({
  id: "r1", kind: "guia", atTime: "08:00:00", period: null, days: [0, 1, 2, 3, 4], customText: null, ...over,
});
const ctx = (over: Partial<any> = {}) => ({
  calId: "cal-fake", user: { timezone: "America/Sao_Paulo" },
  reminders: [rem()], existing: [], ...over,
});

describe("reconcileWith", () => {
  it("creates an event on first sync", async () => {
    const { reconcileWith } = await import("../sync");
    const fake = new FakeProvider();
    const res = await reconcileWith(fake, ctx());
    expect(res.ops.map((o) => o.kind)).toEqual(["create"]);
    expect(fake.calls).toEqual(["create:ev1"]);
  });

  it("no-ops when hash unchanged", async () => {
    const { reconcileWith } = await import("../sync");
    const { eventHash } = await import("../event-shape");
    const fake = new FakeProvider();
    const res = await reconcileWith(fake, ctx({
      existing: [{ reminderId: "r1", externalEventId: "ev9", syncedHash: eventHash(rem()) }],
    }));
    expect(res.ops.map((o) => o.kind)).toEqual(["noop"]);
    expect(fake.calls).toEqual([]);
  });

  it("patches when the time changed", async () => {
    const { reconcileWith } = await import("../sync");
    const fake = new FakeProvider();
    const res = await reconcileWith(fake, ctx({
      existing: [{ reminderId: "r1", externalEventId: "ev9", syncedHash: "stale" }],
    }));
    expect(res.ops.map((o) => o.kind)).toEqual(["patch"]);
    expect(fake.calls).toEqual(["patch:ev9"]);
  });

  it("deletes orphans (reminder no longer wants agenda)", async () => {
    const { reconcileWith } = await import("../sync");
    const fake = new FakeProvider();
    const res = await reconcileWith(fake, ctx({
      reminders: [],
      existing: [{ reminderId: "r1", externalEventId: "ev9", syncedHash: "x" }],
    }));
    expect(res.ops).toEqual([{ kind: "delete", reminderId: "r1" }]);
    expect(fake.calls).toEqual(["delete:ev9"]);
  });

  it("surfaces auth failure without throwing", async () => {
    const { reconcileWith } = await import("../sync");
    const fake = new FakeProvider();
    fake.authFail = true;
    const res = await reconcileWith(fake, ctx());
    expect(res.error).toBeTruthy();
    expect(res.ops).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — FAIL**, then implement `sync.ts` (`reconcileWith` + DB wrappers):

```ts
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { calendarConnections, calendarEvents, reminders, users } from "@/lib/schema";
import { reminderToEvent, eventHash, type ReminderRow } from "./event-shape";
import { CalendarAuthError, CalendarGoneError, type CalProvider } from "./provider";
import { GoogleCal } from "./google";
import { MsCal } from "./microsoft";

export type SyncCtx = {
  calId: string;
  user: { timezone: string };
  reminders: ReminderRow[];
  existing: { reminderId: string; externalEventId: string; syncedHash: string }[];
};
export type SyncOp =
  | { kind: "create"; reminderId: string; externalEventId: string; hash: string }
  | { kind: "patch"; reminderId: string; externalEventId: string; hash: string }
  | { kind: "delete"; reminderId: string }
  | { kind: "noop"; reminderId: string };
export type SyncResult = { ops: SyncOp[]; error?: string };

export async function reconcileWith(provider: CalProvider, ctx: SyncCtx): Promise<SyncResult> {
  const ops: SyncOp[] = [];
  const existingBy = new Map(ctx.existing.map((e) => [e.reminderId, e]));
  const wanted = new Set(ctx.reminders.map((r) => r.id));
  try {
    for (const rem of ctx.reminders) {
      const ev = reminderToEvent(rem, ctx.user);
      const hash = eventHash(rem);
      const prev = existingBy.get(rem.id);
      if (!prev) {
        const id = await provider.upsertEvent(ctx.calId, ev);
        ops.push({ kind: "create", reminderId: rem.id, externalEventId: id, hash });
      } else if (prev.syncedHash !== hash) {
        const id = await provider.upsertEvent(ctx.calId, ev, prev.externalEventId);
        ops.push({ kind: "patch", reminderId: rem.id, externalEventId: id, hash });
      } else {
        ops.push({ kind: "noop", reminderId: rem.id });
      }
    }
    for (const e of ctx.existing) {
      if (!wanted.has(e.reminderId)) {
        await provider.deleteEvent(ctx.calId, e.externalEventId);
        ops.push({ kind: "delete", reminderId: e.reminderId });
      }
    }
    return { ops };
  } catch (e) {
    if (e instanceof CalendarAuthError) return { ops: [], error: "auth" };
    if (e instanceof CalendarGoneError) return { ops: [], error: "gone" };
    return { ops: [], error: String((e as Error).message ?? e) };
  }
}

export async function markCalendarDirty(userId: string): Promise<void> {
  await db.update(calendarConnections).set({ dirty: true }).where(eq(calendarConnections.userId, userId));
}

async function loadCtx(conn: typeof calendarConnections.$inferSelect): Promise<SyncCtx | null> {
  if (!conn.externalCalId) return null;
  const [u] = await db.select().from(users).where(eq(users.id, conn.userId)).limit(1);
  if (!u) return null;
  const rows = await db.select().from(reminders).where(eq(reminders.userId, conn.userId));
  const wanted = rows.filter(
    (r) => r.enabled && Array.isArray(r.channels) && (r.channels as string[]).includes("agenda"),
  );
  const ex = await db.select().from(calendarEvents).where(eq(calendarEvents.connectionId, conn.id));
  return {
    calId: conn.externalCalId,
    user: { timezone: u.timezone },
    reminders: wanted.map((r) => ({
      id: r.id, kind: r.kind, atTime: r.atTime, period: r.period,
      days: (r.days as number[]) ?? [0, 1, 2, 3, 4, 5, 6], customText: r.customText,
    })),
    existing: ex.map((e) => ({
      reminderId: e.reminderId, externalEventId: e.externalEventId, syncedHash: e.syncedHash,
    })),
  };
}

export async function reconcileConnection(connId: string): Promise<SyncResult> {
  const [conn] = await db.select().from(calendarConnections).where(eq(calendarConnections.id, connId)).limit(1);
  if (!conn || conn.status === "broken") return { ops: [] };
  const ctx = await loadCtx(conn);
  if (!ctx) return { ops: [] };
  const provider = conn.provider === "google" ? new GoogleCal(conn) : new MsCal(conn);
  const res = await reconcileWith(provider, ctx);

  // persistir os ops
  for (const op of res.ops) {
    if (op.kind === "create")
      await db.insert(calendarEvents).values({
        connectionId: conn.id, reminderId: op.reminderId,
        externalEventId: op.externalEventId, syncedHash: op.hash,
      }).onConflictDoNothing();
    else if (op.kind === "patch")
      await db.update(calendarEvents).set({ syncedHash: op.hash })
        .where(and(eq(calendarEvents.connectionId, conn.id), eq(calendarEvents.reminderId, op.reminderId)));
    else if (op.kind === "delete")
      await db.delete(calendarEvents)
        .where(and(eq(calendarEvents.connectionId, conn.id), eq(calendarEvents.reminderId, op.reminderId)));
  }

  if (res.error === "auth") {
    // getAccessToken já marcou broken; garantir
    await db.update(calendarConnections).set({ status: "broken", lastError: "acesso expirado" })
      .where(eq(calendarConnections.id, conn.id));
  } else if (res.error) {
    await db.update(calendarConnections).set({ lastError: res.error.slice(0, 300) })
      .where(eq(calendarConnections.id, conn.id));
  } else {
    await db.update(calendarConnections)
      .set({ lastSyncedAt: new Date(), dirty: false, lastError: null })
      .where(eq(calendarConnections.id, conn.id));
  }
  return res;
}

export async function reconcileUser(userId: string): Promise<void> {
  const conns = await db.select().from(calendarConnections)
    .where(and(eq(calendarConnections.userId, userId), eq(calendarConnections.status, "active")));
  for (const c of conns) await reconcileConnection(c.id).catch(() => {});
}

export async function reconcileDirty(limit = 50): Promise<{ reconciled: number; broken: number; errors: number }> {
  const conns = await db.select().from(calendarConnections)
    .where(and(eq(calendarConnections.dirty, true), eq(calendarConnections.status, "active")))
    .limit(limit);
  let reconciled = 0, broken = 0, errors = 0;
  for (const c of conns) {
    const r = await reconcileConnection(c.id).catch(() => ({ ops: [], error: "throw" } as SyncResult));
    if (r.error === "auth") broken++;
    else if (r.error) errors++;
    else reconciled++;
  }
  return { reconciled, broken, errors };
}
```

- [ ] **Step 3: Run — PASS**

```bash
cd web && npx vitest run
```
Expected: todos os testes (crypto, rrule, event-shape, sync) verdes.

- [ ] **Step 4: Substituir os stubs da Task 4 e rodar tsc completo**

Conferir que `web/src/app/api/reminders/route.ts` importa de `@/lib/calendar/sync` sem stub.
```bash
cd web && npx tsc --noEmit
```
Expected: 0 erros.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/calendar/sync.ts web/src/lib/calendar/__tests__/sync.test.ts web/src/app/api/reminders/route.ts
git commit -m "feat(calendar): motor de sync (reconcileWith puro + wrappers de DB), testado com fake provider"
```

---

## Task 9: Rotas OAuth (`start` / `callback` / `disconnect`)

**Files:**
- Create: `web/src/app/api/oauth/[provider]/start/route.ts`
- Create: `web/src/app/api/oauth/[provider]/callback/route.ts`
- Create: `web/src/app/api/oauth/[provider]/disconnect/route.ts`

**Interfaces:**
- Consumes: `authUrl`, `exchangeCode` (Task 6); `GoogleCal`/`MsCal` (Task 7); `reconcileUser` (Task 8); `encryptToken` (Task 2); `getSession` (`@/lib/session`).

- [ ] **Step 1: `start/route.ts`**

```ts
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { oauthStates } from "@/lib/schema";
import { getSession } from "@/lib/session";
import { authUrl } from "@/lib/calendar/oauth";
import { providerConfigured, type Provider } from "@/lib/calendar/config";
import { calendarConfigured } from "@/lib/crypto";

export async function GET(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (provider !== "google" && provider !== "microsoft")
    return NextResponse.json({ error: "provedor inválido" }, { status: 404 });
  if (!calendarConfigured() || !providerConfigured(provider as Provider))
    return NextResponse.json({ error: "agenda não configurada" }, { status: 503 });

  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/entrar", _req.url));
  if (session.account.id !== session.viewing.id)
    return NextResponse.json({ error: "saia da impersonação primeiro" }, { status: 403 });

  const state = randomBytes(24).toString("hex");
  await db.insert(oauthStates).values({
    state, userId: session.viewing.id, provider, createdAt: new Date(),
  });
  return NextResponse.redirect(authUrl(provider as Provider, state));
}
```

- [ ] **Step 2: `callback/route.ts`**

```ts
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { calendarConnections, oauthStates } from "@/lib/schema";
import { exchangeCode } from "@/lib/calendar/oauth";
import { encryptToken } from "@/lib/crypto";
import { GoogleCal } from "@/lib/calendar/google";
import { MsCal } from "@/lib/calendar/microsoft";
import { reconcileUser } from "@/lib/calendar/sync";
import type { Provider } from "@/lib/calendar/config";

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const back = (q: string) => NextResponse.redirect(new URL(`/lembretes?cal=${provider}_${q}`, req.url));

  if ((provider !== "google" && provider !== "microsoft") || !code || !state) return back("err");

  const [row] = await db.select().from(oauthStates)
    .where(and(eq(oauthStates.state, state), eq(oauthStates.provider, provider))).limit(1);
  if (!row) return back("err");
  await db.delete(oauthStates).where(eq(oauthStates.state, state));

  try {
    const tok = await exchangeCode(provider as Provider, code);
    // conexão temporária só pra criar o calendário
    const [existing] = await db.select().from(calendarConnections)
      .where(and(eq(calendarConnections.userId, row.userId), eq(calendarConnections.provider, provider))).limit(1);

    const draft = {
      id: existing?.id ?? crypto.randomUUID(),
      userId: row.userId, provider,
      externalCalId: existing?.externalCalId ?? null,
      accessTokenEnc: encryptToken(tok.accessToken),
      refreshTokenEnc: encryptToken(tok.refreshToken),
      tokenExpiresAt: tok.expiresAt, scope: tok.scope,
      status: "active" as const, lastError: null, lastSyncedAt: null,
      dirty: true, createdAt: existing?.createdAt ?? new Date(),
    };

    let calId = draft.externalCalId;
    if (!calId) {
      const prov = provider === "google" ? new GoogleCal(draft as never) : new MsCal(draft as never);
      calId = await prov.createCalendar("Aristótel.IA");
    }

    await db.insert(calendarConnections)
      .values({ ...draft, externalCalId: calId })
      .onConflictDoUpdate({
        target: [calendarConnections.userId, calendarConnections.provider],
        set: {
          externalCalId: calId, accessTokenEnc: draft.accessTokenEnc,
          refreshTokenEnc: draft.refreshTokenEnc, tokenExpiresAt: draft.tokenExpiresAt,
          scope: draft.scope, status: "active", lastError: null, dirty: true,
        },
      });

    void reconcileUser(row.userId).catch(() => {});
    return back("ok");
  } catch {
    return back("err");
  }
}
```
**Nota:** `calendar_connections` precisa de `UNIQUE (user_id, provider)` pro `onConflictDoUpdate` — já está na migration. Confirmar que a constraint tem esse nome/targets no Drizzle (usar `target: [calendarConnections.userId, calendarConnections.provider]`).

- [ ] **Step 3: `disconnect/route.ts`**

```ts
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { calendarConnections, calendarEvents } from "@/lib/schema";
import { getSession } from "@/lib/session";
import { GoogleCal } from "@/lib/calendar/google";
import { MsCal } from "@/lib/calendar/microsoft";

export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const [conn] = await db.select().from(calendarConnections)
    .where(and(eq(calendarConnections.userId, session.viewing.id), eq(calendarConnections.provider, provider)))
    .limit(1);
  if (!conn) return NextResponse.json({ ok: true });

  try {
    if (conn.externalCalId && conn.status === "active") {
      const prov = provider === "google" ? new GoogleCal(conn) : new MsCal(conn);
      await prov.deleteCalendar(conn.externalCalId);
    }
  } catch { /* segue: o delete local é o que importa */ }

  await db.delete(calendarEvents).where(eq(calendarEvents.connectionId, conn.id));
  await db.delete(calendarConnections).where(eq(calendarConnections.id, conn.id));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: tsc + commit**

```bash
cd web && npx tsc --noEmit
cd .. && git add web/src/app/api/oauth
git commit -m "feat(calendar): rotas OAuth start/callback/disconnect (Google + Microsoft)"
```

---

## Task 10: Endpoint interno de sync + unidades systemd

**Files:**
- Create: `web/src/app/api/internal/calendar/sync/route.ts`
- Create: `scripts/systemd/aristotelia-calsync.service`
- Create: `scripts/systemd/aristotelia-calsync.timer`
- Modify: `scripts/systemd/README.md`

**Interfaces:**
- Consumes: `reconcileDirty` (Task 8); `CAL.internalSecret` (Task 6).

- [ ] **Step 1: `sync/route.ts`**

```ts
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { CAL } from "@/lib/calendar/config";
import { reconcileDirty } from "@/lib/calendar/sync";
import { calendarConfigured } from "@/lib/crypto";

function ok(header: string | null): boolean {
  const expected = `Bearer ${CAL.internalSecret}`;
  if (!CAL.internalSecret || !header || header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

export async function POST(req: Request) {
  if (!ok(req.headers.get("authorization")))
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  if (!calendarConfigured()) return NextResponse.json({ skipped: "sem chave" });
  const body = await req.json().catch(() => ({}));
  if (body.userId) {
    const { reconcileUser } = await import("@/lib/calendar/sync");
    await reconcileUser(String(body.userId));
    return NextResponse.json({ ok: true, user: body.userId });
  }
  const r = await reconcileDirty(50);
  return NextResponse.json(r);
}
```

- [ ] **Step 2: `aristotelia-calsync.service`**

```ini
[Unit]
Description=Aristotel.IA — sync de calendário (dirty queue)
After=network-online.target aristotelia-web.service

[Service]
Type=oneshot
EnvironmentFile=/home/ubuntu/aristotelia-web/web.env
ExecStart=/usr/bin/curl -sS -m 90 -X POST -H "Authorization: Bearer ${INTERNAL_SYNC_SECRET}" http://127.0.0.1:3000/api/internal/calendar/sync
```

- [ ] **Step 3: `aristotelia-calsync.timer`**

```ini
[Unit]
Description=Roda o sync de calendário a cada 10 min

[Timer]
OnBootSec=3min
OnCalendar=*:0/10
RandomizedDelaySec=60
Persistent=true

[Install]
WantedBy=timers.target
```

- [ ] **Step 4: Documentar em `scripts/systemd/README.md`**

Adicionar a 6ª unidade à tabela/lista, com o comando de instalação:
```
sudo cp scripts/systemd/aristotelia-calsync.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now aristotelia-calsync.timer
systemctl list-timers aristotelia-calsync.timer
```

- [ ] **Step 5: tsc + commit**

```bash
cd web && npx tsc --noEmit
cd .. && git add web/src/app/api/internal scripts/systemd/
git commit -m "feat(calendar): endpoint interno de sync + timer systemd (10 min)"
```

---

## Task 11: UI — card de conexões, editor, página de privacidade

**Files:**
- Create: `web/src/components/CalendarConnections.tsx`
- Create: `web/src/app/privacidade/page.tsx`
- Modify: `web/src/app/(app)/lembretes/page.tsx`

**Interfaces:**
- Consumes: `calendarConnections` schema; rotas OAuth (Task 9).

- [ ] **Step 1: `CalendarConnections.tsx`** (client)

```tsx
"use client";
import { useRouter } from "next/navigation";

type Conn = { provider: string; status: string };
const META: Record<string, string> = { google: "Google Calendar", microsoft: "Outlook" };

export function CalendarConnections({ conns }: { conns: Conn[] }) {
  const router = useRouter();
  const by = new Map(conns.map((c) => [c.provider, c]));

  async function disconnect(p: string) {
    await fetch(`/api/oauth/${p}/disconnect`, { method: "POST" });
    router.refresh();
  }

  return (
    <div className="card space-y-3 p-4">
      {(["google", "microsoft"] as const).map((p) => {
        const c = by.get(p);
        return (
          <div key={p} className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">{META[p]}</p>
              {c?.status === "broken" && (
                <p className="text-xs text-clay">o acesso expirou — reconecte</p>
              )}
              {c && c.status === "active" && (
                <p className="text-xs text-ink-soft">conectado · o lembrete com canal “Agenda” aparece aqui</p>
              )}
            </div>
            {c ? (
              <button onClick={() => disconnect(p)} className="text-xs text-ink-soft underline">
                Desconectar
              </button>
            ) : (
              <a
                href={`/api/oauth/${p}/start`}
                className="rounded-full bg-clay px-3 py-1.5 text-xs font-medium text-paper"
              >
                Conectar
              </a>
            )}
          </div>
        );
      })}
      <p className="text-[0.7rem] text-ink-soft">
        A gente cria um calendário só “Aristótel.IA” na sua conta e escreve só nele.{" "}
        <a href="/privacidade" className="underline">privacidade</a>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: `lembretes/page.tsx` — carregar conns + render**

```tsx
// imports
import { calendarConnections } from "@/lib/schema";
import { CalendarConnections } from "@/components/CalendarConnections";
// dentro do componente, junto dos outros selects:
const conns = await db
  .select({ provider: calendarConnections.provider, status: calendarConnections.status })
  .from(calendarConnections)
  .where(eq(calendarConnections.userId, viewing.id));
// no JSX, abaixo do PushToggle e acima de "Silêncio" (só !readOnly):
{!readOnly && (
  <div>
    <p className="label mb-2">Conectar agenda</p>
    <CalendarConnections conns={conns} />
  </div>
)}
```
Também: banner de `searchParams.cal` (`google_ok` → "Google Calendar conectado", `*_err` → "não deu — tenta de novo"). `Lembretes` vira `async function Lembretes({ searchParams }: { searchParams: Promise<{ cal?: string }> })`.

- [ ] **Step 3: `privacidade/page.tsx`** — página estática, PT-BR, tom do `Design.md`. Conteúdo: ver spec §10. Sem `(app)` layout (rota pública). Incluir `export const metadata = { title: "Privacidade — Aristótel.IA" }`.

- [ ] **Step 4: build + commit**

```bash
cd web && DATABASE_URL="postgres://x:x@localhost/x" npx next build
cd .. && git add web/src/components/CalendarConnections.tsx web/src/app/privacidade web/src/app/\(app\)/lembretes/page.tsx
git commit -m "feat(calendar): card de conexões + editor multicanal + página de privacidade"
```

---

## Task 12: Docs + `.env.example` + fechamento

**Files:**
- Modify: `CLAUDE.md` (§4 canais; §6 nova unidade systemd)
- Modify: `Memória.md` (entrada nova, data `2026-09-01`)
- Modify: `scripts/systemd/README.md` (se faltou algo da Task 10)
- Modify: raiz `.env.example` e/ou `web/.env.local.example` — novas chaves de calendário (sem valores)

- [ ] **Step 1: `.env.example` (web)** — adicionar, comentado:

```
# Integração de calendário (opcional — sem isso, a aba "Agenda" fica off)
PUBLIC_BASE_URL=https://147-15-46-51.sslip.io
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MS_CLIENT_ID=
MS_CLIENT_SECRET=
CALENDAR_TOKEN_KEY=        # openssl rand -base64 32
INTERNAL_SYNC_SECRET=      # openssl rand -hex 32
```

- [ ] **Step 2: `CLAUDE.md`**
- §4: nota de que lembrete agora tem lista de canais (`telegram`/`push`/`agenda`).
- §6: adicionar `aristotelia-calsync.timer` à lista de unidades da VM + a nota de que o painel agora precisa das chaves de calendário no `web.env` (opcional).

- [ ] **Step 3: `Memória.md`** — entrada com: o que foi feito, migration 0013, as tabelas, o fluxo, **o que falta a Fernanda fazer** (Google Cloud, Azure, preencher `web.env`, instalar o timer), e que o deploy ainda não foi feito.

- [ ] **Step 4: rodar tudo**

```bash
cd web && npx vitest run && npx tsc --noEmit && DATABASE_URL="postgres://x:x@localhost/x" npx next build
cd .. && ./.venv/Scripts/python.exe -m py_compile bot/*.py
TELEGRAM_TOKEN=x DATABASE_URL=postgres://x:x@localhost/db GROQ_API_KEY=x ./.venv/Scripts/python.exe -c "from bot.main import build_app; build_app(); print('OK')"
```
Expected: tudo verde.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md Memória.md scripts/systemd/README.md web/.env.local.example
git commit -m "docs(calendar): CLAUDE.md + Memória.md + .env.example + checklist de setup da Fernanda"
```

---

## Self-Review (feita)

**Spec coverage:**
- §3 modelo de dados → Task 1. ✓
- §4 OAuth → Tasks 6, 9. ✓
- §5 motor de sync → Tasks 5, 7, 8. ✓
- §6 multicanal bot+web → Tasks 3, 4. ✓
- §7 background sync → Task 10. ✓
- §8 crypto → Task 2. ✓
- §9 config / env → Tasks 6, 12. ✓ (o setup Google/Azure é manual da Fernanda, documentado no spec; Task 12 põe o checklist no `Memória.md`.)
- §10 UI → Task 11. ✓
- §11 casos de borda → cobertos nos testes da Task 8 (auth, gone, orphan, no-op) + lógica de `event-shape` (livre sem texto, periodo). ✓
- §12 testes → Tasks 2, 5, 8. Teste manual em produção fica pro Rollout (pós-deploy, com a Fernanda). ✓
- §13 rollout → Task 12 + passo manual de deploy.

**Placeholders:** nenhum "TBD/TODO". Os stubs de `sync.ts` na Task 4 são explicitamente temporários e resolvidos na Task 8, Step 4.

**Type consistency:** `DesiredEvent`, `CalProvider`, `SyncCtx`, `SyncOp`, `ReminderRow`, `Conn` (= `typeof calendarConnections.$inferSelect`) usados de forma consistente entre Tasks 5–10. `reconcileWith(provider, ctx)` (núcleo puro) vs `reconcileConnection(connId)` (DB) — nomes distintos de propósito. `markCalendarDirty`/`reconcileUser` importados na Task 4 e definidos na Task 8.

**Ordem de execução:** 1 → 2 → 3 → 4 (com stubs) → 5 → 6 → 7 → 8 (remove stubs) → 9 → 10 → 11 → 12. `tsc` só fica 100% verde ao fim da Task 8.
