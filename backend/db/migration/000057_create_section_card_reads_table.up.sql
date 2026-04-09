CREATE TABLE section_card_reads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    section_card_id TEXT NOT NULL,
    read_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_section_card_reads_unique
    ON section_card_reads(student_id, material_id, section_card_id);

CREATE INDEX IF NOT EXISTS idx_section_card_reads_class
    ON section_card_reads(class_id);

CREATE INDEX IF NOT EXISTS idx_section_card_reads_student
    ON section_card_reads(student_id);
