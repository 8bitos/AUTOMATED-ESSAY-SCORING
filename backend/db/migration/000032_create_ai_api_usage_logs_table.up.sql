CREATE TABLE ai_api_usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feature TEXT NOT NULL,
    model_name TEXT NOT NULL,
    status TEXT NOT NULL,
    error_type TEXT,
    error_message TEXT,
    prompt_tokens BIGINT NOT NULL DEFAULT 0,
    candidates_tokens BIGINT NOT NULL DEFAULT 0,
    total_tokens BIGINT NOT NULL DEFAULT 0,
    response_time_ms BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_api_usage_logs_created_at ON ai_api_usage_logs(created_at DESC);
CREATE INDEX idx_ai_api_usage_logs_feature_created_at ON ai_api_usage_logs(feature, created_at DESC);
CREATE INDEX idx_ai_api_usage_logs_status_created_at ON ai_api_usage_logs(status, created_at DESC);
