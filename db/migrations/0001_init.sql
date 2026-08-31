-- AristotelIA — schema inicial (Fase 1, multiusuário)
-- Fonte da verdade do schema. Aplicado pelo runner do bot (bot/db.py) e consumido pelo web (Drizzle mapeia por cima).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()

-- ── Usuários ───────────────────────────────────────────────────────────
CREATE TABLE users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id   BIGINT UNIQUE,               -- null até a pessoa dar /start
  telegram_username  TEXT,
  name               TEXT,
  timezone           TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  role               TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','superadmin')),
  status             TEXT NOT NULL DEFAULT 'onboarding'
                       CHECK (status IN ('onboarding','active','paused')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at       TIMESTAMPTZ
);

-- ── Login no painel web: código de uso único gerado pelo bot ───────────
CREATE TABLE auth_codes (
  code        TEXT PRIMARY KEY,                    -- 6 dígitos
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ
);

CREATE TABLE web_sessions (
  token       TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acts_as     UUID REFERENCES users(id) ON DELETE SET NULL,  -- superadmin impersonando
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);

-- senha do superadmin (hash) — 1 linha só
CREATE TABLE admin_credentials (
  user_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash  TEXT NOT NULL
);

-- ── Preferências / setup ──────────────────────────────────────────────
CREATE TABLE preferences (
  user_id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  minutes_per_day    INT NOT NULL DEFAULT 30,
  wake_time          TIME NOT NULL DEFAULT '06:00',
  sleep_time         TIME NOT NULL DEFAULT '22:00',
  quiet_start        TIME,
  quiet_end          TIME,
  coach_tone         TEXT NOT NULL DEFAULT 'sincero',
  enabled_functions  JSONB NOT NULL DEFAULT
    '["daily_motivation","daily_learning_guide","micro_learning","learning_check","daily_insight","application_challenge","daily_review"]'::jsonb,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Trilha de aprendizagem (uma por usuário, por enquanto) ─────────────
CREATE TABLE learning_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal          TEXT NOT NULL,                     -- "aprender JavaScript pra backend"
  level         TEXT NOT NULL,                     -- "iniciante" | "sei o básico" | ...
  weeks         JSONB NOT NULL,                    -- [{n, theme, days:[{d,topic,goal}]}]
  current_week  INT NOT NULL DEFAULT 1,
  current_day   INT NOT NULL DEFAULT 1,
  known_topics  JSONB NOT NULL DEFAULT '[]'::jsonb,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON learning_plans (user_id) WHERE active;

-- ── Checklist do dia ──────────────────────────────────────────────────
CREATE TABLE tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day         DATE NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('trilha','desafio','pomodoro','manual')),
  title       TEXT NOT NULL,
  detail      TEXT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','skipped')),
  done_via    TEXT CHECK (done_via IN ('telegram','web','auto')),
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  done_at     TIMESTAMPTZ
);
CREATE INDEX ON tasks (user_id, day);

-- ── Log de eventos (evolução) ─────────────────────────────────────────
CREATE TABLE events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day         DATE NOT NULL,
  kind        TEXT NOT NULL,        -- quiz | review | desafio | foco | msg_enviada:<fn> | jasei | ...
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON events (user_id, day);
CREATE INDEX ON events (user_id, kind);

-- ── Sessões de foco (pomodoro) ────────────────────────────────────────
CREATE TABLE focus_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id     UUID REFERENCES tasks(id) ON DELETE SET NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at    TIMESTAMPTZ,
  minutes     INT,
  completed   BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX ON focus_sessions (user_id, started_at);

-- ── Banco de conteúdo ─────────────────────────────────────────────────
CREATE TABLE content_ideas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme        TEXT NOT NULL,
  type         TEXT,
  format       TEXT,
  title        TEXT,
  note         TEXT,
  origin_date  DATE,
  published    BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON content_ideas (user_id);

-- ── Streaks ───────────────────────────────────────────────────────────
CREATE TABLE streaks (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL DEFAULT 'diario',   -- 'diario' = fez o review 1%
  current     INT NOT NULL DEFAULT 0,
  best        INT NOT NULL DEFAULT 0,
  last_date   DATE,
  PRIMARY KEY (user_id, kind)
);

-- ── Estado da conversa do bot (interação pendente) ────────────────────
CREATE TABLE bot_state (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  pending     JSONB,                              -- {type:'quiz'|'review'|'onboarding'|..., ...}
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Outbox: mensagens que o web quer que o bot envie ──────────────────
CREATE TABLE outbox (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at     TIMESTAMPTZ
);
CREATE INDEX ON outbox (created_at) WHERE sent_at IS NULL;
