ALTER TABLE section_contents
DROP CONSTRAINT IF EXISTS section_contents_content_type_check;

ALTER TABLE section_contents
ADD CONSTRAINT section_contents_content_type_check
CHECK (content_type IN ('materi', 'soal', 'tugas'));
