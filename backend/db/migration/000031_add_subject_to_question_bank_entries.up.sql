ALTER TABLE question_bank_entries
ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_question_bank_entries_subject
ON question_bank_entries(subject);
