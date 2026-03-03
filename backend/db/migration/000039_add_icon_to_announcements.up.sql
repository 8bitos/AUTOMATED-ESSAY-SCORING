ALTER TABLE announcements
ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT 'info'
CHECK (icon IN ('info', 'warning', 'danger', 'bell'));
