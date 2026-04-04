ALTER TABLE question_bank_entries
ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_question_bank_entries_tags
ON question_bank_entries USING GIN (tags);
