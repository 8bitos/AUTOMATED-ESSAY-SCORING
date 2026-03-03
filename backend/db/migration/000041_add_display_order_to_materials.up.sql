ALTER TABLE materials
ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY class_id ORDER BY created_at DESC, id DESC) AS rn
  FROM materials
)
UPDATE materials m
SET display_order = ranked.rn
FROM ranked
WHERE m.id = ranked.id;

CREATE INDEX IF NOT EXISTS idx_materials_class_display_order
ON materials(class_id, display_order);
