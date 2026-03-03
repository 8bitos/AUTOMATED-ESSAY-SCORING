DROP INDEX IF EXISTS idx_materials_class_display_order;

ALTER TABLE materials
DROP COLUMN IF EXISTS display_order;
