
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('student', 'teacher', 'superadmin');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_lengkap TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    peran user_role NOT NULL,
    nomor_identitas TEXT,
    username TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
