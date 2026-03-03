
ALTER TABLE essay_questions
DROP COLUMN IF EXISTS level_kognitif,
DROP COLUMN IF EXISTS ideal_answer,
DROP COLUMN IF EXISTS keywords,
DROP COLUMN IF EXISTS weight;
