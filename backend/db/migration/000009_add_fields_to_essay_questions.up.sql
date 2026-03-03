
ALTER TABLE essay_questions
ADD COLUMN level_kognitif TEXT,
ADD COLUMN ideal_answer TEXT,
ADD COLUMN keywords TEXT[],
ADD COLUMN weight NUMERIC;
