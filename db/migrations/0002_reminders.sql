-- Motor de lembretes: a pessoa desenha o próprio acompanhamento.
-- Substitui preferences.enabled_functions + DEFAULT_TIMES fixos do bot.

CREATE TABLE reminders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN (
                  'motivacao','guia','pilula','quiz','insight','desafio',
                  'checkin_manha','checkin_noite','livre')),
  custom_text   TEXT,                        -- só quando kind = 'livre'
  schedule_type TEXT NOT NULL DEFAULT 'fixo' CHECK (schedule_type IN ('fixo','periodo')),
  at_time       TIME,                        -- schedule_type = 'fixo'
  period        TEXT CHECK (period IN ('manha','tarde','noite')),  -- schedule_type = 'periodo'
  days          JSONB NOT NULL DEFAULT '[0,1,2,3,4,5,6]'::jsonb,   -- 0=segunda ... 6=domingo
  channel       TEXT NOT NULL DEFAULT 'telegram' CHECK (channel IN ('telegram','push','email')),
  enabled       BOOLEAN NOT NULL DEFAULT true,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON reminders (user_id) WHERE enabled;

-- horários dos "períodos" (o bot resolve 'periodo' -> hora usando isto)
-- manha=08:00, tarde=15:00, noite=20:00  (constantes no bot/config.py)

-- plano (sem enforcement ainda; futuro: free = 5 lembretes ativos)
ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'
  CHECK (plan IN ('free','pro'));

-- flag pro bot re-agendar quando a pessoa mexe nos lembretes pelo painel
ALTER TABLE bot_state ADD COLUMN reminders_dirty BOOLEAN NOT NULL DEFAULT true;

-- ── backfill: cria o conjunto padrão pra quem já existe ────────────────
INSERT INTO reminders (user_id, kind, at_time, sort_order)
SELECT u.id, x.kind, x.at_time, x.ord
FROM users u
CROSS JOIN (VALUES
  ('motivacao'::text,     '06:00'::time, 0),
  ('guia',                '08:00',       1),
  ('pilula',              '09:00',       2),
  ('quiz',                '10:30',       3),
  ('insight',             '15:00',       4),
  ('desafio',             '16:00',       5),
  ('checkin_noite',       '20:00',       6)
) AS x(kind, at_time, ord)
WHERE u.status = 'active';
