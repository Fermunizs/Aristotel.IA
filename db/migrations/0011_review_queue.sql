-- Trilha adaptativa: fila de tópicos pra revisar quando a pessoa erra o quiz.
-- daily_learning_guide consome 1 item da fila antes de seguir pro próximo tópico
-- novo (sem avançar o dia — o tópico novo só espera 1 dia a mais).
ALTER TABLE learning_plans ADD COLUMN review_queue JSONB NOT NULL DEFAULT '[]'::jsonb;
