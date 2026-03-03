ALTER TABLE essay_submissions
ADD COLUMN IF NOT EXISTS ai_grading_status TEXT NOT NULL DEFAULT 'queued',
ADD COLUMN IF NOT EXISTS ai_graded_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ai_grading_error TEXT;

CREATE INDEX IF NOT EXISTS idx_essay_submissions_ai_grading_status
ON essay_submissions(ai_grading_status);
