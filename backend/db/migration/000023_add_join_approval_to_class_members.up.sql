ALTER TABLE class_members
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

UPDATE class_members
SET status = 'approved',
    requested_at = COALESCE(requested_at, joined_at, NOW()),
    approved_at = COALESCE(approved_at, joined_at, NOW())
WHERE status IS NULL OR status = '' OR approved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_class_members_class_status ON class_members(class_id, status);
