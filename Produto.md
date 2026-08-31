# Produto.md — AristotelIA

> Visão de produto. Documento vivo — atualizar quando escopo, ICP ou roadmap mudarem.
> Estado atual: **bot pessoal rodando** (1 usuária). Objetivo: **validar como produto**.

---

## 1. Visão

**Um treinador pessoal para pessoas que têm dificuldade de foco.**

Você define um objetivo. A AristotelIA vira sua treinadora: monta o plano, decide o que você faz hoje, te cobra, corrige a rota, registra tudo e te mostra que você está evoluindo — **e te alcança onde você já está**, não em mais um app pra você esquecer de abrir.

O diferencial (o "fora da curva"):
- **A treinadora decide, não você.** Você não configura um sistema — você ganha um plano e alguém que não desiste de você. (Personalização vem depois que a pessoa confia.)
- **Ela te encontra onde você vive.** Telegram, notificação no navegador, e-mail, evento na agenda — **você escolhe o canal e o tipo de lembrete**, e ela te ensina a conectar. Zero fricção.
- **Feita para quem não consegue focar.** Toda a experiência assume que você VAI procrastinar, VAI esquecer, NÃO vai abrir o app. Então ela é proativa, sem culpa ("hoje não" reagenda de boa) e se adapta ao seu ritmo real.
- **Conecta com a sua vida.** Lê sua agenda pra marcar foco nas brechas reais; escreve as sessões de volta como eventos.

## 2. Problema (o wedge)

**"Eu sei o que preciso fazer. Só não consigo fazer de forma consistente."**

O problema de quem tem dificuldade de foco não é falta de informação nem de ferramenta — é **falta de alguém puxando**. As ferramentas existentes são **passivas**: dão um quadro em branco (Notion), um catálogo (Udemy), um cronômetro (apps de foco), ou um chat sem memória (ChatGPT). Todas exigem que VOCÊ tenha a disciplina que você não tem. E todas são "mais um app pra abrir".

## 3. Público

**Beachhead (pra validar):** pessoas aprendendo a programar / trocando de carreira pra tech / autodidatas de tecnologia.
Motivo: é onde o "não sei por onde começar" mais dói, tem gente reclamando disso em público (Reddit, X, Discord), e é o público que a fundadora entende na pele.

**Expansão (depois de validar):** qualquer pessoa que quer se desenvolver e tem dificuldade de foco e constância — design, marketing, idiomas, concursos, saúde, escrita. O motor é o mesmo, só muda o conteúdo da trilha.

**Não é para:** quem já tem disciplina e sistema próprio; quem quer só um gerenciador de tarefas.

## 4. Princípios de produto

1. **A treinadora decide.** Setup curto + ela monta tudo. A pessoa não configura um sistema — ganha um plano. Personalização é recompensa por confiança, não pré-requisito.
2. **Ativa.** Ela puxa a conversa. A pessoa não precisa "abrir o app".
3. **Te encontra onde você está.** A pessoa escolhe canal (Telegram, push no navegador, e-mail, agenda) e tipo de cada lembrete. A treinadora ensina a conectar.
4. **Sem culpa.** "Hoje não" reagenda sem quebrar nada. O tom nunca pune.
5. **Composto.** Tudo vira registro. O valor aparece na 3ª semana, quando o gráfico sobe.
6. **Conecta com a vida real.** Lê a agenda pra caber nas brechas; devolve foco como evento.

## 5. Arquitetura (alvo — Fase 2+)

```
      CANAIS (a pessoa escolhe)                 CONTROLE
 ┌──────────┬──────────┬─────────┐        ┌──────────────────┐
 │ Telegram │ push web │ e-mail  │        │  App / Painel     │
 │  (bot)   │  (PWA)   │         │        │  (Next.js/PWA)    │
 └────┬─────┴────┬─────┴────┬────┘        └─────────┬────────┘
      │          │          │                       │
      ▼          ▼          ▼                       ▼
 ┌─────────────────────────────────────────────────────────┐
 │  API + MOTOR DE LEMBRETES + agendador por usuário         │
 │  (o que enviar · quando · por qual canal · adaptação)    │
 └───────────────┬───────────────────────┬─────────────────┘
                 │                       │
          ┌──────▼──────┐         ┌──────▼───────────┐
          │  PostgreSQL  │         │  Google Calendar  │
          └─────────────┘         │  (ler brechas /   │
                                  │   escrever foco)  │
                                  └──────────────────┘
```

**Estado hoje (Fase 1):** só o canal Telegram + painel web + Postgres. O motor de lembretes existe como horários fixos por usuário (`preferences.enabled_functions`). Falta: a pessoa configurar isso pelo app, canais além do Telegram, e a agenda.

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

### 6.6 Motor de lembretes (o "fora da curva" — Fase 2)
Onde a pessoa **desenha o próprio acompanhamento**, dentro do app:
- **[F2]** Lista de lembretes. Cada um tem: **o quê** (motivação · o que estudar · pílula · quiz · desafio · check-in · lembrete livre que a pessoa escreve), **quando** (horário fixo · "de manhã/tarde/noite" · X min antes de um evento da agenda), **canal** (Telegram · notificação no navegador · e-mail · evento na agenda).
- **[F2]** A treinadora sugere um conjunto pronto no onboarding; a pessoa ajusta depois.
- **[F2]** "Quiet hours" e pausar tudo com 1 toque (viagem, doença) — sem quebrar streak.
- **[F2]** Snooze inteligente: "hoje não" reagenda; 3 "hoje não" seguidos → a treinadora puxa uma conversa, não insiste.
- **[depois]** Lembrete adaptativo: se você sempre ignora o das 08h e responde o das 21h, ela move sozinha.

### 6.7 Canais (a pessoa escolhe onde ser alcançada — Fase 2)
- **[F2]** **Telegram** — já existe. Tela de conexão explica o passo a passo (`/start`, deep link).
- **[F2]** **Notificação no navegador (PWA)** — app instalável, push mesmo fechado. Bom pra quem não usa Telegram.
- **[F2]** **E-mail** — digest diário / lembretes, pra quem quer o mínimo de fricção.
- **[F3]** **WhatsApp** — só se houver tração (API oficial cobra por conversa; ver Produto §10).
- **[F3]** **SMS** — fallback caro, só pro check-in crítico.

### 6.8 Agenda / Calendário (Fase 2)
- **[F2]** Conectar **Google Calendar** (OAuth). Ler os horários ocupados → a treinadora marca foco e estudo **nas brechas reais**, não em horário genérico.
- **[F2]** Escrever as sessões de foco de volta como eventos ("🍅 Foco — Generics em Java").
- **[F3]** Lembrete "X min antes do evento Y" (ex: antes de uma aula, antes de uma reunião).
- **[F3]** Outlook / Apple Calendar (via CalDAV).

### 6.9 Conteúdo (diferencial — manter)
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

- **Fase 0 — feito:** bot pessoal (Oracle, US$0). Fernanda usuária nº 1.
- **Fase 1 — feito:** multiusuário (Postgres), onboarding que gera trilha, checklist com auto-check, pomodoro, painel web com identidade visual, superadmin. Canal: só Telegram. **← estamos aqui**
- **Fase 2 — o "fora da curva" (o que a Fernanda descreveu):**
  - **Motor de lembretes configurável** — a pessoa desenha o próprio acompanhamento no app (§6.6): o quê, quando, por qual canal.
  - **Canais** — Telegram (tem) + **push no navegador (PWA)** + **e-mail**. Tela de conexão que explica o setup de cada um.
  - **Google Calendar** — ler brechas pra marcar foco onde cabe; escrever sessões de volta (§6.8).
  - **App instalável (PWA)** — pra funcionar como app de celular com notificação, sem loja.
  - Trilha adaptativa; dashboard de evolução completo.
  - **Preço** — testar assinatura.
- **Fase 3 — escala:** WhatsApp, social/accountability, trilhas-modelo, B2B (bootcamps), expandir além de tech.

**Ordem sugerida da Fase 2:** (1) tela de configuração de lembretes no painel → (2) push PWA como 2º canal → (3) e-mail → (4) Google Calendar. Cada uma é testável sozinha.

## 10. Modelo de negócio (hipóteses — testar, não assumir)

- **Freemium:** trilha + 3 mensagens/dia grátis; ciclo completo (7 msgs + painel + analytics + pomodoro) no pago.
- Faixa provável: **R$19–39/mês** ou **R$150–300/ano**.
- B2B possível depois: bootcamps e cursos usam a AristotelIA como camada de accountability dos alunos (o superadmin já serve pra isso).

## 11. Riscos

- **Público amplo demais** → não sabe onde recrutar nem o que medir. Mitigação: beachhead de tech primeiro.
- **Retenção** é o teste real. Coach que você ignora vira spam. Mitigação: qualidade das mensagens (sincero, sem textão), "hoje não" sem culpa, quiet hours.
- **Custo de LLM** ao escalar. Hoje Groq é grátis; com volume, revisitar (batch, modelo menor pras tarefas simples, cache).
- **Escopo.** A tentação é construir tudo. Fase 1 valida com o mínimo — checklist + trilha + cobrança diária. Pomodoro, hábitos, gamificação: só se o núcleo segurar.
