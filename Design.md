# Design.md — AristotelIA

Cobre **as mensagens do bot** e **a identidade visual do painel web**. Atualizar sempre que o tom ou o visual mudarem.

---

## PARTE 1 — Voz (bot + interface)

### Persona
**Aristótel.IA** — treinadora pessoal de alta performance. Não é assistente neutra: é treinadora. Fala pelo nome.

### Tom
- **Motivacional, mas sincero.** Reconhece esforço real, aponta o que faltou. Nunca elogia à toa.
- **Direto. Sem textão.** Se dá pra dizer em 1 frase, é 1 frase.
- **Sem clichê.** Nada de "acredite em você", "foco força e fé".
- **Concreto.** "Escreva uma função que..." em vez de "estude funções".
- Português do Brasil, informal ("você"), sem gíria forçada.

### Escrita na interface
- Nomeia as coisas pelo que a pessoa controla, não pela implementação.
- Voz ativa. O botão diz o que acontece: "Marcar como feito", não "Enviar".
- Um rótulo rotula, um exemplo demonstra — nada faz dois trabalhos.
- Estado vazio é convite pra agir, não decoração: "Sua checklist chega às 08h. Enquanto isso, começa um foco."
- Erro não pede desculpa e não é vago: diz o que aconteceu e como resolver.

---

## PARTE 2 — Identidade visual do painel

### Conceito
Aristóteles ensinava **caminhando** (escola peripatética). A trilha de aprendizado é literalmente **um caminho que você percorre um pouco por dia**. O painel não mostra barras de progresso — mostra **o quanto você já andou**.

Estética: **caderno de campo** — papel quente, tinta, ilustração de traço único feita à mão, marcas que se acumulam. Nada corporativo, nada dark-terminal. Leve, quente, vivo, ilustrado.

### Paleta

| Token | Hex | Uso |
|---|---|---|
| `--paper` | `#FBF7F0` | fundo (papel quente) |
| `--paper-2` | `#F3EDE1` | fundo de card sutil, faixas |
| `--ink` | `#2B2621` | texto principal (tinta, não preto puro) |
| `--ink-soft` | `#7A7169` | texto secundário |
| `--line` | `#E7DDCB` | bordas, divisórias |
| `--trail` | `#D9C4A3` | o caminho desenhado (terra batida) |
| `--growth` | `#3D7A5D` | **verde-trilha** — progresso, streak, feito, crescimento |
| `--growth-soft` | `#E3EDE6` | fundo de badge/realce verde |
| `--clay` | `#C65D3B` | **terracota** — ação, foco, "agora", o tomate |
| `--clay-soft` | `#F6E4DC` | fundo de badge/realce terracota |
| `--forest` | `#20302A` | card escuro (o único fundo escuro: cronômetro, destaque) |

Regra dos dois acentos: **verde = crescimento** (o que você conquistou), **terracota = ação** (o que fazer agora). Nunca trocar os papéis.

Modo escuro: **não tem** por enquanto. O design é comprometido com a luz. `color-scheme: light`.

### Tipografia (Google Fonts via `next/font`)

| Papel | Fonte | Onde |
|---|---|---|
| Display + números grandes | **Fraunces** (opsz alto, soft, `wght` 400–600, leve `SOFT`) | títulos de tela, o número do streak, o "%" da evolução, o tempo do foco em telas grandes |
| Interface + corpo | **Inter** | tudo: nav, labels, checklist, textos |
| Cronômetro | **Space Mono** | só o countdown do pomodoro |

Escala: display `clamp(1.75rem, 4vw, 2.75rem)` / h2 `1.15rem` / corpo `0.95rem` / label `0.72rem` uppercase `tracking-wide` cor `--ink-soft`.

### Ilustração
- SVG, **traço único ~2px**, cor `--ink`, imperfeito de propósito (cantos não perfeitos, linha viva).
- Preenchimentos só nos acentos (`--growth`, `--clay`, `--trail`).
- Assets: o **tomate** (tela de foco), o **caminho serpenteante** (tela Trilha), **marcos** do caminho (pedra = dia, bandeira = onde você está), pequenos spots pra estados vazios.
- Nada de ícone 3D renderizado, nada de foto.

### Componentes

- **Card:** fundo `--paper`, borda `1px --line`, `border-radius: 18px`, sombra muito leve (`0 1px 2px rgba(43,38,33,.04), 0 8px 24px -12px rgba(43,38,33,.08)`).
- **Card escuro:** fundo `--forest`, texto `#F3EDE1`, usado só pro cronômetro e 1 destaque por tela no máximo.
- **Stat:** número grande em Fraunces, label pequeno uppercase embaixo. Badge de tendência opcional (seta ↑ em `--growth`).
- **Botão primário:** fundo `--ink`, texto `--paper`, `border-radius: 999px`, peso 500. **Botão de ação/foco:** fundo `--clay`. **Secundário:** borda `--line`, texto `--ink`.
- **Checkbox:** quadrado `6px` radius, borda `--line`; feito = fundo `--growth` + check branco. Tarefa feita pelo Telegram ganha um selinho "no Telegram".
- **Nav lateral:** mark no topo + itens (ícone + label). Item ativo: fundo `--paper-2`, barra `--clay` de 3px à esquerda.
- **Gráfico de barras:** barras com **hachura diagonal** (não preenchimento sólido) em `--growth` — assinatura vinda da referência, dá o ar "feito à mão".

### Assinatura da marca
A tela **Trilha**: um **caminho de terra serpenteante** desenhado que sobe a página. Cada semana é um trecho; cada dia é uma **pedra** no caminho; onde você está tem uma **bandeirinha**; o que já passou fica preenchido em `--growth`, o que falta em `--trail` tracejado. Você rola a página e *vê a jornada*. É a tela que a Aristótel.IA é lembrada por — não é lista, é caminho.

### Marca
Wordmark **"Aristótel.IA"** em Fraunces. O ponto do "í" é uma **pedrinha do caminho** (círculo `--clay`). Ícone (favicon/nav): uma **bandeira num morrinho** de traço único.

### Piso de qualidade (sem anunciar)
Responsivo até mobile (nav vira barra inferior). Foco de teclado visível (anel `--clay`). `prefers-reduced-motion` respeitado. Animação só onde serve: a bandeira da trilha balança de leve; o tomate "amadurece" (preenche) conforme o foco passa; entrada de página com fade curto. Nada além disso.
