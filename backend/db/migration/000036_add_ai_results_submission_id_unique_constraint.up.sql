ALTER TABLE ai_results
    ADD CONSTRAINT ai_results_submission_id_key UNIQUE (submission_id);
