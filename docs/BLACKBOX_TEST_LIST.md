# Blackbox Test List

Fokus utama: **penilaian esai**. Tetap mencakup fitur pendukung sistem.

## A. Autentikasi & Akses
1. Login guru dengan kredensial valid.
2. Login siswa dengan kredensial valid.
3. Login gagal dengan kredensial salah.
4. Logout guru dan sesi berakhir.
5. Cek akses halaman guru dengan akun siswa (harus ditolak).

## B. Kelas & Keanggotaan
6. Guru membuat kelas baru.
7. Guru mengedit kelas.
8. Guru menghapus kelas.
9. Siswa join kelas dengan kode.
10. Guru approve join request.
11. Guru menolak join request.
12. Guru mengundang siswa ke kelas.

## C. Materi/Section
13. Guru membuat materi/section baru.
14. Guru mengedit nama section.
15. Guru menghapus section.
16. Guru mengubah urutan section (drag/drop atau tombol).
17. Guru menambah konten materi singkat.
18. Guru menambah konten materi lengkap.
19. Guru upload dokumen ke materi.

## D. Soal Esai (Fokus Skripsi)
20. Guru membuat soal esai dengan rubrik analitik.
21. Guru membuat soal esai dengan rubrik holistik.
22. Validasi gagal jika teks soal kosong.
23. Validasi gagal jika bobot soal kosong/invalid.
24. Guru mengedit soal esai (teks, rubrik).
25. Guru menghapus soal esai.
26. Guru menambah soal dari Bank Soal.
27. Rubrik global aktif untuk soal (jika mode rubrik global).

## E. Submission Siswa (Fokus Skripsi)
28. Siswa submit jawaban esai (1 kali).
29. Siswa submit jawaban esai > 1 kali (attempt meningkat).
30. Siswa submit jawaban kosong (harus ditolak).
31. Siswa melihat status penilaian AI (queued/processing/completed).

## F. Penilaian AI (Fokus Skripsi)
32. AI menghasilkan skor dan feedback.
33. Skor AI tampil di penilaian guru.
34. Rubrik AI per aspek tampil (jika tersedia).
35. AI gagal memproses dan sistem menampilkan pesan error.

## G. Review Guru (Fokus Skripsi)
36. Guru mereview submission dan memberi revisi nilai.
37. Guru menambahkan feedback teks.
38. Nilai akhir memakai revised score (bukan skor AI).
39. Guru mengubah nilai revisi dan data tersimpan.

## H. Laporan Nilai (Fokus Skripsi)
40. Laporan nilai per kelas tampil.
41. Filter konten/section berjalan.
42. Filter rentang tanggal berjalan.
43. Search siswa di laporan berjalan.
44. Distribusi nilai tampil sesuai data.
45. Export CSV sesuai filter.
46. Export Excel sesuai filter.
47. Export “Halaman ini” hanya berisi data page aktif.

## I. Penilaian Tugas (Pendukung)
48. Guru membuat tugas.
49. Siswa upload tugas.
50. Guru melihat submission tugas.
51. Guru memberi review tugas (jika fitur aktif).

## J. Notifikasi & UI Pendukung
52. Guru menerima notifikasi saat siswa submit.
53. Siswa menerima notifikasi saat nilai direview.
54. Navigasi sidebar/topbar ke fitur utama berjalan.
55. Error handling muncul saat API gagal.
