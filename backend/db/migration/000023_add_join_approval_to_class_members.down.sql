DROP INDEX IF EXISTS idx_class_members_class_status;

ALTER TABLE class_members
  DROP COLUMN IF EXISTS approved_at,
  DROP COLUMN IF EXISTS requested_at,
  DROP COLUMN IF EXISTS status;
