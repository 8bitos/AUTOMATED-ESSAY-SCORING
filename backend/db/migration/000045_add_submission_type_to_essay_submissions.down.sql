DROP INDEX IF EXISTS idx_essay_submissions_submission_type;

ALTER TABLE essay_submissions
DROP CONSTRAINT IF EXISTS chk_essay_submissions_submission_type;

ALTER TABLE essay_submissions
DROP COLUMN IF EXISTS submission_type;
