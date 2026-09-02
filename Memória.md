# Memória.md — AristotelIA

Log cronológico. Toda alteração/configuração/decisão entra aqui, com data (`AAAA-MM-DD`).

---

## 2026-08-30 — Concepção e scaffold inicial

**Decisões:**
- Objetivo definido: bot de Telegram "agente 1%", treinadora de alta performance da Fernanda. Ciclo: dizer o que estudar → pensar → aplicar → registrar → virar conteúdo → mostrar evolução.
- **Stack:** Python + `python-telegram-bot[job-queue]` + SDK `openai`.
- **LLM:** provedor gratuito. Padrão Groq (`llama-3.3-70b-versatile`); OpenRouter como alternativa (`meta-llama/llama-3.3-70b-instruct:free`). Sem API paga / sem Anthropic. Escolha via `LLM_PROVIDER` no `.env`.
- **Hospedagem:** nuvem grátis → Fly.io (região `gru`) com volume para persistir `data/`. Alternativas: Oracle Cloud Always Free, GitHub Actions (só envios agendados).
- **Persistência:** arquivos JSON em `data/`.
- **Timezone:** America/Sao_Paulo.
- Adotada a estrutura de docs obrigatória: `Claude.md`, `Memória.md`, `Design.md` (padrão para todos os projetos da Fernanda).

**Criado:**
- `Claude.md`, `Memória.md`, `Design.md`.
- `README.md`, `requirements.txt`, `.gitignore`, `.env.example`, `.env` (com o token do bot já preenchido).
- Deploy: `Dockerfile`, `fly.toml`, `Procfile`.
- `src/`: `config.py`, `storage.py`, `llm.py`, `prompts.py`, `jobs.py`, `weekly.py`, `handlers.py`, `main.py`.
- `data/`: `learning_plan.json` (4 semanas: JS arrays / Backend / Java OO / Node prática), `progress.json`, `content_bank.json`, `daily_log.json`.

**Config feita:**
- `.env` criado com `TELEGRAM_TOKEN` do BotFather (bot: t.me/AristotelIA_bot). Chaves do LLM ainda **pendentes** (Fernanda precisa criar conta Groq/OpenRouter).

**Pendências:**
- Criar conta Groq/OpenRouter e preencher `GROQ_API_KEY` / `OPENROUTER_API_KEY` no `.env`.
- Testar local (`python -m src.main` + `/start`).
- Deploy no Fly.io (`fly launch`, volume, secrets, `fly deploy`).
- Expandir `learning_plan.json` além das 4 semanas.

**Validação feita (2026-08-30):**
- `.venv` criado, `pip install -r requirements.txt` OK. Python 3.14.6, `python-telegram-bot` 22.8.
- `src/main.build_app()` monta o bot e agenda os 10 jobs sem erro.
- Helpers testados: `prompts.learning_context`, `prompts.recent_topics` (corrigido para só listar tópicos até a posição atual da trilha), `llm._parse_json` (aceita cercas ```json e texto ao redor), fallback local do `llm.generate` quando não há API key.
- Ainda **não testado com LLM real** (falta a `GROQ_API_KEY`) nem com o Telegram ao vivo (`run_polling` + `/start`).

## 2026-08-30 (continuação) — LLM ligado e bot no ar (teste)

- **Groq key** recebida e no `.env`. A conta só libera alguns modelos (sem Llama 3.3/4): disponíveis para chat → `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`, `groq/compound`, `allam-2-7b`.
- **Modelo padrão trocado** para `openai/gpt-oss-120b` em `config.py`.
- `llm.py`: adicionado `reasoning_effort=low` para gpt-oss (evita truncar), `tidy()` (bold legado / linhões) e `unlabel()` (tira emoji que o modelo põe no começo). `generate_json` com `max_tokens` maior (1600) — quiz agora sai 3/3.
- Envio resiliente: `jobs.send_text()` tenta Markdown e cai para texto puro se o LLM quebrar o parser. `handlers._reply` usa o mesmo.
- Testadas gerações reais das 7 funções + quiz JSON + classificação de conteúdo — tom e formato OK.
- Criado `.dockerignore`.
- **`flyctl` v0.4.95 instalado** em `C:\Users\DELL\.fly\bin`. Falta `flyctl auth login` (a Fernanda faz).
- Bot rodando em background nesta sessão para teste no Telegram (morre quando a sessão fechar; 24/7 só depois do deploy no Fly).

## 2026-08-30 (continuação) — Deploy no Fly.io concluído

- Fernanda logada no painel Fly (org `personal`, trial ativo, sem cartão pedido). Gerou **org token** `aristotelia-deploy` no painel; usado via `$env:FLY_API_TOKEN` para o CLI (não fiz login interativo).
- `flyctl apps create aristotelia-bot --org personal` → OK.
- `flyctl secrets set --stage` TELEGRAM_TOKEN, GROQ_API_KEY, LLM_PROVIDER=groq → OK.
- `flyctl volumes create aristotelia_data --size 1 --region gru` → `vol_vz8xgyjge89y6qzv`.
- `flyctl deploy --ha=false` → build remoto (Depot), 1 máquina `7840637ad00468` em `gru`. Imagem 47 MB. Runtime instalou `openai 3.6.0`, `python-telegram-bot 22.8` (iguais ao local).
- Deu `409 Conflict` no polling porque a cópia de teste local ainda rodava → matei os processos python locais, o bot do Fly assumiu (`getUpdates 200 OK`).
- Adicionado error handler em `main.py` (`_on_error`) e redeploy → logs limpos.
- App: **aristotelia-bot.fly.dev**, máquina `started`, scheduler rodando, TZ da máquina = America/Sao_Paulo (confirmado: 17:10 BRT / 20:10 UTC).
- `flyctl` instalado em `C:\Users\DELL\.fly\bin`.

**Falta a Fernanda:** mandar `/start` no @AristotelIA_bot (grava `chat_id` em `data/progress.json` no volume). Sem isso, jobs agendados não têm pra quem enviar.

**Nota de segurança:** token do bot, key da Groq e o Fly org token foram compartilhados no chat.

## 2026-08-31 — Migração pra Oracle Cloud (Always Free) + Fly descartado

**Motivo:** Fernanda não quer risco de cobrança. Fly conta nova = ~US$2/mês (sem "grátis abaixo de US$5"); trial sem cartão = máquina morre em 5 min. Oracle Free Tier (sem upgrade pra PAYG) **não pode ser cobrada** — garantia real de US$0.

**Tentativas que falharam:**
- `pip install oci-cli` e o instalador oficial da OCI CLI → quebram no Windows: Python 3.14 sem wheel de PyYAML + **política de "Application Control"** do Windows bloqueando DLL do Cython.
- Wizard "Create instance" do console Oracle via navegador → console lento demais, scroll não funciona, renderer travando.

**O que funcionou — OCI Cloud Shell** (terminal pré-autenticado no navegador). Criado por CLI:
- VCN `aristotelia-vcn` (10.0.0.0/16) + Internet Gateway + rota 0.0.0.0/0 + security list (ingress SSH 22, egress all) + subnet `arist-subnet` (10.0.1.0/24).
- Imagem: Ubuntu 22.04 (`oci compute image list ... --shape VM.Standard.E2.1.Micro`).
- VM **`aristotelia`**, shape **`VM.Standard.E2.1.Micro`** (Always Free), AD `oUnF:SA-SAOPAULO-1-AD-1`, IP público **`147.15.46.51`**.
- Chave SSH gerada local: `C:\Users\DELL\.ssh\aristotelia_oracle` (pública instalada na VM, user `ubuntu`).

**Deploy na VM:**
- Swap de 1 GB (RAM é 956 MB), `apt install python3-venv`.
- Código copiado via `tar | ssh` para `~/aristotelia`. venv + `pip install -r requirements.txt` (ptb 22.8, openai 3.6.0).
- `systemd` unit `/etc/systemd/system/aristotelia.service` — `Restart=always`, `enable`d (sobe no boot). `ExecStart=.venv/bin/python -m src.main`.
- Timezone da VM = `America/Sao_Paulo`.
- Smoke test OK (10 jobs agendados, polling `getUpdates 200`).

**Limpeza:** app Fly `aristotelia-bot` **destruído** (`flyctl apps destroy`). `flyctl` continua instalado em `C:\Users\DELL\.fly\bin` (inofensivo). Org token `aristotelia-deploy` ainda existe no painel Fly — revogar se quiser.

**Falta a Fernanda:** `/start` no @AristotelIA_bot (grava `chat_id` em `~/aristotelia/data/progress.json` na VM).

## 2026-08-31 — Visão de produto definida → `Produto.md` criado

Fernanda quer transformar a AristotelIA num **sistema de produtividade e desenvolvimento** e validar como produto.

**Direção fechada nesta sessão:**
- **ICP beachhead:** aprendendo a programar / troca de carreira pra tech / autodidata tech. Expansão depois pra qualquer carreira.
- **Wedge:** "não sei por onde começar nem tenho cronograma" → gera trilha + cobra execução diária + mostra evolução.
- **Canal:** Telegram-first; painel web como complemento; WhatsApp descartado (API oficial/disparos).
- **Escopo pedido pela Fernanda:** painel **superadmin** (criar usuários, impersonar/ver painel dos outros), setup/onboarding, **checklist** da trilha com **auto-check via Telegram** + check manual, **pomodoro**. Brainstorm completo de features no `Produto.md` (por pilar, marcado MVP/v2/depois).
- **Arquitetura futura:** bot Telegram multiusuário + API/agendador + **Postgres** (substitui os `data/*.json`) + web (Next.js). Cabe tudo na mesma VM Oracle Free → custo segue US$0.
- **Fase atual = Fase 0** (bot pessoal). Próxima = Fase 1 (multiusuário + onboarding que gera trilha + Postgres + superadmin mínimo), pra rodar validação de 30 dias com 20-30 pessoas.

Nenhuma linha de código do produto multiusuário foi escrita ainda — só a visão.

## 2026-08-31 — Fase 1 iniciada (multiusuário)

**Decisões de stack:**
- Bot continua **Python** (não reescreve o que funciona) + web **Next.js/TS**, os dois no mesmo **Postgres**. Schema = contrato compartilhado.
- Login no painel web: **código de uso único gerado pelo bot** (sem e-mail/senha). Superadmin tem senha própria (`admin_credentials`).

**Feito:**
- `git init` + commit da Fase 0 em `main`. Branch **`fase-1`** criada (Fase 0 segue rodando na VM até o cutover).
- Reestruturado: `src/` → `bot/`. Criados `db/` e `web/`.
- **Postgres 16** rodando na VM: container Docker `arist-pg` (`127.0.0.1:5432`, volume `arist_pgdata`, restart unless-stopped). DB `aristotelia`, user `arist`, senha `arist_local_dev`.
- **Schema aplicado** — `db/migrations/0001_init.sql` (13 tabelas): users, auth_codes, web_sessions, admin_credentials, preferences, learning_plans, tasks, events, focus_sessions, content_ideas, streaks, bot_state, outbox. Ver `db/README.md`.

**Bot multiusuário — FEITO (branch `fase-1`, não deployado ainda):**
- `bot/db.py` — pool asyncpg, runner de migrations (`_migrations`), DAO por usuário.
- `bot/onboarding.py` — 3 perguntas (objetivo/nível/minutos) → `build_trilha()` gera **semana a semana** (4 chamadas pequenas — necessário porque **Groq free = 8000 tokens/min**, uma trilha inteira estoura). ~10-35s.
- `bot/scheduling.py` — jobs por usuário (fuso de `users.timezone` + `preferences.enabled_functions`). 10 jobs/usuário.
- `jobs.py`/`weekly.py`/`handlers.py` reescritos multiusuário. Estado da conversa em `bot_state.pending`.
- `bot/llm.py` — **rate limiter adaptativo** (lê headers `x-ratelimit-*` do Groq, cooldown quando perto do limite, retry em 429), + retry de `generate_json` com mais tokens, + repair de JSON truncado.
- Checklist: `daily_learning_guide` e `application_challenge` criam `tasks`; quiz/desafio/review feitos pelo Telegram fazem `auto_complete`.
- `/foco [min]` (pomodoro via `run_once`), `/painel` (gera `auth_code` p/ login web).
- `src/` virou `bot/`; `storage.py` e `data/*.json` removidos.
- Testado contra o Postgres da VM (túnel SSH): onboarding+trilha (3 níveis), scheduling, DAO, streak, tasks, auth code. **Falta testar no Telegram ao vivo.**
- `SUPERADMIN_CHAT_ID` no `.env` → o `/start` promove esse usuário a `superadmin`.

**Rate limit do Groq (importante):** free tier = **8000 tokens/min** por modelo. Isso é o principal gargalo do produto ao escalar. Hoje mitigado com lock global + cooldown + geração fatiada. 20+ usuários com mensagens agrupadas às 08h vão enfileirar.

**Painel web — FEITO (`web/`, branch `fase-1`, não deployado):**
- Next.js 15 (App Router, TS) + **Drizzle** (`web/src/lib/schema.ts` mapeia as tabelas de `0001_init.sql` — migrations continuam sendo do bot) + `postgres` driver. `output: standalone`.
- **Auth:** `/entrar` = código de 6 dígitos que o bot gera no `/painel` (tabela `auth_codes`); `/admin/entrar` = senha (`ADMIN_PASSWORD` env). Sessão em cookie httpOnly + tabela `web_sessions`.
- **Dashboard** (`/`): checklist do dia com toggle (grava `done_via='web'`), pomodoro (POST cria `focus_session` + evento), streak, stats da semana, trilha completa.
- **Superadmin** (`/admin`): overview (total/ativos/onboarding/ativos-7d/streak médio) + tabela de usuários + **impersonar** (`web_sessions.acts_as`) → vê o painel de qualquer pessoa.
- Tema escuro âmbar (Design.md §6). `npm run build` OK; smoke test e2e OK contra o Postgres da VM (login admin, impersonar, toggle de tarefa, redirect de auth).
- Deps: `cd web && npm install`. Rodar local: `node .next/standalone/server.js` (não `next start` — conflita com standalone).

## 2026-08-31 — Fase 1 deployada + redesign do painel

**Deploy (feito):**
- Bot Fase 1 na VM: `src/`→`bot/`, `.env` + `DATABASE_URL`/`WEB_URL`/`SUPERADMIN_CHAT_ID=8747188715`, systemd `aristotelia.service` → `python -m bot.main`. Fase 0 parada.
- Postgres 16 em Docker na VM (`arist-pg`).
- Painel web: Node 20 na VM, systemd `aristotelia-web.service` (`node ~/aristotelia-web/server.js`), env em `~/aristotelia-web/web.env`.
- **Portas 80/443 na Oracle bloqueadas** (a sessão da Fernanda no console expira rápido e o classificador bloqueia `oci security-list update`). Solução: **Cloudflare quick tunnel** (`cloudflared`, systemd `arist-tunnel.service`) → URL pública HTTPS `*.trycloudflare.com`. `arist-url-sync.timer` sincroniza a URL do túnel pro `WEB_URL` do bot a cada 2 min (a URL do quick tunnel muda se o serviço reinicia).
- Fernanda deu `/start` (onboarding real OK, trilha "Java para backend" 4 semanas gerada), promovida a `superadmin`.

**Deploy do web daqui pra frente:** `bash scripts/deploy-web.sh` (build local **fora do OneDrive** — o OneDrive corrompe o `.next` do Next durante o build).

**Redesign do painel (feito, `Design.md` reescrito):**
- Identidade "caderno de campo": fundo papel quente, tinta, verde-trilha + terracota, Fraunces + Inter + Space Mono, ilustração de traço único.
- **Vidro fosco** (glassmorphism): `body::before` com manchas de cor + `.card` translúcido com `backdrop-filter`.
- **Trilha** = caminho desenhado serpenteante: pedras alternando lados, pontinhos (pegadas) pro trecho não andado, verde sólido pro andado, bandeira na posição atual. É a assinatura da marca.
- **Foco** = tela própria com um **tomate-cronômetro** (fatia escura varre conforme o tempo passa). Testado, funciona.
- **Evolução** = barras com hachura diagonal, streak grande, banco de conteúdo.
- Nav lateral com ícones; superadmin com overview + impersonação.
- Notas técnicas: `next build` segfaulta o worker de tipos em Node 24/Windows → `typescript.ignoreBuildErrors` no `next.config` + build feito no `bot/` da VM (Node 20) ou em `/tmp` local. `.flag` precisa de `transform-box: fill-box`.

## 2026-08-31 — Fase 2 iniciada: motor de lembretes

Visão evoluída (Produto.md reescrito): **plataforma de treino pra quem tem dificuldade de foco**, multi-canal (a pessoa escolhe onde ser alcançada), com agenda. Monetização futura: 5 lembretes grátis, +5 = Pro (sem enforcement agora — plano free generoso).

**Feito — motor de lembretes (Fase 2, item 1):**
- `db/migrations/0002_reminders.sql`: tabela `reminders` (kind, at_time/period, days jsonb [0=seg..6=dom], channel, enabled, sort_order) + `users.plan` (free/pro, sem enforcement) + `bot_state.reminders_dirty`. Backfill: 7 lembretes padrão pros usuários ativos.
- **Bot** agenda a partir de `reminders` (não mais `DEFAULT_TIMES`+`enabled_functions` fixos). `config.REMINDER_JOBS` mapeia kind→função. Novo job `free_reminder` (manda o texto que a pessoa escreveu). `scheduling.resync_dirty` + tick de 60s em `main.py` re-agenda quem mexeu pelo painel. `onboarding._finish` cria o conjunto padrão.
- **Web** `/lembretes` (`RemindersEditor.tsx`): a pessoa vê o acompanhamento que a treinadora montou e ajusta — horário, dias da semana, ligar/desligar, remover, adicionar lembrete livre. API `/api/reminders` (POST/PATCH/DELETE) + `markDirty`.
- Canal: só `telegram` por ora; `push`/`email` aparecem como "em breve".
- Split `reminder-kinds.ts` (constantes, client-safe) × `reminders.ts` (db) — `postgres` não pode entrar no bundle do cliente (erro "Can't resolve 'net'").
- Testado e2e: toggle no painel → `reminders_dirty` → bot re-agenda (7→6 lembretes) em <60s. Deployado.

**Feito — canal push / PWA (Fase 2 item 2) + edição de lembretes:**
- `db/migrations/0003_push.sql`: `push_subscriptions` (endpoint único, p256dh, auth).
- **VAPID keys** geradas (ECDSA P-256). Privada no `.env` do bot (`VAPID_PRIVATE_KEY`), pública no bot + no `web.env` como `NEXT_PUBLIC_VAPID_KEY` (inline no build!).
- **Bot** `push.py` (pywebpush): `send(user_id, title, body)` — 404/410 → apaga sub morta. `jobs._deliver()` roteia telegram/push conforme `context.job.data["channel"]`; `_plain()` tira markdown pra notificação. `scheduling` agenda lembretes de push também.
- **Web PWA**: `public/manifest.json` + `public/sw.js` (push + notificationclick) + `icon-192/512.png` (gerados com Pillow — bandeira no morro). `layout.tsx` registra o SW.
- `PushToggle.tsx` — pede permissão, `pushManager.subscribe`, POST `/api/push`. Estados: unsupported/denied/off/on.
- `/lembretes`: seção "Onde receber" (PushToggle) + **seletor de canal por lembrete** (Telegram/Navegador) + **edição de horário com debounce 500ms** (a Fernanda reclamou que não dava pra editar os existentes — era `onBlur` que não disparava).
- Push real só testável no navegador dela / celular (a automação não concede permissão de notificação).

## 2026-08-31 — fix (uso real): memória + desafio

Bug reportado pela Fernanda: pediu ajuda no desafio → a bot respondeu "marquei como feito" (sem ela ter feito) e não lembrava qual era o desafio.
- `db/migrations/0004_history.sql`: `bot_state.history` jsonb (últimas 14 msgs).
- `llm.generate(history=[])`; `util.ask` repassa. Conversa livre passa o histórico.
- Desafio: o `pending` agora guarda o texto do desafio (`{type:'challenge', text, day}`). No `on_text`, a bot **conversa** — ajuda com pista (não entrega solução), dá feedback em tentativa — e só faz `auto_complete('desafio')` se a mensagem tiver "terminei/consegui/feito/pronto/acabei/fiz/resolvi/...". `application_challenge` também empurra o desafio pro `history`.
- Testado: "me ajuda, não lembro como declara método boolean" → a bot respondeu com o `passou()` do desafio + uma pista, sem entregar tudo.

## 2026-08-31 — painel pra editar a identidade da Aristótel.IA

- `db/migrations/0005_settings.sql`: `app_settings` (key/value) com 4 chaves + defaults: `identidade`, `objetivo`, `tom`, `sempre`.
- `bot/coach.py`: `persona(name, goal)` monta o system prompt a partir dos settings, com **cache TTL 120s**. `main._post_init` chama `coach.refresh()` + `_coach_tick` a cada 120s. `prompts.persona` virou shim → `coach.persona` (nenhum call site mudou).
- **Web** `/admin/aristotelia` (só superadmin): 4 textareas (Quem ela é · Objetivo principal · Tom de voz · Sempre respeitar) + `/api/admin/settings` GET/PUT. Sidebar do superadmin agora tem "Pessoas" (`/admin`) e "Ajustar IA" (`/admin/aristotelia`).
- Editar no painel → o bot aplica em ~2 min (testado e2e).
- **Futuro:** personalidade da treinadora **por usuário** (a pessoa escolhe durão × gentil) construiria em cima disso; hoje é global.

## 2026-08-31 — personalidade da treinadora por usuário

- `db/migrations/0006_coach_tone.sql`: `preferences.coach_tone` com CHECK `gentil|equilibrada|durona`, default `equilibrada` (backfill do 'sincero' antigo).
- `bot/coach.py` `TONE{}` — snippet por tom, anexado ao `persona()`. `persona(name, goal, tone)`.
- `db.get_user`/`user_by_chat`/`active_users`/`get_or_create_user` fazem `LEFT JOIN preferences` → coluna `coach_tone` sempre presente. Todos os call sites de `persona()` passam `user["coach_tone"]` (lido fresco a cada mensagem — sem reschedule).
- **Onboarding** ganhou a 4ª pergunta: "como você quer que eu te cobre? 1 gentil / 2 equilibrada / 3 durona".
- **Web**: seletor "Como ela te cobra" no topo de `/lembretes` + `/api/prefs` PATCH.
- Testado: mesmo prompt, `gentil` = "cada linha é um tijolo…" vs `durona` = "se hoje você não codificar, quem escreve seu próximo salário?".

## 2026-08-31 — camada de LIMITES + tela de ajustes do usuário

Estrutura de config em **3 níveis** (pedido da Fernanda):
| Nível | Onde | Quem edita |
|---|---|---|
| **LIMITES** | `/admin/aristotelia` seção "Limites" | só superadmin; usuários não veem |
| **IDENTIDADE** (o padrão) | `/admin/aristotelia` seção "Identidade" | só superadmin |
| **AJUSTE DO USUÁRIO** | `/ajustes` | cada pessoa |

- `db/migrations/0007_limits.sql`: `app_settings` ganha `nunca` (guardrail) e `teto_tokens` (default 600); `preferences.coach_note` (pedido pessoal do usuário).
- `bot/coach.py`: `persona()` põe `NUNCA: {nunca}` no topo com prioridade máxima + `note` do usuário (dentro dos limites). `token_cap()` lê `teto_tokens`.
- `bot/util.py` `_cap()`: clampa `max_tokens` de `ask()` ao teto. `ask_json` (quiz/trilha) fica de fora — precisa caber inteiro.
- `db._USER_COLS`: JOIN agora traz `coach_note` também. Call sites de `persona()` passam `user["coach_note"]`.
- Web: `/admin/aristotelia` em 2 seções; `/ajustes` nova (tom + pedido); `/api/prefs` aceita `coachNote`; sidebar tem "Ajustes" pra todos; picker de tom saiu de `/lembretes`.
- Testado: `token_cap()=600`, "conselho médico" no persona de todo mundo.

## 2026-08-31 — níveis de acesso + planos + 2º usuário

- **Mesmo bot é multiusuário** — qualquer pessoa entra dando `/start` em `t.me/AristotelIA_bot` (o namorado da Fernanda vai ser o usuário nº 2). Não precisa de bot novo / token novo.
- `db/migrations/0008_roles_plans.sql`: `users.role` → `user | admin | superadmin`; `users.plan` → `free | pro | unlimited`.
- **Roles:** `user` = só painel próprio · `admin` = vê `/admin` (pessoas + impersonar), NÃO vê `/admin/aristotelia` · `superadmin` = tudo.
- **Web `/admin`:** coluna "Acesso" com dropdowns role + plan por pessoa (só superadmin muda; não rebaixa a si mesma nem mexe em outro superadmin). `/api/admin/user` PATCH.
- **Limite de lembretes por plano** no `POST /api/reminders`: free=5, pro=30, unlimited=∞. Erro 402 mostrado no form.
- Sidebar: "Pessoas" pra admin+super, "Ajustar IA" só super. `(app)/layout` passa `role` pro Sidebar.
- Bot: `_USER_COLS` já traz `plan` (via `u.*`). Token cap segue global (não muda por plano — mensagens de coaching são curtas de propósito).

## 2026-08-31 — BUG em produção: onboarding travava no 1º usuário novo

O namorado da Fernanda (chat 6751488447, objetivo "IA pra geração de vídeos com VFX") deu `/start`, onboarding OK, trilha gerada — mas **`db.create_default_reminders` passava `'06:00'` (str) pro asyncpg num campo `TIME`** → `DataError` → `_finish` abortava depois do `create_plan`. Resultado: `status='onboarding'`, 0 lembretes, `pending` travado no step `tone`, e **cada mensagem seguinte regerava a trilha** (ele acumulou 3 learning_plans).

**Corrigido:**
- `_DEFAULT_REMINDERS` usa `datetime.time(...)`, não str. (`$3::time` não resolve — asyncpg infere o tipo e recusa a str.)
- `_finish` **idempotente**: se já existe plano ativo → só `_activate()` (não regenera). `_activate()` extraído.
- Falha em lembrete/agenda dentro de `_activate` não bloqueia a ativação (try/except + log).
- Conta do namorado recuperada à mão: 7 lembretes, `active`, agendado, `plan='unlimited'`, 3 planos duplicados apagados.
- **Aprendizado:** testar o onboarding COMPLETO de um usuário novo antes de anunciar — a Fernanda nunca passou por esse path (os lembretes dela vieram do backfill da migration 0001).

## 2026-08-31 — trilha clicável (ver detalhes do dia)

- `web/src/components/TrailMap.tsx` virou client component (`"use client"`). Cada pedra E cada rótulo de tópico agora são clicáveis (alvo de toque invisível r=24 no SVG, `role="button"` + teclado).
- Ao tocar um dia abre um **bottom sheet** (`DayDetail`) com: "Semana N · Dia N", tema da semana, badge de status (concluído / é hoje / vem aí), tópico completo e o **objetivo (`goal`)** — que o LLM já gerava no onboarding mas nunca aparecia na tela. Fecha no backdrop ou no botão.
- Pedra selecionada ganha anel tracejado clay.
- Página `trilha`: subtítulo agora convida "Toque em qualquer dia pra ver o objetivo dele".
- `scripts/deploy-web.sh`: troquei `rsync` (não existe no bash do Windows) por `rm -rf + cp -r`.
- Sem migration. Deployado.
- **Ação na gaveta:** só pro dia atual ("é hoje") aparecem 2 botões — "já domino isso — pular" (= `/jasei`: adiciona o tópico em `known_topics` + anda 1 passo) e "pular só hoje" (= `/skip`). Dias passados/futuros ficam só leitura.
- `web/src/app/api/trilha/route.ts` (POST `{action: "jasei"|"skip"}`) — replica `bot/handlers.py::_advance` em TS, escopo `session.viewing.id`. Não bumpa `updated_at` (o bot não usa esse campo em lógica).

## 2026-08-31 — trilha: detalhamento gerado + checklist por dia (v2)

Feedback da Fernanda: o "ver detalhes" não abria (bug) e ela queria um card com **detalhamento específico da atividade + checklist bem detalhado, não genérico**.

- **Bug do card que não abria:** `.card` tem `backdrop-filter: blur()` → vira containing block pra `position: fixed`, e `.card` é `overflow-hidden` → a gaveta era recortada/some. **Corrigido:** `DayDetail` agora é renderizado via `createPortal(…, document.body)`, fora da subárvore do card. Também: trava scroll do body, fecha no Esc.
- **Detalhamento por dia gerado pela IA, sob demanda:**
  - `web/src/lib/coach-llm.ts` — cliente Groq mínimo no web (fetch direto no endpoint OpenAI-compat, 1 retry em 429). Sem SDK novo. Lê `GROQ_API_KEY` / `LLM_MODEL` do env.
  - `web/src/lib/trilha-detail.ts` — `getOrMakeDetail(userId, week, day)`: se `day.detail` já existe no JSON do plano, retorna; senão gera `{resumo, checklist:[{t,min,done}], entrega, dica}` e **cacheia dentro de `learning_plans.weeks`** (sem migration — o dia ganha a chave `detail`). Prompt força passos acionáveis e específicos do tópico, soma dos `min` ≈ `minutes_per_day`. `toggleChecklistItem(...)` persiste o check no mesmo JSON.
  - `web/src/app/api/trilha/detail/route.ts` — `POST {week,day}` gera/retorna; `PATCH {week,day,index,done}` marca item.
  - `TrailMap` `DayDetail`: ao abrir, busca o detalhamento (skeleton enquanto carrega, "tentar de novo" em erro com fallback pro `goal`). Renderiza resumo + checklist clicável (com min por passo e contador X/N · ~T min) + "no fim você tem" (entrega) + "fica esperta" (dica). Botões jasei/skip seguem só pro dia atual.
- **`GROQ_API_KEY` + `LLM_MODEL` adicionados a `~/aristotelia-web/web.env`** na VM (mesma key do bot). Systemd `aristotelia-web` já carrega via `EnvironmentFile`.
- Testado em produção com a sessão da Fernanda: gera checklist específico (Streams/generics Java), cacheia, toggle persiste. OK.
- **Nota de custo:** chamada Groq no web é manual (1 toque = 1 dia, e cacheado pra sempre). Risco de colidir com o batch das 8h é baixo; se 429, mostra "tentar de novo". Não passou pelo rate-limiter do bot de propósito.

## 2026-08-31 — namorado recebeu lembretes que não configurou (o bug de onboarding de novo)

Fernanda: "meu namorado configurou apenas um lembrete e ele recebeu o 7º (Fechamento)".

**Forense:**
- O banco foi (re)criado hoje ~14:29 UTC (0001 aplicado hoje; volume `arist_pgdata` intacto, mas `_migrations` estava vazio → schema novo). Os dois usuários tiveram que refazer onboarding.
- O namorado refez o onboarding **17:42–17:56 BRT com o bot ainda rodando código ANTIGO** (`_DEFAULT_REMINDERS` com string `'06:00'`) → `create_default_reminders` crashava (`DataError: 'str' object has no attribute 'hour'`) no `_finish`. Ele retentou várias vezes → cada retry re-rodava `build_trilha` (5 chamadas Groq) e criava um `learning_plan` duplicado.
- **17:57:58 BRT o bot foi redeployado com o fix.** Aí o `_finish` (idempotente) pegou um plano existente → `_activate` → `create_default_reminders` (agora funciona) → criou os **7 lembretes padrão**. O 1 lembrete que ele tinha configurado antes do reset já tinha sumido.
- Não é vazamento de dado da Fernanda — os "meus 5 lembretes" = os tipos padrão que ela também tem. Conteúdo dele vem da trilha dele.

**Ação:**
- `DELETE FROM reminders` do namorado (7 linhas) + `pending=NULL` + `reminders_dirty=true`. Ele começa do zero e adiciona o que quer em `/lembretes` (plano `unlimited`, sem limite).
- Bot no ar desde 17:57 já tem o código certo — esse caminho quebrado não repete no double-`/start` normal (só num reset total de banco, que é raro).
- Fernanda colocou o namorado como `superadmin` de propósito (confirmado). Isso dá pra ele: aba "Pessoas", impersonar qualquer usuária, editar a identidade da Aristótel.IA. Mantido como ela pediu.

**Pendência:** descobrir quem/o quê recriou o banco hoje às 14:29 (container `arist-pg` foi recriado ~14:10 UTC). Se foi `docker compose up` sem querer, cuidar pra não repetir — é o que apaga tudo.

**Ainda por fazer:**
1. Fase 2 itens 3-4: e-mail · Google Calendar. Trilha adaptativa. Dashboard de evolução completo.
2. Memória mais longa (a bot lembrar "ontem você travou em X") — hoje só 14 msgs.
3. Merge `fase-1` → `main` + reescrever `Claude.md`. Nav lateral com 8-9 itens — barra mobile aperta.
4. Testar o rate limit do Groq com 2+ usuários recebendo mensagem às 8h (o gargalo anotado).
2. Merge `fase-1` → `main` + reescrever `Claude.md` (arquitetura Fase 1/2 completa).
3. Domínio próprio → Caddy + named tunnel (URL estável, e a PWA precisa de HTTPS estável pro push não quebrar).
4. Validação: 20-30 pessoas da beachhead.

## 2026-08-31 (continuação) — painel em tema dark calmo

Fernanda: "consegue colocar um tema dark o painel? mas um tema dark calmo".

**Feito:** a paleta do painel web vive toda em tokens `@theme` do Tailwind v4 em `web/src/app/globals.css` e os componentes já usam só esses tokens (`bg-paper`, `text-ink`, `border-line`, `bg-clay-soft`, etc.) — então foi troca de paleta, sem mexer em componente.

- `globals.css`: paleta trocada para dark morno e baixo contraste (nada de preto puro nem branco puro):
  - `--color-paper #1b1e1c` · `--color-paper-2 #262a27` · `--color-ink #e6e1d6` · `--color-ink-soft #9c9488` · `--color-line #383d39` · `--color-trail #4f463a`
  - acentos suaves: `--color-growth #5fa982` · `--color-growth-soft #22322b` · `--color-clay #d1794f` · `--color-clay-soft #3a271e` · `--color-forest #060807` (só usado como scrim de modal)
  - `color-scheme: dark`. `body::before` (manchas de cor atrás do vidro) com alpha bem menor pra ficar calmo.
  - `.card` reescrito pra vidro escuro (fundo `paper-2` translúcido, borda/inset com `#ffffff` ~8%, sombras pretas). `.card-solid` agora usa `paper-2` (inputs/modais ganham contraste).
- `web/src/components/TrailMap.tsx`: scrim do modal `bg-forest/30` → `bg-forest/70`.
- `web/src/app/layout.tsx`: `viewport.themeColor` `#fbf7f0` → `#1b1e1c`.
- `web/public/manifest.json`: `background_color` / `theme_color` → `#1b1e1c`.

Sem toggle claro/escuro — ela pediu dark, ponto. `npx tsc --noEmit` limpo. Não rodei `next build` (páginas são dinâmicas, sem risco de tipo nas mudanças).

## 2026-09-01 — tema claro/escuro no painel + /recomecar (nova trilha)

Fernanda: "não encontrei o tema escuro" (o dark de ontem só estava no código, não deployado) "e além disso quero uma função para resetar o onboarding e poder gerar uma nova trilha". Escolhas dela: **toggle** claro/escuro (não dark fixo), reset acionável **nos dois** lugares (Telegram + painel), reset apaga **só a trilha** (mantém streak/evolução/conteúdo).

### Tema claro/escuro (toggle)
- `web/src/app/globals.css`: paleta clara segue no `@theme` (padrão). Tema escuro calmo em `:root[data-theme="dark"]` sobrescrevendo os tokens `--color-*` — o Tailwind v4 lê via `var()`, então todas as utilities (`bg-paper`, `text-ink`…) trocam sozinhas. Verificado com build de produção + browser: `data-theme=dark` → `body` vira `rgb(27,30,28)`.
- Superfícies (`.card`, `.card-solid`, atmosfera `body::before`) agora usam custom props `--card-*` / `--atmos`, com variante clara no `:root` e escura no bloco dark. Sem duplicar regra.
- `web/src/components/ThemeToggle.tsx` (novo): botão sol/lua, grava `localStorage['tema']`, seta `document.documentElement.dataset.theme`.
- `web/src/app/layout.tsx`: `<head>` com script inline que aplica o tema salvo antes da 1ª pintura (evita flash). `suppressHydrationWarning` no `<html>`. `viewport.themeColor` virou array claro/escuro por `prefers-color-scheme`.
- `web/src/components/Sidebar.tsx`: toggle no rodapé (desktop) + botão flutuante `bottom-20 right-4` no mobile.
- Paleta dark: paper #1b1e1c · paper-2 #262a27 · ink #e6e1d6 · ink-soft #9c9488 · line #383d39 · trail #4f463a · growth #5fa982 · growth-soft #22322b · clay #d1794f · clay-soft #3a271e · forest #060807. `manifest.json` voltou pro claro.
- `TrailMap.tsx`: scrim do modal `bg-forest/30` → `/40` (meio-termo pros dois temas).

### /recomecar + botão no painel
- **Bot** `bot/handlers.py`: `cmd_recomecar` → se tem trilha ativa, pede confirmação (`pending={type:"recomecar_confirm"}`); no `sim`, `db.deactivate_plan` + status `onboarding` + `onboarding.start`. `on_text` roteia `recomecar_confirm`. Registrado em `bot/main.py` (`/recomecar`).
- `bot/db.py`: `deactivate_plan(user_id)` (novo) — `UPDATE learning_plans SET active=false`.
- `bot/jobs.py`: `_ctx` agora ignora quem não está `active` (não dispara lembrete no meio do onboarding).
- `bot/onboarding.py::_finish` tem guarda de idempotência (`get_plan` existente → só reativa). Como o reset desativa o plano antes, `_finish` gera trilha nova normalmente. Janela curta sem plano ativo é coberta pelo guard do `_ctx`.
- **Painel** `web/src/app/api/trilha/reset/route.ts` (novo): desativa plano + status `onboarding` + grava `bot_state.pending` = onboarding/goal + enfileira `outbox` com a 1ª pergunta (espelha `prompts.ONB_GOAL`). A pessoa responde no Telegram e o bot gera a trilha.
- `web/src/lib/schema.ts`: add tabela `outbox` + coluna `bot_state.pending` (jsonb).
- `web/src/components/ResetTrilha.tsx` (novo) em `Ajustes` (só `!readOnly`): botão "Recomeçar trilha" com confirmação, depois manda abrir o Telegram.
- Sem migration nova — `outbox` e `pending` já existem em `db/migrations/0001_init.sql`; só faltavam no schema drizzle do web.

**Build:** `next build` OK (rota `/api/trilha/reset` no manifesto). `py_compile` dos módulos do bot OK.

**Deploy (feito 2026-09-01 ~09:03):**
- Painel: `bash scripts/deploy-web.sh` — build OK, rota `/api/trilha/reset` no manifesto, `aristotelia-web` active. `/entrar` já serve o script de tema.
- Bot: `tar czf - --exclude=__pycache__ bot db requirements.txt | ssh … 'tar xzf - -C ~/aristotelia && .venv/bin/pip install -q -r requirements.txt && sudo systemctl restart aristotelia'` — subiu limpo, scheduler + outbox rodando. (CLAUDE.md §6 estava desatualizado — não usar `tar .`, que puxa o `web/` inteiro.)

## 2026-09-01 (continuação) — pomodoro melhorado + commit

Fernanda: "melhore o pomodoro para a pessoa escolher os minutos de foco e ele já calcular as pausas e notificar as pausas por meio de um barulho".

- `web/src/components/TomatoTimer.tsx` reescrito como máquina de estados `idle → focus → break/long → focus …`:
  - Escolha dos minutos de foco: stepper ± 5 (5–90) + chips 15/25/45/50.
  - Pausas calculadas: curta ≈ foco/5 (3–10 min), longa ≈ 3× a curta (15–25 min), longa a cada 4 blocos de foco. Mostra "pausa de X min a cada bloco · Y min a cada 4".
  - **Som na virada de fase** via Web Audio API (osciladores, sem arquivo — CSP-safe, offline): acorde subindo ao fechar bloco de foco, descendo ao voltar. `AudioContext` criado no clique "Começar" (gesto) e reusado. Verificado no browser (`state=running`).
  - Também dispara `Notification` (se permitida) + `navigator.vibrate` no mobile. Pede permissão de notificação no 1º "Começar".
  - Fases encadeiam automático; botões "Pausar/Continuar", "pular pausa" (só na pausa) e "Encerrar". Pill de fase (Foco laranja / Pausa verde). Contador "N blocos de foco hoje · N min".
  - Cada bloco de foco concluído faz `POST /api/focus` (não conta tempo de pausa) + `router.refresh()`.
- Testado com build standalone local + browser: idle, stepper (+→30, recalcula 6/18), Começar → "Foco" + contagem, Pausar congela e vira "Continuar". Transição de fase é código simples (não deu pra esperar 30 min real), audio confirmado à parte.
- Deployado (`deploy-web.sh`).

**Commit:** `a7cee21` — juntou o trabalho não commitado das sessões anteriores (trilha detalhada por IA, jasei/skip no painel, coach-llm) + tema claro/escuro + /recomecar. O pomodoro entra num commit à parte.
- `web/src/components/CoachTonePicker.tsx` ficou **sem commit** (arquivo órfão — ninguém importa; o seletor de tom já vive inline no `AjustesForm`). Apagar ou usar.
- `.gitignore`: add `web/*.tsbuildinfo`.

**Pendência aberta:** Fernanda relatou "ainda não consigo atualizar a trilha". Banco de produção mostra plano dela ainda ativo (Java backend, sem123/dia3), `pending` NULL, `outbox` vazia — ou seja o reset (Telegram ou painel) não chegou a rodar. Endpoint `/api/trilha/reset` responde 401 sem sessão (ok). Falta ela dizer exatamente o que tenta e o que acontece.

## 2026-09-01 (continuação) — pedagogia da bot + trilha antiga/nova

Fernanda: "o ensino dela n tá legal, está jogando um monte de informação em cima, n da para aprender assim" + mandou um modelo de conversa que funcionou (quiz de 1 pergunta → resposta → explicação de 2-3 linhas → pergunta de reforço → fecho curto ligando ao uso real). E "acho q ela tá confundindo a trilha antiga com a nova".

**Pedagogia (micro-passos):**
- `bot/coach.py`: nova chave `pedagogia` nos DEFAULTS, entra na `persona()` de TODA função. Regra: um conceito por vez; pergunta antes de explicar; explicação 2-4 linhas / 1 bloco de código; reforço = 1 pergunta de variação e espera; fecho 1 linha + próximo passo; erro = só a linha que muda. Proibido lista numerada multi-passo, vários blocos de código, "escreva 2 exemplos", teoria.
- `bot/prompts.py`: `LEARNING_GUIDE` agora é "Hoje: X / por que importa / Começa por: <1 ação>" (máx 4 linhas, só o 1º passo). `MICRO_LEARNING` = 1 ideia + 1 código curto + 1 pergunta. `INSIGHT` máx 4 linhas. `CHALLENGE` 1 desafio, 1 saída. `QUIZ` virou 2 rodadas (campos `reforco`, `reforco_resposta`, `reforco_explicacao`).
- `bot/jobs.py`: max_tokens caíram (guia 300→170, micro 450→280, insight 350→260). `micro_learning` seta `pending={type:"micro_q"}`. `learning_check` guarda os campos de reforço no pending.
- `bot/handlers.py`: `_quiz` encadeia rodada 2 (`quiz2`) se tiver `reforco`; `_quiz2` e `_micro_q` (novos) reagem à resposta livre em ≤3 linhas via LLM. Roteamento novo em `on_text`.

**Trilha antiga × nova:** a bleed vinha de (a) `bot_state.history` (14 msgs da conversa antiga) e (b) o quiz lendo `events` do mês todo. Corrigido:
- `bot/db.py`: `clear_history(user_id)`. Chamado em `onboarding._finish` logo após `create_plan` (cobre /recomecar e reset pelo painel).
- `bot/jobs.py::learning_check`: `events_since` agora usa `max(início do mês, data de criação do plano)` — não mistura tópicos de trilha anterior. `get_plan` já traz `created_at`.

`Design.md` PARTE 1 ganhou seção "Como ela ensina". `py_compile` + smoke de `persona()`/prompts OK. Falta deploy do bot.

## 2026-09-01 (continuação) — escala: fallback de LLM, conteúdo compartilhado, jitter + review

Fernanda passou o bot pra colegas ("vai passar pra outros"). Pediu ideias 1+2+4, a chave grátis do Gemini e uma revisão geral pra escalar sem quebrar.

### Chave Gemini
Ela JÁ tem uma (aistudio.google.com/apikey → "Default Gemini API Key", projeto `gen-lang-client-0628080961`, Nível gratuito). Só precisa copiar (ícone de copiar na linha) e colar no `.env` (bot) e `web.env` (painel) na VM, campo `GEMINI_API_KEY=`, e reiniciar os serviços. **Não passou pela sessão** — ela faz.

### Idea 1 — jitter (espalha o pico)
`bot/scheduling.py`: `_jitter(user_id)` = offset estável 0–24 min por usuário (hash do UUID), `_shift(time, min)`. Aplicado nos lembretes E nos jobs de domingo. "Todo mundo às 08:00" vira 08:00–08:24. Determinístico → resync não muda o slot.

### Idea 2 — conteúdo compartilhado do dia
`daily_motivation` e `daily_insight` são genéricos → gerar 1x/dia e reusar entre todos.
- Migration `0009_content_cache.sql`: tabela `content_cache (kind, day, text)`.
- `bot/db.py`: `get_cached_content` / `save_cached_content` (INSERT ON CONFLICT DO NOTHING — race-safe, vários workers no mesmo minuto só geram 1).
- `bot/jobs.py`: `_shared_daily()`. Se o lembrete tem `custom_text` (instrução própria), gera personalizado; senão usa o cache. Corta ~2 das ~6 chamadas de LLM agendadas por usuário/dia.

### Idea 4 — cadeia de provedores com fallback
`bot/config.py`: `LLM_PROVIDER` agora é CSV (`groq,gemini,openrouter`) = ordem de prioridade. `LLM_CHAIN` = só os que têm key. Novo provider `gemini` (endpoint OpenAI-compat, `gemini-2.0-flash`). `LLM_CONCURRENCY` (default 2).
`bot/llm.py` reescrito: classe `_Provider` (cliente + `Semaphore(LLM_CONCURRENCY)` + cooldown PRÓPRIOS). `_call` tenta cada provedor em ordem; 429/erro num → cai pro próximo; todos falham → pool local. Antes: 1 provedor, `Lock` global (1 chamada por vez no processo inteiro) + cooldown global. Agora concorrência por-provedor e um 429 do Groq não trava o Gemini.
`web/src/lib/coach-llm.ts`: mesma cadeia Groq→Gemini (painel).
Na VM: `LLM_PROVIDER=groq,gemini,openrouter` já setado no `.env` e `.env.example`. Vira `[groq,gemini]` assim que ela colar a `GEMINI_API_KEY` + reiniciar.

### Bug corrigido: `/hoje` pulava o dia da trilha
`cmd_hoje` chamava `daily_learning_guide`, que avança `current_day` no fim. Toda vez que ela mandava `/hoje` pra VER o dia, a trilha andava. Agora o job lê `data["advance"]` (default True nos agendados; `cmd_hoje` passa `False`).
Também: `micro_learning` só cria pending `micro_q` se a pílula terminou mesmo com "🎯" (evita tratar frase de fallback como pergunta).

### Review — o que fica pra depois (anotado, não urgente com <20 users)
- `push_history` é read-modify-write (race benigno, last-write-wins). Migrar pra append em SQL se crescer.
- `events` cresce sem prune/partição — ok por 1+ ano. Depois: partição por mês ou job de limpeza.
- `auth_codes`/`web_sessions` expirados nunca são apagados — cron simples.
- `pop_outbox` sem `FOR UPDATE SKIP LOCKED` — ok com 1 consumidor.
- Job registry: PTB/APScheduler com N×~10 jobs — tranquilo até ~centenas de usuários; além disso, mover pra um scheduler externo ou 1 job "tick" que varre quem tem lembrete na janela.
- `_coach_tick` (refresh de settings a cada 120s) roda mesmo sem mudança — trocar por checar `stale()`.
- Persona (~1.2k tokens) vai no system de toda chamada — o conteúdo compartilhado já ameniza; se apertar, versão enxuta pros jobs de broadcast.
- Per-user API key (cada colega com a própria chave grátis) = escala linear e 100% grátis — bom próximo passo se passar de ~30 pessoas.

Deploy: bot (migration 0009 aplicada, no ar) + painel. `py_compile` + `build_app()` + `tsc` OK, chamadas reais de LLM testadas (motivação, quiz 2 rodadas).

## 2026-09-01 (continuação) — níveis de acesso + faxina

Fernanda: "acho q está com problema nos níveis de acesso, um usuário normal está conseguindo acessar a Aba de ajustes da IA".

**Diagnóstico:** os usuários novos são `role='user'` corretamente (Savage World / @savageworld0). As páginas `/admin` e `/admin/aristotelia` JÁ tinham guarda server-side (`redirect` se não for superadmin) — um usuário logado de verdade não passa. O que causava a impressão de bug: **durante impersonação**, o sidebar continuava mostrando "Pessoas" e "Ajustar IA" (usava `session.account.role`, que segue superadmin), e a página abria porque o `account` é superadmin. Fernanda impersonando o colega via os menus de admin e achava que era acesso indevido.

**Correção — impersonação vira "ver como usuário" de verdade:**
- `web/src/lib/guards.ts` (novo): `requireSession` / `requireAdmin` / `requireSuperadmin`. Os dois últimos bloqueiam **também durante impersonação** (`account.id !== viewing.id` → `redirect('/')`). Pra usar ferramenta de admin, sair da impersonação primeiro (1 clique no rodapé).
- `web/src/app/(app)/admin/page.tsx` e `.../admin/aristotelia/page.tsx`: usam os guards centralizados.
- `web/src/components/Sidebar.tsx`: "Pessoas" e "Ajustar IA" só aparecem se `!impersonating`.
- Verificado no navegador: impersonando o colega, os menus somem e `/admin/aristotelia` direto na URL redireciona pra `/`. Ao sair, tudo volta.

**Faxina (a pedido "faça o que acha melhor"):**
- Fernanda tinha 14 `web_sessions` acumuladas (cada login `/painel` cria uma, nunca eram apagadas).
- `web/src/lib/session.ts`: `createSession` apaga sessões expiradas antes de criar a nova.
- `bot/db.py::cleanup_expired()` + job diário `_cleanup_tick` em `main.py`: limpa `auth_codes` (>1d), `web_sessions` expiradas, `outbox` já enviada (>7d), `content_cache` (>14d).
- `_coach_tick` agora só faz `refresh()` se `coach.stale()`.

Deploy: bot + painel. `tsc` + `build` + `py_compile` OK. Guardas testadas ao vivo.

**Ainda pra fazer (review, sem urgência):** `events` sem partição/prune; `push_history` read-modify-write; per-user API key pra escala linear grátis; job-registry do PTB vira gargalo lá pra centenas de usuários.

## 2026-09-01 (continuação) — chave Gemini (recusada), favicon, raio-x completo

- **Chave do Gemini:** Fernanda colou a chave no chat. **Não adicionei** — política: não manuseio credencial em texto puro. Orientei ela a revogar essa (exposta no chat) e colar uma nova no `.env` / `web.env` da VM ela mesma. `LLM_PROVIDER=groq,gemini,openrouter` e o campo `GEMINI_API_KEY=` já estão prontos nos dois arquivos; só falta o valor + `systemctl restart`.
- **Favicon do painel:** `web/src/app/icon.svg` — o `Mark` (bandeira da marca) como ícone da aba. Next detecta automático (`<link rel="icon" type="image/svg+xml">`). Verificado em produção.
- **`/recomecar` limpa a checklist de trilha antiga:** `db.clear_future_trilha_tasks()` no `onboarding._finish` — apaga `tasks source='trilha'` pendentes de hoje em diante. Antes: a checklist de hoje mostrava o tópico da trilha velha ao lado do "Foco de hoje" novo (visto no painel da Fernanda: card "Instalação JDK e IDE" + checklist "Streams e lambdas avançados"). `/recomecar` da Fernanda funcionou — trilha Java nova, semana 1.
- **Raio-X completo da plataforma** publicado como artifact: https://claude.ai/code/artifact/33f47653-796d-428f-875d-32885cfadd46
  - 24 pontos (F01–F24): 4 críticos, 12 a corrigir, 8 a evoluir. Referência estável por F##.
  - **Críticos:** F01 auth sem rate limit (código 6 díg + senha admin, força bruta), F02 sem backup do Postgres, F03 uso do código de login não-atômico, F04 conversa livre do bot sem teto (drena LLM compartilhado).
  - **Ordem sugerida:** backup → rate limit auth → teto de conversa → instrumentação de retenção → domínio próprio → quiet hours + pausar → chave por usuário.
  - Não implementei nenhum ainda (é análise); os críticos deveriam vir a seguir.

## 2026-09-01 (continuação) — os 4 críticos resolvidos + limite de 40 msg/dia + dashboard de consumo

Fernanda: "corrija todos os críticos, principalmente do backup, resolva todos, coloque um limite de 40 mensagens por dia por usuário e além disso no meu painel de admin eu quero ter um dash de consumo de token, fallback etc".

### F02 — backup do Postgres (prioridade dela)
- `scripts/backup-db.sh`: `docker exec arist-pg pg_dump` gzipado → `~/backups/` na VM (fora do volume do Docker — é o que quase se perdeu em 31/08), mantém os 14 mais recentes, valida que o dump não saiu vazio.
- `aristotelia-backup.service` + `.timer` (systemd, diário 03:30, `RandomizedDelaySec`) — instalados e **testados** (rodei manual: dump de 17K, 18 `CREATE TABLE`, íntegro).
- Off-site: opcional via `BACKUP_UPLOAD_URL` (PUT numa URL pré-assinada — guia pra Oracle Object Storage sem CLI no `scripts/systemd/README.md`). **Não configurado ainda** — precisa a Fernanda criar o bucket + PAR (3 min). Sem isso, protege contra o volume sumir mas não contra a VM/disco morrer.
- `scripts/systemd/README.md`: as 5 unidades da VM documentadas (fonte da verdade).

### F01 + F03 — auth endurecida
- `web/src/lib/ratelimit.ts`: rate limit em memória por IP (janela deslizante).
- `/api/auth/code`: 8 tentativas / 10 min por IP; consumo do código agora é **atômico** (`UPDATE ... WHERE used_at IS NULL RETURNING`, uma query só — fecha a corrida).
- `/api/auth/admin`: 5 tentativas / 15 min por IP; senha comparada em tempo constante (`timingSafeEqual`); superadmin escolhido deterministicamente (mais antigo) em vez de indefinido com 2+ superadmins.
- **Testado em produção:** 8 tentativas OK + 9ª→429 no código; 5 OK + 6ª→429 na senha admin.

### F04 — limite de 40 mensagens de conversa livre por usuário/dia
- `bot/handlers.py`: `CHAT_DAILY_CAP = 40`. Conta `events kind='msg:chat'` do dia; ao bater o teto, responde sem chamar o LLM ("bateu o limite... as da trilha seguem normais"). Só vale pra conversa livre — quiz/desafio/review/onboarding não contam.

### Dashboard de consumo (painel → Admin → **Consumo**, só superadmin)
- Migration `0010_llm_usage.sql`: 1 linha por chamada de LLM (user, origem bot/web, tag, provedor, modelo, tokens prompt/completion, se foi fallback, se caiu no pool local, status).
- **Bot:** `bot/usage.py` — contextvar (`set_context(user_id, tag)` nos entry points: `jobs._ctx`, `on_text`, `onboarding._finish`) + fila thread-safe (o `llm.py` roda em thread via `asyncio.to_thread`, que propaga o contextvar — DB é async, não dá pra gravar direto de dentro da thread). `llm.py` grava um evento por tentativa de provedor (sucesso, 429, erro) + um se cair no pool local. Tick de 20s em `main.py` drena a fila e grava em lote.
- **Web:** `coach-llm.ts` grava direto (já é async) — cadeia Groq→Gemini com o mesmo formato. `trilha-detail.ts` passa `{userId, tag:"trilha-detalhe"}`.
- **Página** `/admin/consumo`: tokens+chamadas 7d, % que caiu em fallback, contagem de 429, aviso se algo caiu no pool local, gráfico de barras de tokens/dia (14d), "quem mais consome" (top 12), por provedor, por tipo de mensagem (tag). Usa `requireSuperadmin()`.
- **Testado ponta a ponta em produção:** chamada real ao Groq com contexto setado → drenada pelo tick → apareceu certinha no dashboard (usuário, provedor, tokens). Linha de teste removida depois.

**Deploy:** bot (migration 0010 aplicada) + painel. `py_compile`, `tsc --noEmit`, `next build` OK.

**Ainda falta (não crítico, documentado no Raio-X):** off-site do backup (ação da Fernanda), F05–F16 do raio-x (domínio próprio, instrumentação de retenção, quiet hours, etc).

## 2026-09-01 (continuação) — bug gravíssimo (fuga de objetivo) + trilha adaptativa + árvore de aprendizado

Fernanda: "que a trilha se adapte se caso a pessoa errar e faça um tipo de revisão" + ideia da árvore de aprendizado (galhos/troncos crescendo) + "erro gravíssimo: o usuário Savage falou que queria aprender sobre vendas, a IA do nada começou a falar sobre tag HTML".

### O bug (investigado e corrigido)
Não era a trilha (a trilha da Savage estava certinha — "Princípio da Reciprocidade", "Escuta Ativa", tudo sobre vendas). Era a **conversa livre**: ela mandou um texto que era um exemplo de oferta que ela mesma escreveu ("combo de site + google meu negócio... top do google" — provavelmente resposta da tarefa do dia 1, "escreva 3 ofertas de valor"), mandado como mensagem solta em vez de pela tarefa guiada. O LLM pegou as palavras "site" e "google" e literalmente puxou a conversa pra SEO/HTML, ignorando que o objetivo dela é vendas. Quando ela tentou corrigir ("como aprendo vendas?"), a IA nem corrigiu direito.
- **Causa raiz:** o `goal` ia pro system prompt como frase fraca ("Ela está trabalhando para: X"), sem instrução de blindagem — nada impedia o modelo de "seguir a associação de palavras" pra um assunto não relacionado.
- **Corrigido em `bot/coach.py::persona()`** (afeta TODA função, não só chat): guarda-corpo explícito — "TUDO que você disser fica DENTRO desse objetivo... nunca puxe a conversa pra um assunto não relacionado só porque uma palavra lembrou outra coisa", com o exemplo literal do bug (site/SEO vs. vendas) pro modelo reconhecer o padrão.
- **`handlers.on_text`** (conversa livre): agora também manda o tópico do dia da trilha no prompt, reforço extra de contexto.
- **Testado com o cenário exato da Savage** (mesma mensagem, mesmo objetivo) contra o LLM real: antes vertia pra HTML, depois da correção respondeu 100% dentro de vendas/reciprocidade.
- **Efeito colateral também corrigido:** o `daily_insight` (que eu tinha posto pra ser compartilhado entre usuários, sessão passada) foi revertido pra **sempre personalizado** — compartilhar um insight só faz sentido pra conteúdo genérico (motivação), não pra algo que promete "ligado à área da pessoa". Isso era um risco do MESMO tipo de bug (alguém aprendendo vendas recebendo insight de banco de dados). `daily_motivation` continua compartilhada (é realmente genérica, sem risco).

### Trilha adaptativa (erra o quiz → dia de revisão)
- Migration `0011_review_queue.sql`: `learning_plans.review_queue jsonb`.
- `bot/db.py`: `add_review_topic` (dedup via `@>` antes de inserir) / `pop_review_topic` (atômico, `FOR UPDATE`).
- `handlers._quiz`: errou a rodada 1 → tópico entra na fila.
- `jobs.daily_learning_guide`: antes de gerar o guia normal, tira 1 item da fila (se houver) e manda um guia de **revisão** (`prompts.REVIEW_GUIDE` — reexplica em 2-3 linhas + 1 mini-exercício) em vez do próximo tópico novo — **sem avançar o dia** (o tópico novo só espera 1 dia a mais). `/hoje` (advance=False) não consome a fila, só a execução agendada das 08h consome.

### Árvore de aprendizado
`web/src/components/LearningTree.tsx` — SVG procedural (sem lib, mesma técnica do TrailMap: trig + paths calculados), server component, sem JS no cliente:
- Tronco cresce (altura ∝ progresso real: dias concluídos / total) com um "tronco fantasma" translúcido mostrando o tamanho final.
- 1 galho por semana, alternando lado (mesmo zigue-zague do TrailMap), com folhas = dias (verde cheio = feito, anel terracota = hoje, oco pontilhado = futuro — vocabulário visual idêntico ao TrailMap).
- Semana toda concluída → galho vira verde inteiro (status calculado por posição real, não por número da semana — corrigi um bug de borda onde a última semana ficava "ativa" pra sempre depois de terminar a trilha).
- Trilha 100% completa → flor/fruto terracota no topo (broto verde enquanto não termina).
- Testado visualmente em 4 estágios (início/meio/quase lá/completo) antes de subir — comportamento validado, bug de borda achado e corrigido nesse teste.
- Entra no topo da página **Trilha**, acima do TrailMap (que continua sendo a navegação dia-a-dia); a árvore é a "visão geral".

**Deploy:** bot (migration 0011) + painel. `py_compile`, `tsc --noEmit`, `next build` OK. Testado em produção (página `/trilha` da Fernanda renderizando a árvore real).

**Pergunta em aberto pra Fernanda:** quer que eu mande uma mensagem pra Savage explicando/pedindo desculpa pelo desvio de assunto? Não fiz isso sem perguntar — é mensagem pra um usuário real dela.

## 2026-09-01 (continuação) — conversar no painel + /pausar /voltar + horário de silêncio + pomodoro persistente

Fechei o lote que estava pela metade no working tree (F06 e F09 do Raio-X + 2 melhorias soltas).

### 1. Aba "Conversar" no painel (F09 — quem não tem Telegram)
Conversa livre com a treinadora direto no painel, **mesma memória** do bot (`bot_state.history`, compartilhada nos dois sentidos).
- `web/src/app/(app)/conversar/page.tsx` — carrega o histórico e renderiza o chat + aviso de Telegram.
- `web/src/components/ChatPanel.tsx` — client, bolhas, "escrevendo…", Enter envia.
- `web/src/components/TelegramNotice.tsx` — explica que notificação push é só via Telegram + `/start`; sem Telegram, usa esta aba.
- `web/src/app/api/chat/route.ts` — POST: mesmo teto de **40 msg/dia** do bot (conta `events kind='msg:chat'`, agora compartilhado bot+painel), persona idêntica, tópico do dia no system, grava user+assistant no histórico com o **mesmo SQL de append atômico com corte no cap** do `bot/db.py::push_history` (reescrito nesta leva pra ser 1 query só — o painel também escreve lá).
- `web/src/lib/persona.ts` — espelho de `bot/coach.py::persona()` (identidade/objetivo/tom/pedagogia/blindagem de objetivo + overrides de `app_settings`). Comentário no topo: MANTER EM SINCRONIA.
- `web/src/lib/coach-llm.ts` — `coachChat()` (cadeia Groq→Gemini + telemetria `llm_usage`, tag `chat-painel`); tipo `Msg` agora aceita `assistant`.
- `web/src/components/Sidebar.tsx` — item "Conversar" (entre Foco e Lembretes).
- **Bug que achei e corrigi ao revisar:** o route mandava só o histórico salvo pro LLM e **não anexava a mensagem atual** — na 1ª msg o modelo não recebia pergunta nenhuma. Agora monta `[...history, {user: texto}]` antes de chamar.

### 2. `/pausar` e `/voltar` no bot (F06 — pausar sem culpa)
- `bot/handlers.py::cmd_pausar` / `cmd_voltar`: `status` vai pra `paused`/`active` e re-agenda (`schedule_user` já tira todos os jobs quando `status != active`).
- Streak **não quebra** (o `bump_streak` só incrementa, nunca reseta por dia perdido — confirmado), trilha congela.
- `bot/main.py`: handlers registrados. `bot/onboarding.py`: `/pausar` no rodapé de comandos. `CLAUDE.md` §4 atualizado.

### 3. Horário de silêncio (F06 — quiet hours)
- `bot/scheduling.py::_in_quiet()` — testa se o horário (já com jitter) cai na janela `[quiet_start, quiet_end)`, aceita janela que cruza a meia-noite. Lembrete dentro da janela **não é agendado**. Colunas `preferences.quiet_start/quiet_end` já existiam (migration 0001) — **sem migration nova**.
- Tirei o fallback pra `sleep_time/wake_time` que eu tinha posto: silêncio agora é **opt-in explícito** no painel (senão mudava o comportamento de quem já usa, sem UI).
- UI: `web/src/components/QuietHours.tsx` (toggle + 2 inputs de hora) na página **Lembretes**, seção "Silêncio". `web/src/app/api/prefs/route.ts` aceita `quietStart/quietEnd` (valida `HH:MM`, os dois juntos ou os dois nulos) e marca `reminders_dirty` → o `_resync_tick` (60s) re-agenda.
- `web/src/lib/schema.ts` — `quietStart/quietEnd` mapeados em `preferences`.

### 4. Pomodoro sobrevive a refresh
- `web/src/components/TomatoTimer.tsx` — salva fase/rounds/`endsAt` em `localStorage` (`arist_pomodoro`); ao montar, retoma o tempo restante real (ou zera se acabou). `try/catch` em tudo (storage bloqueado = segue sem retomar).

### Verificação
- `py_compile bot/*.py` OK; `build_app()` OK (13 handlers); `_in_quiet` testado com 7 casos (meia-noite, sem janela, janela degenerada).
- `web`: `tsc --noEmit` limpo, `next build` OK (rotas `/conversar`, `/api/chat`, `/api/prefs`, `/lembretes` compiladas). ESLint não está configurado no projeto (nunca esteve) — validação é tsc+build, como nas sessões anteriores.
- **Deploy feito:** bot (`systemctl is-active` → active, polling ok, 0 erro no log) + painel (`aristotelia-web` active). Smoke test em prod: `/conversar` e `/lembretes` → 307 (redirect p/ login, rota ok), `/api/chat` GET → 405 (só POST, ok). Chamada real de LLM da aba Conversar não deu pra testar sem sessão logada — a Fernanda confirma abrindo o painel.

**Não configurado (e nunca esteve no escopo): integração com Google / Outlook / e-mail.** O login do painel é código de 6 díg do Telegram + senha admin. Canais de lembrete: `telegram` e `push` (web push) funcionam; `email` existe no enum do schema mas é Fase 2, sem implementação. Não há sync de calendário nem "entrar com Google". Se a Fernanda quiser, é trabalho à parte (OAuth + Google Calendar API / Microsoft Graph, ou provedor de e-mail transacional).

**Nota pra sincronia:** `bot/coach.py::persona()` e `web/src/lib/persona.ts` são cópias manuais. Mudou uma → mudar a outra.

## 2026-09-01 (continuação) — planos Aprendiz/Sábio/Mestre + LP no Vercel + cadeia de LLM ampliada

Sessão longa. Vários pedidos da Fernanda.

### Lote pequeno já no ar (deploy feito no início da sessão)
`/pausar` + `/voltar` (pausa lembretes sem quebrar streak), horário de silêncio (`preferences.quiet_start/quiet_end`, opt-in no painel → `_in_quiet` no scheduling), pomodoro que sobrevive a refresh (localStorage), aba **"Conversar"** no painel (chat com a treinadora, mesma memória `bot_state.history` do bot, teto de 40/dia compartilhado). Commits `8eee551`, `cfa4d27`.

### Integração de calendário — SPEC + PLANO escritos, NÃO implementado
- `docs/superpowers/specs/2026-09-01-integracao-calendario-design.md` + `docs/superpowers/plans/2026-09-01-integracao-calendario.md` (12 tasks TDD).
- Abordagem: OAuth Google + Microsoft no app web, evento recorrente por lembrete num calendário secundário "Aristótel.IA", timer systemd de sync. Lembrete vira multi-canal (`channels` array).
- Trava: Fernanda precisa criar projeto Google Cloud + registro Azure + preencher `web.env`. Passo a passo no spec §9.

### Landing page — app Next STANDALONE em `landing/` (porta 3001), pra Vercel
- Separado do painel. `next build` OK. NÃO deployado — Fernanda sobe no Vercel (root dir `landing`, env `GROQ_API_KEY`/`GEMINI_API_KEY`).
- Tema claro por padrão (igual ao painel, toggle opcional), estátua da Aristótel.IA no hero (`referencias/ChatGPT Image…png` otimizada → `landing/public/aristotelia.webp`).
- **Widget "monte metade da trilha":** `POST /api/trilha/preview` gera a semana 1 via LLM (rate limit 6/h por IP + cache por objetivo). Mostra 2 dias, borra 3-5, CTA pro Telegram. Sem key → exemplo estático.
- `/privacidade` incluída (exigida pela tela de consentimento do Google).
- **Nota:** `next dev` corrompe o `.next` no OneDrive (mesmo problema do painel — ver `scripts/deploy-web.sh`). Rodar via `next build && next start`.

### Planos — DECIDIDOS (cobrança ainda desligada)
`docs/precos-e-limites.md` reescrito. `Produto.md §10` atualizado.
- **Aprendiz** (grátis) · **Sábio** (R$39/mês, R$290/ano) · **Mestre** (R$79/mês, R$590/ano) · **Turma** (B2B, sob consulta).
- Fundador: Sábio R$29 / Mestre R$59, travado **12 meses** (transição, não pra sempre).
- Grátis generoso: ciclo 1% + gráfico de evolução + 25 msg/dia + 5 crons + 1 trilha. Nunca corta o ciclo básico/canais/gráfico.
- Headline dos pagos = **conteúdo → rede social** (LinkedIn/IG/X com copy). + multi-trilha (3/6, modelo de dias-da-semana por trilha), agenda, análise profunda, export. Mestre: ilimitado + revisão espaçada + pergunta estratégica + trilhas-modelo + parceiro de constância + boletim de autoridade + prioridade no LLM.
- **Status de build:** Aprendiz ~90% pronto. Pagos = majoritariamente roadmap (multi-trilha, agenda, pipeline de conteúdo, export, boletim, prioridade LLM, B2B cohort não existem). Enum `plan` é `free/pro/unlimited` — precisa migration + `LIMIT` maps por tier.

### Cadeia de LLM ampliada (pedido: "Gemini mais inteligente? mais opções de chave")
- `bot/config.py::_PROVIDER_SPECS` agora tem **7 provedores** OpenAI-compat: gemini, groq, cerebras, sambanova, mistral, github (GitHub Models), openrouter. Espelhado em `web/src/lib/coach-llm.ts` e `landing/src/lib/llm.ts` (SPECS + ORDER de `LLM_PROVIDER`).
- **Gemini agora é o 1º** da ordem padrão, e o modelo default subiu pra **`gemini-2.5-flash`** (era 2.0; o 2.5 tem "thinking", melhor). Groq 2º.
- Modelo por provedor via `<PROVEDOR>_MODEL` no `.env` (antes só `LLM_MODEL` do 1º).
- `bot/llm.py`: `reasoning_effort=low` agora pra qualquer `gpt-oss` (groq E cerebras).
- Fernanda precisa: criar contas Cerebras/SambaNova/Mistral/GitHub-PAT (5 min cada), colar keys no `.env`/`web.env`, e ajustar `LLM_PROVIDER=` na ordem que quiser.
- `py_compile` + `build_app` + `tsc` (web/landing) + `next build` (landing) OK.

### Recurso "D" — aviso de quase-limite de key + métricas de servidor no `/admin` (FEITO, falta deploy)
**Migration `0012_limits_vitals.sql`** (NÃO rodada — o runner do bot aplica no deploy):
- `llm_usage` ganhou 5 colunas nullable: `rl_remaining_requests/rl_remaining_tokens/rl_limit_requests/rl_limit_tokens/rl_reset_seconds` (headers `x-ratelimit-*` por chamada).
- `events.user_id` virou **nullable** (evento de sistema `llm:near_limit:<provider>` não tem dono). Drizzle: `events.userId` sem `.notNull()`.
- Tabela nova `system_vitals` (1 linha, PK fixa `id=1`, upsert).

**D1 — quase-limite das chaves de LLM:**
- `bot/llm.py`: `_Provider.call()` agora devolve 3-tupla `(texto, usage, snapshot)`; `_rl_snapshot()` lê TODOS os headers `x-ratelimit-*` (requests+tokens, nomes `*-requests`/`*-tokens` do Groq/Cerebras E os genéricos do OpenRouter). Gemini não manda nada → campos None.
- `web/src/lib/coach-llm.ts`: `rlSnapshot(res.headers)` idem; `record()` grava os 5 campos. Exporta `llmChain()`.
- `bot/llm_limits.py` + `web/src/lib/llm-limits.ts` (espelhos): `PROVIDER_LIMITS` (rpm/rpd/tpm/tpd por provedor — **APROXIMADOS, chutados da doc, precisam ajuste real**) + `pressure_pct()` (usa header quando tem, senão estima pelo uso das últimas 24h/1min).
- `bot/main.py`: job `_limits_tick` (120s) → `db.llm_pressure()` + `db.log_near_limit()` grava `events(kind='llm:near_limit:<provider>')` quando cruza 80%, no máx 1/provedor/hora.
- Dashboard: **seção nova em `/admin/consumo`** ("Limites das chaves · agora") — 1 card por provedor da cadeia: requests/tokens 24h vs limite, pico/min, header mais recente, % com cor (clay >70%, vermelho >90%), cooldown provável, último aperto. (não fiz página `/admin/limites` — ficou mais limpo dentro do consumo.)

**D2 — métricas do servidor:**
- `bot/vitals.py` (novo): `collect()` lê `/proc/loadavg`, `/proc/meminfo`, `shutil.disk_usage`, `systemctl is-active` (aristotelia, aristotelia-web, aristotelia-backup.timer), `docker inspect arist-pg`, arquivo mais novo em `~/backups/`, uptime do processo. Tudo em try/except isolado — em dev (Windows) degrada sem quebrar.
- `bot/db.py`: `save_vitals()` (upsert + `pg_database_size`). `bot/main.py`: job `_vitals_tick` (60s).
- Página nova `/admin/servidor` (server component, `requireSuperadmin`): CPU load, RAM/swap (vermelho se RAM livre <100 MB), disco, serviços ✅/❌, tamanho do Postgres, último backup (âmbar >36h), uptime, "atualizado há Xs".
- `Sidebar.tsx`: item "Servidor" no bloco superadmin (some na impersonação, igual "Consumo").

**Scripts de asserção:** `scripts/check_llm_limits.py`, `scripts/check_vitals.py` — passam.
**Checks:** `py_compile bot/*.py` · `build_app()` · `tsc --noEmit` · `next build` — todos OK.
**Falta a Fernanda:** subir o deploy (bot + web) — a migration 0012 aplica sozinha no restart do bot. Depois, calibrar os limites em `llm_limits.py`/`llm-limits.ts` com os números reais de cada free tier.

### Ainda na fila (ordem a definir com a Fernanda)
B) enum de planos + teto por plano · C) implementar o calendário · E) multi-trilha · F) pipeline conteúdo→rede social.

## 2026-09-02 — auditoria da VM + cadeia de LLM de verdade + início da estruturação do backlog

Fernanda: "vamos estruturar a plataforma pois está uma bagunça de tarefas e vamos pelas mais críticas". Pressão: convidar mais gente + confiabilidade do que está no ar (cobrança NÃO é prioridade agora).

**Auditoria da VM (o que estava desatualizado na Memória):**
- **Lote D (limits + vitals) JÁ está em produção** — migration `0012` aplicada 2026-09-01 20:14, `system_vitals` atualiza a cada 60s, colunas `rl_*` em `llm_usage`. A nota "falta a Fernanda subir o deploy" estava errada.
- Migrações: as 12 (`0001`→`0012`) todas aplicadas. Nada pendente. Não existe `0013` (calendário nunca foi construído).
- Serviços todos `active` (aristotelia, aristotelia-web, backup.timer, arist-tunnel, url-sync.timer). Bot saudável.
- **Backup:** timer roda (últimos: 01/09 e 02/09), mas `BACKUP_UPLOAD_URL` **vazio** → backup só existe dentro da VM (off-site nunca configurado).
- **Túnel:** ainda quick tunnel (`*.trycloudflare.com`), URL efêmera — F05 aberto, maior risco operacional.
- Branch `master` local = só o commit da Fase 0, já superado por `main`.

**Cadeia de LLM — era teatro, agora é real:**
- Descoberto: no `.env` da VM **só `GROQ_API_KEY` tinha valor**; as outras 6 linhas existiam vazias. `llm_usage` de 3 dias = 100% Groq, zero fallback. 1 provedor = 1 ponto de falha no pico das 8h.
- Fernanda colou as 5 keys no chat sob pressão de tempo e pediu explicitamente pra aplicar. Aplicadas (free tier, sem billing = sem risco $).
- **Teste real de cada uma na VM:** Gemini ✅ (mas `gemini-2.5-flash` dá 404 "no longer available to new" → `gemini-flash-lite-latest`), Mistral ✅ (`mistral-small-latest`), Groq ✅. **Cerebras** ❌ 402 Payment required, **SambaNova** ❌ 402 (`balance_units: 0`), **GitHub Models** ❌ 410 retirement brownout.
- **Cadeia ativa:** `LLM_PROVIDER=groq,gemini,mistral` (Groq primário — é onde a pedagogia foi calibrada). Setada em `.env` + `web.env` da VM, serviços reiniciados, 3 provedores confirmados por chamada real.
- Commit `6e7a2e2`: `bot/config.py` (default order + gemini model), `web/src/lib/coach-llm.ts`, `landing/src/lib/llm.ts`, `CLAUDE.md §5`. `tsc` web+landing limpo, `config.py` compila.
- **Falta a Fernanda:** pôr `GEMINI_API_KEY`/`MISTRAL_API_KEY` + `LLM_PROVIDER`/`GEMINI_MODEL` na **Vercel** (landing) e redeploy. Rotacionar as keys quando sair da correria (passaram pelo chat).

**Próximo:** montar o `Backlog.md` (fonte única, IDs estáveis) consolidando Raio-X F01–F24 + fila da Memória, priorizado pra "convidar gente + confiabilidade". Depois atacar P0 (domínio próprio, backup off-site).

## 2026-09-02 (continuação) — `Backlog.md` criado + P1 B05/B06/B07

Fernanda: "pode mandar ver em tudo que for importante para colocarmos para rodar". Domínio ela não consegue agora (B01 fica parado).

**`Backlog.md` na raiz** — fonte única, IDs `B01`–`B20`, P0–P4. `CLAUDE.md §9` aponta pra lá. Commits `044b0ac` / `b4ecd61`. Branch `master` órfã apagada.

**B05 — onboarding à prova de bala** (commit `ea8fd72`, deployado):
- Bug que quebrou 2x: durante os ~20s de geração da trilha, `pending` seguia em `step=tone` → cada mensagem da pessoa disparava outra `build_trilha` (5 chamadas de LLM + `learning_plans` duplicados).
- `_finish` marca `pending step='building'` imediatamente; mensagem nesse estado só responde "tô montando" e não regera.
- `_stub_week(tema)` — semana que o LLM não gera vira versão mínima do tema; `build_trilha` só devolve `None` se NENHUMA semana saiu.
- `_retry_job` — falha total agenda retry automático (60s, 120s), até 3x; esgotou → volta pro `step=tone`.
- `db.get_or_create_user`: `INSERT ... ON CONFLICT (telegram_chat_id) DO NOTHING` (duplo `/start` não estoura mais unique violation).
- `_activate` não repete a boas-vindas em re-entrada.
- `scripts/check_onboarding.py` — 5 asserções da degradação, sem DB/LLM real. Passa local e na VM.

**B06 — página de retenção** (commit `ae78316`, deployado):
- `/admin/retencao` (superadmin): D1/D7/D30, funil da trilha (chega na semana 2), tarefa concluída/dia (14d), lista "sumiram" (ativos sem engajamento 3+ dias).
- `retencao()` em `web/src/lib/queries.ts` — "dia engajado" = `events kind IN (quiz, quiz_reforco, review, desafio, foco, jasei, skip, msg:chat)` OU `tasks.status='done'`. Mensagem que o bot MANDA não conta.
- Cores comparam com os alvos do `Produto.md §8`. Hoje: 3 contas, todas <7 dias (D7/D30 mostram "—").
- SQL validado direto no Postgres de produção antes do deploy.

**B07 — telas de erro + gate de tipos** (commit `74e5ba6`, deployado):
- `error.tsx` / `global-error.tsx` / `not-found.tsx` com a identidade (antes: erro de runtime = tela branca). 404 custom confirmado em prod.
- `scripts/deploy-web.sh` roda `tsc --noEmit` e **aborta** se falhar, antes do `next build`. `ignoreBuildErrors` continua (segfault do worker no Node 24/Win) mas a checagem virou obrigatória no deploy.

**Ainda na fila:** P0 B01 (domínio — Fernanda) · B02 (bucket Oracle — Fernanda) · B04 (keys na Vercel — Fernanda). P2: B09 persona enxuta, B10 N+1, B11 calibrar limites de LLM.

## 2026-09-02 (continuação) — OpenRouter + ordem por capacidade + otimização da VM

Fernanda: adicionar a key da OpenRouter, priorizar "a chave mais inteligente primeiro", OpenRouter sempre `:free`, e otimizar a VM (RAM em ~520/956, com medo de não suportar ao convidar gente).

### LLM
- **Benchmark real na VM** (prompt "explique API REST em 1 frase"): Groq `gpt-oss-120b` = melhor resposta (completa, PT natural, rápida). Mistral `small` = boa. Gemini `flash-lite` = fraca/truncada. Gemini `pro-latest` = 429 (quota free baixa). Gemini `2.5-flash` = 404.
- **OpenRouter: conta sem crédito → TODO modelo `:free` devolve 404** ("unavailable for free" ou "no endpoints"). Testei 11 modelos, nenhum funciona. Só destrava com US$10 de crédito vitalício (aí libera DeepSeek V3, Llama 3.3 70B etc). Key adicionada no `.env` + `web.env` mesmo assim; fica no FIM da cadeia — como `_call` só tenta o próximo quando o anterior falha, um openrouter morto no fim só custa 1 chamada falha quando groq+mistral+gemini já caíram (raríssimo), aí vai pro pool local igual.
- **Ordem nova:** `LLM_PROVIDER=groq,mistral,gemini,openrouter` (mais capaz primeiro). `config.py` força sufixo `:free` no modelo do openrouter. Espelhado em web + landing. Commit `056b48f`, deployado (bot + painel).

### Otimização da VM (feito, ao vivo)
Antes: 420 MB usados / 375 livres, **288 MB em swap** (só 1 GB de swap). Depois: **356 usados / 438 livres, 65 MB em swap**, swap agora de **3 GB**.
- **Swap 1 GB → 3 GB** (`/swapfile` recriado, fstab ok). `vm.swappiness=60→10`, `vm.vfs_cache_pressure=100→50` em `/etc/sysctl.d/99-arist-mem.conf`.
- **`fwupd` e `multipathd` mascarados e mortos** (inúteis num VM guest) — ~50 MB de processos + sockets.
- **Bot:** drop-in systemd `/etc/systemd/system/aristotelia.service.d/mem.conf` com `MALLOC_ARENA_MAX=2` (104 → ~89 MB RSS).
- **Painel:** `NODE_OPTIONS=--max-old-space-size=160` no `web.env` (97 → ~83 MB).
- **Postgres:** `max_connections 100 → 25` (pool do bot = 8, do painel = 5; folga sobra). `ALTER SYSTEM` + restart do container.
- Ideia anotada pro Backlog: rodar Postgres nativo (apt) em vez de Docker economizaria dockerd+containerd (~72 MB) — mas é migração com risco, fica pra depois.

## 2026-09-02 (continuação) — auditoria de integridade do banco (B22) + migration 0013

Fernanda: "a estrutura do banco está tudo certo? tenho medo de bagunçar as informações de um usuário com o outro, a memória está funcionando, ela tem acesso à trilha e vai dando check, quero um banco que não quebre caso cresça".

**Auditoria (li o schema todo, as ~40 funções de `bot/db.py` e as 15 rotas de `web/src/app/api`):**
- **Isolamento entre usuários = OK.** Toda tabela de dados tem `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`. Toda query do bot tem `WHERE user_id = $1`. As mutações do painel que recebem só um id (`tasks/[id]`, `reminders`, `push`) filtram `AND user_id = session.viewing.id` — id de outra pessoa vira no-op. Rotas `/api/admin/*` checam `account.role === 'superadmin'`. `viewing` (quem você olha) vs `account` (quem você é) bem separados.
- **Memória = OK.** `bot_state.history` por usuário (PK), append atômico com corte em 14 msgs numa query só, compartilhada bot↔painel (mesmo SQL nos dois). Zerada no `/recomecar`.
- **Check da trilha = OK.** Job cria `tasks source='trilha'` → quiz/desafio/review pelo Telegram fazem `auto_complete(user_id, day, source)`, ou toggle no painel via `/api/tasks/[id]` com escopo. `add_task` deduplica.
- **Índices:** cobrem todos os caminhos quentes (`tasks(user_id,day)`, `events(user_id,day)` e `(user_id,kind)`, `learning_plans(user_id) WHERE active`, etc).
- **Riscos de escala:** (a) `events` cresce sem prune — ok por 1+ ano; (b) `learning_plans.weeks` JSONB guarda o `detail` mutável de cada dia → todo toggle reescreve o blob; refatorar em multi-trilha. Anotados B12/B22 no Backlog.

**Migration `0013_integrity.sql`** (aplicada, dry-run OK antes — 0 linhas violavam):
- `learning_plans_user_id_idx` (comum) → **`learning_plans_one_active` ÚNICO parcial** — impossível 2 trilhas ativas pro mesmo user. `db.create_plan` virou transacional (desativa+insere atômico).
- **`tasks_dedup` ÚNICO** `(user_id, day, source, title)` — fecha a corrida do SELECT-então-INSERT; `add_task` agora `ON CONFLICT DO NOTHING`.
- `events_kind_idx` — ajuda a página de retenção e o check de near-limit.
- Backfill defensivo: `INSERT INTO preferences/streaks/bot_state SELECT id FROM users ON CONFLICT DO NOTHING`.

Commit `fd504aa`, deployado (bot aplicou a migration no restart, 3 índices confirmados).

**Veredito pra Fernanda:** o banco NÃO mistura dados entre usuários e aguenta crescer. O que fica pra depois é só otimização (partição de `events`, tirar o `detail` do JSONB) — nada quebra sem isso.

## 2026-09-02 (continuação) — acesso sem Telegram (B23): cadastro web + onboarding no painel + push + webhook Kiwify

Fernanda: "quem não tem Telegram como acessa o painel? a LP fala só de Telegram". Depois: "faça o que achar melhor e seguro" + "preciso que já suba na LP com o checkout, senão qualquer um pega os planos só dando barra".

**Decisões:** Plano B (cadastro web sem OAuth — Google fica pra fase 2, precisa Google Cloud + domínio). Login por **link pessoal** (bearer 256 bits). Lembrete via **push**. Webhook do Kiwify casando por **e-mail**. NÃO renomear os planos agora.

Spec: `docs/superpowers/specs/2026-09-02-acesso-web-e-kiwify-design.md`.

**Migration `0014_web_auth.sql`:** `users` +`email`/`google_sub`/`avatar_url`/`signup_via`/`login_token`/`login_token_at` (tudo nullable — Telegram não quebra). Tabelas `pending_upgrades` (pagou antes de ter conta) e `kiwify_events` (log cru de todo webhook).

**Painel:**
- `/entrar` ganha "Não tenho Telegram" → nome + e-mail → `POST /api/signup/web` (`webauth.ts::createWebUser`) → cria user `signup_via='web' status='onboarding'`, linhas-filhas, aplica `pending_upgrades`, `createSession`.
- **Link pessoal:** `GET /entrar/link?k=<token>` (`link/route.ts`) troca o token por cookie de sessão e redireciona pra `/` ou `/onboarding` **sem o `?k=`** na URL. `/api/me/link` GET mostra / POST rotaciona.
- `/onboarding` (`OnboardingFlow.tsx`) — 4 telas (objetivo/nível/minutos/tom). `POST /api/onboarding` → `trilha-build.ts` (porta de `bot/onboarding.py::build_trilha` — `groqJson` ×5, `stubWeek` pra semana que falha, **1 retry com mais tokens** antes do stub) → grava trilha (transacional), prefs, **7 lembretes `channel='push'`**, `reminders_dirty=true`, `status='active'`. Tela final: salvar o link + `PushToggle`.
- `(app)/layout.tsx`: usuário `status='onboarding'` (não impersonado) → redirect `/onboarding`.
- `origin.ts::publicOrigin(req)` — atrás do túnel o Node vê `localhost:3000`; usa `x-forwarded-host`. (o link pessoal saía como `https://localhost:3000/...` — corrigido.)

**Bot (agenda quem não tem Telegram):**
- `db._REACHABLE` = tem `telegram_chat_id` OU tem linha em `push_subscriptions`. `active_users()`, `dirty_reminder_users()`, `scheduling.schedule_user()` usam. `db.has_push()` novo.
- `jobs._ctx`: não exige mais `telegram_chat_id` — devolve `chat=None` pra usuário só-push. `jobs._deliver`: `channel=='push'` OU `chat` None → manda push. `weekly.py`: 4 `send_text` diretos → `_deliver`. `main._outbox_tick`: pula (marca enviada) se `telegram_chat_id` NULL.
- **Gap conhecido (B25):** quiz/desafio/review mandam a notificação mas o `pending` só é consumido por msg de Telegram. Usuário só-push recebe, não responde fácil. Não crasha.

**Webhook Kiwify** (`web/src/app/api/webhook/kiwify/route.ts`):
- Lê o corpo **cru**, verifica HMAC-SHA1 com `KIWIFY_WEBHOOK_TOKEN` (query `?signature=`). Grava **sempre** em `kiwify_events` (raw + parsed). Extração tolerante de e-mail / evento / produto (doc do Kiwify incompleta — a 1ª compra real calibra).
- Aprovada/renovada → `users.plan` (por produto: `KIWIFY_PRODUCT_SABIO`→pro, `_MESTRE`→unlimited) ou `pending_upgrades` se não achar o e-mail. Cancelada/reembolso/chargeback → `free`. Sempre responde 200 (não revela).

**LP** (`landing/src/app/page.tsx`): FAQ "Não uso Telegram" agora é verdade + CTA secundário "entrar pelo painel" (`NEXT_PUBLIC_PANEL_URL`).

**Testado em produção ponta a ponta:** signup → `/` redireciona pra `/onboarding` → trilha gerada (4 semanas reais, 5 chamadas Groq ok) → link pessoal com host certo → abrir o link loga e limpa o `?k=` → link inválido → `/entrar?e=link` → webhook sem assinatura loga `ok=false` e responde 200. Usuários de teste apagados.

**Commits:** `ea82439` (feature) + `abc310d` (fix origin + retry). Migration 0014 aplicada. Bot + painel deployados.

**Falta a Fernanda:** `NEXT_PUBLIC_PANEL_URL` + `NEXT_PUBLIC_KIWIFY_SABIO/MESTRE` na Vercel · `KIWIFY_WEBHOOK_TOKEN` + `KIWIFY_PRODUCT_SABIO/MESTRE` no `web.env` da VM · configurar o webhook no painel do Kiwify (`${PANEL}/api/webhook/kiwify` + eventos). Google OAuth = B24 (fase 2).

## 2026-09-02 (continuação) — LP: caminho "sem Telegram" mais visível

Fernanda: "a opção da pessoa que não tem Telegram não está na landing". Sem URL estável do painel ainda (B05), então mudança mínima e sem link quebrado no ar.

**`landing/src/app/page.tsx`:**
- Hero lede: `+` "Não usa? Cria a conta direto no painel."
- CTA final: o botão secundário agora **renderiza sempre** (era `{ENTRAR !== TG && …}`). Rótulo "Não usa Telegram? →". Com `NEXT_PUBLIC_PANEL_URL` → aponta pra `…/entrar`; sem a env var → cai em `#faq` (rola até "Não uso Telegram."), nunca link morto.
- FAQ "Não uso Telegram.": 1ª frase "Dá sim." → "Dá — e é o mesmo produto."

`tsc --noEmit` + `next build` OK. Deploy = Fernanda (Vercel, push na main). Quando resolver o B05 e setar `NEXT_PUBLIC_PANEL_URL`, o CTA passa a levar direto pro `/entrar` sem tocar em código.
