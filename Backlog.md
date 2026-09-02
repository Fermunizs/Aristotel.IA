# Backlog.md — AristotelIA

> **Fonte única de verdade das tarefas em aberto.** Consolida o Raio-X (F01–F24), a fila da `Memória.md` e as pendências do `CLAUDE.md §9`.
> Toda sessão: pegar o item de maior prioridade ainda aberto, fazer, mover pra "Feito" com a data e o commit.
> IDs `B##` são estáveis — não renumerar. Referências `F##` apontam pro Raio-X (artifact `33f47653`).

**Última revisão:** 2026-09-02
**Foco atual (decidido com a Fernanda):** convidar mais gente + confiabilidade do que está no ar. **Cobrança está adiada** (P4).

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
A cadeia `groq,gemini,mistral` já está ativa e testada **na VM** (bot + painel). Falta só a **landing na Vercel**: `GEMINI_API_KEY`, `MISTRAL_API_KEY`, `LLM_PROVIDER=groq,gemini,mistral`, `GEMINI_MODEL=gemini-flash-lite-latest` em Settings → Environment Variables → redeploy.
Sem isso o widget "monte metade da trilha" só tem o Groq de rede.
**Depende de:** Fernanda (Vercel). Rotacionar as keys depois (passaram pelo chat).

### B05 · Onboarding à prova de bala — `M` — refs F13
Duas vezes na vida real (namorado da Fernanda) o onboarding quebrou no meio: `_finish` abortava depois de gerar a trilha → usuário `status='onboarding'`, 0 lembretes, `pending` travado, e **cada mensagem seguinte regerava a trilha** (planos duplicados). `_finish` já ficou idempotente, mas a geração semana-a-semana ainda pode falhar no meio e deixar trilha parcial.
**Fazer:** (a) transação/checkpoint na geração da trilha — semana que falha não deixa plano meio-pronto ativo; (b) teste ponta-a-ponta de um usuário **novo de verdade** (nunca foi feito sem bug — a Fernanda e o namorado entraram por backfill/recuperação manual); (c) tela/mensagem clara de "deu ruim, manda /recomecar" em vez de loop silencioso.

### B06 · Instrumentação de retenção — `M` — refs F06
Zero medição hoje. `Produto.md §8` define as métricas-alvo (D1/D7/D30, % tarefa concluída/dia, % que chega na semana 2, "pagaria?") mas nada calcula isso. Sem isso a validação de 30 dias não mede nada.
**Fazer:** view/consulta de coorte a partir de `events` + `tasks` + `streaks` → página `/admin/retencao` (ou seção em `/admin`): retenção por coorte de signup, tarefa/dia, funil da trilha. Reusar o padrão de `/admin/consumo`.

### B07 · Telas de erro no painel + build trava em erro de tipo — `P` — refs F14
`next.config` tem `typescript.ignoreBuildErrors` (posto pra contornar segfault do worker de tipos em Node 24/Win). O `tsc --noEmit` roda à parte, mas o build não protege. E não há `error.tsx` / `not-found.tsx` — erro de runtime no painel = tela branca.
**Fazer:** `error.tsx` + `global-error.tsx` + `not-found.tsx` com a identidade visual; investigar se dá pra tirar o `ignoreBuildErrors` (talvez só precise Node 20 no build, que o `deploy-web.sh` já usa).

### B08 · Confirmar quiet hours + /pausar no uso real — `P` — refs F07, F08
Os dois foram implementados e deployados (2026-09-01) mas nunca confirmados por uso real. Checar: lembrete dentro da janela de silêncio não dispara; `/pausar` tira todos os jobs e `/voltar` re-agenda; streak não quebra na pausa.

---

## P2 — Qualidade e custo (durante a validação)

### B09 · Persona enxuta pros jobs de broadcast — `P` — refs F09
O system prompt carrega ~1,2 k tokens de persona em **toda** chamada. Conteúdo compartilhado (motivação) já ameniza. Fazer versão curta da persona pros jobs genéricos; manter a completa na conversa livre e nas tarefas guiadas.

### B10 · N+1 e queries sequenciais no painel — `P` — refs F12
Dashboard faz várias queries em série + N+1 em algumas listas. Paralelizar (`Promise.all`) e juntar as N+1 num `JOIN`/`IN`. Só relevante quando o painel tiver uso real de várias pessoas.

### B11 · Calibrar limites reais de free tier — `P`
`bot/llm_limits.py` e `web/src/lib/llm-limits.ts` têm `PROVIDER_LIMITS` **chutados da doc**. Agora que a cadeia é `groq,gemini,mistral`, medir os limites reais (rpm/rpd/tpm/tpd) de cada um e ajustar — senão o aviso de "quase-limite" em `/admin/consumo` mente.

### B12 · Higiene de dados que cresce sem prune — `P` — refs F22
`events` cresce sem partição/limpeza (ok por ~1 ano). `auth_codes`/`web_sessions` expirados: o `_cleanup_tick` diário já cobre parte. Revisar o que falta e documentar o horizonte.

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

### B19 · Higiene de schema + robustez de infra — `M` — refs F22, F24
`push_history` já virou append atômico (F16 feito). Falta: processo único / VM única (F24) — aceitar o risco por ora, mas ter o restore documentado e testado (tem em `CLAUDE.md §6`). Revisar `pop_outbox` sem `FOR UPDATE SKIP LOCKED` se aparecer 2º consumidor.

---

## P4 — Cobrança (adiado)

### B20 · Planos + enforcement + webhook Kiwify — `G` — refs Memória 2026-09-01
A landing já mostra Kiwify, mas o banco é `plan ∈ {free, pro, unlimited}` e os planos decididos são **Aprendiz / Sábio / Mestre / Turma**. Falta: migration do enum + mapa de `LIMIT` por tier + webhook de pagamento Kiwify → seta `users.plan` + enforcement real dos limites. Só ligar quando ≥3 métricas de `Produto.md §8` no verde.

---

## Ações da Fernanda (não-código)

| # | Ação | Desbloqueia |
|---|---|---|
| 1 | Escolher/registrar um domínio | B01 |
| 2 | Bucket Oracle Object Storage + PAR → `BACKUP_UPLOAD_URL` | B02 |
| 3 | Keys de LLM na Vercel (landing) + redeploy | B04 |
| 4 | Rotacionar as keys de LLM que passaram pelo chat | — |
| 5 | (quando for fazer B17) projeto Google Cloud + registro Azure | B17 |

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
| — | Cadeia de LLM real `groq,gemini,mistral` testada na VM (commit `6e7a2e2`) | 2026-09-02 |
