export type SystemUpdateEntry = {
  version: string;
  date: string;
  title: string;
  majorUpdates: string[];
  minorUpdates: string[];
};

// Append-only changelog: tambahkan versi terbaru di paling atas, jangan hapus histori lama.
// Pisahkan poin dampak besar (major) dan penyempurnaan kecil/iteratif (minor).
export const SYSTEM_UPDATES: SystemUpdateEntry[] = [
  {
    version: "1.1",
    date: "2026-03-05",
    title: "Perbaikan UI Workspace Kelas Teacher",
    majorUpdates: [
      "Merapikan struktur toolbar Section Workspace di halaman detail kelas teacher agar alur utama lebih fokus: heading workspace, primary action Tambah Section, search section, sort, filter, dan mode view.",
      "Menyederhanakan aksi per-section dengan tombol aksi langsung berbasis ikon (Tambah Konten, Edit, Hapus, Expand/Collapse), lengkap tooltip hover, warna aksi yang dibedakan, dan dukungan dark mode agar interaksi lebih cepat tanpa membuka menu overflow.",
      "Menyamakan pola aksi Table Mode dengan Card Mode melalui kontrol aksi langsung per-section agar interaksi lintas mode tetap konsisten.",
    ],
    minorUpdates: [
      "Menambahkan ringkasan konteks workspace pada panel sticky untuk memperjelas fokus kerja (kelola urutan section, konten, dan aksi cepat).",
      "Merapikan posisi dan prioritas bulk action terpilih agar lebih terpisah dari kontrol filter utama.",
      "Menjaga kompatibilitas flow lama (table/card, tambah konten, edit/hapus section) sambil meningkatkan keterbacaan UI.",
      "Menambahkan empty state yang lebih jelas untuk hasil filter section kosong agar pengguna tahu langkah lanjutan yang tersedia.",
      "Menambahkan skeleton loading pada area daftar konten/soal per section saat data relasi soal masih dimuat.",
      "Menyelaraskan token warna tipe konten (materi/soal/tugas) lintas panel agar badge dan ikon tidak berbeda style antar-view.",
      "Menambahkan animasi transisi halus pada popup CRUD dan dropdown menu aksi section untuk feedback interaksi yang lebih natural.",
      "Menyederhanakan halaman detail kelas dengan menghapus panel ringkasan metrik atas yang duplikatif agar fokus langsung ke workspace dan aksi utama.",
      "Menstabilkan auto-refresh data setelah CRUD utama section/konten (tambah, edit, hapus) agar panel dan badge tidak perlu refresh manual.",
      "Menambahkan setting tampilan di workspace untuk show/hide label ordinal section (\"Section 1/2/...\"), termasuk persist preferensi per kelas.",
      "Menambahkan alur edit detail Materi Lengkap langsung dari modal edit konten melalui aksi \"edit di sini\" yang membuka popup editor rich text.",
    ],
  },
  {
    version: "1.0",
    date: "2026-03-05",
    title: "Publish Pertama",
    majorUpdates: [
      "Menambahkan mode Spreadsheet di Manajemen User (Superadmin) agar edit data user lebih cepat, termasuk perbaikan struktur kolom berdasarkan role (guru/siswa) dan optimasi lebar kolom.",
      "Menambahkan fitur Ajukan Banding Nilai (Student), termasuk status banding, alasan banding, dan tampilan riwayat banding pada area nilai/feedback.",
      "Menyempurnakan modul review banding nilai di sisi Teacher (proses, terima, tolak) dengan state aksi yang lebih jelas dan feedback UI yang lebih informatif.",
      "Memperbaiki endpoint dan alur API banding nilai agar halaman teacher penilaian tidak lagi gagal memuat data banding karena mismatch route.",
      "Memperbaiki query backend banding nilai (error PostgreSQL uuid=text) agar listing banding untuk student/teacher berjalan stabil.",
      "Menyempurnakan tampilan Student Grades agar lebih actionable: ringkasan KPI, prioritas tindakan, detail per konten/per soal, dan konteks feedback terbaru.",
      "Menambahkan status proses AI grading (queued/processing/waiting_result/failed) pada alur jawaban essay beserta indikator loading/polling hasil.",
      "Menambahkan kontrol feature flag `feature_show_updates_sidebar` di panel Superadmin Feature Flags untuk show/hide menu Update Sistem/Revisi.",
      "Menambahkan halaman baru 'Update Sistem/Revisi' yang bisa diakses dari semua role (Student, Teacher, Superadmin).",
      "Menambahkan Global Command Search di Topbar (Ctrl/Cmd+K) dengan hasil terkelompok (Terakhir, Aksi, Navigasi, Kelas, Siswa, Konten), keyboard navigation, quick action, dan recent commands per-user.",
      "Merapikan dark mode halaman Teacher Penilaian pada panel utama (header, kartu ringkasan, daftar kelas/siswa, input kontrol) agar kontras konsisten antara mode terang dan gelap.",
      "Memperbaiki alur tab pada route Teacher Soal berbasis sectionCardId agar tab 'Submisi Siswa' bisa dipilih normal (tidak lagi dipaksa kembali ke tab daftar soal).",
      "Menyempurnakan modal Tambah Soal untuk mobile: layout responsif, panel parameter bisa ditampilkan/disembunyikan, tombol aksi dipadatkan, dan area kontrol cepat bisa di-collapse.",
    ],
    minorUpdates: [
      "Menghubungkan sidebar semua role ke public feature flag agar visibilitas menu update bisa dikendalikan terpusat dari Superadmin.",
      "Finalisasi dark mode sidebar (teks, border, hover, submenu, settings, dan panel profil mobile) agar kontras konsisten.",
      "Menambahkan navigasi keyboard di mode spreadsheet serta penyempurnaan interaksi edit cepat agar workflow administrasi lebih efisien.",
      "Memperbaiki struktur tampilan rubrik agar rubrik ditampilkan per soal (bukan duplikat agregat di luar soal), sehingga interpretasi penilaian lebih akurat.",
      "Menyempurnakan UX submit jawaban/tugas dengan pesan status yang lebih jelas untuk mode instant maupun queued.",
      "Perbaikan besar dark mode di berbagai halaman student (terutama kelas, badges, status, cards, feedback blocks) agar kontras lebih konsisten.",
      "Perbaikan navigasi mobile: topbar disederhanakan, floating tombol sidebar disesuaikan, serta alur profil/logout mobile dibuat lebih rapi.",
      "Peningkatan stabilitas deploy container/frontend-backend-env untuk environment server agar proxy API dan komunikasi antar service lebih konsisten.",
      "Menambahkan menu sidebar khusus dengan style berbeda untuk menonjolkan info pengembangan sistem.",
      "Menyesuaikan wording CTA di halaman detail kelas teacher dari 'Tambah Konten' menjadi 'Tambah Section' pada area global agar hierarki aksi lebih jelas.",
      "Menghapus opsi tipe konten 'Penilaian' dari dropdown Tambah Konten di section karena tidak lagi dipakai pada alur konten aktif.",
      "Memperbaiki endpoint/update mode grading agar toggle Instant/Queued stabil, termasuk fallback ke endpoint setting generik dan perbaikan prioritas route spesifik di backend.",
      "Meningkatkan visibilitas pesan error update mode grading di UI agar sumber kegagalan lebih mudah ditelusuri.",
      "Merapikan interaksi mobile pada form langkah (Soal/Rubrik/Preview) agar tidak menutupi konten penting saat proses input panjang.",
    ],
  },
];
