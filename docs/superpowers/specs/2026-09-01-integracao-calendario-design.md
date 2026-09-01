# Design — Integração com Google Calendar e Outlook + lembretes multicanal

> Data: 2026-09-01 · Status: aprovado pela Fernanda · Abordagem: **A** (web dona de tudo, eventos recorrentes, timer systemd)

## 1. Objetivo

A pessoa conecta a agenda dela (Google e/ou Outlook) ao painel. Cada lembrete
passa a ter **uma lista de canais** (`telegram`, `push`, `agenda`) em vez de um
canal único. Um lembrete com `agenda` marcado vira um **evento recorrente** no
calendário secundário "Aristótel.IA" — um bloco de horário com link pro
Telegram/painel e o alarme nativo do calendário 10 min antes. O conteúdo
(guia, quiz, desafio) continua chegando por Telegram/push; o calendário é o
empurrão + bloqueio de agenda.

### Não-objetivos (v1)

- Sync nos dois sentidos (nunca lemos alterações que a pessoa fez no calendário).
- Ler eventos existentes da agenda da pessoa.
- Apple Calendar (sem API; ICS ficou fora — a Fernanda escolheu OAuth).
- Lead time do alarme configurável (fixo: popup 10 min antes).
- Calendário pros jobs de domingo (`weekly.py`).
- Fallback ICS.
- Mais de um calendário por provedor.

## 2. Decisões de arquitetura

| Questão | Decisão | Porquê |
|---|---|---|
| Onde mora a lógica de OAuth + API de calendário | 100% no app web (Next) | OAuth precisa de HTTP + domínio + sessão; mantém o bot Python simples e a lógica perto dos tokens |
| Bot participa do sync? | Não | Isolamento — a Fernanda pode reiniciar bot e painel de forma independente; erro de calendário não polui o log do bot |
| Granularidade do evento | 1 evento **recorrente** (RRULE) por lembrete | 1 objeto por lembrete, editar = 1 PATCH, o alarme nativo do calendário faz o resto; ~10–30× menos chamadas de API que eventos por dia |
| Calendário de destino | **Calendário secundário dedicado** "Aristótel.IA" criado na conta da pessoa | O sync só toca esse calendário (nunca os eventos reais dela); desconectar = apagar 1 calendário; a pessoa pode ocultar/colorir num clique |
| Seleção de canais | **Por lembrete** (lista) | Escolha da Fernanda. Migra `reminders.channel` → `reminders.channels` |
| Canal `agenda` | 1 canal só; sincroniza pra **todos** os provedores conectados | Simples de entender; a maioria conecta um só |
| Jitter no horário do evento | Não | Jitter existe pra espalhar carga de LLM; o calendário usa a hora limpa (08:00, não 08:07) |
| Disparo do sync | Inline após editar lembrete + **timer systemd a cada 10 min** (rede de segurança) | Mesmo padrão do `aristotelia-backup.timer` |
| Tokens em repouso | Cifrados AES-256-GCM, chave no `web.env` | Protege os backups (`pg_dump` gzipado fica na VM) |
| Escopo Google | `calendar.app.created` | App só enxerga/edita calendários que ele mesmo criou — consentimento mínimo |

## 3. Modelo de dados — migration `db/migrations/0012_calendar.sql`

```sql
-- ── multicanal por lembrete ──────────────────────────────────────────
ALTER TABLE reminders ADD COLUMN channels JSONB NOT NULL DEFAULT '["telegram"]'::jsonb;
UPDATE reminders SET channels = jsonb_build_array(channel);
ALTER TABLE reminders DROP COLUMN channel;

-- ── conexões OAuth de calendário (1 por provedor por usuário) ─────────
CREATE TABLE calendar_connections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider          TEXT NOT NULL CHECK (provider IN ('google','microsoft')),
  external_cal_id   TEXT,                                   -- calendário "Aristótel.IA"
  access_token_enc  TEXT,                                   -- cifrado (curto)
  refresh_token_enc TEXT NOT NULL,                          -- cifrado (longevo)
  token_expires_at  TIMESTAMPTZ,
  scope             TEXT,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','broken')),
  last_error        TEXT,                                   -- só code/message do provedor, nunca token
  last_synced_at    TIMESTAMPTZ,
  dirty             BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);
CREATE INDEX ON calendar_connections (dirty) WHERE dirty;

-- ── mapa lembrete -> evento no provedor ──────────────────────────────
CREATE TABLE calendar_events (
  connection_id     UUID NOT NULL REFERENCES calendar_connections(id) ON DELETE CASCADE,
  reminder_id       UUID NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
  external_event_id TEXT NOT NULL,
  synced_hash       TEXT NOT NULL,                          -- fingerprint (kind,time,days,customText,ver)
  PRIMARY KEY (connection_id, reminder_id)
);

-- ── state anti-CSRF do handshake OAuth (curto) ───────────────────────
CREATE TABLE oauth_states (
  state       TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`bot/db.py::cleanup_expired()` ganha: `DELETE FROM oauth_states WHERE created_at < now() - interval '1 hour'`.

Drizzle (`web/src/lib/schema.ts`): `reminders.channels` (jsonb), novas tabelas
`calendarConnections`, `calendarEvents`, `oauthStates`.

## 4. Fluxo OAuth (rotas web)

Todas exigem sessão (exceto o callback, que valida via `oauth_states`).

- **`GET /api/oauth/{provider}/start`** — `provider ∈ {google, microsoft}`.
  Gera `state` aleatório, grava `oauth_states(state, user_id, provider)`,
  redireciona pro consent do provedor:
  - Google: `access_type=offline&prompt=consent&include_granted_scopes=true`,
    scope `openid email https://www.googleapis.com/auth/calendar.app.created`.
  - Microsoft: scope `offline_access Calendars.ReadWrite`, `prompt=consent`.
- **`GET /api/oauth/{provider}/callback?code&state`**
  1. Acha e apaga a linha `oauth_states` (state desconhecido / de outro user → 400).
  2. Troca `code` por tokens.
  3. Cria o calendário secundário:
     - Google: `POST /calendar/v3/calendars` `{ "summary": "Aristótel.IA" }` → guarda `id`.
       (opcional: `PATCH /users/me/calendarList/{id}` `{ "colorId": "5" }`.)
     - Microsoft: `POST /me/calendars` `{ "name": "Aristótel.IA" }` → guarda `id`.
  4. `INSERT ... ON CONFLICT (user_id, provider) DO UPDATE` em `calendar_connections`
     (tokens cifrados, `status='active'`, `dirty=true`, `last_error=NULL`).
  5. `void reconcileUser(userId)` (fire-and-forget, com catch).
  6. Redireciona `/lembretes?cal=google_ok` (ou `..._err`).
- **`POST /api/oauth/{provider}/disconnect`** — exige sessão.
  Best-effort: `deleteEvent` de tudo que estiver em `calendar_events`, depois
  `deleteCalendar(external_cal_id)`. Sempre apaga a linha `calendar_connections`
  localmente (cascade nas `calendar_events`), mesmo se o remoto falhar.

### Refresh de token — `getAccessToken(conn): Promise<string>`

Se `token_expires_at` < agora + 60s → chama o refresh do provedor, atualiza
`access_token_enc` + `token_expires_at`. Se o provedor devolver `invalid_grant`
(ou equivalente) → `UPDATE calendar_connections SET status='broken',
last_error=$err` e lança `CalendarAuthError` (o loop de sync captura e para
naquela conexão).

## 5. Motor de sync — `web/src/lib/calendar/`

`web/src/lib/crypto.ts` (fora da pasta, uso geral) + `web/src/lib/calendar/`:

```
web/src/lib/calendar/
├── provider.ts      # interface CalProvider + tipo DesiredEvent
├── google.ts        # implementa CalProvider (Calendar API v3)
├── microsoft.ts     # implementa CalProvider (Graph /me/calendars)
├── rrule.ts         # dias[] -> BYDAY; objeto de recorrência do Graph
├── event-shape.ts   # reminder -> DesiredEvent + synced hash
└── sync.ts          # reconcileConnection / reconcileUser / reconcileDirty
```

### `provider.ts`

```ts
export type DesiredEvent = {
  clientKey: string;        // = reminder.id
  summary: string;          // "🧭 Aristótel.IA — O que fazer hoje"
  description: string;      // link Telegram + painel
  startTime: string;        // "08:00"
  durationMin: number;      // 15
  byday: number[];          // [0..6] seg..dom  (mapeado dentro do provider)
  reminderMinutes: number;  // 10
  timeZone: string;         // IANA — user.timezone
};

export interface CalProvider {
  createCalendar(name: string): Promise<string>;              // -> external_cal_id
  deleteCalendar(calId: string): Promise<void>;
  upsertEvent(calId: string, ev: DesiredEvent, existingId?: string): Promise<string>; // -> event id
  deleteEvent(calId: string, eventId: string): Promise<void>;
}
```

Cada provider recebe `getAccessToken` (closure sobre a conexão) no construtor.

### `rrule.ts`

- `bydayCodes = ["MO","TU","WE","TH","FR","SA","SU"]` (índice = 0..6, mesma
  convenção de `reminders.days`, onde 0 = segunda).
- `toRRule(days: number[]): string` — `days.length === 7` → `FREQ=DAILY`;
  senão `FREQ=WEEKLY;BYDAY=<códigos ordenados>`. Sem `UNTIL` (aberto).
- `toGraphRecurrence(days, startDate)` — objeto
  `{ pattern: { type: "weekly", interval: 1, daysOfWeek: [...] }, range: { type: "noEnd", startDate } }`
  (o Graph não aceita RRULE cru).

### `event-shape.ts`

- `reminderToEvent(rem, user): DesiredEvent`
  - `summary`: `livre` → `⏰ ${rem.customText || "Lembrete"}`; senão
    `🧭 Aristótel.IA — ${KIND_LABEL[rem.kind]}`.
  - `startTime`: `rem.atTime?.slice(0,5)` ou `PERIOD_TIMES[rem.period]`
    (`manha` 08:00 / `tarde` 15:00 / `noite` 20:00 — constante espelhada em
    `reminder-kinds.ts`, que já é client-safe). **Sem jitter.**
  - `durationMin`: 15.
  - `description`:
    `"Abra o Telegram pra ver o de hoje: https://t.me/AristotelIA_bot\nou o painel: {PUBLIC_BASE_URL}/"`.
  - `reminderMinutes`: 10.
  - `timeZone`: `user.timezone`.
- `eventHash(rem): string` — sha1 hex de
  `JSON.stringify([SHAPE_VER, rem.kind, startTime, sortedDays, rem.customText ?? ""])`.
  `SHAPE_VER` (int) sobe quando o formato do evento muda → força re-sync de todos.

### `sync.ts`

`reconcileConnection(conn)`:

1. Carrega `reminders` do `conn.user_id` com `enabled = true` e
   `channels @> '["agenda"]'`.
2. `desired` = `reminders.map(reminderToEvent)`, indexado por `reminder.id`.
3. `existing` = linhas `calendar_events` dessa conexão, indexadas por `reminder_id`.
4. Provider = `conn.provider === 'google' ? new GoogleCal(...) : new MsCal(...)`.
5. Para cada `d` em `desired`:
   - sem linha `existing` → `upsertEvent(calId, d)` → `INSERT calendar_events(..., synced_hash)`.
   - com linha e `hash !== synced_hash` → `upsertEvent(calId, d, row.external_event_id)`
     → `UPDATE synced_hash`.
   - hash igual → nada.
6. Para cada `row` em `existing` sem `desired` correspondente →
   `deleteEvent(calId, row.external_event_id)` → `DELETE calendar_events`.
7. Sucesso → `UPDATE calendar_connections SET last_synced_at=now(), dirty=false, last_error=NULL`.
8. `CalendarAuthError` → já marcou `broken`; sai silencioso (painel avisa).
9. Erro transitório (5xx/429/rede) → `UPDATE ... SET last_error=$msg` e **deixa
   `dirty=true`** (retry no próximo tick). Um evento que falhou não bloqueia os
   outros — coleta erros e segue.
10. Erro "calendário sumiu" (404 no `calId`) → tenta `createCalendar` de novo,
    atualiza `external_cal_id`, refaz todos os eventos; se ainda falhar → `broken`.

`reconcileUser(userId)` — loop nas conexões `active` do usuário.
`reconcileDirty(limit = 50)` — `SELECT ... WHERE dirty = true` (pula `broken`),
reconcilia cada, também dá refresh em tokens que expiram em < 1h. Usado pelo
endpoint interno.

### Pontos de disparo

- `web/src/app/api/reminders/route.ts` (POST/PATCH/DELETE) — depois de
  `markDirty(uid)`: `markCalendarDirty(uid)` (`UPDATE calendar_connections SET
  dirty=true WHERE user_id=$1`) + `void reconcileUser(uid).catch(logErr)`.
- OAuth callback — `void reconcileUser`.
- Timer systemd (§7).

## 6. Multicanal — bot + painel

### Bot

- `bot/scheduling.py`:
  - `chans = set(rem["channels"])`.
  - Agenda o job se `chans & {"telegram", "push"}` (antes: `rem["channel"] in
    ("telegram","push")`).
  - `data["channels"] = sorted(chans)` (antes: `data["channel"]`).
- `bot/jobs.py::_deliver(context, user, chat, title, text)`:
  - `chans = (context.job.data or {}).get("channels", ["telegram"])`.
  - Se `"telegram" in chans` e `chat` → `send_text(context.bot, chat, text)`.
  - Se `"push" in chans` → `push.send(user["id"], title, _plain(text))`.
  - Os dois podem disparar (hoje é ou/ou). `agenda` → ignorado.
- `bot/db.py::get_reminders` já faz `SELECT *`; garantir que `channels` passa pelo
  `_j()` (parse JSON).
- `_shift`/jitter seguem só pra telegram/push.

### Painel

- `web/src/lib/schema.ts` — `reminders.channels: jsonb(...).$type<string[]>()`.
- `web/src/lib/reminder-kinds.ts`:
  - `CHANNELS`: adiciona `agenda: { label: "Agenda", ready: true }`; `email`
    fica como está (`ready: false`, não mexer).
  - Adiciona `PERIOD_TIMES = { manha: "08:00", tarde: "15:00", noite: "20:00" }`.
- `web/src/app/api/reminders/route.ts`:
  - POST default `channels: ["telegram"]`.
  - PATCH aceita `channels: string[]`, valida `⊆ {telegram, push, agenda}`,
    rejeita vazio (400 "escolha ao menos um canal").
- `web/src/lib/reminders.ts::getReminders` — mapeia `channels` (default
  `["telegram"]` se null).
- `web/src/components/RemindersEditor.tsx` — seletor de canal (hoje single) vira
  **chips multi-toggle** `[Telegram] [Navegador] [Agenda]`. `agenda` marcado sem
  nenhuma conexão ativa → mostra dica inline "conecte uma agenda ali em cima".

## 7. Sync em background

- **`web.env`**: `INTERNAL_SYNC_SECRET` (`openssl rand -hex 32`).
- **`POST /api/internal/calendar/sync`** — sem sessão; header
  `Authorization: Bearer <INTERNAL_SYNC_SECRET>` (comparação em tempo constante).
  Body opcional `{ userId }` (se vier, só esse usuário). Chama `reconcileDirty(50)`.
  Responde `{ reconciled, broken, errors }`.
- **VM** — `scripts/systemd/aristotelia-calsync.service` + `.timer`:
  - `.timer`: `OnCalendar=*:0/10`, `RandomizedDelaySec=60`, `Persistent=true`.
  - `.service`: `Type=oneshot`, `EnvironmentFile=/home/ubuntu/aristotelia-web/web.env`,
    `ExecStart=/usr/bin/curl -sS -m 90 -X POST -H "Authorization: Bearer ${INTERNAL_SYNC_SECRET}" http://127.0.0.1:3000/api/internal/calendar/sync`.
  - Documentar em `scripts/systemd/README.md` (as unidades da VM são a fonte da verdade).

## 8. Segurança de token — `web/src/lib/crypto.ts`

```ts
// AES-256-GCM. Chave = base64 de 32 bytes em CALENDAR_TOKEN_KEY.
// Formato do blob: base64(iv[12]) + ":" + base64(tag[16]) + ":" + base64(ciphertext)
export function encryptToken(plain: string): string
export function decryptToken(blob: string): string   // lança se adulterado
export function calendarConfigured(): boolean         // CALENDAR_TOKEN_KEY presente e 32 bytes
```

- `refresh_token` e `access_token` cifrados (uniformidade; access é barato).
- Tokens **nunca** vão pra log nem pra `last_error` (só `error.code` / mensagem curta do provedor).
- Chave ausente/inválida no boot → `calendarConfigured()` falso → rotas de
  calendário respondem 503 "agenda não configurada", o resto do painel funciona.
- Gerar: `openssl rand -base64 32`.

## 9. Config — `web.env` (novas chaves)

```
PUBLIC_BASE_URL=https://147-15-46-51.sslip.io
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MS_CLIENT_ID=
MS_CLIENT_SECRET=
CALENDAR_TOKEN_KEY=        # openssl rand -base64 32
INTERNAL_SYNC_SECRET=      # openssl rand -hex 32
```

### Passo a passo Google (Fernanda)

1. https://console.cloud.google.com → novo projeto "AristotelIA".
2. APIs & Services → Library → ativar **Google Calendar API**.
3. APIs & Services → OAuth consent screen:
   - User type **External**.
   - App name "Aristótel.IA", email de suporte, logo (opcional).
   - **App domain / Homepage:** `https://147-15-46-51.sslip.io`
   - **Privacy policy:** `https://147-15-46-51.sslip.io/privacidade`
   - Scopes → adicionar `.../auth/calendar.app.created` (+ `openid`, `email`).
   - **PUBLISH APP** → "In production" (sem publicar, o refresh token do Google
     morre em 7 dias). O aviso "app não verificado" continua — ok até 100 usuários,
     a pessoa clica "Avançado → continuar".
4. Credentials → Create credentials → OAuth client ID → **Web application**:
   - Authorized redirect URI: `https://147-15-46-51.sslip.io/api/oauth/google/callback`
   - Copiar Client ID / Client Secret → `web.env`.

### Passo a passo Microsoft / Outlook (Fernanda)

1. https://entra.microsoft.com → Identity → App registrations → New registration.
   - Nome "Aristótel.IA".
   - Supported account types: **Accounts in any org directory and personal Microsoft accounts**.
   - Redirect URI (Web): `https://147-15-46-51.sslip.io/api/oauth/microsoft/callback`
2. Certificates & secrets → New client secret → copiar o **Value** → `web.env` (`MS_CLIENT_SECRET`).
3. API permissions → Add → Microsoft Graph → **Delegated** → `Calendars.ReadWrite`
   + `offline_access` + `openid` + `email`. (Contas pessoais/consumidor não
   precisam de admin consent.)
4. Overview → copiar **Application (client) ID** → `web.env` (`MS_CLIENT_ID`).

## 10. Painel — UI

### `web/src/app/(app)/lembretes/page.tsx`

- Server-load: `calendar_connections` de `viewing.id`.
- Novo card **"Conectar agenda"** (só `!readOnly`):
  - Google e Outlook, cada um: "Conectar" (link pra `/api/oauth/<p>/start`) ou
    "Conectado ✓ · Desconectar" (POST disconnect).
  - `status === 'broken'` → faixa âmbar "o acesso à sua agenda expirou —
    reconecte".
- Banner de retorno: `?cal=google_ok` (verde) / `?cal=google_err` (âmbar).

### `web/src/app/privacidade/page.tsx` (rota pública, fora do `(app)`)

Página estática, tom honesto e curto:
- O que guardamos (token de acesso à agenda, cifrado; que lembretes você criou).
- O que fazemos (criamos **um** calendário "Aristótel.IA" na sua conta e
  escrevemos só nele; nunca lemos nem mexemos nos seus outros eventos).
- Como revogar (Desconectar no painel, ou nas configurações da sua conta Google/Microsoft).
- Contato: `munizsilvestrefernanda@gmail.com`.
- Link no rodapé do painel e da LP.

### `RemindersEditor.tsx` — chips de canal multi-toggle (ver §6).

## 11. Casos de borda

| Situação | Comportamento |
|---|---|
| `agenda` marcado, nenhuma agenda conectada | Permitido; sincroniza quando conectar. Dica inline no editor. |
| Token revogado fora do app | Próxima chamada 401/`invalid_grant` → `status='broken'`, painel pede reconectar, **sem retry em loop**. |
| Provedor 5xx / 429 / rede | `last_error` gravado, `dirty` continua true, retry no próximo tick (10 min). |
| Pessoa apaga o calendário "Aristótel.IA" na conta dela | `upsert` dá 404 no calId → recria o calendário, refaz os eventos; se falhar → `broken`. |
| DST / fuso | Manda `timeZone` IANA no evento; provedor resolve. RRULE sem `UNTIL`. |
| Lembrete `periodo` | Usa `PERIOD_TIMES`. |
| Lembrete `livre` sem texto | `summary` = `⏰ Lembrete`. |
| Desconectar durante um sync | Linhas cascateiam; próximo tick não acha nada, no-op. |
| Impersonação (superadmin vendo outro) | Card "Conectar agenda" escondido (`readOnly`), consistente com o resto. |
| Lembrete desativado (`enabled=false`) | Evento é apagado do calendário; volta se reativar. |
| `SHAPE_VER` sobe (mudança de formato) | Todos os hashes divergem → re-sync geral no próximo tick. |

## 12. Testes

**Unit**
- `rrule.ts` — `[0,1,2,3,4]` → `BYDAY=MO,TU,WE,TH,FR`; `[0..6]` → `FREQ=DAILY`;
  objeto do Graph com `daysOfWeek` certo.
- `event-shape.ts` — cada `kind` → summary certo; `periodo` → hora certa;
  `livre` sem texto; `eventHash` estável (mesmo input → mesmo hash; ordem dos
  dias não importa).
- `crypto.ts` — round-trip; blob adulterado lança; chave errada lança.

**Integração (fake provider em memória)**
- `sync.ts` com um `CalProvider` fake: 1º sync cria; editar hora → PATCH; hash
  igual → 0 chamadas; desmarcar `agenda` → delete; desativar lembrete → delete;
  erro transitório → `dirty` continua; `CalendarAuthError` → `broken`, para.
- OAuth `state`: state inexistente / de outro user → 400.
- `/api/internal/calendar/sync` sem/errado o bearer → 401.

**Bot**
- `_deliver` com `channels=["telegram","push"]` → manda nos dois.
- `scheduling` agenda job com `channels=["agenda"]` apenas? → **não** agenda
  (nada pro job queue), mas o lembrete continua válido pro calendário.

**Manual (uma vez, em produção, contas da Fernanda)**
- Conectar Google real → marcar `agenda` num lembrete → conferir evento +
  popup 10 min antes + recorrência certa → editar hora no painel → conferir que
  mexeu no calendário → Desconectar → conferir que o calendário sumiu.
- Idem Outlook.

## 13. Rollout

1. `0012_calendar.sql` (runner do bot aplica no deploy).
2. Deploy **bot + web juntos** (schema em lockstep — `channel` some).
3. Fernanda: preenche `web.env`, faz Google Cloud + Azure (§9).
4. Instalar `aristotelia-calsync.timer` na VM (`systemctl enable --now`).
5. Smoke test com as contas da Fernanda (§12 manual).
6. Atualizar `CLAUDE.md` (§4 canais, deploy/§6 nova unidade systemd) e
   `Memória.md`.

## 14. Arquivos tocados (resumo)

**Novos**
- `db/migrations/0012_calendar.sql`
- `web/src/lib/crypto.ts`
- `web/src/lib/calendar/{provider,google,microsoft,rrule,event-shape,sync}.ts`
- `web/src/app/api/oauth/[provider]/start/route.ts`
- `web/src/app/api/oauth/[provider]/callback/route.ts`
- `web/src/app/api/oauth/[provider]/disconnect/route.ts`
- `web/src/app/api/internal/calendar/sync/route.ts`
- `web/src/app/privacidade/page.tsx`
- `web/src/components/CalendarConnections.tsx`
- `scripts/systemd/aristotelia-calsync.{service,timer}`

**Alterados**
- `db/migrations` (nova) · `bot/db.py` (cleanup, get_reminders) ·
  `bot/scheduling.py` · `bot/jobs.py` (_deliver)
- `web/src/lib/schema.ts` · `web/src/lib/reminders.ts` ·
  `web/src/lib/reminder-kinds.ts` · `web/src/app/api/reminders/route.ts` ·
  `web/src/components/RemindersEditor.tsx` ·
  `web/src/app/(app)/lembretes/page.tsx`
- `scripts/systemd/README.md` · `CLAUDE.md` · `Memória.md`
