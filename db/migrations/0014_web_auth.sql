-- Acesso sem Telegram (Backlog B23): cadastro web + login por link pessoal +
-- webhook do Kiwify. Ver docs/superpowers/specs/2026-09-02-acesso-web-e-kiwify-design.md
-- Nada quebra pra quem já é Telegram — todas as colunas novas são nullable/default.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email          TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub     TEXT;   -- reservado p/ a fase Google
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url     TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_via     TEXT NOT NULL DEFAULT 'telegram';
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_token    TEXT;   -- link pessoal (bearer), rotacionável
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_token_at TIMESTAMPTZ;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_signup_via_check;
ALTER TABLE users ADD  CONSTRAINT users_signup_via_check CHECK (signup_via IN ('telegram','web'));

CREATE UNIQUE INDEX IF NOT EXISTS users_email_key       ON users (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_key  ON users (google_sub)   WHERE google_sub IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_login_token_key ON users (login_token)  WHERE login_token IS NOT NULL;

-- upgrades que chegaram antes de o usuário existir (paga no Kiwify, cria conta depois)
CREATE TABLE IF NOT EXISTS pending_upgrades (
  email        TEXT PRIMARY KEY,       -- sempre lower()
  plan         TEXT NOT NULL,
  kiwify_order TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- log cru de todo webhook do Kiwify (debug + auditoria + calibrar o formato real)
CREATE TABLE IF NOT EXISTS kiwify_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   TEXT,
  order_id     TEXT,
  email        TEXT,
  matched_user UUID REFERENCES users(id) ON DELETE SET NULL,
  ok           BOOLEAN NOT NULL DEFAULT false,
  raw          JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kiwify_events_created_idx ON kiwify_events (created_at);
