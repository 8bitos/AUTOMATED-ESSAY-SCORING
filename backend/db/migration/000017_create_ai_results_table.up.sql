CREATE TABLE ai_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES essay_submissions(id) ON DELETE CASCADE,
    skor_ai NUMERIC(5, 2) NOT NULL,
    umpan_balik_ai TEXT,
    raw_response JSONB,
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);