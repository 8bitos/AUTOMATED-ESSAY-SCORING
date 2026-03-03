CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('banner', 'running_text')),
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    target_role TEXT NOT NULL DEFAULT 'all' CHECK (target_role IN ('all', 'student', 'teacher')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    starts_at TIMESTAMPTZ NULL,
    ends_at TIMESTAMPTZ NULL,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_active_role_time
    ON announcements (is_active, target_role, starts_at, ends_at, created_at DESC);
