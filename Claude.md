# Claude.md — AristotelIA

> **Fonte única de verdade do projeto.** Toda sessão do Claude Code DEVE ler este arquivo antes de começar qualquer trabalho.

---

## 0. Regras de documentação (OBRIGATÓRIAS — valem para todo projeto da Fernanda)

1. **Claude.md** (este arquivo) — sempre ler no início da sessão. Sempre que a estrutura do projeto mudar (arquivo novo, pasta nova, decisão de arquitetura, comando novo), **atualizar este arquivo na mesma tarefa**.
2. **Memória.md** — log cronológico. **Toda** alteração, configuração ou decisão feita durante uma sessão é registrada lá, com data (formato `AAAA-MM-DD`).
3. **Design.md** — tudo de design (tom de voz das mensagens, formatação, emojis, tipografia de eventuais telas). Sempre que o design mudar, atualizar lá.
4. **Produto.md** — visão de produto: ICP, wedge, features por pilar, arquitetura multiusuário, plano de validação, roadmap, modelo de negócio. Atualizar quando escopo/ICP/roadmap mudarem.

Essa estrutura é global: usar nos outros projetos da Fernanda também.

---

## 1. O que é a AristotelIA

**Aristótel.IA** — "agente de evolução 1%". Um bot de Telegram (t.me/AristotelIA_bot) que age como **treinadora pessoal de alta performance** da Fernanda.

Ciclo que o bot executa:

> dizer o que estudar → fazer pensar → fazer aplicar → registrar → transformar em conteúdo → mostrar evolução

Não é um bot de lembretes. O diferencial é **aprendizado ativo** (perguntas, quizzes, desafios) + **registro de evolução** + **transformar formação em conteúdo de Instagram**.

Contexto da Fernanda: Java na faculdade, JS/Node/n8n no trabalho, quer carreira em engenharia/produto, cria conteúdo. Tom das mensagens: **motivacional mas sincero, sem clichê, sem textão** (ver `Design.md`).

---

## 2. Rotina (horários — America/Sao_Paulo)

| Horário | Função (`src/jobs.py`)      | Tipo         | O que faz |
|---------|-----------------------------|--------------|-----------|
| 06:00   | `daily_motivation`          | mentalidade  | 1 frase provocativa sobre disciplina/carreira/futuro. Varia todo dia. |
| 08:00   | `daily_learning_guide`      | aprendizado  | **Função mais importante.** Diz EXATAMENTE o que estudar hoje, com ação concreta. Puxa o tópico de `data/learning_plan.json`. |
| 09:00   | `micro_learning`            | consumo      | Pílula de 5–10 min sobre o tópico + 1 pergunta para responder. |
| 10:30   | `learning_check`            | retenção     | Micro-quiz A/B/C sobre tópico recente. Registra acerto/erro. |
| 15:00   | `daily_insight`             | engenharia   | Insight fora da sintaxe (arquitetura, banco, carreira, produto, segurança) + pergunta que desenvolve visão de engenheira. |
| 16:00   | `application_challenge`     | prática      | Desafio de código de 10 min. "Não pesquise antes de tentar." |
| 20:00   | `daily_review`              | reflexão     | Pergunta 3 linhas (o que aprendi / o que fiz / o que entendi melhor). A resposta vira um card 📈 EVOLUÇÃO e dispara o `content_capture`. |

**Domingo** (`src/weekly.py`):

| Horário | Função              | O que faz |
|---------|---------------------|-----------|
| 10:00   | `weekly_review`     | Lê o `daily_log` dos últimos 7 dias → card 📊 SUA SEMANA com maior avanço, ponto fraco (sincero) e foco da próxima semana. |
| 11:00   | `content_planner`   | Lê `content_bank` + tópicos da semana → sugere 3 peças de conteúdo (carrossel/reel/threads). |
| 11:05   | `advance_week`      | Avança `learning_plan.current` para a próxima semana. |

Horários centralizados em `src/config.py` (`SCHEDULE`).

---

## 3. Estrutura de arquivos

```
AristotelIA/
├── Claude.md                 # este arquivo
├── Memória.md                # log cronológico
├── Design.md                 # tom de voz + formatação das mensagens
├── README.md                 # setup rápido
├── requirements.txt
├── .env                      # SEGREDOS (não commitar) — token do bot + chave do LLM
├── .env.example              # modelo do .env
├── .gitignore
├── Dockerfile                # imagem para deploy (Fly.io)
├── fly.toml                  # config Fly.io
├── Procfile                  # deploy alternativo (Railway/Render worker)
├── data/                     # estado persistente (JSON)
│   ├── learning_plan.json    # trilha de estudo — EDITÁVEL À MÃO
│   ├── progress.json         # runtime: chat_id, streak, interação pendente
│   ├── content_bank.json     # banco de ideias de conteúdo
│   └── daily_log.json        # registros diários de evolução
└── src/
    ├── __init__.py
    ├── main.py               # entrypoint: cria o bot, agenda os jobs, run_polling()
    ├── config.py             # env vars, timezone, tabela SCHEDULE, modelos do LLM
    ├── storage.py            # load()/save() dos JSON em data/ + defaults
    ├── llm.py                # cliente do LLM (Groq/OpenRouter via SDK openai) + fallback
    ├── prompts.py            # PERSONA + system prompt de cada função
    ├── jobs.py               # as 7 funções diárias
    ├── weekly.py             # funções de domingo
    └── handlers.py           # comandos (/start, /hoje, /jasei, ...) e roteamento de respostas
```

### Como os arquivos conversam

- `main.py` monta o `Application` do `python-telegram-bot`, registra handlers de `handlers.py` e agenda `jobs.py`/`weekly.py` via `job_queue.run_daily`.
- Todo job lê o `chat_id` de `data/progress.json` (gravado no `/start`). Se não houver `chat_id`, o job é ignorado.
- Jobs e handlers chamam `llm.generate(...)` / `llm.generate_json(...)`. Chamada de rede é feita em thread (`asyncio.to_thread`) para não travar o bot.
- Interações que esperam resposta (quiz, review, captura de conteúdo) gravam `progress["pending"]`; `handlers.on_text` roteia a próxima mensagem de texto conforme `pending["type"]`. Sem `pending`, a mensagem vira conversa livre com a treinadora.

---

## 4. Comandos do bot

| Comando      | Ação |
|--------------|------|
| `/start`     | Registra o `chat_id` e manda boas-vindas. **Precisa ser rodado uma vez** para os agendamentos funcionarem. |
| `/recomecar` | Refaz o onboarding (4 perguntas) e gera uma trilha nova. Pede `sim` pra confirmar. Mantém streak, evolução e conteúdo. Também acionável pelo painel (Ajustes → Trilha → "Recomeçar trilha"). |
| `/pausar`    | Pausa **todos** os lembretes sem quebrar o streak (`status='paused'`, tira os jobs do JobQueue). Trilha e streak ficam congelados. |
| `/voltar`    | Sai da pausa (`status='active'`, re-agenda tudo). |
| `/hoje`      | Dispara o guia do dia sob demanda. |
| `/jasei`     | Marca o tópico atual como dominado e pula para o próximo. |
| `/skip`      | Pula para o próximo dia sem marcar como dominado. |
| `/plano`     | Mostra a trilha e onde ela está. |
| `/status`    | Streak, dia atual, nº de registros. |
| `/conteudo`  | Abre a captura de ideia de conteúdo manualmente. |
| texto livre  | Se não houver interação pendente, conversa com a treinadora. |

---

## 5. Configuração / segredos

`.env` (ver `.env.example`):

```
TELEGRAM_TOKEN=...            # do BotFather
LLM_PROVIDER=gemini,cerebras,groq,sambanova,mistral,github,openrouter   # ordem = prioridade
GEMINI_API_KEY=...            # https://aistudio.google.com/apikey
GROQ_API_KEY=...              # https://console.groq.com/keys
CEREBRAS_API_KEY=...          # https://cloud.cerebras.ai
SAMBANOVA_API_KEY=...         # https://cloud.sambanova.ai
MISTRAL_API_KEY=...           # https://console.mistral.ai
GITHUB_MODELS_TOKEN=...       # PAT github, escopo models:read
OPENROUTER_API_KEY=...        # https://openrouter.ai/keys
LLM_MODEL=                    # legado — sobrescreve o modelo só do 1º provedor
GEMINI_MODEL= / GROQ_MODEL= / ...  # opcional, modelo por provedor
TZ=America/Sao_Paulo
```

**Cadeia de LLM** (`bot/config.py::_PROVIDER_SPECS`, espelhada em `web/src/lib/coach-llm.ts` e `landing/src/lib/llm.ts`): provedores OpenAI-compat. Só entram na cadeia os que têm key; a ordem vem de `LLM_PROVIDER`. Se o 1º estoura rate limit / cai, `llm.py` passa pro próximo (concorrência e cooldown por-provedor). Adicionar provedor = 1 linha em `_PROVIDER_SPECS` (base_url + env da key) + a key no `.env`.
**Cadeia ativa (2026-09-02, testada ponta a ponta na VM):** `LLM_PROVIDER=groq,mistral,gemini,openrouter` (mais capaz primeiro). Groq → `openai/gpt-oss-120b` (reasoning_effort=low, primário, melhor resposta nos testes) · Mistral → `mistral-small-latest` · Gemini → `gemini-flash-lite-latest`.
**OpenRouter:** key configurada, mas a conta da Fernanda **sem crédito** → todo modelo `:free` devolve 404 ("unavailable for free" / "no endpoints"). Fica no fim da cadeia como degrau extra antes do pool local; vira útil quando ela puser US$10 de crédito vitalício (destrava DeepSeek V3, Llama 3.3 70B etc). `config.py` força `:free` no modelo do openrouter.
Fora da cadeia (specs mantidos p/ religar): **Cerebras** e **SambaNova** passaram a exigir billing (402 em key nova); **GitHub Models** em retirement brownout (410).
Obs.: a conta Groq só expõe alguns modelos (sem Llama 3.3/4). Nomes datados do Gemini (`gemini-2.5-flash`, `-pro`) dão 404/429 em key nova — usar `gemini-flash-lite-latest`.

Se o LLM falhar, `llm.py` usa um fallback local (pool de frases) para o bot nunca ficar mudo.

**Observabilidade (superadmin):**
- `/admin/consumo` — tokens/chamadas/fallback/429 por dia, usuário, provedor e tag (tabela `llm_usage`). Tem também a seção **"Limites das chaves"**: por provedor da cadeia, quão perto está de estourar o rate limit do free tier. Usa os headers `x-ratelimit-*` quando o provedor manda (Groq/Cerebras/OpenRouter) e, quando não manda (Gemini), estima pelo uso das últimas 24h contra `web/src/lib/llm-limits.ts` / `bot/llm_limits.py` (limites **aproximados** — ajustar lá). O bot grava `events(kind='llm:near_limit:<provider>')` quando cruza 80% (job `_limits_tick`, no máx 1/provedor/hora).
- `/admin/servidor` — saúde da VM Oracle (CPU load, RAM/swap, disco, serviços systemd + `arist-pg`, tamanho do Postgres, último backup, uptime do bot). Tabela `system_vitals` (1 linha, upsert), alimentada pelo job `_vitals_tick` a cada 60s (`bot/vitals.py`).

---

## 6. Rodar

Local:

```
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env   # e preencher
python -m src.main
```

Depois, no Telegram, mandar `/start` para o bot.

### Deploy — Oracle Cloud (Always Free) — JÁ FEITO

**Onde roda:** VM `aristotelia` na Oracle Cloud, região `sa-saopaulo-1`.
- Shape **`VM.Standard.E2.1.Micro`** (1 OCPU, 1 GB RAM) — **Always Free**, custo **US$0**.
- Ubuntu 22.04. IP público: **`147.15.46.51`**. Swap de 1 GB ativo.
- Rede: VCN `aristotelia-vcn` / subnet `arist-subnet`, security list libera só SSH (22) de entrada.
- **Nunca clicar em "Upgrade to Pay As You Go"** no painel Oracle — é o que quebraria a garantia de custo zero.

**Serviço:** `systemd` unit `aristotelia.service` (`Restart=always`, `enable`d → sobe no boot).
Roda `/home/ubuntu/aristotelia/.venv/bin/python -m bot.main` em `/home/ubuntu/aristotelia` (Python 3.10).
O painel web é outro serviço: `aristotelia-web.service` (Node 20, `~/aristotelia-web`), deploy via `bash scripts/deploy-web.sh`.

**Acesso SSH** (chave privada em `C:\Users\DELL\.ssh\aristotelia_oracle`):

```powershell
ssh -i $env:USERPROFILE\.ssh\aristotelia_oracle ubuntu@147.15.46.51
```

**Comandos no VM:**

```bash
sudo systemctl status aristotelia
sudo journalctl -u aristotelia -f -o cat        # logs ao vivo
sudo systemctl restart aristotelia
```

**Redeploy do bot depois de mudar código** (raiz do projeto local, Git Bash) — envia só `bot/`, `db/` e `requirements.txt` (NÃO `tar .` — puxaria o `web/` inteiro):

```bash
tar czf - --exclude='__pycache__' bot db requirements.txt \
| ssh -i ~/.ssh/aristotelia_oracle ubuntu@147.15.46.51 \
  'tar xzf - -C ~/aristotelia && ~/aristotelia/.venv/bin/pip install -q -r ~/aristotelia/requirements.txt && sudo systemctl restart aristotelia && sleep 3 && systemctl is-active aristotelia'
```

O `.env` e o estado ficam só no VM (Postgres em Docker `arist-pg`) — o tar acima não toca neles.

**Backup do Postgres:** `aristotelia-backup.timer` (systemd, diário 03:30) roda `scripts/backup-db.sh` — `pg_dump` gzipado em `~/backups/` (mantém 14) + PUT opcional numa URL pré-assinada (`BACKUP_UPLOAD_URL` no `.env`) pra sair da VM. Ver `scripts/systemd/README.md`. Restore: `gzip -dc ~/backups/aristotelia-<data>.sql.gz | docker exec -i arist-pg psql -U arist -d aristotelia`.

**O `.env` no VM** está em `/home/ubuntu/aristotelia/.env` (mesmo conteúdo do local).

Fly.io foi usado no dia 30/08 e **descartado** (trial sem cartão = 5 min; conta nova = ~US$2/mês). App `aristotelia-bot` já destruído; revogar o org token `aristotelia-deploy` no painel do Fly se quiser.

---

## 7. Trilha de aprendizagem

`data/learning_plan.json`:

- `current` = `{ "week": N, "day": D }` — onde ela está.
- `weeks[]` = lista de semanas, cada uma com `theme` e `days[]` (`{ "d", "topic", "goal" }`).
- `known_topics[]` — tópicos que ela marcou com `/jasei`; o guia do dia pula esses.

Editar à mão é seguro. `advance_week` (domingo) incrementa `current.week`; `daily_learning_guide` incrementa `current.day` (1→5) a cada dia útil.

---

## 8. Decisões tomadas (resumo — detalhe em Memória.md)

- Stack Python (não Node) — ecossistema de IA mais direto; `python-telegram-bot` já traz agendador.
- LLM **grátis** (Groq/OpenRouter) — sem API paga. Interface via SDK `openai` (compatível com os dois).
- Persistência em JSON — suficiente para 1 usuária; migrar para SQLite só se necessário.
- Agendamento via `job_queue` do PTB — evita dependência extra.
- Jobs semanais são agendados todo dia e checam `weekday()` internamente (evita ambiguidade do parâmetro `days`).
- **Hospedagem: Oracle Cloud Always Free** (não Fly). Motivo: conta Free Tier da Oracle não pode ser cobrada enquanto não sofrer upgrade pra PAYG — garantia de custo zero, que era prioridade da Fernanda. Fly custaria ~US$2/mês.
- Modelo Groq: a conta só libera `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`, `groq/compound`, `allam-2-7b`. Usando `gpt-oss-120b` com `reasoning_effort=low`.

---

## 9. Pendências / próximos passos

**Backlog completo, priorizado e com IDs estáveis: `Backlog.md` na raiz.** É a fonte de verdade das tarefas em aberto — consolida o Raio-X (F01–F24), a fila da `Memória.md` e as pendências antigas daqui.

Estado atual (2026-09-02): Fase 1+2 no ar (multiusuário, painel, lembretes, push, trilha adaptativa, landing na Vercel). Os 4 críticos do Raio-X resolvidos. Cadeia de LLM real = `groq,gemini,mistral`. Foco: confiabilidade (P0: domínio próprio, backup off-site) + preparar a validação de 20–30 pessoas (P1). Cobrança adiada.
