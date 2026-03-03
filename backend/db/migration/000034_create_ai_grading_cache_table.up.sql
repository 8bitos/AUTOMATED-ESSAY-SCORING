CREATE TABLE ai_grading_cache (
    request_hash TEXT PRIMARY KEY,
    score TEXT NOT NULL,
    feedback TEXT NOT NULL,
    aspect_scores JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    hit_count BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_ai_grading_cache_last_used_at
ON ai_grading_cache(last_used_at DESC);
