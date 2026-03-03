UPDATE essay_questions
SET rubrics = '[]'::jsonb
WHERE rubrics IS NULL OR rubrics::text = 'null' OR rubrics::text = '';