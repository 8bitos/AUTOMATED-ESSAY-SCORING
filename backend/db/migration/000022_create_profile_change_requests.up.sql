CREATE TABLE profile_change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_changes JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reason TEXT,
    reviewer_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_profile_change_requests_user_id ON profile_change_requests(user_id);
CREATE INDEX idx_profile_change_requests_status ON profile_change_requests(status);

