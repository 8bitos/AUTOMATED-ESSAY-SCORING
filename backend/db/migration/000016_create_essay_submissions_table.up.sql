CREATE TABLE essay_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    soal_id UUID NOT NULL REFERENCES essay_questions(id) ON DELETE CASCADE,
    siswa_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    teks_jawaban TEXT NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
