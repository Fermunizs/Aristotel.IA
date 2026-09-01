# Preços e limites — AristotelIA

> Documento de **debate**, não decisão fechada. Estado: validação, <20 usuários.
> Objetivo: ter uma estrutura defensável pra (a) desenhar a landing e (b) instrumentar o produto pra decidir preço com dado real.
> Atualizar `Produto.md §10` quando algo aqui virar decisão.

---

## 1. Contexto de custo (por que preço ≠ custo aqui)

- **LLM é grátis hoje.** Cadeia Groq → Gemini (free tier) → OpenRouter. Custo marginal por usuário ≈ **R$0**.
- **Hospedagem grátis.** VM Oracle Always Free. Postgres, API, bot e web na mesma máquina. **US$0/mês.**
- **O que NÃO é infinito:** o *rate limit compartilhado* das chaves grátis. Todo mundo divide o mesmo balde de tokens/minuto. Por isso já existe:
  - teto de **40 msg/dia de conversa livre** por usuário (`bot/handlers.py`, `web/src/app/api/chat/route.ts`);
  - conteúdo compartilhado (motivação do dia gerada 1x pra todos);
  - jitter nos horários (espalha o pico das 08h).
- Conclusão: **preço não cobre custo — ele sinaliza valor, filtra quem não é o público, e financia a saída das chaves grátis** (chave paga dedicada, e-mail transacional, domínio, Google Calendar API) quando houver volume.

**Implicação prática:** dá pra ser generoso no Free sem quebrar o caixa. O limite real do Free é *proteger o balde de LLM compartilhado* e *deixar espaço pro Pro ter o que vender*, não economizar centavo.

---

## 2. Estruturas possíveis

### (A) Free generoso + Pro único
Free entrega o ciclo 1% inteiro. Pro adiciona o que tem custo de infra real (agenda), o que é "a mais" (planner de conteúdo, export) e limites maiores.

| Prós | Contras |
|---|---|
| Retenção não é sabotada por paywall — o Free já vicia | Receita depende de features que ainda não existem (agenda é Fase 2) |
| Fácil de explicar na landing | Risco de o Free ser bom demais e ninguém migrar |
| Coerente com o princípio "te encontro onde você está" (não corta canal) | |

### (B) Free restrito + Pro
Free = trilha + 3 msgs/dia + dashboard só de 7 dias (o que `Produto.md §10` cogitou). Ciclo completo (7 lembretes + analytics + pomodoro + planner) só no Pro.

| Prós | Contras |
|---|---|
| Conversão mais alta e mais cedo | **Contamina a validação:** você precisa que a pessoa viva o ciclo completo por 30 dias pra medir retenção real |
| Receita não depende de feature futura | "Coach que corta você no dia 8" é a antítese do posicionamento ("não desiste de você") |
| | Word-of-mouth cai — o "aha" do gráfico subindo na 3ª semana fica atrás do paywall |

### (C) Só Free agora + Pro como "fundador" / waitlist
Durante a validação, **tudo liberado**. O plano Pro existe no código e na landing, com preço travado ("fundador"), mas a cobrança só liga depois que a retenção bater a barra do `Produto.md §8`. Quem entra agora garante o preço fundador pra sempre.

| Prós | Contras |
|---|---|
| Validação limpa (todo mundo usa tudo) | Zero receita no curto prazo (ok: custo é US$0) |
| Cria lista de gente que **disse que pagaria** — sinal forte | Precisa de disciplina pra realmente ligar o preço depois |
| "Preço de fundador" é gatilho honesto de urgência | Migração free→pago depois gera um pouco de atrito |
| Dá tempo de construir pagamento (Pix/Stripe) sem pressa | |

### Recomendação: **(C) agora, evoluindo pra (A)**

1. **Hoje:** tudo liberado. Landing mostra Free e Pro (estrutura A), com o Pro marcado **"em breve — preço de fundador travado pra quem entra agora"**. CTA do Pro = entrar numa lista / responder "quero".
2. **Instrumentar** (seção 6) quem encostaria em cada limite se ele existisse.
3. **Quando** retenção D30 > 30% E "pagaria?" > 50% em entrevista → ligar cobrança do Pro no modelo (A), honrando o preço de fundador pra base atual.

Não usar (B): o custo de contaminar a única janela de validação que ela tem é maior que a receita que (B) traria de <20 pessoas.

---

## 3. Tabela de limites por plano (proposta)

Coluna "validação" = o que vale AGORA (modelo C). Coluna "Free / Pro" = alvo quando a cobrança ligar (modelo A).

| Recurso | Na validação (todos) | Free (alvo) | Pro (alvo) | Racional do corte |
|---|---|---|---|---|
| **Lembretes ativos** | 8 | **5** | **30** | 5 já está no código (`api/reminders/route.ts`). O ciclo padrão tem 7 funções → no Free a pessoa **escolhe** 5, e sente falta das outras 2 = upsell honesto. Pro 30 = "desenha o acompanhamento inteiro". Durante a validação sobe pra 8 (ciclo completo + 1) pra não enviesar a retenção. |
| **Conversa livre / dia** | 40 | **15** | **40** | 40 é o teto técnico que protege a chave compartilhada — mantém no Pro. 15/dia cobre uso real (as tarefas guiadas não contam nesse teto). Chat pesado é onde o custo concentra. |
| **Trilha ativa** | 1 | **1** | **1** | Multi-trilha é "depois" (`Produto.md §6.2`). Ninguém perde nada. |
| **Recomeços de trilha / mês** | 5 | **2** | **ilimitado** | Recomeço = geração de plano inteiro pelo LLM (caro no balde). 2/mês é folgado pra uso legítimo — ninguém recomeça de verdade toda semana. É trava anti-abuso, não anti-usuário. |
| **Integração de agenda** (Google/Outlook) | — (não existe) | **não** | **sim** | Fase 2. Tem custo de infra real (OAuth, quota de API) e é a promessa "conecta com a sua vida" — alto valor percebido. Gate clássico de Pro. |
| **Canais: push no navegador + e-mail** | sim | **sim** | **sim** | Canal **não** se corta. Princípio 3 do produto: "te encontro onde você está". Cortar canal no Free contradiz o posicionamento. |
| **Dashboard de evolução (gráfico)** | completo | **completo** | **completo** | O gráfico subindo na 3ª semana é o "aha" e o motor de boca-a-boca. Gatear isso mata a coisa que traz usuário novo. **Não gatear.** |
| **Export do histórico** (CSV / Notion) | — | **não** | **sim** | "Levar seus dados" é valor pra quem já está investido. Custo ~zero, disposição a pagar real. |
| **Análise semanal comparativa** ("SUA SEMANA" com ponto forte/fraco + comparação com semanas anteriores) | completa | **card simples** | **completa** | Free vê o card da semana. Pro vê a leitura profunda + tendência entre semanas. Chamada de LLM semanal = custo no balde. |
| **Planner de conteúdo semanal** (3 peças + rascunho de copy) | sim | **não** (só o *banco* de ideias) | **sim** | Diferencial pro sub-público criador. Claramente "a mais". Custo de LLM semanal. Free salva ideias; Pro gera o plano. |
| **Personalidade do coach / quiet hours / pausar sem culpa / "hoje não"** | sim | **sim** | **sim** | Núcleo do "sem culpa". Nunca gatear. |
| **Retenção de dados** | indefinida | **indefinida** (não apaga) | **indefinida** | Storage é barato. Apagar dado de usuário é péssima UX e não economiza nada relevante. O que muda entre planos é *export* e *profundidade de análise*, não a existência do dado. |

### Resumo do que separa Free de Pro (alvo)
Pro = **agenda** + **planner de conteúdo** + **análise semanal profunda** + **export** + **limites maiores** (30 lembretes, 40 msg/dia).
Free = o ciclo 1% inteiro, todos os canais, o gráfico de evolução, pomodoro, quiet hours. Suficiente pra viciar e pra recomendar pra um amigo.

---

## 4. Preço do Pro

### Comparáveis (BRL)

| Produto | Mensal | Anual | Observação |
|---|---|---|---|
| Duolingo Super (individual) | R$14,99 | R$179,90 (~R$15/mês) | Comparável mais próximo: hábito diário + aprendizado + notificação. |
| Productive (hábitos) | — | R$64,90 / R$209,90 / R$299,90 | Faixa larga de plano anual de app de hábito no BR. |
| OFENSIVA (hábitos + "coach", BR) | grátis generoso | — | Concorrente indireto de posicionamento; Free forte. |
| Coaching de accountability humano (apps) | US$29–49/mês | — | AristotelIA entrega "uma treinadora que não desiste" por fração disso. |
| Faixa psicológica de assinatura BR | R$9,90 / R$14,90 / **R$29,90** | — | R$29,90 é a linha que "pesa"; ficar abaixo dela ajuda. |

### Recomendação

- **Mensal: R$19.** Anual: **R$149** (~R$12,40/mês, ~35% off).
- Faixa a testar: **R$19–29/mês**, **R$149–199/ano**. Começar em R$19 (conselho "só cobra e vê" — não modelar demais com <20 pessoas).
- **Preço de fundador:** quem entra na fase de validação trava **R$19/mês ou R$149/ano pra sempre**. Serve de urgência honesta e recompensa quem apostou cedo.
- **Não** cair pro R$9,90: gera tração falsa (gente que nunca pagaria preço real), prende o preço lá embaixo, e o cliente mais barato é o que mais reclama e mais churna.

### Por que R$19 e não mais

O ICP — quem troca de carreira pra tech, autodidata, com dificuldade de foco — é aspiracional mas **contando dinheiro** (muita gente ainda estudando, sem o salário de tech). R$19 = "um almoço", abaixo da linha dos R$29,90, mesma faixa do Duolingo que a pessoa já conhece. Dá pra subir depois (novos usuários primeiro, base atual grandfathered) se a conversão passar de 40% ou o churn ficar abaixo de 3%/mês.

---

## 5. Trial

- **Pro Trial: 14 dias**, libera **tudo** (agenda quando existir, planner de conteúdo, análise semanal profunda, export, 30 lembretes, 40 msg/dia).
- **Sem cartão na frente** durante a validação (e provavelmente depois — self-serve, público sensível a atrito).
- No fim do trial: **downgrade automático pro Free, sem perder dado**. Mensagem da treinadora no tom da casa ("o trial acabou. Suas tarefas da trilha seguem normais. Quando quiser o planner e a agenda de volta, é só voltar pro Pro.").
- 14 > 7 porque o "aha" (gráfico + card semanal) só aparece de verdade na 2ª/3ª semana — 7 dias não mostram o composto.

---

## 6. Riscos e o que medir antes de fechar preço

### Instrumentar já (antes de cobrar)
- **Quantos encostariam em cada limite** se ele valesse hoje: lembretes > 5, msgs > 15/dia, recomeços > 2/mês. Registrar em `events` (`kind='limit:would_hit:<recurso>'`) mesmo sem bloquear.
- **Retenção D7 / D30** por usuário (barra do `Produto.md §8`: D7 > 50%, D30 > 30%).
- **% de dias com tarefa diária concluída** (> 40% = sinal bom).
- **"Pagaria por isso? Quanto?"** em entrevista com os ~20 — meta > 50% sim.
- **Van Westendorp mini** (4 perguntas de preço) com a base atual quando chegar a ~15 usuários ativos.

### Riscos
| Risco | Mitigação |
|---|---|
| Free bom demais → ninguém vira Pro | O Pro vende agenda + conteúdo + análise, não "o básico". Se ainda assim ninguém migrar, o problema é valor do Pro, não preço. |
| Gatear análise semanal / planner machuca o boca-a-boca | Por isso o **gráfico de evolução fica no Free**. Medir se quem indica amigo é free ou pro. |
| Rate limit da chave grátis estoura antes de ter receita | Caminho já mapeado: chave paga dedicada (~US$5–20/mês cobre muito) ou chave por usuário. Cobrança do Pro paga isso. |
| Não há pagamento construído (Pix/Stripe/Mercado Pago) | Trabalho à parte. Estimar antes de anunciar data. Pix manual dá pra primeira dúzia de fundadores. |
| Migração free→pago irrita a base atual | Preço de fundador travado + aviso com antecedência + "seu histórico continua" resolvem a maior parte. |

---

## 7. Decisões que dependem da Fernanda

1. **Cobrar agora vs. modelo fundador/waitlist.** Recomendação: não cobrar ainda (modelo C).
2. **Teto de lembretes do Free:** 5 (código) ou 7–8 durante a validação. Recomendação: 8 agora, 5 quando cobrar.
3. **Gatear ou não o histórico/análise do gráfico.** Recomendação: gráfico sempre grátis; só export e análise profunda no Pro.
4. **Preço final do Pro** dentro de R$19–29 / R$149–199. Recomendação: R$19 e R$149, travado pra fundador.
5. **Provedor de pagamento:** Pix manual / Mercado Pago / Stripe BR.
6. **Agenda (Google/Outlook): Pro-only ou add-on pago à parte.** Recomendação: dentro do Pro.
7. **Trial: 7 ou 14 dias.** Recomendação: 14.
8. **CTA do Pro na landing enquanto não cobra:** lista de espera, "quero ser fundador", ou botão que abre conversa no bot.
