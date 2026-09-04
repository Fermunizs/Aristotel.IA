# Spec — Gamificação: XP + níveis (estágios de domínio)

**Data:** 2026-09-04
**Backlog:** novo — realiza `Produto.md §6.5` ("[v2] Skill tree com XP e níveis (gamificação sóbria)"), parte de "atratividade / vontade de assinar".
**Decidido com a Fernanda:**
- Objetivo: **sensação de domínio crescendo** + **algo pra ter orgulho / mostrar**.
- Forma: **XP + níveis**, enquadrados como **estágios** (título que muda, não só número).
- Onde: **painel + bot**.
- Guardar XP: **derivado da tabela `events`** (abordagem A) — sem migration.
- Estética: caderno de campo, sóbria. **Sem** confete, moedas, ou ranking público (isso é "depois").

---

## 1. Problema

O sistema já mede progresso (streak, totais, gráfico de 14 dias, árvore, a tela Trilha), mas nada disso dá **um número que sobe** nem um **marco de identidade** ("virei nível 5", "sou 'Consistente' agora"). Falta o laço de progressão de longo prazo que faz a pessoa querer voltar amanhã e ter o que mostrar.

## 2. Não-objetivos (v1)

- Mapa de domínio por área da trilha (estende `LearningTree`) → **v2**.
- Cartão de progresso exportado como **imagem PNG** → v2. (v1: uma seção bem desenhada que a pessoa printa.)
- Missões / desafios semanais → v2.
- Temporada, ranking de turma, XP como feature paga → depois (Fase 3).
- Bônus de "semana 100%" e "trilha concluída" → v2 (exigem derivar de `tasks`/estado do plano; deixam v1 mais arriscado).
- Migration / storage de XP. v1 é **100% derivado + aditivo**.

## 3. Modelo

### 3.1 XP é uma função pura de `events`

Nenhum XP é gravado. `xp_total(user) = Σ pontos(evento) + bônus_dias_engajados`, calculado on-read.

**Mapa evento → pontos** (`bot/xp.py::POINTS`, espelhado em `web/src/lib/xp.ts`):

| `events.kind` | Pontos | Observação |
|---|---|---|
| `quiz` | 15 se `payload.resultado == "acerto"`, senão 5 | errar ainda conta (tentou) |
| `quiz_reforco` | 10 | |
| `desafio` | 30 | |
| `review` | 20 | fechamento da noite — a keystone |
| `foco` | `min(payload.minutos, 30)` | 1 XP/min, teto 30 por sessão |
| `jasei` | 0 | não premia pular |
| `skip` | 0 | |
| `msg:*` | 0 | mensagens que o bot manda não são conquista |
| `xp:levelup` | 0 | evento de controle (ver 3.3) |

**Tetos diários por categoria** (anti-farm), aplicados agrupando os eventos por `(day, kind)` antes de somar:
- `quiz`, `quiz_reforco`, `desafio`, `review`: conta **1 por dia** cada. Se houver 2+ no mesmo dia (painel deixou repetir), vale o de maior pontuação (ex.: `quiz` acerto > erro).
- `foco`: contam as **2 maiores sessões** do dia (teto 30 cada → 60 XP/dia).
- `xp:levelup`, `msg:*`, `jasei`, `skip`: 0, sem teto a aplicar.

**Bônus de dia engajado:** `+10` por dia distinto com pelo menos um evento em
`('quiz','quiz_reforco','review','desafio','foco')`. (Mesma definição de "dia engajado" de `queries.ts`.) Captura quem mantém a constância, inclusive usuário só-painel.

Estimativa: dia completo ≈ 15 (quiz) + 10 (reforço) + 30 (desafio) + 20 (review) + 15 (foco) + 10 (dia) ≈ **100 XP/dia**.

### 3.2 Curva de nível

`xp_para_chegar(L) = 50 · (L−1) · L` → 0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, …
(cada nível pede 100 XP a mais que o anterior).

`level_for_xp(xp)` = maior `L` com `50·(L−1)·L ≤ xp`. Função pura, idêntica nos dois idiomas.

Ritmo: ~1 nível/semana no começo (com constância), desacelerando. Combina com "domínio crescendo" — sem grind, sem estagnar.

### 3.3 Estágios (títulos) — **rascunho, refinar no design review**

Título muda a cada 3 níveis. Tema peripatético / caminho (`Design.md §Conceito`). Draft:

| Níveis | Estágio |
|---|---|
| 1–2 | Começando |
| 3–4 | Na trilha |
| 5–6 | Em ritmo |
| 7–9 | Consistente |
| 10–12 | Aprofundando |
| 13–15 | Praticante |
| 16–19 | Dominando |
| 20+ | Referência |

`stage_for_level(L) -> str`. **Design.md §Voz/PARTE 1** é dono do texto final (não pode colidir com os nomes de plano: Aprendiz/Sábio/Mestre — por isso "Começando", não "Aprendiz").

### 3.4 Anunciar a subida de nível (sem storage novo)

O "já parabenizei por este nível" é o **maior `payload.level` entre os eventos `kind='xp:levelup'` do usuário**.

`bot/xp.py::sync_and_maybe_announce(user_id, day) -> str | None`:
1. `xp = xp_total(user)`; `lvl = level_for_xp(xp)`.
2. `announced = max(level dos eventos xp:levelup)  (0 se nenhum)`.
3. Se `lvl > announced`: insere `log_event(user, "xp:levelup", day, {"level": lvl, "xp": xp})` e devolve a linha de anúncio (só a do nível mais alto, mesmo que tenha pulado 2). Senão devolve `None`.

Idempotente e à prova de corrida o suficiente (o `xp:levelup` fica gravado; no pior caso 2 anúncios do mesmo nível se duas ações caírem no mesmo instante — aceitável, raríssimo).

**Onde o bot chama:** logo depois de registrar o evento que fecha uma ação e **antes de mandar a resposta** — em `handlers._review`, `handlers._quiz2`, `handlers._challenge` (ramo "terminou"), e no `jobs.daily_learning_guide` (pega quem subiu por ação no painel, no máx 1 dia depois). A linha volta anexada à mensagem que já ia sair — não é mensagem extra.

**Formato da linha** (sóbrio, 1 linha, verde-trilha):
`📈 Nível 4 — Na trilha. Você tá andando.`
O fecho é determinístico: `xp.py::STAGE_LINES[estágio]` (não é LLM). Draft (refinar no `Design.md`):

| Estágio | Fecho |
|---|---|
| Começando | Começou. |
| Na trilha | Você tá andando. |
| Em ritmo | O ritmo pegou. |
| Consistente | Isso já é constância. |
| Aprofundando | Tá ficando sério. |
| Praticante | Você faz, não só estuda. |
| Dominando | Pouca gente chega aqui. |
| Referência | Agora é você que serve de exemplo. |

**Card de domingo** (`weekly.py::weekly_review`): uma linha a mais no fim — `Nível N (Estágio) · +X XP essa semana`. Calculada, não vai pro prompt do LLM.

## 4. Painel

### 4.1 `web/src/lib/xp.ts` (espelho de `bot/xp.py`)
- `POINTS`, `DAILY_CAPS`, `ENGAGED_KINDS`
- `levelForXp(xp)`, `xpToReach(L)`, `stageForLevel(L)`
- `computeProgress(userId) -> { xp, level, stage, xpInLevel, xpForNextLevel, bySource: {...}, thisWeekXp }`
  — uma query em `events` (SUM com CASE + COUNT DISTINCT day). Reaproveita o padrão de `queries.ts::evolucaoData`.

### 4.2 Home — `(app)/page.tsx`
Faixa compacta no topo (acima da checklist):
```
NÍVEL 3 · Na trilha
▓▓▓▓▓▓▓▓▓▓▓▓░░░░░  760 XP pro nível 4
```
Fraunces no número, barra com a hachura da marca (`HatchedBars` / `--growth`). Linка pra `/evolucao`.

### 4.3 Evolução — `(app)/evolucao/page.tsx`
Nova seção no topo, **desenhada pra printar** (o "cartão de progresso"):
- Nível grande (Fraunces) + estágio.
- XP total + barra pro próximo.
- Streak (já vem em `evolucaoData`) integrado no mesmo bloco.
- **XP desta semana por fonte:** quiz · desafio · foco · constância — barrinhas.
- "desde {primeira data de evento}".
- Ilustração: um marco do caminho (pedra/bandeira de `components/art`) — reusa o traço único que já existe.

Componente novo: `web/src/components/ProgressCard.tsx` (server component, recebe `computeProgress`). A faixa da home reusa um subset (`<LevelBar />`).

### 4.4 Sem novas rotas de API
Tudo server-side (`computeProgress` roda no server component). O bot não expõe XP por HTTP.

## 5. Arquivos

**Novos:**
- `bot/xp.py` — mapa, curva, estágios, `xp_total()`, `sync_and_maybe_announce()`.
- `web/src/lib/xp.ts` — espelho + `computeProgress()`.
- `web/src/components/ProgressCard.tsx` + `web/src/components/LevelBar.tsx`.

**Editados:**
- `bot/handlers.py` — `_review`, `_quiz2`, `_challenge`: anexar a linha de `sync_and_maybe_announce`.
- `bot/jobs.py` — `daily_learning_guide`: idem (rede de segurança pro usuário de painel).
- `bot/weekly.py` — `weekly_review`: linha de nível/XP no fim do card.
- `bot/db.py` — talvez um helper `events_all(user_id)` ou `xp_rows(user_id)` (SELECT enxuto: kind, payload, day) se `events_since` não servir.
- `web/src/app/(app)/page.tsx` — faixa `<LevelBar />`.
- `web/src/app/(app)/evolucao/page.tsx` — `<ProgressCard />` no topo.
- `web/src/lib/queries.ts` — se fizer sentido dobrar `computeProgress` aqui junto de `evolucaoData` (uma query só).
- `Design.md` — seção "Progressão / XP" (estágios, tom da linha de level-up, o cartão). **Dono do texto dos estágios.**
- `Produto.md §6.5` — marcar XP+níveis como feito; skill tree segue [v2].
- `Backlog.md` — linha em Feito + item novo pro v2 (mapa de domínio, card-imagem, missões).

**Migration:** nenhuma.

## 6. Riscos / decisões

- **Query em `events` a cada page-load.** ~15 linhas/dia/usuário → ~5 k/ano. SUM+CASE sobre isso é ~1 ms. `evolucaoData` já varre a mesma tabela. OK. Se um dia pesar: materializar `preferences.xp` + tick de reconcile (não agora).
- **Rebalancear o XP depois.** Como é derivado, mudar os pesos **recalcula todo o histórico** — bom (não trava em número errado), mas pode fazer alguém "descer de nível" num deploy. Mitigação: só ajustar pesos pra cima, ou avisar. Registrar isso no `Design.md`.
- **`xp:levelup` como marcador.** Se a curva mudar e alguém "subir" retroativo, o `max(level)` já anunciado evita spam pra baixo; subida retroativa gera 1 anúncio (aceitável, até positivo).
- **Usuário só-painel** não recebe o anúncio na hora (o bot é quem anuncia). Recebe via push no próximo `daily_learning_guide`, ou vê no painel na hora. Aceitável pro v1; B25 (interação do painel) é problema à parte.
- **Estética.** A linha do bot e o cartão passam pelo filtro do `Design.md` — sóbrio, verde = crescimento, sem exclamação em cascata.

## 7. Teste

- **`bot/xp.py`**: unit puro — `level_for_xp` nas bordas (0, 99, 100, 299, 300…), `xp_total` com uma lista de eventos mock incluindo tetos diários e o bônus de dia engajado.
- **`sync_and_maybe_announce`**: mock de `events` — não anuncia 2×, anuncia o nível mais alto ao pular 2, grava o `xp:levelup`.
- **`web/src/lib/xp.ts`**: os mesmos casos de borda de `level_for_xp` (paridade com Python).
- **Manual na VM**: rodar `computeProgress` num usuário real (a Fernanda) e conferir o número contra os eventos; `/evolucao` renderiza o cartão; forçar um evento e ver a linha de level-up sair no bot.
- `py_compile` + `tsc --noEmit` + `next build`.

## 8. Ordem de implementação (pro plano)

1. `bot/xp.py` + testes (mapa, curva, estágios, `xp_total`).
2. `sync_and_maybe_announce` + testes.
3. Fiação no bot (`handlers`, `jobs`, `weekly`).
4. `web/src/lib/xp.ts` (espelho) + `computeProgress`.
5. `LevelBar` + faixa na home.
6. `ProgressCard` + seção na Evolução.
7. `Design.md` (estágios definitivos) + `Produto.md` + `Backlog.md`.
8. Deploy bot + painel; verificação manual na VM.
