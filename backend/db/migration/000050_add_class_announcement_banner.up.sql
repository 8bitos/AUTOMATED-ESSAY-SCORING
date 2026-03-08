ALTER TABLE classes
ADD COLUMN announcement_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN announcement_title TEXT NOT NULL DEFAULT '',
ADD COLUMN announcement_content TEXT NOT NULL DEFAULT '',
ADD COLUMN announcement_tone TEXT NOT NULL DEFAULT 'info';
