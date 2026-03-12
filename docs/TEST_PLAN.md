# Test Plan - AUTOMATED-ESSAY-SCORING

Dokumen ini berisi rencana uji (blackbox + whitebox) dengan fokus utama pada **sistem penilaian esai** dan tetap mencakup fitur lain sebagai pendukung.

## 1. Tujuan
1. Memastikan alur penilaian esai (AI + revisi guru) berjalan benar end-to-end.
2. Memastikan hasil nilai, rubrik, dan umpan balik tampil konsisten di UI dan API.
3. Memastikan fitur pendukung (kelas, materi, soal, laporan, export, notifikasi) berjalan stabil.

## 2. Ruang Lingkup
**Fokus utama:**
1. Pembuatan soal esai + rubrik.
2. Submission jawaban siswa.
3. Penilaian AI.
4. Review dan revisi nilai oleh guru.
5. Rekap nilai dan laporan.

**Pendukung:**
1. Autentikasi, kelas, materi.
2. Bank soal.
3. Penilaian tugas.
4. Notifikasi.
5. Export data.

## 3. Lingkungan Uji
1. Backend Go + PostgreSQL + Redis.
2. Frontend Next.js.
3. Browser: Chrome/Edge.
4. Akun: Guru + Siswa (dummy).

## 4. Data Uji Minimum
1. 1 kelas (contoh: 10A - Sejarah).
2. 2 materi (Materi A, Materi B).
3. 2 soal esai (dengan rubrik analitik & holistik).
4. 3 siswa (A, B, C).
5. Masing-masing siswa mengirim minimal 2 jawaban.

## 5. Strategi Uji
### 5.1 Blackbox (Fungsional)
1. Uji skenario utama penilaian esai.
2. Uji validasi input & error handling.
3. Uji kombinasi filter, export, dan tampilan.

### 5.2 Whitebox
1. Unit test untuk service penilaian, rubrik, kalkulasi skor.
2. Integration test API dengan DB.
3. Coverage minimum 60% pada module penilaian esai.

## 6. Test Case - Fokus Penilaian Esai
**TC-ESS-01: Buat Soal Esai (Rubrik Analitik)**
1. Guru buka Materi A -> Tambah Soal.
2. Isi teks soal.
3. Tambah rubrik analitik (min 1 aspek, min 2 skor).
4. Simpan.
Expected:
1. Soal tampil di daftar.
2. API `POST /api/essay-questions` sukses.

**TC-ESS-02: Buat Soal Esai (Rubrik Holistik)**
1. Guru buat soal baru.
2. Pilih rubrik holistik.
3. Simpan.
Expected:
1. Soal tersimpan.
2. Rubrik holistik tersimpan di DB.

**TC-ESS-03: Submission Jawaban Siswa**
1. Siswa buka soal.
2. Isi jawaban panjang.
3. Submit.
Expected:
1. Submission tersimpan.
2. Status penilaian AI muncul (queued/processing/completed).

**TC-ESS-04: Penilaian AI Selesai**
1. Setelah submit, tunggu.
2. Buka halaman penilaian guru.
Expected:
1. Skor AI muncul.
2. Rubrik AI per aspek (jika tersedia).

**TC-ESS-05: Guru Revisi Nilai**
1. Guru buka submission.
2. Ubah nilai & feedback.
3. Simpan.
Expected:
1. Revised score tersimpan.
2. Nilai akhir menggunakan revisi guru.

**TC-ESS-06: Validasi Nilai**
1. Masukkan nilai negatif atau >100.
Expected:
1. Sistem menolak input invalid.

**TC-ESS-07: Rubrik Global (jika aktif)**
1. Aktifkan mode rubrik global.
2. Buat soal esai.
Expected:
1. Soal memakai rubrik global.

**TC-ESS-08: Multi-attempt Submission**
1. Siswa submit jawaban 2x.
Expected:
1. Attempt count bertambah.
2. Nilai terakhir yang dipakai.

**TC-ESS-09: Feedback AI**
1. Pastikan AI menghasilkan feedback.
Expected:
1. Feedback tampil di UI.
2. Tersimpan di DB.

**TC-ESS-10: Laporan Nilai**
1. Buka laporan nilai kelas.
2. Filter tanggal.
3. Export CSV/XLSX.
Expected:
1. Rekap nilai sesuai filter.
2. File export terunduh.

## 7. Test Case - Pendukung Sistem Lain
**TC-SYS-01: Login**
1. Login dengan akun guru.
Expected: masuk dashboard.

**TC-SYS-02: Buat Kelas**
1. Guru buat kelas baru.
Expected: kelas muncul di list.

**TC-SYS-03: Tambah Materi**
1. Guru buat materi baru.
Expected: materi muncul di kelas.

**TC-SYS-04: Bank Soal**
1. Simpan soal ke bank soal.
2. Ambil soal dari bank.
Expected: soal terpakai di materi.

**TC-SYS-05: Penilaian Tugas**
1. Buat tugas.
2. Siswa upload file.
Expected: guru bisa review.

**TC-SYS-06: Notifikasi**
1. Siswa submit jawaban.
Expected: guru menerima notifikasi.

## 8. Whitebox - Rencana Test Teknis
**Backend (Go)**
1. Unit test service `essay_submission_service` (kalkulasi skor, filter, laporan).
2. Unit test `ai_service` (hasil rubrik, skor).
3. Unit test `teacher_review_service`.
4. Integration test API `/essay-questions`, `/submissions`, `/teacher-reviews`.

**Frontend (Next.js)**
1. Unit test komponen form soal.
2. Test validasi input nilai.
3. Test rendering laporan nilai.

## 9. Output yang Dicatat
1. Tabel test case (pass/fail).
2. Screenshot hasil blackbox.
3. Laporan coverage whitebox.

## 10. Kriteria Selesai
1. Semua test case ESS-01 s.d. ESS-10 lulus.
2. Minimal 80% test case pendukung lulus.
3. Coverage module penilaian esai >= 60%.
