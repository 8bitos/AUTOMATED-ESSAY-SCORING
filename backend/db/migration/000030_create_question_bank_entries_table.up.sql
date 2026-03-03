CREATE TABLE question_bank_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    source_material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
    source_question_id UUID REFERENCES essay_questions(id) ON DELETE SET NULL,
    teks_soal TEXT NOT NULL,
    level_kognitif TEXT,
    keywords TEXT[],
    ideal_answer TEXT,
    weight NUMERIC(10,2),
    rubrics JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_question_bank_entries_created_by ON question_bank_entries(created_by);
CREATE INDEX idx_question_bank_entries_class_id ON question_bank_entries(class_id);
CREATE INDEX idx_question_bank_entries_source_material_id ON question_bank_entries(source_material_id);
