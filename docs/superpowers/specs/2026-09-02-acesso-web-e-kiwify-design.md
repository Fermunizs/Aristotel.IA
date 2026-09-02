# Spec — Acesso sem Telegram + webhook Kiwify

**Data:** 2026-09-02
**Backlog:** novo (B23 acesso web, B20 parcial — só o webhook, sem renomear planos)
**Decidido com a Fernanda:** Plano B (cadastro web sem OAuth), login por link pessoal, lembrete via push, webhook do Kiwify casando por e-mail. NÃO renomear os planos agora (`free/pro/unlimited` fica).

---

## 1. Problema

O login do painel é só o código de 6 dígitos que o bot gera no `/painel` (Telegram). Sem Telegram → sem código → **sem conta**. A LP promete "dá pra usar pelo painel web" — mentira hoje.

E: a pessoa paga no Kiwify e nada acontece — `users.plan` não muda sozinho.

## 2. Não-objetivos (agora)

- OAuth Google (fase seguinte, precisa projeto Google Cloud + domínio estável)
- E-mail transacional / magic link por e-mail (precisa domínio — B01)
- Renomear planos pra aprendiz/sábio/mestre (B20 completo)
- Migrar quem já é Telegram

## 3. Schema — `0014_web_auth.sql`

```sql
ALTER TABLE users ADD COLUMN email          TEXT;
ALTER TABLE users ADD COLUMN google_sub     TEXT;   -- reservado p/ a fase Google
ALTER TABLE users ADD COLUMN avatar_url     TEXT;
ALTER TABLE users ADD COLUMN signup_via     TEXT NOT NULL DEFAULT 'telegram'
                                            CHECK (signup_via IN ('telegram','web'));
ALTER TABLE users ADD COLUMN login_token    TEXT;   -- link pessoal (bearer), rotacionável
ALTER TABLE users ADD COLUMN login_token_at TIMESTAMPTZ;

CREATE UNIQUE INDEX users_email_key       ON users (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX users_google_sub_key  ON users (google_sub)   WHERE google_sub IS NOT NULL;
CREATE UNIQUE INDEX users_login_token_key ON users (login_token)  WHERE login_token IS NOT NULL;

-- upgrades que chegaram antes do usuário existir (paga no Kiwify, cria conta depois)
CREATE TABLE pending_upgrades (
  email       TEXT PRIMARY KEY,       -- lower()
  plan        TEXT NOT NULL,
  kiwify_order TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- log cru de todo webhook do Kiwify (debug + auditoria)
CREATE TABLE kiwify_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT,
  order_id    TEXT,
  email       TEXT,
  matched_user UUID REFERENCES users(id) ON DELETE SET NULL,
  ok          BOOLEAN NOT NULL DEFAULT false,
  raw         JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`telegram_chat_id` já é nullable → usuário web tem ele NULL.

## 4. Login por link pessoal

**Token:** 32 bytes aleatórios (`crypto.randomBytes(32).toString('base64url')`) em `users.login_token`. 256 bits — não-enumerável. Sem TTL (não expira sozinho — some só na rotação).

**Entrar:** `GET /entrar?k=<token>`
- rate limit por IP (o `ratelimit.ts` que já existe)
- acha `users WHERE login_token = k` → `createSession(user.id)` (reusa `web_sessions`, cookie httpOnly 30d — igual ao Telegram)
- **redireciona pra `/` (ou `/onboarding` se `status='onboarding'`) SEM o `?k=`** — o token não fica na barra/histórico depois da 1ª troca
- token inválido → `/entrar` com aviso

**Rotacionar:** `/ajustes` → botão "gerar novo link" → novo `login_token`, invalida o antigo, mostra o novo com botão copiar. Sessões ativas continuam (não desloga).

**Recuperação:** `/ajustes` mostra "conectar Telegram" (gera um código que a pessoa manda no bot → amarra `telegram_chat_id`) e, na fase seguinte, "conectar Google". Aí o link vira secundário.

**Caveat honesto (documentar na tela):** o link é uma credencial tipo senha. Se vazar, quem tiver entra → por isso o botão de rotacionar. E o host do link muda se o túnel reiniciar (→ domínio próprio resolve, B01).

## 5. Cadastro web

`/entrar` ganha "Não tenho Telegram" → form:
- nome (obrigatório)
- e-mail (obrigatório — é a âncora do Kiwify e da recuperação; **não** manda e-mail nenhum, só guarda)

`POST /api/signup/web`:
1. valida nome + e-mail (regex simples)
2. e-mail já existe → erro "já tem conta, usa teu link" (não vaza mais que isso)
3. cria user: `signup_via='web'`, `status='onboarding'`, `login_token` gerado, `timezone` default
4. cria linhas-filhas (preferences/streaks/bot_state) — mesma lógica do `get_or_create_user`
5. **aplica `pending_upgrades[email]` se houver** → `plan`
6. `createSession` + redireciona `/onboarding`

## 6. Onboarding no painel

`/onboarding` (client) — só renderiza se `session.viewing.status === 'onboarding'`. 4 telas:
1. objetivo (texto) — `prompts.ONB_GOAL`
2. nível (3 botões) — `_LEVELS`
3. minutos (número) — clamp 10–180
4. tom (3 botões) — `gentil/equilibrada/durona`

`POST /api/onboarding` (passo final):
- porta `bot/onboarding.py::build_trilha` pra TS em `web/src/lib/trilha-build.ts`:
  - `groqJson` (já existe em `coach-llm.ts`) × 5: `TRILHA_PLANO` + 4× `TRILHA_SEMANA`
  - prompts copiados de `bot/prompts.py` (comentário "MANTER EM SINCRONIA", igual `persona.ts`)
  - semana que falha → `_stub_week` (mesma ideia do B05); só falha total → erro "tenta de novo"
- grava a trilha (`learning_plans`), `preferences` (minutos+tom), lembretes padrão **`channel='push'`**, `status='active'`
- `maxDuration = 60` na rota (5 chamadas de LLM, ~20–40s)
- falhou → mantém `status='onboarding'`, mensagem clara "tenta de novo" (sem loop — o painel é síncrono, a pessoa reenvia)

Fim do onboarding → tela "ative as notificações" com o `PushToggle` que já existe + "salva teu link de acesso".

## 7. Bot — agendar quem não tem Telegram

Hoje `db.active_users()` e o scheduling filtram `telegram_chat_id IS NOT NULL`. Mudar:

- `active_users()` / `dirty_reminder_users()`: incluir quem é `status='active'` E (`telegram_chat_id IS NOT NULL` OU existe `push_subscriptions`).
- `bot/scheduling.py`: agenda igual — o lembrete já carrega `channel`.
- `bot/jobs.py::_deliver`: se `channel='telegram'` mas `telegram_chat_id` é NULL → tenta push como fallback; se nada → loga e desiste (não crasha).
- `_ctx` / qualquer lugar que faz `bot.send_message(chat_id=...)` sem checar NULL → guarda.

Push-only user nunca dispara código que dependa de `chat_id`.

## 8. Webhook Kiwify

`POST /api/webhook/kiwify` (na LP? ou no painel?) — **no painel** (`web/`), porque é lá que está o banco e o `users`. A LP não fala com o Postgres.

Espera: `?signature=<hex>` (query) — HMAC-SHA1 do corpo cru com `KIWIFY_WEBHOOK_TOKEN` como chave (padrão Kiwify). Fallback: header `x-kiwify-signature`. Config errada / sem match → 200 mesmo assim (não revela), mas grava `kiwify_events.ok=false`.

Fluxo:
1. lê o corpo **cru** (sem parsear antes de verificar)
2. verifica assinatura; grava SEMPRE em `kiwify_events` (raw + parsed best-effort)
3. extrai tolerante: `email` de `Customer.email` / `customer.email` / `buyer.email` / `email`; `status`/`event` de `order_status` / `webhook_event_type` / `event`
4. mapeia produto → tier:
   - `KIWIFY_PRODUCT_SABIO` → `pro`
   - `KIWIFY_PRODUCT_MESTRE` → `unlimited`
   - (env vars com os product_ids do Kiwify)
5. evento de compra aprovada / assinatura renovada → `UPDATE users SET plan=<tier> WHERE lower(email)=<email>`; sem user → `pending_upgrades`
6. `subscription_canceled` / `compra_reembolsada` / `chargeback` → `plan='free'`
7. `subscription_late` → não mexe (ainda no ar); logar
8. responde 200 rápido

**Config (Fernanda):**
- Kiwify → Apps → Webhooks → URL = `${WEB_URL}/api/webhook/kiwify`, eventos: compra_aprovada, subscription_renewed, subscription_canceled, compra_reembolsada, chargeback. Copiar o token.
- Vercel (LP): `NEXT_PUBLIC_KIWIFY_SABIO` / `NEXT_PUBLIC_KIWIFY_MESTRE` = URLs de checkout do Kiwify.
- `web.env` (painel, VM): `KIWIFY_WEBHOOK_TOKEN`, `KIWIFY_PRODUCT_SABIO`, `KIWIFY_PRODUCT_MESTRE`.

**Matching sem e-mail:** usuário Telegram que quer assinar → o botão "assinar" no painel manda ele pro checkout do Kiwify; ele paga com um e-mail; de volta no painel, `/ajustes` tem "já assinei" → pede o e-mail usado → casa com `pending_upgrades` ou com um `kiwify_events` recente. (v2 — por ora o e-mail no checkout que bate com `users.email` já cobre o web.)

## 9. LP

- `page.tsx`: FAQ "Não uso Telegram" → *"Dá sim. Você cria a conta no painel, responde as 4 perguntas e a trilha nasce ali. Notificação pelo navegador."* + link pro painel `/entrar`
- CTA secundário abaixo de "Começar no Telegram": *"ou entra pelo painel →"* (`${WEB_URL}/entrar`)
- `WEB_URL` na LP: env `NEXT_PUBLIC_PANEL_URL` (Vercel) — a URL do túnel/domínio

## 10. Ordem de implementação

1. **`0014` + cadastro web + link pessoal + sessão** (zero dep externa) — deploy
2. **`/onboarding` + `trilha-build.ts`** — deploy
3. **Bot: agendar push-only** — deploy
4. **Webhook Kiwify + `kiwify_events`** — deploy (Fernanda configura Kiwify depois)
5. **LP** — Fernanda faz deploy na Vercel (ou eu preparo e ela sobe)

Cada passo é testável e deployável sozinho.

## 11. Riscos

- **Host do link instável** (túnel) — mitigado por "estável há 2+ dias"; domínio resolve.
- **Formato do webhook Kiwify** — mitigado pelo log cru + extração tolerante; 1ª compra real calibra.
- **`build_trilha` no web sob o rate limit do Groq** — 5 chamadas em ~30s; se 429, cai pra gemini/mistral (cadeia). Pior caso: erro "tenta de novo".
- **Link como bearer** — aceito pra fase de validação (dados sem pagamento/PII); rotação + Telegram/Google como recuperação.
