# System Map - SAGE Skripsi

Dokumen ini jadi peta cepat supaya perubahan fitur tetap aman dan tidak merusak alur yang sudah berjalan.

## 1) Gambaran Arsitektur
- Frontend: Next.js (`frontend`) dengan fetch ke path relatif `/api/*`.
- Proxy API: rewrite di Next.js meneruskan `/api/*` ke backend Go (`http://localhost:8080/api/*`).
- Backend: Go + Gorilla Mux (`backend`) dengan middleware JWT cookie, role guard, dan service layer.
- Database: PostgreSQL dengan migrasi berurutan (`backend/db/migration`).
- AI: Gemini dipanggil oleh `AIService`, dipakai untuk grading esai dan generate soal.

Referensi inti:
- `backend/main.go`
- `backend/internal/routes/routes.go`
- `backend/internal/routes/middleware.go`
- `backend/internal/services/ai_service.go`
- `backend/internal/services/essay_submission_service.go`
- `frontend/next.config.js`
- `frontend/src/context/AuthContext.tsx`

## 2) Alur Data Utama
### A. Login & Session
1. Frontend kirim `POST /api/login`.
2. Backend validasi user dan set cookie `auth_token` (HttpOnly).
3. Frontend baca status user lewat `GET /api/me`.
4. Route dashboard di frontend redirect ke `/login` jika tidak authenticated.

### B. Kelas & Materi
1. Teacher membuat kelas (`POST /api/classes`).
2. Teacher membuat/ubah materi dan soal esai (`/api/materials`, `/api/essay-questions`).
3. Student join class (`POST /api/student/join-class`) lalu lihat materi per kelas (`GET /api/student/classes/{classId}`).

### C. Submission & AI Grading
1. Student submit jawaban (`POST /api/submissions`).
2. Backend simpan ke `essay_submissions` dengan status awal `queued`.
3. Mode grading dibaca dari `system_settings.grading_mode`:
- `instant`: diproses langsung pada request.
- `queued`: masuk worker queue background.
4. `AIService.GradeEssay`:
- bangun prompt deterministik,
- panggil Gemini dengan retry + rate limit,
- parse JSON skor per aspek,
- cache hasil di `ai_grading_cache`.
5. Hasil disimpan ke `ai_results`, status submission diupdate (`processing/completed/failed`).

## 3) Matriks Endpoint (Ringkas)
### Public (tanpa auth)
- `POST /api/login`
- `POST /api/register`
- `POST /api/logout`
- `POST /api/grade-essay`
- `GET /api/classes-public`
- `GET /api/dev/tables` (dev/debug)

### Protected (auth cookie)
- Profil: `/api/me`, `/api/profile`, `/api/profile/password`
- Student umum: `/api/student/*`
- Submission: `/api/submissions*`, `/api/students/{studentId}/submissions`
- AI result: `/api/ai-results*`, `/api/submissions/{submissionId}/ai-result`
- Upload: `POST /api/upload`

### Teacher only (+ write access verification)
- Kelas: `/api/classes*`, `/api/classes/{classId}/students*`, join requests
- Materi: `/api/materials*`, `/api/classes/{classId}/materials`
- Soal esai: `/api/essay-questions*`, auto-generate
- Question bank: `/api/question-bank*`
- Modul ajar: `/api/modules`, `/api/classes/{classId}/teaching-modules*`

### Superadmin only
- `/api/admin/dashboard-summary`
- `/api/admin/api-statistics`
- `/api/admin/settings/grading-mode` (GET/PUT)
- `/api/admin/users*`
- `/api/admin/profile-requests*`

## 4) Domain Service (Backend)
- `AuthService`: login/register, profile change request, admin user management, teacher verification.
- `ClassService`: kelas, member, join approval, dashboard teacher.
- `MaterialService`: materi + relasi ke soal/modul.
- `EssayQuestionService`: CRUD soal esai + data student view.
- `EssaySubmissionService`: create/update/delete submission + worker grading.
- `AIService`: integrasi Gemini + logging usage + cache grading.
- `AIResultService`: CRUD hasil penilaian AI.
- `SystemSettingService`: setting global (terutama `grading_mode`).

## 5) Skema Data Kunci (Konseptual)
- `users`
- `classes`
- `class_members`
- `materials`
- `modules`
- `essay_questions`
- `essay_submissions`
- `ai_results`
- `teacher_reviews`
- `question_bank_entries`
- `ai_api_usage_logs`
- `ai_grading_cache`
- `system_settings`
- `profile_change_requests`

Catatan: detail kolom resmi mengikuti migration SQL terbaru di `backend/db/migration`.

## 6) Area Sensitif (Wajib Hati-hati)
- Auth & role check:
  - `backend/internal/routes/middleware.go`
  - `backend/internal/handlers/auth.go`
- Kontrak endpoint (dipakai luas di frontend):
  - `backend/internal/routes/routes.go`
  - banyak halaman `frontend/src/app/dashboard/**`.
- Alur grading AI:
  - `backend/internal/services/essay_submission_service.go`
  - `backend/internal/services/ai_service.go`
- Rewrites frontend:
  - `frontend/next.config.js`

## 7) Aturan Aman Saat Ubah Kode
1. Jangan ubah path/shape response API tanpa cek seluruh pemanggil frontend.
2. Semua perubahan DB harus via migration baru (tanpa edit migration lama).
3. Untuk fitur grading, jaga kompatibilitas status: `queued`, `processing`, `completed`, `failed`.
4. Jika ubah middleware auth/role, uji minimal role student, teacher (verified/unverified), superadmin.
5. Pertahankan pola `credentials: 'include'` pada request frontend yang butuh session.

## 8) Baseline Teknis Saat Dokumen Dibuat
- Backend compile check: `go test ./...` (tidak ada test file, compile sukses).
- Frontend lint: saat ini gagal karena konfigurasi ESLint package export (`eslint.config.mjs` vs versi ESLint terpasang).

## 9) Checklist Sebelum Merge Perubahan
- Build backend sukses.
- Endpoint yang disentuh dites manual minimal happy path + 1 error path.
- UI yang terdampak diverifikasi untuk role terkait.
- Jika ubah skema: migration up/down diverifikasi.
- Tidak ada rahasia/env key yang ikut ter-commit.
