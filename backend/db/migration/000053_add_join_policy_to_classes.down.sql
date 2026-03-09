ALTER TABLE classes
DROP CONSTRAINT IF EXISTS chk_classes_join_policy;

ALTER TABLE classes
DROP COLUMN IF EXISTS join_policy;
