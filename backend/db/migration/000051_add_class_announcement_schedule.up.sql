ALTER TABLE classes
ADD COLUMN announcement_starts_at TIMESTAMPTZ NULL,
ADD COLUMN announcement_ends_at TIMESTAMPTZ NULL;
