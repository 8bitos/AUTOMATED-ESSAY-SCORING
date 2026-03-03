DROP INDEX IF EXISTS idx_essay_submissions_ai_grading_status;

ALTER TABLE essay_submissions
DROP COLUMN IF EXISTS ai_grading_error,
DROP COLUMN IF EXISTS ai_graded_at,
DROP COLUMN IF EXISTS ai_grading_status;
