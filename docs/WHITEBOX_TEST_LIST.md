# Whitebox Test List

Fokus utama: **penilaian esai**. Termasuk coverage untuk modul pendukung.

## A. Backend (Go) - Unit & Integration

### A1. Essay Submission Service
1. `ListMaterialStudentSubmissionSummaries` menghitung total/reviewed/pending dengan benar.
2. `ListClassStudentSubmissionSummaries` filter by class + optional material.
3. `ListClassStudentSubmissionSummaries` filter by date range.
4. `GetClassScoreDistribution` bucketisasi skor (<60, 60-69, 70-79, 80-89, >=90).
5. `GetClassScoreDistribution` pakai `revised_score` jika ada, fallback ke `skor_ai`.

### A2. Essay Question Service
6. Create question menyimpan rubrik analitik.
7. Create question menyimpan rubrik holistik.
8. Update question mengubah rubrik tanpa merusak format JSON.
9. Validasi bobot soal > 0.

### A3. AI Service (Core Scoring)
10. Score calculation konsisten terhadap rubrik analitik.
11. Score calculation konsisten terhadap rubrik holistik.
12. Error handling ketika AI service gagal (return status “failed”).

### A4. Teacher Review Service
13. Create/Update review menyimpan revised_score & feedback.
14. Review update menimpa nilai lama.

### A5. API Handlers
15. `POST /api/essay-questions` validasi input wajib.
16. `POST /api/submissions` validasi jawaban kosong.
17. `GET /api/reports/classes/{classId}/students` hasil sesuai filter.
18. `GET /api/reports/classes/{classId}/distribution` hasil sesuai filter.
19. `GET /api/reports/classes/{classId}/export` menghasilkan file CSV.
20. `GET /api/reports/classes/{classId}/export?format=xlsx` menghasilkan file Excel.

## B. Frontend (Next.js) - Unit
21. Komponen form soal: validasi teks soal dan bobot.
22. Komponen rubrik analitik: tambah/hapus aspek & skor.
23. Komponen rubrik holistik: tambah/hapus skor.
24. Laporan nilai: filter kelas + konten.
25. Laporan nilai: filter tanggal.
26. Laporan nilai: export “Halaman ini” membentuk file CSV/Excel.

## C. Integration / End-to-End
27. Alur lengkap: buat soal -> siswa submit -> AI scoring -> review guru -> laporan nilai.
28. Alur rubrik global: rubrik dipakai di soal baru.
29. Alur multi-attempt: nilai akhir mengikuti attempt terbaru.

## D. Coverage Target
1. Module penilaian esai (service + handler) coverage >= 60%.
2. Endpoint laporan nilai coverage >= 60%.
