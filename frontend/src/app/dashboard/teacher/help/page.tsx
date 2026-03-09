"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useMemo, useState } from "react";
import { FiChevronDown, FiHelpCircle, FiSearch } from "react-icons/fi";

type FAQCategory =
  | "Akun & Akses"
  | "Dashboard Guru"
  | "Manajemen Kelas"
  | "Materi & Soal"
  | "Penilaian"
  | "Bank Soal"
  | "Laporan Nilai"
  | "Notifikasi"
  | "Settings & Keamanan"
  | "Tips Operasional";

interface FAQItem {
  id: string;
  category: FAQCategory;
  question: string;
  answer: string[];
  keywords: string[];
}

interface OnboardingStep {
  id: string;
  title: string;
  desc: string;
  href: string;
}

const TEACHER_ONBOARDING_STEPS: OnboardingStep[] = [
  { id: "step-1", title: "Lengkapi Profil Guru", desc: "Isi mapel, rombel, institusi, dan data penting akun.", href: "/dashboard/teacher/settings/profile" },
  { id: "step-2", title: "Buat / Cek Kelas", desc: "Siapkan kelas aktif dan pastikan kode kelas siap dipakai siswa.", href: "/dashboard/teacher/classes" },
  { id: "step-3", title: "Siapkan Materi & Soal", desc: "Upload materi, buat soal, rubrik, dan parameter penilaian.", href: "/dashboard/teacher/classes" },
  { id: "step-4", title: "Simpan ke Bank Soal", desc: "Simpan soal bagus agar reusable untuk kelas lain.", href: "/dashboard/teacher/bank-soal" },
  { id: "step-5", title: "Review Submission", desc: "Cek penilaian AI, berikan revisi dan feedback guru jika perlu.", href: "/dashboard/teacher/penilaian" },
  { id: "step-6", title: "Pantau Laporan Nilai", desc: "Lihat tren performa siswa untuk tindak lanjut pembelajaran.", href: "/dashboard/teacher/laporan-nilai" },
];

const FAQ_ITEMS: FAQItem[] = [
  {
    id: "akun-role-guru",
    category: "Akun & Akses",
    question: "Sebagai guru, saya bisa melakukan apa saja di sistem ini?",
    answer: [
      "Guru bisa membuat dan mengelola kelas, mengundang siswa, mereview join request, mengelola materi, membuat soal esai, menyimpan ke bank soal, menilai submission, memberi revisi nilai, dan memantau laporan nilai.",
      "Guru juga punya notifikasi operasional (join request, submission perlu review, update sistem) dan pengaturan profil/keamanan sendiri.",
    ],
    keywords: ["fitur guru", "akses", "hak akses", "role guru"],
  },
  {
    id: "akun-peta-fitur-guru",
    category: "Akun & Akses",
    question: "Sebagai guru, bagaimana cara cepat memahami semua fitur yang tersedia?",
    answer: [
      "Mulai dari sidebar: Kelas untuk workspace kelas, Penilaian untuk review submission/banding, Bank Soal untuk reuse soal, Laporan Nilai untuk rekap performa, Bantuan untuk dokumentasi, dan Setting untuk profil/keamanan/notifikasi.",
      "Dashboard guru dipakai sebagai ringkasan operasional harian, sedangkan detail kerja utama ada di halaman kelas, penilaian, dan bank soal.",
      "Gunakan halaman Update Sistem/Revisi untuk mengecek fitur baru atau perubahan workflow sebelum dipakai di kelas aktif.",
    ],
    keywords: ["peta fitur", "semua fitur", "guru", "sidebar", "menu"],
  },
  {
    id: "akun-write-lock",
    category: "Akun & Akses",
    question: "Kenapa kadang saya tidak bisa edit/create meski login sebagai guru?",
    answer: [
      "Kemungkinan akun guru belum terverifikasi penuh atau ada kebijakan akses write dari sistem.",
      "Cek status akun di profil, lalu minta superadmin cek approval jika fitur write terkunci.",
    ],
    keywords: ["tidak bisa edit", "akses write", "verifikasi guru", "approval"],
  },
  {
    id: "dashboard-fungsi",
    category: "Dashboard Guru",
    question: "Apa fungsi utama dashboard guru?",
    answer: [
      "Dashboard merangkum aktivitas harian: kelas aktif, submission terbaru, item review prioritas, serta info pengumuman sistem.",
      "Gunakan dashboard sebagai titik awal sebelum masuk ke menu manajemen kelas atau penilaian.",
    ],
    keywords: ["dashboard", "ringkasan", "prioritas", "aktivitas"],
  },
  {
    id: "kelas-create",
    category: "Manajemen Kelas",
    question: "Bagaimana alur membuat kelas baru sampai siap dipakai?",
    answer: [
      "Buka Manajemen Kelas lalu buat kelas baru.",
      "Sistem akan menyiapkan kode kelas untuk join mandiri siswa.",
      "Setelah itu, tambahkan materi atau undang siswa agar kelas bisa langsung digunakan.",
    ],
    keywords: ["buat kelas", "manajemen kelas", "kode kelas"],
  },
  {
    id: "kelas-join-request",
    category: "Manajemen Kelas",
    question: "Bagaimana mengelola request join siswa?",
    answer: [
      "Masuk ke detail kelas, buka daftar join request.",
      "Review satu per satu lalu ACC/tolak sesuai kebijakan kelas.",
      "Keputusan ini memengaruhi akses siswa ke materi dan soal kelas tersebut.",
    ],
    keywords: ["join request", "acc siswa", "tolak siswa", "kelas"],
  },
  {
    id: "kelas-invite",
    category: "Manajemen Kelas",
    question: "Apa beda invite siswa dan join pakai kode?",
    answer: [
      "Join kode: siswa mengajukan masuk (bisa butuh approval).",
      "Invite: guru memasukkan siswa langsung ke kelas tanpa menunggu input kode dari siswa.",
    ],
    keywords: ["invite siswa", "kode kelas", "join kelas"],
  },
  {
    id: "kelas-remove",
    category: "Manajemen Kelas",
    question: "Bisakah guru mengeluarkan siswa dari kelas?",
    answer: [
      "Bisa, melalui detail kelas pada daftar siswa.",
      "Pastikan keputusan ini sesuai kebijakan karena akan memutus akses siswa ke materi/submission kelas itu.",
    ],
    keywords: ["hapus siswa", "remove student", "anggota kelas"],
  },
  {
    id: "materi-types",
    category: "Materi & Soal",
    question: "Apa saja jenis materi yang bisa dibuat guru?",
    answer: [
      "Guru bisa membuat materi pembelajaran biasa, materi tipe soal, atau tipe tugas.",
      "Tiap tipe punya perilaku UI berbeda, tetapi semuanya bisa terhubung ke penilaian dan tracking siswa.",
    ],
    keywords: ["jenis materi", "materi", "soal", "tugas"],
  },
  {
    id: "materi-editor",
    category: "Materi & Soal",
    question: "Fitur apa saja di editor materi?",
    answer: [
      "Editor mendukung konten teks terstruktur, media/link, dan blok konten pembelajaran.",
      "Gunakan struktur konten rapi agar siswa mudah memahami konteks sebelum mengerjakan soal.",
    ],
    keywords: ["editor materi", "konten", "blok materi", "media"],
  },
  {
    id: "soal-manual-auto",
    category: "Materi & Soal",
    question: "Apa beda mode Manual dan Auto (AI) saat buat soal?",
    answer: [
      "Manual: guru menulis soal, rubrik, keyword, bobot sendiri.",
      "Auto (AI): sistem bantu generate draft soal/rubrik dari materi, lalu tetap harus direview guru sebelum dipakai.",
    ],
    keywords: ["mode manual", "mode auto", "generate ai", "buat soal"],
  },
  {
    id: "soal-rubrik",
    category: "Materi & Soal",
    question: "Bagaimana memilih rubrik analitik vs holistik?",
    answer: [
      "Analitik cocok untuk penilaian multi-aspek (mis. akurasi, argumentasi, struktur).",
      "Holistik cocok untuk penilaian menyeluruh dengan satu aspek utama.",
      "Pilih sesuai tujuan evaluasi agar interpretasi skor lebih reliabel.",
    ],
    keywords: ["rubrik", "analitik", "holistik", "penilaian"],
  },
  {
    id: "soal-ideal-keywords",
    category: "Materi & Soal",
    question: "Untuk apa Jawaban Ideal dan Kata Kunci?",
    answer: [
      "Jawaban ideal memberi referensi kualitas jawaban target.",
      "Kata kunci membantu validasi konsep penting.",
      "Keduanya mendukung konsistensi grading AI, tapi tetap harus ditulis jelas dan tidak ambigu.",
    ],
    keywords: ["jawaban ideal", "kata kunci", "scoring ai"],
  },
  {
    id: "soal-rounding",
    category: "Materi & Soal",
    question: "Apa fungsi opsi Bulatkan Nilai (kelipatan 5)?",
    answer: [
      "Jika diaktifkan pada soal, skor AI akan diproses ke kelipatan 5 terdekat (post-processing).",
      "Contoh: 67 jadi 65, 68 jadi 70, 72 jadi 70.",
      "Ini opsional per soal dan tidak mengubah mekanisme revisi nilai guru.",
    ],
    keywords: ["bulatkan nilai", "kelipatan 5", "post processing", "skor ai"],
  },
  {
    id: "soal-bank",
    category: "Bank Soal",
    question: "Bagaimana alur menggunakan Bank Soal?",
    answer: [
      "Guru dapat menyimpan draft soal dari form buat soal ke Bank Soal.",
      "Soal yang tersimpan bisa dipanggil kembali ke form untuk dipakai/diadaptasi.",
      "Informasi pembuat soal tetap ditampilkan agar audit kolaborasi jelas.",
    ],
    keywords: ["bank soal", "simpan soal", "panggil soal", "pembuat"],
  },
  {
    id: "soal-bank-share",
    category: "Bank Soal",
    question: "Apakah bank soal bisa diakses semua guru?",
    answer: [
      "Ya, bank soal bersifat kolaboratif lintas guru sesuai kebijakan sistem.",
      "Gunakan metadata (kelas/mapel/pembuat) untuk memilih soal yang relevan.",
    ],
    keywords: ["akses bank soal", "semua guru", "kolaborasi"],
  },
  {
    id: "penilaian-queue",
    category: "Penilaian",
    question: "Bagaimana alur penilaian AI sampai nilai tampil?",
    answer: [
      "Saat siswa submit, sistem membuat job grading (instant/queued tergantung konfigurasi).",
      "AI menghasilkan skor + feedback per rubrik, lalu disimpan sebagai hasil AI.",
      "Guru bisa meninjau dan memberi revisi jika diperlukan.",
    ],
    keywords: ["penilaian ai", "queue", "instant", "hasil ai"],
  },
  {
    id: "penilaian-review",
    category: "Penilaian",
    question: "Bagaimana cara revisi nilai siswa?",
    answer: [
      "Masuk ke menu Penilaian, buka submission yang perlu ditinjau.",
      "Guru dapat ubah skor revisi dan menambahkan feedback guru.",
      "Ketika revisi ada, nilai revisi guru diprioritaskan untuk tampilan hasil siswa.",
    ],
    keywords: ["revisi nilai", "feedback guru", "submission review"],
  },
  {
    id: "penilaian-priority",
    category: "Penilaian",
    question: "Cara cepat menemukan submission yang harus direview dulu?",
    answer: [
      "Gunakan filter/sort di menu Penilaian dan notifikasi untuk item prioritas.",
      "Dahulukan submission yang belum memiliki feedback atau yang baru masuk.",
    ],
    keywords: ["prioritas review", "filter penilaian", "submission"],
  },
  {
    id: "laporan-fungsi",
    category: "Laporan Nilai",
    question: "Apa yang bisa dilakukan di Laporan Nilai?",
    answer: [
      "Melihat rekap performa siswa per kelas/materi.",
      "Membantu identifikasi siswa yang perlu penguatan atau tindak lanjut.",
      "Gunakan laporan untuk komunikasi ke wali kelas/koordinator mapel.",
    ],
    keywords: ["laporan nilai", "rekap", "performa siswa"],
  },
  {
    id: "notif-guru",
    category: "Notifikasi",
    question: "Notifikasi guru meliputi event apa saja?",
    answer: [
      "Join request baru, submission yang perlu review, serta pengumuman sistem.",
      "Preferensi notifikasi bisa diaktifkan/nonaktifkan lewat Settings > Notifikasi.",
    ],
    keywords: ["notifikasi guru", "join request", "submission", "pengumuman"],
  },
  {
    id: "notif-history",
    category: "Notifikasi",
    question: "Apakah notifikasi guru punya riwayat?",
    answer: [
      "Ya, halaman notifikasi guru menyimpan riwayat event penting.",
      "Gunakan fitur pencarian/filter/read-unread untuk operasional harian.",
    ],
    keywords: ["riwayat notifikasi", "read unread", "filter notifikasi"],
  },
  {
    id: "settings-profile",
    category: "Settings & Keamanan",
    question: "Pengaturan apa saja yang harus rutin dicek guru?",
    answer: [
      "Profil (identitas profesional), keamanan akun (password), dan preferensi notifikasi.",
      "Pastikan data mapel/rombel/institusi selalu up to date agar manajemen kelas akurat.",
    ],
    keywords: ["settings guru", "profil guru", "keamanan", "password"],
  },
  {
    id: "settings-darkmode",
    category: "Settings & Keamanan",
    question: "Kalau tampilan dark mode kurang pas, apa yang harus dilakukan?",
    answer: [
      "Refresh halaman setelah update terbaru diterapkan.",
      "Jika masih ada elemen kurang kontras, laporkan menu spesifik agar bisa di-patch terarah.",
    ],
    keywords: ["dark mode", "kontras", "ui"],
  },
  {
    id: "ops-workflow",
    category: "Tips Operasional",
    question: "Workflow guru yang direkomendasikan setiap hari?",
    answer: [
      "1) Cek dashboard dan notifikasi prioritas.",
      "2) Review join request siswa.",
      "3) Review submission baru di menu Penilaian.",
      "4) Update materi/soal bila diperlukan.",
      "5) Pantau ringkasan lewat Laporan Nilai.",
    ],
    keywords: ["workflow guru", "rutinitas", "operasional"],
  },
  {
    id: "ops-quality-rubric",
    category: "Tips Operasional",
    question: "Tips agar hasil AI grading lebih stabil?",
    answer: [
      "Gunakan rubrik yang jelas per aspek dan deskriptor skor yang tegas.",
      "Isi jawaban ideal dan keyword seperlunya (spesifik, bukan terlalu umum).",
      "Review sampel submission berkala lalu revisi rubrik jika ada pola mismatch.",
    ],
    keywords: ["stabil", "ai grading", "rubrik jelas", "kualitas soal"],
  },
  {
    id: "soal-rubrik-mode-global-per-soal",
    category: "Materi & Soal",
    question: "Apa beda Mode Rubrik Per Soal vs Global, dan scope-nya di mana?",
    answer: [
      "Scope pengaturan rubrik adalah per card soal (section card) yang aktif. Jadi pengaturan ini hanya memengaruhi soal di card tersebut.",
      "Per Soal: setiap soal punya rubrik sendiri. Fungsi utamanya menjaga akurasi penilaian ketika tipe soal, tingkat kesulitan, atau indikator kompetensi berbeda.",
      "Global: satu rubrik digunakan bersama untuk semua soal dalam satu card. Fungsi utamanya mempercepat setup ketika semua soal memiliki pola penilaian yang sama.",
      "Cara pakai: buka halaman soal card terkait -> buka Mode Rubrik -> pilih Per Soal/Global -> simpan -> cek ulang rubrik aktif sebelum publish.",
    ],
    keywords: ["mode rubrik", "per soal", "global", "section card", "akurasi ai"],
  },
  {
    id: "soal-rubrik-mode-confirmation",
    category: "Materi & Soal",
    question: "Kenapa saat simpan mode rubrik muncul konfirmasi dan tooltip?",
    answer: [
      "Konfirmasi berfungsi sebagai validasi akhir sebelum mode rubrik diterapkan ke card soal aktif, untuk mencegah perubahan tidak sengaja.",
      "Tooltip dan alert berfungsi sebagai panduan keputusan: menjelaskan kapan Per Soal lebih presisi, dan kapan Global lebih efisien.",
      "Cara pakai aman: baca ringkasan perbedaan mode -> pilih mode -> lanjut simpan pada popup konfirmasi -> verifikasi hasil pada daftar soal card tersebut.",
    ],
    keywords: ["konfirmasi", "tooltip", "alert", "simpan mode rubrik", "salah klik"],
  },
  {
    id: "penilaian-fullscreen-spreadsheet",
    category: "Penilaian",
    question: "Bagaimana cara memakai mode fullscreen di halaman Penilaian (spreadsheet)?",
    answer: [
      "Fungsi mode fullscreen adalah memperluas area edit spreadsheet penilaian agar input skor/feedback lebih cepat dan minim distraksi.",
      "Cara masuk: buka menu Penilaian -> aktifkan mode fullscreen dari kontrol spreadsheet. Tampilan akan menjadi overlay satu halaman penuh aplikasi (bukan F11 browser).",
      "Saat fullscreen aktif, panel ringkasan disembunyikan supaya fokus ke grid nilai.",
      "Cara keluar: gunakan tombol exit fullscreen atau shortcut keyboard yang ditampilkan di kontrol fullscreen.",
    ],
    keywords: ["fullscreen", "spreadsheet", "penilaian", "overlay", "shortcut"],
  },
  {
    id: "search-ctrlk-content",
    category: "Dashboard Guru",
    question: "Sekarang Ctrl/Cmd+K bisa cari apa saja?",
    answer: [
      "Fungsi Command Search (Ctrl/Cmd+K) adalah navigasi cepat lintas menu dan konten pembelajaran.",
      "Pencarian dapat mencocokkan judul menu, judul konten, isi materi, teks soal, keyword, jawaban ideal, dan deskriptor rubrik.",
      "Cara pakai: tekan Ctrl/Cmd+K -> ketik kata kunci topik atau frasa soal -> pilih hasil paling relevan untuk langsung membuka halaman target.",
    ],
    keywords: ["ctrl k", "cmd k", "command search", "search konten", "rubrik"],
  },
  {
    id: "materi-singkat-image-editor",
    category: "Materi & Soal",
    question: "Bagaimana memakai fitur gambar dan formatting di editor Materi Singkat?",
    answer: [
      "Fungsi editor Materi Singkat adalah menyusun materi teks + media secara cepat dalam satu area kerja.",
      "Gambar: klik ikon gambar di toolbar -> pilih file (PNG/JPG/JPEG, maksimal 10MB) -> file terupload otomatis dan langsung tersisip ke editor.",
      "Teks: gunakan toolbar untuk Bold, Italic, Underline, Strike, Bullet, Number, Heading, Link, dan alignment (kiri, tengah, kanan, kiri-kanan/justify).",
      "Blok gambar: klik gambar untuk seleksi -> atur alignment kiri/tengah/kanan -> resize horizontal dari handle browser -> hapus dengan Delete/Backspace.",
    ],
    keywords: ["materi singkat", "upload otomatis", "10mb", "resize gambar", "formatting"],
  },
  {
    id: "workspace-preference-account",
    category: "Manajemen Kelas",
    question: "Apakah preferensi tampilan workspace (mis. hide/show section detail) tersimpan per akun?",
    answer: [
      "Ya. Preferensi tampilan workspace disimpan per akun, sehingga setelan tetap konsisten saat login ulang.",
      "Fungsi penyimpanan ini adalah menjaga pengalaman kerja yang sama di perangkat berbeda.",
      "Cara pakai: atur opsi tampilan workspace sesuai kebutuhan (mis. show/hide detail tertentu), lalu lanjutkan kerja seperti biasa; sistem akan menyimpan preferensi tersebut.",
    ],
    keywords: ["workspace", "preferensi", "hide section", "per akun", "persist"],
  },
  {
    id: "workspace-viewmode-bulk",
    category: "Manajemen Kelas",
    question: "Apa fungsi mode Card/Table dan bulk action di Workspace Kelas?",
    answer: [
      "Mode Card cocok untuk editing detail per section, sedangkan mode Table cocok untuk review cepat banyak section.",
      "Bulk action membantu operasi massal seperti duplikasi atau hapus section terpilih tanpa mengulang aksi satu per satu.",
      "Kombinasi filter + search + bulk action mempercepat rapikan struktur kelas skala besar.",
    ],
    keywords: ["card mode", "table mode", "bulk action", "duplikat section", "hapus section"],
  },
  {
    id: "soal-ordering-dnd",
    category: "Materi & Soal",
    question: "Bagaimana mengatur urutan soal per card section?",
    answer: [
      "Urutan soal bisa diubah dengan drag-and-drop langsung pada daftar soal.",
      "Tersedia juga tombol naik/turun untuk penyesuaian presisi per soal.",
      "Setelah disimpan, urutan akan dipakai pada tampilan siswa sesuai card section terkait.",
    ],
    keywords: ["urut soal", "drag and drop", "naik turun", "section card"],
  },
  {
    id: "soal-student-session-mode",
    category: "Materi & Soal",
    question: "Apa saja pengaturan mode pengerjaan siswa yang bisa diatur guru?",
    answer: [
      "Guru dapat mengatur visibilitas hasil, visibilitas rubrik saat pengerjaan, mode submit (per soal atau submit semua), serta batas/aturan attempt.",
      "Sistem juga mendukung kontrol integritas seperti kewajiban fullscreen dan deteksi perpindahan tab sesuai kebutuhan sesi.",
      "Selalu cek ulang konfigurasi sebelum publish agar perilaku sesi sesuai tujuan evaluasi.",
    ],
    keywords: ["mode pengerjaan", "show_rubric_in_question", "submit semua", "fullscreen", "attempt"],
  },
  {
    id: "penilaian-banding-tab",
    category: "Penilaian",
    question: "Bagaimana alur kelola banding nilai di menu Penilaian?",
    answer: [
      "Menu Penilaian memiliki tab khusus banding untuk melihat pengajuan siswa per status dan per kelas.",
      "Guru bisa memproses banding menjadi In Review, Diterima, atau Ditolak dengan respons yang terdokumentasi.",
      "Jika banding diterima, skor revisi guru akan menjadi referensi utama di hasil siswa.",
    ],
    keywords: ["banding nilai", "in review", "diterima", "ditolak", "tab banding"],
  },
  {
    id: "fitur-update-sistem-guru",
    category: "Dashboard Guru",
    question: "Di mana guru bisa melihat update sistem atau revisi fitur terbaru?",
    answer: [
      "Gunakan menu Update Sistem/Revisi di sidebar guru untuk melihat histori perubahan fitur antar versi sistem.",
      "Gunakan halaman ini untuk briefing cepat tim pengajar sebelum memakai alur baru.",
      "Visibilitas menu dikendalikan lewat feature flag publik oleh superadmin.",
    ],
    keywords: ["update sistem", "revisi", "changelog", "feature flag"],
  },
  {
    id: "fitur-cara-menemukan-fitur-guru",
    category: "Dashboard Guru",
    question: "Kalau lupa letak fitur tertentu, cara tercepat menemukannya bagaimana?",
    answer: [
      "Gunakan pola utama sidebar: fitur operasional kelas ada di Kelas, evaluasi ada di Penilaian, koleksi soal ada di Bank Soal, dan analisis hasil ada di Laporan Nilai.",
      "Pakai pencarian pada halaman Bantuan untuk istilah seperti join request, rubrik, bulk submit, banding, atau command search.",
      "Jika fitur terasa baru atau berbeda dari sebelumnya, cek Update Sistem/Revisi untuk melihat perubahan versi terbaru.",
    ],
    keywords: ["mencari fitur", "letak fitur", "guru", "search", "sidebar"],
  },
];

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default function TeacherHelpPage() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<FAQCategory | "Semua">("Semua");
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [doneStepIds, setDoneStepIds] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("teacher_help_onboarding_done");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setDoneStepIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setDoneStepIds([]);
    }
  }, []);

  const toggleDoneStep = (id: string) => {
    setDoneStepIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (typeof window !== "undefined") {
        window.localStorage.setItem("teacher_help_onboarding_done", JSON.stringify(next));
      }
      return next;
    });
  };

  const categories = useMemo(() => {
    const list = Array.from(new Set(FAQ_ITEMS.map((item) => item.category)));
    return ["Semua", ...list] as Array<FAQCategory | "Semua">;
  }, []);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQ_ITEMS.filter((item) => {
      const matchCategory = activeCategory === "Semua" || item.category === activeCategory;
      const textSource = `${item.question} ${item.answer.join(" ")} ${item.keywords.join(" ")}`.toLowerCase();
      const matchQuery = !q || textSource.includes(q);
      return matchCategory && matchQuery;
    });
  }, [activeCategory, query]);

  const categoryCount = useMemo(() => {
    const map: Record<string, number> = {};
    FAQ_ITEMS.forEach((item) => {
      map[item.category] = (map[item.category] || 0) + 1;
    });
    return map;
  }, []);

  const onboardingProgress = useMemo(() => {
    const total = TEACHER_ONBOARDING_STEPS.length;
    const done = TEACHER_ONBOARDING_STEPS.filter((step) => doneStepIds.includes(step.id)).length;
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [doneStepIds]);

  const highlightText = (text: string) => {
    const q = query.trim();
    if (!q) return text;
    const regex = new RegExp(`(${escapeRegex(q)})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, idx) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark key={`${part}-${idx}`} className="rounded bg-amber-200 px-0.5 text-slate-900">
          {part}
        </mark>
      ) : (
        <span key={`${part}-${idx}`}>{part}</span>
      ),
    );
  };

  const toggleOpen = (id: string) => {
    setOpenIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const expandAll = () => {
    setOpenIds((prev) => Array.from(new Set([...prev, ...filteredItems.map((item) => item.id)])));
  };

  const collapseAll = () => {
    const filteredSet = new Set(filteredItems.map((item) => item.id));
    setOpenIds((prev) => prev.filter((id) => !filteredSet.has(id)));
  };

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Bantuan Guru</h1>
        <p className="text-sm text-slate-500">
          Dokumentasi lengkap fitur guru: dari manajemen kelas, pembuatan soal, grading AI, sampai pelaporan nilai.
        </p>
      </div>

      <section className="sage-panel p-4">
        <label className="relative block">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="sage-input pl-10"
            placeholder="Cari bantuan guru: join request, bank soal, rubrik, revisi nilai..."
          />
        </label>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">Onboarding Guru (Guided)</p>
            <p className="mt-1 text-xs text-slate-500">
              Progress {onboardingProgress.done}/{onboardingProgress.total} langkah ({onboardingProgress.pct}%)
            </p>
          </div>
          <div className="h-2 w-40 rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full bg-slate-900 transition-all" style={{ width: `${onboardingProgress.pct}%` }} />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {TEACHER_ONBOARDING_STEPS.map((step, idx) => {
            const done = doneStepIds.includes(step.id);
            return (
              <div key={step.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Langkah {idx + 1}</p>
                    <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                    <p className="mt-1 text-xs text-slate-600">{step.desc}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                      <input type="checkbox" checked={done} onChange={() => toggleDoneStep(step.id)} />
                      Selesai
                    </label>
                    <Link href={step.href} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      Buka
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        {categories.map((category) => {
          const active = activeCategory === category;
          const count = category === "Semua" ? FAQ_ITEMS.length : categoryCount[category] || 0;
          return (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {category} ({count})
            </button>
          );
        })}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                <FiHelpCircle />
                FAQ Lengkap Guru
              </p>
              <p className="mt-1 text-xs text-slate-500">{filteredItems.length} topik ditemukan</p>
            </div>
            {filteredItems.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={expandAll}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Collapse All
                </button>
              </div>
            )}
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">
            Tidak ada hasil yang cocok. Coba kata kunci lain atau pilih kategori <b>Semua</b>.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredItems.map((item) => {
              const isOpen = openIds.includes(item.id);
              return (
                <article key={item.id} className="px-5">
                  <button
                    type="button"
                    onClick={() => toggleOpen(item.id)}
                    className="flex w-full items-center justify-between gap-4 py-4 text-left"
                  >
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.category}</p>
                      <h3 className="mt-1 text-sm font-semibold text-slate-900">{item.question}</h3>
                    </div>
                    <FiChevronDown className={`shrink-0 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isOpen && (
                    <div className="pb-4 text-sm text-slate-700">
                      <div className="space-y-2">
                        {item.answer.map((line, idx) => (
                          <p key={`${item.id}-${idx}`}>{highlightText(line)}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
