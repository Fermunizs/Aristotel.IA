-- Memória curta de conversa: as últimas mensagens trocadas com a treinadora.
ALTER TABLE bot_state ADD COLUMN history JSONB NOT NULL DEFAULT '[]'::jsonb;
