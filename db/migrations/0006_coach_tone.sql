-- Personalidade da treinadora escolhida por cada pessoa.
UPDATE preferences SET coach_tone = 'equilibrada' WHERE coach_tone NOT IN ('gentil','equilibrada','durona');
ALTER TABLE preferences ALTER COLUMN coach_tone SET DEFAULT 'equilibrada';
ALTER TABLE preferences ADD CONSTRAINT coach_tone_ck
  CHECK (coach_tone IN ('gentil','equilibrada','durona'));
