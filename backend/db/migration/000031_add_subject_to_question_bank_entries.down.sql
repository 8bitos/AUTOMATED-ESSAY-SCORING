DROP INDEX IF EXISTS idx_question_bank_entries_subject;

ALTER TABLE question_bank_entries
DROP COLUMN IF EXISTS subject;
