ALTER TABLE classes
ADD COLUMN IF NOT EXISTS join_policy TEXT NOT NULL DEFAULT 'approval_required';

ALTER TABLE classes
DROP CONSTRAINT IF EXISTS chk_classes_join_policy;

ALTER TABLE classes
ADD CONSTRAINT chk_classes_join_policy
CHECK (join_policy IN ('approval_required', 'open', 'closed'));
