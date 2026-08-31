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

**Próximo (Fase 1, em ordem):**
1. `bot/db.py` — pool asyncpg + runner de migrations + DAO por usuário.
2. Refatorar `storage/jobs/handlers/weekly` do bot pra multiusuário (estado por `user_id`, jobs por usuário respeitando fuso/horários/funções ligadas).
3. Onboarding no Telegram: novo usuário → 3 perguntas → LLM gera trilha → agenda os jobs dele.
4. Checklist: trilha do dia vira `tasks`; auto-check quando feito pelo Telegram.
5. Web (Next.js): auth por código, superadmin (lista/criar/impersonar), dashboard do usuário (checklist + pomodoro + evolução).
6. Deploy dos dois na VM + cutover (merge `fase-1` → `main`).
