
ALTER TABLE essay_questions
ADD COLUMN module_id UUID REFERENCES modules(id) ON DELETE SET NULL;
