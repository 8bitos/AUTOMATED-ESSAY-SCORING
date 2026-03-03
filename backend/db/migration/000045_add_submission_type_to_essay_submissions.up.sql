ALTER TABLE essay_submissions
ADD COLUMN IF NOT EXISTS submission_type TEXT NOT NULL DEFAULT 'essay';

UPDATE essay_submissions es
SET submission_type = CASE
  WHEN eq.keywords IS NOT NULL AND 'tugas_submission' = ANY(eq.keywords) THEN 'task'
  ELSE 'essay'
END
FROM essay_questions eq
WHERE eq.id = es.soal_id;

ALTER TABLE essay_submissions
DROP CONSTRAINT IF EXISTS chk_essay_submissions_submission_type;

ALTER TABLE essay_submissions
ADD CONSTRAINT chk_essay_submissions_submission_type
CHECK (submission_type IN ('essay', 'task'));

CREATE INDEX IF NOT EXISTS idx_essay_submissions_submission_type
ON essay_submissions(submission_type);
