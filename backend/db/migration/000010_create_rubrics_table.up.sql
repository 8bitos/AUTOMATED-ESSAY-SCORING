
CREATE TABLE rubrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES essay_questions(id) ON DELETE CASCADE,
    nama_aspek TEXT NOT NULL,
    deskripsi TEXT,
    max_score INTEGER NOT NULL,
    descriptors JSONB NOT NULL,
    bobot DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rubrics_question_id ON rubrics(question_id);
