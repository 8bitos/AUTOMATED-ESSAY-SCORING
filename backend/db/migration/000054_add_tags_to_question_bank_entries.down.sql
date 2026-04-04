DROP INDEX IF EXISTS idx_question_bank_entries_tags;
ALTER TABLE question_bank_entries DROP COLUMN IF EXISTS tags;
