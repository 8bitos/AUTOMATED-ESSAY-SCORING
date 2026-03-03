DROP INDEX IF EXISTS idx_classes_teacher_archived;

ALTER TABLE classes
  DROP COLUMN IF EXISTS is_archived;
