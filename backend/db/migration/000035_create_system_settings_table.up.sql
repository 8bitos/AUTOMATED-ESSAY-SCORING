CREATE TABLE system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Default grading mode: queued (current async queue behavior).
INSERT INTO system_settings (key, value, description)
VALUES ('grading_mode', 'queued', 'Mode penilaian AI: queued = asynchronous queue, instant = inline grading')
ON CONFLICT (key) DO NOTHING;
