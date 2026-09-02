-- Reforço de integridade (Backlog.md B05/B22). Nada de coluna nova — só torna
-- impossível no nível do banco o que hoje só a aplicação evita.

-- ── 1 trilha ativa por usuário (era só índice comum) ──────────────────
-- create_plan() já desativa as outras antes de inserir; isto garante que uma
-- corrida ou bug nunca deixe 2 ativas. Verificado: 0 usuários violam hoje.
DROP INDEX IF EXISTS learning_plans_user_id_idx;
CREATE UNIQUE INDEX learning_plans_one_active
  ON learning_plans (user_id) WHERE active;

-- ── tarefa única por (usuário, dia, origem, título) ───────────────────
-- add_task() faz SELECT-então-INSERT pra deduplicar — tem janela de corrida.
-- Com o índice, o INSERT duplicado simplesmente falha (a app ignora).
CREATE UNIQUE INDEX IF NOT EXISTS tasks_dedup
  ON tasks (user_id, day, source, title);

-- ── busca por kind sem escopo de usuário (retenção, near-limit) ───────
CREATE INDEX IF NOT EXISTS events_kind_idx ON events (kind);

-- ── linhas-filhas garantidas pra todo usuário (defensivo) ────────────
-- get_or_create_user() já cria; isto cobre qualquer conta antiga sem elas,
-- pra memória/pending/streak nunca virarem no-op silencioso.
INSERT INTO preferences (user_id) SELECT id FROM users ON CONFLICT DO NOTHING;
INSERT INTO streaks (user_id)     SELECT id FROM users ON CONFLICT DO NOTHING;
INSERT INTO bot_state (user_id)   SELECT id FROM users ON CONFLICT DO NOTHING;
