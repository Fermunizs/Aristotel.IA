-- Cache de conteúdo compartilhado do dia (motivação, insight): gerado 1x/dia
-- e reusado por todo mundo — não faz sentido 1 chamada de LLM por usuário
-- pra uma frase genérica. Escala melhor conforme o número de usuários cresce.

CREATE TABLE content_cache (
  kind        TEXT NOT NULL,          -- 'motivation' | 'insight'
  day         DATE NOT NULL,
  text        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, day)
);
