-- Camada de LIMITES (global, não editável pelos usuários) + ajuste pessoal do usuário.

INSERT INTO app_settings (key, value) VALUES
  ('nunca',       'Nunca dê conselho médico, jurídico ou de investimento específico. Nunca prometa resultado garantido. Nunca fale de política ou religião. Se a pessoa insistir num tema fora do seu papel, redirecione pro objetivo dela.'),
  ('teto_tokens', '600')
ON CONFLICT (key) DO NOTHING;

-- pedido pessoal do usuário pra treinadora (opcional)
ALTER TABLE preferences ADD COLUMN coach_note TEXT NOT NULL DEFAULT '';
