-- Níveis de acesso (role) e planos (plan).

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'admin', 'superadmin'));

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_check;
ALTER TABLE users ADD CONSTRAINT users_plan_check
  CHECK (plan IN ('free', 'pro', 'unlimited'));

-- limite de lembretes por plano (o web consulta):
--   free       -> 5 ativos
--   pro        -> 30
--   unlimited  -> sem limite
