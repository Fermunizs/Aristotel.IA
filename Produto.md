# Produto.md — AristotelIA

> Visão de produto. Documento vivo — atualizar quando escopo, ICP ou roadmap mudarem.
> Estado atual: **bot pessoal rodando** (1 usuária). Objetivo: **validar como produto**.

---

## 1. Visão

Um **treinador de alta performance** que transforma intenção em evolução composta.
Você diz o que quer desenvolver → a AristotelIA monta a trilha, te cobra todo dia, registra o que você fez e te mostra que está evoluindo 1% por dia.

Não é app de tarefas. Não é curso. É um **coach ativo e opinativo** que vive no seu bolso (Telegram) e tem um painel pra ver o todo (web).

## 2. Problema (o wedge)

**"Quero me desenvolver mas não sei por onde começar, não tenho cronograma, consumo conteúdo demais e aplico de menos, e não consigo ver se estou evoluindo."**

Ferramentas existentes falham porque são **passivas**: te dão um quadro em branco (Notion), um catálogo (Udemy) ou um cronômetro (qualquer app de foco). Ninguém te diz *o que fazer hoje* e te cobra.

## 3. Público

**Beachhead (pra validar):** pessoas aprendendo a programar / trocando de carreira pra tech / autodidatas de tecnologia.
Motivo: é onde o "não sei por onde começar" mais dói, tem gente reclamando disso em público (Reddit, X, Discord), e é o público que a fundadora entende na pele.

**Expansão (depois de validar):** qualquer pessoa que quer se desenvolver e tem dificuldade de foco e constância — design, marketing, idiomas, concursos, saúde, escrita. O motor é o mesmo, só muda o conteúdo da trilha.

**Não é para:** quem já tem disciplina e sistema próprio; quem quer só um gerenciador de tarefas.

## 4. Princípios de produto

1. **Opinativo.** Setup de 3 perguntas + defaults inteligentes. A mágica é ela decidir por você. Customização avançada é v2, não v1.
2. **Ativo.** Ela puxa a conversa. O usuário não precisa "abrir o app".
3. **Composto.** Tudo vira registro. O valor aparece na 3ª semana, quando você vê o gráfico subir.
4. **Fricção zero.** Telegram primeiro. A web é complemento, nunca pré-requisito.
5. **Aplicação > consumo.** Todo dia precisa ter contato + interação + aplicação, não só "leia isso".

## 5. Arquitetura

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Telegram    │────▶│   API (backend)   │◀────│  Painel Web  │
│  bot (coach) │     │  + agendador      │     │  (Next.js)   │
└─────────────┘     └────────┬─────────┘     └─────────────┘
                             │
                      ┌──────▼──────┐
                      │  PostgreSQL  │  (estado por usuário)
                      └─────────────┘
```

- **Bot Telegram** — o que já existe, reescrito pra multiusuário. Lê/escreve no mesmo banco.
- **API + agendador** — jobs por usuário (respeitando fuso e horários de cada um), geração de trilha, sync de checklist.
- **Painel Web** — onboarding, checklist, pomodoro, dashboard de evolução, banco de conteúdo. E o **superadmin**.
- **Postgres** — substitui os `data/*.json`. Um schema, multi-tenant por `user_id`.
- **Hospedagem:** cabe tudo na **mesma VM Oracle Always Free** (Postgres + API + bot + web estático). Oracle Free ainda dá 2 Autonomous DB grátis se precisar separar. Custo continua **US$0**.

**Papéis:** `superadmin` (Fernanda) · `user`. Superadmin pode impersonar/ver o painel de qualquer user (suporte) e criar/convidar usuários.

## 6. Features por pilar

Legenda: **[MVP]** valida o produto · **[v2]** depois do primeiro sinal · **[depois]** quando houver tração.

### 6.1 Setup / Onboarding
- **[MVP]** Intake de 3 perguntas: *o que quer aprender · nível atual · minutos por dia* → gera a trilha na hora (LLM).
- **[MVP]** Escolher horário de acordar/dormir e "quiet hours".
- **[v2]** Ligar/desligar cada função diária (motivação, quiz, insight, desafio…).
- **[v2]** Personalidade do coach: mais durão × mais gentil.
- **[depois]** Importar metas de um calendário / Notion.

### 6.2 Trilha + Checklist (o coração)
- **[MVP]** Trilha gerada = semanas com dias, cada dia com tópico + objetivo + ação concreta.
- **[MVP]** **Checklist diária** no painel, montada a partir da trilha do dia.
- **[MVP]** **Auto-check:** tarefa marca sozinha quando feita pelo Telegram (respondeu o quiz, mandou o desafio, fez o review). Ou a pessoa marca na mão.
- **[MVP]** `/jasei` (pula tópico dominado) e "hoje não" (reagenda sem quebrar o streak).
- **[v2]** Trilha adaptativa: errou os quizzes de um tópico → insere dia de revisão; acertou tudo → acelera.
- **[v2]** Reordenar / adiar tarefas (arrastar).
- **[depois]** Trilhas-modelo curadas que o superadmin pode atribuir.

### 6.3 Foco / Execução
- **[MVP]** **Pomodoro** no painel (25/5 configurável). "Começar foco" também pelo Telegram — o bot silencia durante a sessão e registra os minutos.
- **[MVP]** "Tarefa mais importante do dia" (regra 1-3-5).
- **[v2]** Sugestão de time-block dentro da janela de tempo da pessoa.
- **[v2]** Estatística de "deep work" (minutos de foco por dia/semana).

### 6.4 Hábitos / Rotina
- **[v2]** Habit tracker além de estudo (sono, exercício, não-scroll).
- **[v2]** Streak por hábito + o "streak 1%" geral.
- **[MVP]** Check-in da manhã (06:00) e fechamento (20:00) — já existe.

### 6.5 Evolução / Analytics
- **[MVP]** Dashboard: conceitos aprendidos · praticados · problemas resolvidos · minutos de foco · streak · conteúdos publicados.
- **[MVP]** Gráfico de evolução ao longo do tempo.
- **[MVP]** Card semanal (já existe) vira uma tela viva + "ponto forte / ponto fraco".
- **[v2]** Skill tree com XP e níveis (gamificação sóbria).
- **[depois]** Portfólio público: desafios concluídos viram um "build log" compartilhável.

### 6.6 Conteúdo (diferencial — manter)
- **[MVP]** Banco de ideias + planner semanal (já existe).
- **[v2]** "Esse aprendizado → carrossel / reel / threads" com rascunho de copy.
- **[v2]** Marcar o que foi realmente publicado (fecha o loop formação → conteúdo).

### 6.7 Superadmin
- **[MVP]** Lista de usuários: status (ativo, streak, último acesso), criar/convidar.
- **[MVP]** **Impersonar** / ver o painel de um usuário (suporte).
- **[MVP]** Métricas agregadas: retenção D7/D30, % de conclusão da tarefa diária, onde as pessoas desistem.
- **[v2]** Mandar mensagem pra um usuário ou broadcast.
- **[v2]** Gerenciar trilhas-modelo.

### 6.8 Social / Accountability (forte pra retenção — mas depois)
- **[depois]** Parceiro de accountability / grupos pequenos.
- **[depois]** Leaderboard opt-in.
- **[depois]** Compartilhar streak / card semanal.

### 6.9 Integrações
- **[depois]** GitHub (commits contam como "prática").
- **[depois]** Google Calendar.
- **[depois]** Export do log de evolução pra Notion/Obsidian.

## 7. Modelo de dados (alto nível)

- `users` — id, telegram_chat_id, nome, timezone, papel, quiet_hours, criado_em
- `preferences` — user_id, funções ligadas, personalidade do coach, min/dia
- `learning_plans` — user_id, objetivo, nível, semanas (jsonb), current {week,day}, known_topics
- `tasks` — user_id, data, origem (trilha/pomodoro/manual), texto, status, feito_via (telegram/web/auto)
- `events` (o daily_log) — user_id, data, tipo (quiz/review/foco/desafio), payload
- `focus_sessions` — user_id, início, duração_min, tarefa_id
- `content_ideas` — user_id, tema, tipo, formato, origem, publicado
- `streaks` — user_id, tipo, atual, recorde, última_data

## 8. Plano de validação

**Pré-requisito:** reescrever o bot pra multiusuário + onboarding que gera trilha + banco Postgres. (Web pode vir logo depois, não precisa estar pronto pro primeiro teste — dá pra validar só no Telegram.)

**Passos:**
1. Multiusuário + onboarding no Telegram.
2. Landing simples: *"Diz o que quer aprender. A AristotelIA monta sua trilha e te cobra todo dia."* + botão pro bot.
3. Recrutar 20–30 pessoas da beachhead (comunidades onde elas já reclamam do problema).
4. Rodar 30 dias.

**Métricas de sinal (o que "funcionou" significa):**
| Métrica | Sinal fraco | Sinal bom |
|---|---|---|
| Retenção D7 | < 30% | > 50% |
| Retenção D30 | < 15% | > 30% |
| Tarefa diária concluída | < 25% dos dias | > 40% dos dias |
| "Pagaria por isso?" (entrevista) | < 30% | > 50% |
| Trilha: chega na semana 2 | < 20% | > 40% |

Se der sinal bom em ≥ 3 delas → investir em web + preço + expandir público.

## 9. Roadmap faseado

- **Fase 0 — hoje:** bot pessoal rodando (Oracle, US$0). Fernanda é usuária nº 1.
- **Fase 1 — multiusuário (validação):** Postgres, onboarding, trilha gerada, checklist com auto-check, pomodoro básico, superadmin mínimo. Só Telegram + um painel enxuto.
- **Fase 2 — se validar:** dashboard de evolução completo, trilha adaptativa, gerador de conteúdo, preço.
- **Fase 3 — escala:** social/accountability, integrações, trilhas-modelo, expandir além de tech.

## 10. Modelo de negócio (hipóteses — testar, não assumir)

- **Freemium:** trilha + 3 mensagens/dia grátis; ciclo completo (7 msgs + painel + analytics + pomodoro) no pago.
- Faixa provável: **R$19–39/mês** ou **R$150–300/ano**.
- B2B possível depois: bootcamps e cursos usam a AristotelIA como camada de accountability dos alunos (o superadmin já serve pra isso).

## 11. Riscos

- **Público amplo demais** → não sabe onde recrutar nem o que medir. Mitigação: beachhead de tech primeiro.
- **Retenção** é o teste real. Coach que você ignora vira spam. Mitigação: qualidade das mensagens (sincero, sem textão), "hoje não" sem culpa, quiet hours.
- **Custo de LLM** ao escalar. Hoje Groq é grátis; com volume, revisitar (batch, modelo menor pras tarefas simples, cache).
- **Escopo.** A tentação é construir tudo. Fase 1 valida com o mínimo — checklist + trilha + cobrança diária. Pomodoro, hábitos, gamificação: só se o núcleo segurar.
