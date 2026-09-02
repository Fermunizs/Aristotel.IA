# Backlog.md — AristotelIA

> **Fonte única de verdade das tarefas em aberto.** Consolida o Raio-X (F01–F24), a fila da `Memória.md` e as pendências do `CLAUDE.md §9`.
> Toda sessão: pegar o item de maior prioridade ainda aberto, fazer, mover pra "Feito" com a data e o commit.
> IDs `B##` são estáveis — não renumerar. Referências `F##` apontam pro Raio-X (artifact `33f47653`).

**Última revisão:** 2026-09-02 (B05, B06, B07, B22, B23 feitos e deployados)
**Foco atual (decidido com a Fernanda):** convidar mais gente + confiabilidade do que está no ar.
**Próximo:** ações da Fernanda (domínio, Kiwify, Vercel) · P2 B09/B10/B11.

| Prioridade | Significado |
|---|---|
| **P0** | Confiabilidade do que já está no ar. Fazer antes de qualquer feature. |
| **P1** | Pré-requisito pra convidar mais gente (a validação de 20–30 pessoas). |
| **P2** | Qualidade e custo — durante a validação, sem bloquear. |
| **P3** | Evoluir quando o núcleo segurar. |
| **P4** | Cobrança — adiado até ≥3 métricas de `Produto.md §8` no verde. |

Esforço: **P** pequeno (<½ dia) · **M** médio (1–2 dias) · **G** grande (semana+).

---

## P0 — Confiabilidade (fazer já)

### B01 · Domínio próprio + túnel nomeado — `M` — refs F05
Hoje o painel roda num Cloudflare **quick tunnel** (`*.trycloudflare.com`): a URL **muda sozinha** quando o serviço reinicia. Isso quebra (a) o `WEB_URL` que o bot manda nos links, (b) o service worker / push do PWA (origin muda → subscription morre). Um `arist-url-sync.timer` remenda o `WEB_URL` a cada 2 min, mas é gambiarra.
**Fazer:** registrar um domínio (ou subdomínio) → Cloudflare **named tunnel** (`cloudflared tunnel create` + credenciais fixas + rota DNS) → `WEB_URL` fixo no `.env` e no `web.env` → aposentar o `arist-url-sync.timer`. Conferir manifest/SW do PWA na origin nova.
**Depende de:** Fernanda escolher/registrar o domínio.

### B02 · Backup off-site do Postgres — `P` — refs F02
O `aristotelia-backup.timer` roda diário e gzipa o dump em `~/backups/` na VM — mas `BACKUP_UPLOAD_URL` está **vazio**. Se o disco/VM morrer, perde tudo. O `scripts/backup-db.sh` já suporta PUT numa URL pré-assinada.
**Fazer:** Fernanda cria um bucket no Oracle Object Storage + PAR (pre-authenticated request, ~3 min, guia em `scripts/systemd/README.md`) → colar em `BACKUP_UPLOAD_URL` no `.env` → rodar o script manual 1x pra confirmar que sobe.
**Depende de:** Fernanda (bucket + PAR).

### B03 · Faxina de repositório e docs — `P`
- Apagar a branch `master` (é só o commit da Fase 0, já superado por `main`).
- `CLAUDE.md §9` está desatualizado (fala de deploy do Fly, `/start` pendente, "popular learning_plan") → substituir por um ponteiro pra este `Backlog.md`.
- Confirmar que `fase-1` já foi mergeada e pode sumir.

---

## P1 — Antes de convidar mais gente

### B04 · Chaves de fallback de LLM na Vercel — `P` — (parte já feita 2026-09-02)
A cadeia `groq,mistral,gemini,openrouter` já está ativa e testada **na VM** (bot + painel). Falta só a **landing na Vercel** → Settings → Environment Variables → redeploy:
```
GEMINI_API_KEY=<a chave>
MISTRAL_API_KEY=<a chave>
OPENROUTER_API_KEY=<a chave>
LLM_PROVIDER=groq,mistral,gemini,openrouter
GEMINI_MODEL=gemini-flash-lite-latest
```
Sem isso o widget "monte metade da trilha" só tem o Groq de rede.
**Depende de:** Fernanda (Vercel). Rotacionar as keys depois (passaram pelo chat).
**OpenRouter:** hoje a conta está **sem crédito** → todo modelo `:free` dá 404. US$10 de crédito vitalício destrava DeepSeek V3 / Llama 3.3 70B etc. Enquanto isso o openrouter no fim da cadeia é inofensivo (só um degrau antes do pool local).

### ~~B05 · Onboarding à prova de bala~~ — FEITO 2026-09-02 (commit `ea8fd72`) — refs F13
Trava de geração (`step='building'` → não regera), `_stub_week` pra semana parcial, `_retry_job` automático (até 3x), `get_or_create_user` com `ON CONFLICT`, boas-vindas não repete. `scripts/check_onboarding.py` cobre a degradação. Deployado.
**Ainda vale:** teste ponta-a-ponta de um usuário novo de verdade (a Fernanda pode pedir pra alguém entrar e observar).

### ~~B06 · Instrumentação de retenção~~ — FEITO 2026-09-02 (commit `ae78316`) — refs F06
`/admin/retencao` (superadmin): D1/D7/D30, funil da trilha (chega na semana 2), tarefa concluída/dia (14d), lista de "sumiram" (ativos sem engajamento 3+ dias). `retencao()` em `queries.ts`. Cores vs. os alvos do `Produto.md §8`.

### ~~B07 · Telas de erro no painel + build trava em erro de tipo~~ — FEITO 2026-09-02 (commit `74e5ba6`) — refs F14
`error.tsx` / `global-error.tsx` / `not-found.tsx` com a identidade. `deploy-web.sh` agora roda `tsc --noEmit` e aborta se falhar (o `ignoreBuildErrors` continua por causa do segfault do worker no Node 24/Win, mas a checagem virou obrigatória no deploy).

### B08 · Confirmar quiet hours + /pausar no uso real — `P` — refs F07, F08
Os dois foram implementados e deployados (2026-09-01) mas nunca confirmados por uso real. Checar: lembrete dentro da janela de silêncio não dispara; `/pausar` tira todos os jobs e `/voltar` re-agenda; streak não quebra na pausa. **Ação da Fernanda** (uso real) ou um teste dirigido.

---

## P2 — Qualidade e custo (durante a validação)

### B09 · Persona enxuta pros jobs de broadcast — `P` — refs F09
O system prompt carrega ~1,2 k tokens de persona em **toda** chamada. Conteúdo compartilhado (motivação) já ameniza. Fazer versão curta da persona pros jobs genéricos; manter a completa na conversa livre e nas tarefas guiadas.

### B10 · N+1 e queries sequenciais no painel — `P` — refs F12
Dashboard faz várias queries em série + N+1 em algumas listas. Paralelizar (`Promise.all`) e juntar as N+1 num `JOIN`/`IN`. Só relevante quando o painel tiver uso real de várias pessoas.

### B11 · Calibrar limites reais de free tier — `P`
`bot/llm_limits.py` e `web/src/lib/llm-limits.ts` têm `PROVIDER_LIMITS` **chutados da doc**. Agora que a cadeia é `groq,gemini,mistral`, medir os limites reais (rpm/rpd/tpm/tpd) de cada um e ajustar — senão o aviso de "quase-limite" em `/admin/consumo` mente.

### B12 · Higiene de dados que cresce sem prune — `P` — refs F22
`events` cresce sem partição/limpeza (~15 linhas/usuário/dia — a tabela que mais cresce; ok por 1+ ano, ~1,6 M linhas/ano a 300 usuários). `auth_codes`/`web_sessions`/`outbox`/`content_cache`/`llm_usage` já têm prune no `_cleanup_tick` diário. Quando `events` incomodar: partição por mês OU job que apaga `msg:*` (mensagens que o bot mandou) com >90 dias, mantendo os de engajamento.
**Auditoria de integridade feita 2026-09-02 (B22):** ver "Feito". Isolamento entre usuários = OK (FK `user_id` + toda query com escopo, verificado nas ~40 funções do bot e nas 15 rotas de API do painel).

### B22 · Guardar a estrutura mutável da trilha fora do JSONB `weeks` — `M` — refs F22
O detalhamento por dia (`detail`: checklist, entrega, dica) é cacheado DENTRO de `learning_plans.weeks` — cada toggle de item reescreve o blob inteiro da trilha e tem janela de corrida se a pessoa abre 2 abas. Funciona hoje; quando a trilha ficar longa ou entrar multi-trilha (B18), mover pra uma tabela `plan_day_detail (plan_id, week, day, detail jsonb, checklist_state jsonb)`.

---

## P3 — Evoluir (quando o núcleo segurar)

### B13 · Chave de LLM por usuário — `M` — refs F17
Cada pessoa cola a própria chave grátis (Groq/Gemini) → escala linear, 100% grátis, sem gargalo de pico compartilhado. Bom quando passar de ~30 pessoas.

### B14 · Tarefa mais importante do dia (1-3-5) — `M` — refs F20
Além da tarefa da trilha, deixar a pessoa marcar "a coisa mais importante de hoje". Padrão 1-3-5. Encaixa no dashboard e no check da noite.

### B15 · Fechar o loop formação → conteúdo — `M` — refs F21
É o headline dos planos pagos e hoje não fecha: o `content_capture` coleta ideias, mas não vira peça pronta (carrossel/reel/thread com copy). `content_planner` de domingo sugere 3, mas solto.

### B16 · Job-registry vira um tick único — `M` — refs F23
Hoje é 1 job persistente no APScheduler por lembrete por usuário (N×~10). Tranquilo até centenas de usuários; depois, trocar por 1 job "tick" que varre quem tem lembrete na janela.

### B17 · Integração de calendário — `G` — spec+plano prontos
`docs/superpowers/specs/2026-09-01-integracao-calendario-design.md` + plano de 12 tasks TDD. OAuth Google + Microsoft, evento recorrente por lembrete, timer de sync, lembrete multi-canal.
**Depende de:** Fernanda criar projeto Google Cloud + registro Azure (passo a passo no spec §9).

### B18 · Multi-trilha — `G`
Sábio: 3 trilhas, Mestre: 6. Modelo de dias-da-semana por trilha. Precisa migration (`learning_plans` deixa de ser 1-ativo-por-user) + UI.

### B21 · Postgres nativo em vez de Docker — `M`
Hoje o Postgres roda num container (`arist-pg`); `dockerd` + `containerd` custam ~72 MB de RAM só pra servir 1 container. Migrar pra Postgres nativo (apt) liberaria isso. Risco: migração do volume `arist_pgdata` + ajustar `scripts/backup-db.sh` (que usa `docker exec`) e `bot/vitals.py` (que usa `docker inspect`). Só vale se a RAM apertar de novo — a otimização de 2026-09-02 já deu folga (356/956 usados, 3 GB de swap).

### B19 · Higiene de schema + robustez de infra — `M` — refs F22, F24
`push_history` já virou append atômico (F16 feito). Falta: processo único / VM única (F24) — aceitar o risco por ora, mas ter o restore documentado e testado (tem em `CLAUDE.md §6`). Revisar `pop_outbox` sem `FOR UPDATE SKIP LOCKED` se aparecer 2º consumidor.

---

## P4 — Cobrança

### B20 · Renomear planos + enforcement completo — `M` — refs Memória 2026-09-01
O **webhook do Kiwify já foi feito** (B23, casa por e-mail → `users.plan`). Falta: renomear o enum (`free/pro/unlimited` → `aprendiz/sabio/mestre`) + migration + revisar os mapas de `LIMIT` por tier. As features pagas em si (multi-trilha, pipeline de conteúdo, boletim) são B13/B15/B17 e não existem — não há o que gatear até elas existirem. Ligar cobrança de verdade quando ≥3 métricas de `Produto.md §8` no verde.

### B24 · Google OAuth (fase 2 do acesso web) — `M`
"Entrar com Google" por cima do link pessoal — tira o risco do bearer pra quem quiser. Precisa: projeto Google Cloud (consent screen + credencial Web) + `GOOGLE_CLIENT_ID/SECRET` + redirect URI estável (→ domínio, B01). Coluna `users.google_sub` já existe (migration 0014).

### B25 · Quiz/desafio interativo pra usuário só-push — `P`
Hoje o quiz/desafio/review manda a notificação mas o `pending` só é consumido por mensagem de Telegram. Usuário só-painel recebe mas não responde fácil. Precisa de uma tela no painel pra responder o quiz do dia (ou tratar como só-leitura + registrar via checklist).

---

## Ações da Fernanda (não-código)

| # | Ação | Desbloqueia |
|---|---|---|
| 1 | Escolher/registrar um domínio (~R$40/ano) | B01, B24, backup off-site |
| 2 | Bucket Oracle Object Storage + PAR → `BACKUP_UPLOAD_URL` | B02 |
| 3 | Keys de LLM na Vercel (landing) + `NEXT_PUBLIC_PANEL_URL` + redeploy | B04, B23 (LP) |
| 4 | Rotacionar as keys de LLM que passaram pelo chat | — |
| 5 | Kiwify: configurar webhook (`${PANEL}/api/webhook/kiwify` + token) + `NEXT_PUBLIC_KIWIFY_SABIO/MESTRE` na Vercel + `KIWIFY_WEBHOOK_TOKEN`/`KIWIFY_PRODUCT_*` no `web.env` da VM | B23 (cobrança) |
| 6 | (quando for fazer B24/B17) projeto Google Cloud + registro Azure | B24, B17 |

---

## Feito (arquivo)

| Ref | O quê | Quando |
|---|---|---|
| F01 | Rate limit no login (código 6 díg + senha admin) | 2026-09-01 |
| F02 (parcial) | Backup diário local do Postgres (falta off-site → B02) | 2026-09-01 |
| F03 | Uso atômico do código de login (`UPDATE … WHERE used_at IS NULL RETURNING`) | 2026-09-01 |
| F04 | Teto de 40 msg/dia de conversa livre (bot + painel) | 2026-09-01 |
| F07 | Quiet hours respeitado no scheduling (`_in_quiet`) | 2026-09-01 |
| F08 | `/pausar` + `/voltar` sem quebrar streak | 2026-09-01 |
| F10 | Dashboard de consumo de LLM (`/admin/consumo`, tabela `llm_usage`) | 2026-09-01 |
| F11 | Guardas de admin centralizadas (`web/src/lib/guards.ts`) | 2026-09-01 |
| F15 | Pomodoro sobrevive a refresh (localStorage) | 2026-09-01 |
| F16 | `push_history` virou append atômico em SQL | 2026-09-01 |
| F18 | Trilha adaptativa (erra quiz → fila de revisão, `0011`) | 2026-09-01 |
| F19 | Landing page standalone na Vercel + widget da trilha | 2026-09-01 |
| — | Lote D: aviso de quase-limite das keys + `/admin/servidor` (`0012`) | 2026-09-01 |
| — | Cadeia de LLM real `groq,gemini,mistral` testada na VM (`6e7a2e2`) | 2026-09-02 |
| B05 | Onboarding à prova de bala (trava de geração + retry + semana parcial, `ea8fd72`) | 2026-09-02 |
| B06 | Página de retenção `/admin/retencao` (`ae78316`) | 2026-09-02 |
| B07 | Telas de erro + gate de tipos no deploy (`74e5ba6`) | 2026-09-02 |
| — | OpenRouter na cadeia + ordem por capacidade + `:free` forçado (`056b48f`) | 2026-09-02 |
| — | Otimização de RAM da VM: swap 3 GB, fwupd/multipathd off, caps de heap/malloc, PG max_conn 25 (−65 MB, swap 288→65) | 2026-09-02 |
| B22 | Auditoria de integridade do banco + migration `0013` (índice único 1-trilha-ativa, dedup de tarefa, backfill de linhas-filhas, `create_plan` transacional). Isolamento entre usuários verificado OK. (`fd504aa`) | 2026-09-02 |
| B23 | **Acesso sem Telegram** — migration `0014`, cadastro web (nome+email) + link pessoal (token 256 bits, troca por cookie), onboarding no painel (`/onboarding` + `trilha-build.ts`), bot agenda usuários só-push, webhook Kiwify (`/api/webhook/kiwify`, casa por e-mail), LP atualizada. Testado ponta a ponta em produção. (`ea82439`, `abc310d`) | 2026-09-02 |
