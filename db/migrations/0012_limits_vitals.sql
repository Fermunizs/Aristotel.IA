-- Recurso "D": (D1) aviso de quase-limite das chaves de LLM + (D2) vitais da VM.
--
-- D1: guarda, por chamada de LLM, o que os headers x-ratelimit-* disseram
--     (nem todo provedor manda — colunas nullable). Alimenta /admin/consumo.
-- D2: tabela de 1 linha (upsert por id=1) com a saúde da VM Oracle. Alimenta
--     /admin/servidor. O bot atualiza a cada 60s (bot/vitals.py).

-- ── D1: snapshot de rate-limit por chamada ──────────────────────────
ALTER TABLE llm_usage ADD COLUMN rl_remaining_requests INT;
ALTER TABLE llm_usage ADD COLUMN rl_remaining_tokens   BIGINT;
ALTER TABLE llm_usage ADD COLUMN rl_limit_requests     INT;
ALTER TABLE llm_usage ADD COLUMN rl_limit_tokens       BIGINT;
ALTER TABLE llm_usage ADD COLUMN rl_reset_seconds      REAL;

-- eventos de sistema (llm:near_limit:<provider>) não pertencem a um usuário
ALTER TABLE events ALTER COLUMN user_id DROP NOT NULL;

-- ── D2: vitais da VM — 1 linha só, atualizada in-place ──────────────
CREATE TABLE system_vitals (
  id                 INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cpu_load_1         REAL,
  cpu_load_5         REAL,
  cpu_load_15        REAL,
  mem_total_mb       INT,
  mem_available_mb   INT,
  swap_total_mb      INT,
  swap_free_mb       INT,
  disk_total_gb      REAL,
  disk_free_gb       REAL,
  services           JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {"aristotelia":true,"arist-pg":true,...}
  pg_size_bytes      BIGINT,
  last_backup_at     TIMESTAMPTZ,
  last_backup_bytes  BIGINT,
  bot_uptime_seconds BIGINT,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
