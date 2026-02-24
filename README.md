# Sistem Penilaian Esai Otomatis berbasis AI

Project ini menggabungkan backend Go + PostgreSQL dengan frontend Next.js untuk membangun Learning Management System yang secara otomatis menilai esai siswa menggunakan Gemini API (AI). Penilaian mengikuti rubrik guru, memanfaatkan worker queue agar tidak memperlambat UI, namun bisa juga di-toggle ke mode instant agar skor langsung muncul dalam sekali request.

### Penjelasan sistem
- **Backend** (Go) menangani: autentikasi JWT, pengelolaan kelas/materi, queue grading AI, caching hasil, notifikasi, dan API untuk superadmin/teacher/student. Semua logika penting ada di `backend/internal`.
- **Frontend** (Next.js) menghadirkan dashboard multi-role (student / teacher / superadmin) dengan fitur seperti materi, tugas, penilaian, notifikasi, bank soal, dan pengaturan.
- **AI grading** memanggil Gemini dengan prompt deterministik, menyimpan skor + feedback ke tabel `ai_results`, dan memiliki caching + opsi grading instant/queued agar fleksibel.

### Alur penilaian esai
1. Guru membuat materi + rubrik di dashboard teacher.
2. Siswa mengirim esai melalui form; backend menyimpan submission & (depend on mode) langsung memanggil AI atau memasukkannya ke antrian background worker.
3. Worker/instant grading memformat prompt rubrik + esai → panggil Gemini → parse JSON respons → simpan skor/feedback di `ai_results` dan update `essay_submissions.ai_grading_status`.
4. UI siswa/teacher membaca `ai_results` via JOIN untuk menampilkan nilai, grafik radar, atau feedback.
5. Superadmin dapat mengubah mode grading (Instant/Queued), memonitor API, dan approve user/guru.

### Teknologi utama
- Go 1.23+ (GIN/Mux, postgreSQL, golang-migrate, generative AI client).  
- Next.js 14+ (React, Tailwind, Recharts).  
- PostgreSQL + Redis (dijalankan via Docker Compose jika menggunakan dev stack).  
- Gemini API (Google) sebagai LLM untuk grading/generator soal.  
- Docker Compose memudahkan stack lengkap (database + frontend + backend + Elasticsearch bila diperlukan).

### Cara AI menilai agar akurat

1. **Prompt deterministik** – `GradeEssay` selalu mengirimkan prompt dengan struktur yang sama: daftar aspek rubrik urut, instruksi “evidence-based”, dan format JSON eksklusif. Ini membuat model tidak bingung soal format output dan menekan variasi skor untuk input identik.
2. **Rubrik terstruktur** – Sistem mengubah rubrik guru menjadi `RubricAspect` dengan nama aspek plus daftar skor yang valid; instruksi meminta AI memilih tepat satu skor per aspek dan menyebutkan nama aspek persis sama agar perhitungan total bisa tetap konsisten.
3. **Post-processing & cache** – Setelah respons, backend menghitung skor akhir berdasarkan total skor diperoleh vs total maksimum, mengarsipkan hasil ke `ai_results`, serta menyimpan request-response yang sama ke `ai_grading_cache`. Ini berarti soal + esai + rubrik identik akan langsung mendapatkan skor yang sama tanpa panggilan ulang ke Gemini.

Kalau ingin akurasi tambah tinggi: pastikan rubrik punya deskripsi skor jelas, sertakan `ideal answer` + `keywords` supaya AI punya referensi faktual, dan gunakan mode instant hanya jika latency langsung diperlukan (queued mode lebih tahan galat/rate-limit).

### Persyaratan minimal
1. Docker & Docker Compose (opsional tapi direkomendasikan untuk menyamakan stack).  
2. Go toolchain (1.21+) dan `npm`/`pnpm` untuk frontend.  
3. Salah satu editor: VSCode / JetBrains (tidak disimpan karena `.gitignore`).  
4. API key Gemini + database PostgreSQL aktif.

### Struktur penting
- `/backend`: kode Go, migration SQL, upload file.  
- `/frontend`: Next.js dashboard utama (ada `.git`).  
- `/web-frontend`: salinan/hasil build (tidak aktif selama dev).  
- `/docker-compose.yml`: layanan dev (db, redis, web, search).  
- `/env.example`: template environment untuk backend + Next.js.  
- `README.md` ini, `.gitignore` (menghindari node_modules, uploads, docker override, env, dll).

### Setup dan menjalankan lokal
1. **Clone repo**  
   ```bash
   git clone <repo-url>
   cd SAGE-Skripsi
   ```
2. **Isi environment**  
   - Duplikasi `env.example` menjadi `.env` (backend) dan root `.env` jika perlu.  
   - Jangan commit `.env`; sudah ada `.gitignore` untuk menolak file sensitif.  
   - Pastikan nilai penting: `DB_*`, `JWT_SECRET`, `GEMINI_API_KEY`, `FRONTEND_ORIGIN`, `NEXT_PUBLIC_API_BASE_URL`.
3. **Backend**  
   ```bash
   cd backend
   go mod tidy
   go run .
   ```
   - `go run .` otomatis menjalankan migrasi (`./db/migration`).  
   - Jika menggunakan Docker Compose: `GEMINI_API_KEY` tetap di `.env` host (tidak masuk image).
4. **Frontend**  
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   - Pastikan `NEXT_PUBLIC_API_BASE_URL` diarahkan ke backend (`http://localhost:8080/api`).  
   - CORS dikendalikan oleh `FRONTEND_ORIGIN` di backend.
5. **(Opsional) Docker Compose**  
   ```bash
   docker compose up --build
   ```
   - Gunakan `docker compose up -d` untuk background; `down` untuk hentikan.  
   - File `.env` tetap dibaca, jadi atur di root repo sebelum `docker compose` dijalankan.
