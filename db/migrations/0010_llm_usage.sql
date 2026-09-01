-- Telemetria de consumo de LLM: 1 linha por chamada.
-- Alimenta o dashboard de consumo no painel de superadmin (quem gasta, qual
-- provedor atende, quanto de fallback, quantos 429).

CREATE TABLE llm_usage (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,  -- null = chamada de sistema
  source        TEXT NOT NULL DEFAULT 'bot',                    -- 'bot' | 'web'
  tag           TEXT,                                           -- 'guia' | 'quiz' | 'chat' | 'trilha' | ...
  provider      TEXT NOT NULL,                                  -- 'groq' | 'gemini' | 'openrouter' | 'fallback'
  model         TEXT,
  prompt_tokens     INT NOT NULL DEFAULT 0,
  completion_tokens INT NOT NULL DEFAULT 0,
  fallback      BOOLEAN NOT NULL DEFAULT false,                 -- true = não foi o 1º provedor da cadeia
  ok            BOOLEAN NOT NULL DEFAULT true,                  -- false = caiu no pool local
  status        TEXT,                                           -- 'ok' | '429' | 'error'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON llm_usage (created_at);
CREATE INDEX ON llm_usage (user_id, created_at);
