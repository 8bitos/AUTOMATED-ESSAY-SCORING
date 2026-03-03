
CREATE TABLE class_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (class_id, user_id)
);

CREATE INDEX idx_class_members_class_id ON class_members(class_id);
CREATE INDEX idx_class_members_user_id ON class_members(user_id);
