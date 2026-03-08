ALTER TABLE classes
DROP COLUMN IF EXISTS announcement_tone,
DROP COLUMN IF EXISTS announcement_content,
DROP COLUMN IF EXISTS announcement_title,
DROP COLUMN IF EXISTS announcement_enabled;
