CREATE TABLE grade_appeals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES essay_submissions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES essay_questions(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason_type TEXT NOT NULL DEFAULT 'nilai_tidak_sesuai',
    reason_text TEXT NOT NULL,
    attachment_url TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    teacher_response TEXT,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE grade_appeals
    ADD CONSTRAINT chk_grade_appeals_status
    CHECK (status IN ('open', 'in_review', 'resolved_accepted', 'resolved_rejected', 'withdrawn'));

CREATE INDEX idx_grade_appeals_student_id ON grade_appeals(student_id);
CREATE INDEX idx_grade_appeals_class_id ON grade_appeals(class_id);
CREATE INDEX idx_grade_appeals_submission_id ON grade_appeals(submission_id);
CREATE INDEX idx_grade_appeals_status ON grade_appeals(status);
CREATE UNIQUE INDEX uq_grade_appeals_active_per_submission_student
    ON grade_appeals(submission_id, student_id)
    WHERE status IN ('open', 'in_review');
