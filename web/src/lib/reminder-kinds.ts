// Constantes puras — seguras pra importar no cliente (sem db).

export const KINDS = {
  motivacao: { label: "Provocação da manhã", desc: "Uma frase sincera pra começar o dia." },
  guia: { label: "O que fazer hoje", desc: "A treinadora diz exatamente o passo do dia." },
  pilula: { label: "Pílula de conteúdo", desc: "5–10 min sobre o tópico de hoje." },
  quiz: { label: "Quiz rápido", desc: "Um teste curto pra fixar o que você viu." },
  insight: { label: "Insight", desc: "Algo além da matéria — carreira, produto, visão." },
  desafio: { label: "Desafio de 10 min", desc: "Pôr a mão na massa, sem pesquisar antes." },
  checkin_manha: { label: "Check-in da manhã", desc: "Um empurrão pra arrancar." },
  checkin_noite: { label: "Fechamento do dia", desc: "O que você fez pra evoluir 1%." },
  livre: { label: "Lembrete seu", desc: "Um texto que você escreve." },
} as const;

export type Kind = keyof typeof KINDS;

export const CHANNELS = {
  telegram: { label: "Telegram", ready: true },
  push: { label: "Navegador", ready: true },
  email: { label: "E-mail", ready: false },
} as const;

export type Channel = keyof typeof CHANNELS;

export const DAY_LABELS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
