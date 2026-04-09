**Automatic Essay Grading Database Documentation**

**Enum Definitions**
Enum `user_role`: `student`, `teacher`, `superadmin`.  
Enum `essay_submission_type`: `essay`, `task`.

**Table Users**  
The `users` table stores all accounts that interact with the essay grading system. Each user has a UUID primary key, login credentials, and a role (`user_role`) that determines access level. The `created_at` column records when the account was created. This table is the identity backbone for submissions and reviews.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `nama_lengkap` | `text` | Not null |
| `email` | `text` | Not null, unique |
| `password` | `text` | Not null |
| `peran` | `user_role` | Not null |
| `created_at` | `timestamp` | Default `CURRENT_TIMESTAMP` |

**Table Materials**  
The `materials` table stores learning materials that provide context for essay questions. Each material has a UUID primary key and a title. This table anchors questions to the relevant learning content.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `judul` | `text` | Not null |
| `created_at` | `timestamp` | Default `CURRENT_TIMESTAMP` |

**Table Modules**  
The `modules` table stores uploaded module files tied to a material. Each module references one material and includes a name and file URL. This supports organizing content into smaller units.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `material_id` | `uuid` | Not null |
| `nama_modul` | `varchar(255)` | Not null |
| `file_url` | `text` | Not null |
| `created_at` | `timestamp` | Default `CURRENT_TIMESTAMP` |

**Table Essay Questions**  
The `essay_questions` table stores the essay prompts and grading configuration. Each question belongs to a material and can optionally reference a module. It includes cognitive level, ideal answer, keywords, weight, rubric JSON, and rounding rules to control automated scoring.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `material_id` | `uuid` | Not null |
| `teks_soal` | `text` | Not null |
| `module_id` | `uuid` | Nullable |
| `level_kognitif` | `text` | Nullable |
| `ideal_answer` | `text` | Nullable |
| `keywords` | `text[]` | Nullable |
| `weight` | `numeric` | Nullable |
| `rubrics` | `json` | Nullable |
| `created_at` | `timestamp` | Default `CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp` | Default `CURRENT_TIMESTAMP` |
| `round_score_to_5` | `boolean` | Default `false` |
| `round_score_step` | `float` | Default `5` |

**Table Rubrics**  
The `rubrics` table stores detailed scoring criteria per essay question. Each rubric defines scoring aspects, descriptors, and weights that the AI or teacher can follow for consistent evaluation.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `question_id` | `uuid` | Not null |
| `nama_aspek` | `text` | Not null |
| `deskripsi` | `text` | Nullable |
| `max_score` | `integer` | Not null |
| `descriptors` | `json` | Not null |
| `bobot` | `float` | Not null |
| `created_at` | `timestamp` | Default `CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp` | Default `CURRENT_TIMESTAMP` |

**Table Essay Submissions**  
The `essay_submissions` table stores student answers to essay questions. Each submission is linked to a question and the student who submitted it. It also tracks AI grading lifecycle fields and attempt count.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `soal_id` | `uuid` | Not null |
| `siswa_id` | `uuid` | Not null |
| `teks_jawaban` | `text` | Not null |
| `submitted_at` | `timestamp` | Default `CURRENT_TIMESTAMP` |
| `ai_grading_status` | `text` | Default `'queued'` |
| `ai_graded_at` | `timestamp` | Nullable |
| `ai_grading_error` | `text` | Nullable |
| `submission_type` | `essay_submission_type` | Default `'essay'` |
| `attempt_count` | `integer` | Default `1` |

**Table AI Results**  
The `ai_results` table stores the AI-generated score and feedback for each submission. It also records the raw response and RAG logs for transparency and auditing.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `submission_id` | `uuid` | Not null |
| `skor_ai` | `numeric` | Nullable |
| `umpan_balik_ai` | `text` | Nullable |
| `raw_response` | `json` | Nullable |
| `logs_rag` | `text` | Nullable |
| `generated_at` | `timestamp` | Default `CURRENT_TIMESTAMP` |

**Table Teacher Reviews**  
The `teacher_reviews` table stores the human evaluation results that confirm or override AI grading. Each review is linked to one submission and the reviewing teacher.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `submission_id` | `uuid` | Not null |
| `teacher_id` | `uuid` | Not null |
| `revised_score` | `numeric` | Nullable |
| `teacher_feedback` | `text` | Nullable |
| `created_at` | `timestamp` | Default `CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp` | Default `CURRENT_TIMESTAMP` |

**Table AI API Usage Logs**  
The `ai_api_usage_logs` table records AI service calls for monitoring performance and cost. It stores model identifiers, status, token usage, error details, and response latency.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `feature` | `text` | Not null |
| `model_name` | `text` | Not null |
| `status` | `text` | Not null |
| `error_type` | `text` | Nullable |
| `error_message` | `text` | Nullable |
| `prompt_tokens` | `bigint` | Nullable |
| `candidates_tokens` | `bigint` | Nullable |
| `total_tokens` | `bigint` | Nullable |
| `response_time_ms` | `bigint` | Nullable |
| `created_at` | `timestamp` | Default `CURRENT_TIMESTAMP` |

**Table AI Grading Cache**  
The `ai_grading_cache` table stores cached AI grading results for identical requests. It reduces costs and latency by reusing previous outputs and tracks cache usage over time.

| Column | Type | Constraints/Notes |
|---|---|---|
| `request_hash` | `text` | Primary key |
| `score` | `text` | Not null |
| `feedback` | `text` | Not null |
| `aspect_scores` | `json` | Nullable |
| `created_at` | `timestamp` | Default `CURRENT_TIMESTAMP` |
| `last_used_at` | `timestamp` | Default `CURRENT_TIMESTAMP` |
| `hit_count` | `bigint` | Default `1` |

**Relationships (Purpose and Meaning)**  
The relationships below explain why each foreign key exists and how it supports the essay grading workflow.

| Relation | Purpose |
|---|---|
| `modules.material_id -> materials.id` | Each module belongs to a material, enabling content to be grouped under a learning resource. |
| `essay_questions.material_id -> materials.id` | Each question is tied to a material so the prompt is anchored to its context. |
| `essay_questions.module_id -> modules.id` | Optional link when a question is part of a specific module. |
| `rubrics.question_id -> essay_questions.id` | Rubrics define scoring criteria for a specific question. |
| `essay_submissions.soal_id -> essay_questions.id` | Each submission answers one question. |
| `essay_submissions.siswa_id -> users.id` | Each submission is owned by a student user. |
| `ai_results.submission_id -> essay_submissions.id` | AI results are generated for a single submission. |
| `teacher_reviews.submission_id -> essay_submissions.id` | Teacher reviews are attached to the submission being evaluated. |
| `teacher_reviews.teacher_id -> users.id` | Identifies the teacher who performed the review. |
