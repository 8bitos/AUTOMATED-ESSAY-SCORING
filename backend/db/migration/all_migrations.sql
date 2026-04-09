-- Migration 000001_init_schema.up.sql
-- Ekstensi untuk UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tipe ENUM kustom
CREATE TYPE user_role AS ENUM ('teacher', 'student');
CREATE TYPE cognitive_level AS ENUM ('C1', 'C2', 'C3', 'C4');

-- 1. Tabel users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama_lengkap VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    peran user_role NOT NULL,
    nomor_identitas VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabel classes
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guru_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nama_kelas VARCHAR(255) NOT NULL,
    deskripsi TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabel class_members
CREATE TABLE class_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kelas_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    siswa_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(kelas_id, siswa_id)
);

-- 4. Tabel materials
CREATE TABLE materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kelas_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    pengunggah_id UUID REFERENCES users(id) ON DELETE SET NULL,
    judul VARCHAR(255) NOT NULL,
    isi_materi TEXT,
    file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabel essay_questions
CREATE TABLE essay_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    materi_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    teks_soal TEXT NOT NULL,
    level_kognitif cognitive_level,
    kunci_jawaban TEXT
);

-- 6. Tabel rubrics
CREATE TABLE rubrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    soal_id UUID NOT NULL REFERENCES essay_questions(id) ON DELETE CASCADE,
    nama_aspek VARCHAR(255) NOT NULL,
    deskripsi TEXT,
    bobot FLOAT
);

-- 7. Tabel essay_submissions
CREATE TABLE essay_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    soal_id UUID NOT NULL REFERENCES essay_questions(id) ON DELETE CASCADE,
    siswa_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    teks_jawaban TEXT NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Tabel ai_results
CREATE TABLE ai_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID UNIQUE NOT NULL REFERENCES essay_submissions(id) ON DELETE CASCADE,
    skor_ai FLOAT,
    umpan_balik_ai TEXT,
    logs_rag TEXT,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Tabel teacher_reviews
CREATE TABLE teacher_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID UNIQUE NOT NULL REFERENCES essay_submissions(id) ON DELETE CASCADE,
    skor_final FLOAT NOT NULL,
    catatan_guru TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migration 000002_add_superadmin_role.up.sql
ALTER TYPE user_role ADD VALUE 'superadmin';

-- Migration 000003_add_username_to_users.up.sql
-- Menambahkan kolom username yang unik dan tidak boleh null
-- Dibuat nullable terlebih dahulu untuk kompatibilitas dengan data yang ada
ALTER TABLE users ADD COLUMN username VARCHAR(50) UNIQUE;

-- Migration 000004_add_class_code.up.sql
ALTER TABLE classes ADD COLUMN class_code VARCHAR(10) UNIQUE;
ALTER TABLE classes ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Migration 000050_add_class_announcement_banner.up.sql
ALTER TABLE classes ADD COLUMN announcement_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE classes ADD COLUMN announcement_title TEXT NOT NULL DEFAULT '';
ALTER TABLE classes ADD COLUMN announcement_content TEXT NOT NULL DEFAULT '';

-- Migration 000056_add_rubric_scores_to_ai_results.up.sql
ALTER TABLE ai_results ADD COLUMN rubric_scores JSONB;
ALTER TABLE classes ADD COLUMN announcement_tone TEXT NOT NULL DEFAULT 'info';

-- Migration 000051_add_class_announcement_schedule.up.sql
ALTER TABLE classes ADD COLUMN announcement_starts_at TIMESTAMPTZ NULL;
ALTER TABLE classes ADD COLUMN announcement_ends_at TIMESTAMPTZ NULL;

-- Migration 000052_create_notifications_table.up.sql
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    external_key TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    href TEXT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    event_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, external_key)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_event
    ON notifications (user_id, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_active
    ON notifications (user_id, is_read, is_active, event_at DESC);

-- Migration 000053_add_join_policy_to_classes.up.sql
ALTER TABLE classes
ADD COLUMN IF NOT EXISTS join_policy TEXT NOT NULL DEFAULT 'approval_required';

ALTER TABLE classes
DROP CONSTRAINT IF EXISTS chk_classes_join_policy;

ALTER TABLE classes
ADD CONSTRAINT chk_classes_join_policy
CHECK (join_policy IN ('approval_required', 'open', 'closed'));
