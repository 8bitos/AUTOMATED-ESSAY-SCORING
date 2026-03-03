WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY soal_id, siswa_id
      ORDER BY submitted_at DESC, id DESC
    ) AS rn
  FROM essay_submissions
),
to_delete AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM essay_submissions es
USING to_delete td
WHERE es.id = td.id;

ALTER TABLE essay_submissions
DROP CONSTRAINT IF EXISTS uq_essay_submissions_soal_siswa;

ALTER TABLE essay_submissions
ADD CONSTRAINT uq_essay_submissions_soal_siswa
UNIQUE (soal_id, siswa_id);
