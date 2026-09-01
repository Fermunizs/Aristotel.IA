# Preços e limites — AristotelIA

> Estrutura **decidida** com a Fernanda em 2026-09-01. Cobrança ainda **não ligada** (modelo de validação — ver §6).
> Fonte de verdade dos planos. Atualizar `Produto.md §10` quando mudar.

---

## 1. Contexto de custo (por que preço ≠ custo aqui)

- **LLM é grátis hoje.** Cadeia Groq → Gemini (free tier) → OpenRouter. Custo marginal por usuário ≈ **R$0**.
- **Hospedagem grátis.** VM Oracle Always Free. **US$0/mês.**
- **O que NÃO é infinito:** o *rate limit compartilhado* das chaves grátis. Todo mundo divide o mesmo balde de tokens/minuto. Por isso já existe teto de conversa (hoje 40/dia), conteúdo compartilhado e jitter nos horários.
- Conclusão: **preço não cobre custo — ele sinaliza valor, filtra quem não é o público, e financia a saída das chaves grátis** (chave paga dedicada, e-mail transacional, quota de Calendar API) quando houver volume.

**Implicação:** dá pra ser generoso no plano grátis. O limite do grátis existe pra *proteger o balde de LLM* e *deixar o que vender nos pagos*, não economizar centavo.

---

## 2. Os planos

Nomes contam a jornada do produto: você **aprende, entende e domina** — e vira referência.

| | **Aprendiz** | **Sábio** | **Mestre** | **Turma** (B2B) |
|---|---|---|---|---|
| **Pra quem** | Começando, quer constância | Usa a sério pra carreira; cria conteúdo | Várias frentes; quer virar referência | Bootcamp / curso / mentor com alunos |
| **Preço** | R$0 | **R$39/mês** · R$290/ano | **R$79/mês** · R$590/ano | sob consulta (por aluno/mês) |
| **Fundador** | — | R$29/mês travado 12 meses | R$59/mês travado 12 meses | — |
| Ciclo 1% diário (guia, pílula, quiz, desafio, fechamento) | ✅ | ✅ | ✅ | ✅ |
| Gráfico + árvore de evolução | ✅ | ✅ | ✅ | ✅ |
| Pomodoro · quiet hours · pausar sem culpa · tom do coach | ✅ | ✅ | ✅ | ✅ |
| Todos os canais (Telegram; push e e-mail a caminho) | ✅ | ✅ | ✅ | ✅ |
| **Conversa livre** | 25/dia | 25/dia | **ilimitada** | 25/dia |
| **Lembretes agendados (crons)** | 5 | **15** | **30** | 15 |
| **Trilhas rodando** | 1 | **3** | **6** | 1 (a da instituição) + 1 própria |
| Banco de ideias de conteúdo | ✅ | ✅ | ✅ | ✅ |
| **Ideias de post (LinkedIn / IG / X) + copy pronta** | — | **3/semana** | **calendário completo** | — |
| Análise semanal | card simples | profunda + tendência | profunda + tendência | profunda (aluno) |
| Agenda (Google / Outlook) | — | ✅ | ✅ | ✅ |
| Export (CSV / Notion) | — | ✅ | ✅ | ✅ |
| Boletim mensal de autoridade | — | — | ✅ | — |
| Prioridade no LLM quando a fila aperta | — | — | ✅ | ✅ |
| Revisão espaçada cruzando as trilhas | — | — | ✅ | — |
| Pergunta estratégica de carreira (1×/semana, resposta longa) | — | — | ✅ | — |
| Trilhas-modelo (biblioteca curada, acesso antecipado) | — | — | ✅ | — |
| Parceiro de constância (convida 1, streak compartilhado) | — | — | ✅ | — |
| Relatório mensal compartilhável ("meu mês") | — | — | ✅ | — |
| Painel do organizador (streak/trilha/conclusão da turma) | — | — | — | ✅ |

**Regra de preço:** topo ≈ 2× o meio (Best = 2–3× Better). R$79 = fração de um curso (Alura ~R$85/mês, bootcamp milhares) pra quem usa isto pra carreira.

### Racional dos cortes

| Corte | Por quê |
|---|---|
| **Ciclo 1% + gráfico de evolução no grátis** | O gráfico subindo na 3ª semana é o "aha" e o motor de indicação. Gatear isso mata o que traz usuário novo. E "coach que te larga no dia 8" contradiz "não desiste de você". |
| **Conversa 25/dia no grátis e Sábio** | A conversa É o produto/hábito — 25 cobre uso real (tarefas guiadas não contam). Ilimitado é o mimo do Mestre. |
| **Crons: 5 / 15 / 30** | 5 já está no código. O ciclo padrão tem 7 funções → no grátis a pessoa escolhe 5 e sente falta = upsell honesto. |
| **Trilhas: 1 / 3 / 6** | Multi-trilha (§3) é o "puxão" real do Sábio pra cima. |
| **Conteúdo social só do Sábio pra cima** | É o *headline* dos planos pagos, não footnote: o ICP cria conteúdo, e "minha formação vira reputação" tem disposição a pagar real. |
| **Agenda / export / análise profunda no Sábio** | Custo de infra real (OAuth, quota) + valor pra quem já está investido. |
| **Retenção de dados: nunca apagar, em nenhum plano** | Storage é barato. O que muda é *export* e *profundidade de análise*, não a existência do dado. |

---

## 3. Como funcionam as várias trilhas

O produto é "um passo por dia, sem textão" — não dá pra rodar 3 ciclos completos no mesmo dia. Modelo:

- Cada trilha ganha **dias da semana próprios**. Ex: *Java* seg/qua/sex · *Inglês* ter/qui · *Design* sáb.
- O ciclo das 08h (guia → pílula → quiz → desafio) roda pra **a trilha daquele dia**. **Um dia = uma trilha.** Não empilha.
- Trilha sem dia marcado fica **parada** (não some, não cobra). Dá pra ter 6 salvas e rodar 2 por vez.
- **Fechamento da noite e streak são únicos** (do dia), não por trilha.
- `/jasei`, `/skip`, revisão adaptativa, "chegou na semana 2": **por trilha**.
- Aprendiz = 1 trilha (todo dia). Sábio = 3. Mestre = 6.

**Build:** exige mudança de schema (hoje `learning_plans` tem 1 ativa fixa → múltiplas ativas + mapa de dias por trilha). Fase 2, junto do motor de lembretes configurável.

---

## 4. A escada de conteúdo (diferencial do Sábio pra cima)

- **Sábio:** toda semana, **3 ideias de post** tiradas do que você estudou — escolhe LinkedIn, Instagram ou X, vem com **hook + copy pronta**.
- **Mestre:** **calendário de conteúdo** da semana (ideias já distribuídas nos dias) · carrossel/thread com **estrutura completa** (tópicos/slides, não só copy) · a mesma ideia **adaptada pras 3 plataformas** · **boletim mensal**: seus temas de estudo × o que você postou, pra ver se sua presença conta uma história coerente de autoridade.

---

## 5. Preço de fundador e reajuste

- Quem entra na validação e vira pagante trava **R$29 (Sábio) / R$59 (Mestre) por 12 meses**.
- Depois dos 12 meses: migra pro preço vigente com **60 dias de aviso** + opção de travar o anual antes.
- Fundador é **transição**, não isenção permanente (um fundador em R$29 que deveria estar em R$49 = ~R$240/ano subsidiados na base inteira, pra sempre).
- Reajuste futuro: testar em **novos usuários primeiro**, depois migrar a base em ondas de 5–10%.

---

## 6. Agora: modelo de validação

- **Cobrança desligada.** Tudo liberado (limites de validação: 8 crons, 40 msg/dia, 1 trilha até multi-trilha existir).
- **Landing mostra os 3 planos.** Sábio e Mestre com selo **"em breve · fundador"**. CTA = "quero ser fundador" → entra numa lista.
- **Ligar cobrança quando** ≥ 3 métricas do `Produto.md §8` no verde: retenção D30 > 30%, "pagaria?" > 50% em entrevista, tarefa diária concluída > 40% dos dias.

### Instrumentar já (antes de cobrar)
- **Quem encostaria em cada limite** se valesse hoje: crons > 5, msgs > 25/dia, trilhas > 1, recomeços > 2/mês. Gravar em `events` (`kind='limit:would_hit:<recurso>'`) **sem bloquear**.
- Retenção D7/D30, % de dias com tarefa concluída.
- "Pagaria? Quanto? Qual plano?" nas entrevistas com os ~20.
- Van Westendorp mini (4 perguntas de preço) quando chegar a ~15 ativos.

---

## 7. Riscos

| Risco | Mitigação |
|---|---|
| Grátis bom demais → ninguém vira Sábio | Os pagos vendem **conteúdo + multi-trilha + agenda**, não "o básico". Se ninguém migrar, o problema é valor dos pagos, não preço. |
| Gatear conteúdo machuca o boca-a-boca | Por isso o **gráfico de evolução fica no grátis**. Medir se quem indica é grátis ou pagante. |
| Rate limit da chave grátis estoura antes de ter receita | Chave paga dedicada (~US$5–20/mês cobre muito) ou chave por usuário. Prioridade no LLM do Mestre já é o gancho. |
| Sem pagamento construído (Pix / Mercado Pago / Stripe) | Trabalho à parte. Pix manual dá pra primeira dúzia de fundadores. Estimar antes de anunciar data. |
| Multi-trilha é build grande e pode não valer | Vender "3 trilhas" no Sábio só depois que o schema existir. Até lá, Sábio = 1 trilha + tudo o resto. |
| LTV com teto (produto de 1 usuário, flat fee) | **Turma (B2B)** é o lever de expansão — o superadmin já existe. Sábio/Mestre viram prova e funil pro B2B. |

---

## 8. Decisões fechadas (2026-09-01)

- Nomes: **Aprendiz / Sábio / Mestre / Turma**.
- Preço: **R$39 / R$79**; fundador **R$29 / R$59** travado **12 meses**.
- Grátis generoso (ciclo + gráfico + 25 msg/dia + 5 crons + 1 trilha).
- Headline dos pagos = **conteúdo → rede social** (autoridade).
- Multi-trilha pelo modelo de **dias da semana por trilha** (§3).
- **Turma (B2B)** entra na tabela como "sob consulta" desde já.
- Todos os extras do Mestre entram (revisão espaçada, pergunta estratégica, trilhas-modelo, parceiro de constância, boletim).

### Ainda aberto
- Provedor de pagamento.
- Mínimo de alunos + preço/aluno do plano Turma.
- Duração do trial (quando a cobrança ligar) — provável 14 dias de Mestre.
