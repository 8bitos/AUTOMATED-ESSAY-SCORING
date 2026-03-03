ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_classes_teacher_archived ON classes(teacher_id, is_archived);
