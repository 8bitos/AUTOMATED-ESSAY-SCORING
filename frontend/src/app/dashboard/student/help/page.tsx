"use client";

import { useMemo, useState } from "react";
import { FiChevronDown, FiHelpCircle, FiSearch } from "react-icons/fi";

type FAQCategory =
  | "Akun & Akses"
  | "Kelas"
  | "Materi & Tugas"
  | "Nilai & Feedback"
  | "Notifikasi"
  | "Fitur Student";

interface FAQItem {
  id: string;
  category: FAQCategory;
  question: string;
  answer: string[];
  keywords: string[];
}

const FAQ_ITEMS: FAQItem[] = [
  {
    id: "akun-role",
    category: "Akun & Akses",
    question: "Apa beda menu student dengan teacher/superadmin?",
    answer: [
      "Akun student fokus ke belajar: akses kelas, materi, tugas, nilai, dan feedback.",
      "Akun teacher fokus manajemen kelas dan penilaian.",
      "Akun superadmin fokus approval dan manajemen user.",
    ],
    keywords: ["role", "student", "teacher", "superadmin", "akses"],
  },
  {
    id: "akun-peta-fitur-student",
    category: "Akun & Akses",
    question: "Sebagai student, bagaimana cara cepat memahami semua fitur yang tersedia?",
    answer: [
      "Mulai dari sidebar: My Classes untuk kelas aktif, Assignments untuk tugas, Grades untuk nilai, Announcements untuk pengumuman, Calendar untuk agenda, Notifikasi untuk event akun, dan Setting untuk profil/keamanan/preferensi.",
      "Gunakan menu Bantuan ini sebagai peta fitur, lalu buka Update Sistem/Revisi untuk melihat fitur baru atau perubahan alur terbaru.",
      "Kalau ingin lompat cepat ke halaman tertentu, gunakan Command Search (Ctrl/Cmd+K) bila tersedia di topbar.",
    ],
    keywords: ["peta fitur", "semua fitur", "sidebar", "student", "menu"],
  },
  {
    id: "akun-settings",
    category: "Akun & Akses",
    question: "Bagaimana cara ubah profil dan password?",
    answer: [
      "Buka menu Setting (paling bawah sidebar).",
      "Masuk ke Profil untuk edit data diri.",
      "Masuk ke Keamanan untuk ganti password, termasuk indikator strength meter.",
    ],
    keywords: ["profil", "password", "keamanan", "setting"],
  },
  {
    id: "kelas-join",
    category: "Kelas",
    question: "Bagaimana cara gabung kelas dengan kode?",
    answer: [
      "Buka My Classes.",
      "Masukkan kode kelas di form Gabung Kelas Baru.",
      "Jika kelas butuh approval guru, status akan muncul di bagian Menunggu ACC Guru.",
    ],
    keywords: ["join", "kode", "my classes", "acc", "pending"],
  },
  {
    id: "kelas-invite",
    category: "Kelas",
    question: "Kalau saya di-invite guru, apa yang terjadi?",
    answer: [
      "Kamu langsung masuk ke kelas tanpa perlu input kode.",
      "Notifikasi \"Diundang ke Kelas\" akan muncul jika toggle notifikasinya aktif.",
      "Kelas akan tampil di My Classes.",
    ],
    keywords: ["invite", "diundang", "kelas", "notifikasi"],
  },
  {
    id: "kelas-acc",
    category: "Kelas",
    question: "Bagaimana tahu request gabung saya sudah di-ACC?",
    answer: [
      "Aktifkan preferensi notifikasi \"ACC masuk kelas\" di Settings > Preferensi Notifikasi.",
      "Saat disetujui, kamu akan dapat notifikasi dan kelas pindah dari daftar pending ke daftar kelas aktif.",
    ],
    keywords: ["acc", "approve", "kelas", "pending", "notifikasi"],
  },
  {
    id: "materi-open",
    category: "Materi & Tugas",
    question: "Bagaimana urutan mengerjakan materi dan soal?",
    answer: [
      "Masuk ke My Classes lalu pilih kelas.",
      "Buka materi yang ingin dipelajari, baca konten dan deskripsi.",
      "Pindah ke tab soal, isi jawaban, lalu submit per soal.",
      "Cek tab hasil untuk nilai AI/revisi guru dan nilai akhir materi.",
    ],
    keywords: ["materi", "soal", "submit", "hasil", "tab"],
  },
  {
    id: "materi-status",
    category: "Materi & Tugas",
    question: "Apa arti status Belum Selesai / Selesai di materi?",
    answer: [
      "Selesai: semua soal pada materi sudah disubmit.",
      "Belum Selesai: masih ada soal yang belum disubmit.",
      "Tanpa Tugas: materi tidak punya soal esai.",
    ],
    keywords: ["status", "selesai", "belum", "materi", "tugas"],
  },
  {
    id: "materi-dot",
    category: "Materi & Tugas",
    question: "Apa arti dot merah di materi?",
    answer: [
      "Dot merah menandakan ada update terbaru pada materi.",
      "Saat materi dibuka atau deskripsi materi dibaca, status update akan ditandai sebagai sudah dilihat.",
    ],
    keywords: ["dot merah", "update", "materi"],
  },
  {
    id: "materi-sort-soal",
    category: "Materi & Tugas",
    question: "Bagaimana mengurutkan soal di halaman materi?",
    answer: [
      "Di tab soal, kamu bisa memilih opsi urutkan seperti bobot terbesar, alphabet, atau belum dijawab.",
      "Gunakan urutan ini untuk fokus mengerjakan soal prioritas terlebih dahulu.",
    ],
    keywords: ["sort", "soal", "bobot", "alphabet", "belum dijawab"],
  },
  {
    id: "nilai-rumus",
    category: "Nilai & Feedback",
    question: "Bagaimana rumus Nilai Akhir Materi dihitung?",
    answer: [
      "Rumus: (Σ(nilai soal × bobot) / Σ(bobot)) × (jumlah soal dijawab / total soal).",
      "Artinya, bobot soal dan kelengkapan jawaban sama-sama mempengaruhi nilai akhir.",
      "Jika belum semua soal dijawab, nilai akhir akan turun sesuai faktor kelengkapan.",
    ],
    keywords: ["rumus", "nilai akhir", "bobot", "kelengkapan"],
  },
  {
    id: "nilai-revisi",
    category: "Nilai & Feedback",
    question: "Nilai AI dan Nilai Revisi Guru, mana yang dipakai?",
    answer: [
      "Jika guru memberi revisi nilai, sistem akan memprioritaskan nilai revisi guru.",
      "Jika belum ada revisi, nilai AI yang digunakan.",
      "Detailnya bisa dilihat di tab hasil pada materi.",
    ],
    keywords: ["ai", "revisi", "guru", "nilai", "hasil"],
  },
  {
    id: "nilai-dashboard",
    category: "Nilai & Feedback",
    question: "Apa saja yang bisa dilihat di menu Nilai & Feedback?",
    answer: [
      "Ringkasan rata-rata nilai, materi selesai, dan materi yang perlu perbaikan.",
      "Tabel nilai per materi dengan filter/sort.",
      "Feedback terbaru dari guru, plus chart distribusi nilai.",
    ],
    keywords: ["grades", "feedback", "chart", "summary", "tabel"],
  },
  {
    id: "notif-bell",
    category: "Notifikasi",
    question: "Notifikasi muncul saat apa saja?",
    answer: [
      "Status approval profile request.",
      "ACC masuk kelas atau diinvite ke kelas.",
      "Materi baru/diperbarui, soal baru, dan nilai direview guru.",
      "Semua ini bisa diatur on/off per jenis notifikasi.",
    ],
    keywords: ["notifikasi", "bell", "approval", "materi", "review"],
  },
  {
    id: "notif-settings",
    category: "Notifikasi",
    question: "Bagaimana mengatur jenis notifikasi yang ingin tampil?",
    answer: [
      "Masuk ke Setting > Preferensi Notifikasi.",
      "Aktifkan/nonaktifkan toggle sesuai kebutuhan.",
      "Perubahan akan langsung berpengaruh ke ikon lonceng dan halaman notifikasi.",
    ],
    keywords: ["toggle", "preferensi", "setting", "notifikasi"],
  },
  {
    id: "notif-read",
    category: "Notifikasi",
    question: "Bagaimana cara tandai notifikasi sudah dibaca?",
    answer: [
      "Buka popup notifikasi dari ikon lonceng atau halaman notifikasi.",
      "Pakai tombol Tandai sudah dibaca / Tandai semua sudah dibaca.",
      "Status baca disimpan per akun di browser kamu.",
    ],
    keywords: ["read", "tandai", "dibaca", "notifikasi"],
  },
  {
    id: "fitur-kalender",
    category: "Fitur Student",
    question: "Fungsi menu Kalender untuk siswa apa?",
    answer: [
      "Kalender menampilkan agenda aktivitas berdasarkan tanggal, misalnya update materi, feedback guru, atau status approval.",
      "Kamu bisa klik tanggal tertentu untuk melihat detail agenda hari itu.",
    ],
    keywords: ["kalender", "agenda", "tanggal"],
  },
  {
    id: "fitur-pengumuman",
    category: "Fitur Student",
    question: "Apa bedanya menu Pengumuman dan Notifikasi?",
    answer: [
      "Notifikasi fokus event cepat di akunmu (ikon lonceng dan feed notifikasi).",
      "Pengumuman berisi feed informasi lebih umum seperti update sistem, update materi, approval, dan feedback terbaru.",
    ],
    keywords: ["pengumuman", "notifikasi", "beda"],
  },
  {
    id: "fitur-update-sistem-student",
    category: "Fitur Student",
    question: "Di mana saya bisa melihat update sistem atau revisi fitur terbaru?",
    answer: [
      "Gunakan menu Update Sistem/Revisi jika menu itu sedang ditampilkan di sidebar akunmu.",
      "Halaman tersebut berisi ringkasan perubahan versi, termasuk major update dan penyempurnaan kecil yang memengaruhi alur belajar.",
      "Jika menu tidak terlihat, berarti visibilitasnya sedang diatur oleh superadmin melalui feature flag sistem.",
    ],
    keywords: ["update sistem", "revisi", "changelog", "sidebar", "fitur baru"],
  },
  {
    id: "fitur-cara-menemukan-fitur-student",
    category: "Fitur Student",
    question: "Kalau saya lupa letak fitur tertentu, cara menemukannya bagaimana?",
    answer: [
      "Cek dulu kategori di sidebar karena fitur student dikelompokkan berdasarkan alur belajar: kelas, tugas, nilai, pengumuman, kalender, dan notifikasi.",
      "Gunakan kolom pencarian di halaman Bantuan untuk mencari kata kunci seperti nilai, banding, rubrik, submit, atau notifikasi.",
      "Untuk fitur yang baru dirilis atau berubah posisi, lihat halaman Update Sistem/Revisi agar tidak ketinggalan perubahan navigasi.",
    ],
    keywords: ["mencari fitur", "letak fitur", "sidebar", "bantuan", "search"],
  },
  {
    id: "materi-soal-compact-expand",
    category: "Materi & Tugas",
    question: "Kenapa daftar soal sekarang lebih ringkas dan detailnya harus dibuka dulu?",
    answer: [
      "Fungsi tampilan ringkas adalah mempercepat scanning daftar soal saat jumlah soal banyak.",
      "Cara pakai: ketuk card soal untuk membuka detail (bobot, status submit, percobaan, nilai, dan aksi lanjutan), lalu ketuk lagi untuk menutup.",
      "Model ini membantu fokus ke soal yang ingin dikerjakan tanpa harus scroll halaman panjang terus-menerus.",
    ],
    keywords: ["compact", "expand", "daftar soal", "detail soal", "ui baru"],
  },
  {
    id: "materi-rubrik-collapse",
    category: "Materi & Tugas",
    question: "Rubrik di halaman pengerjaan bisa dibuka/tutup?",
    answer: [
      "Ya. Rubrik ditampilkan dalam panel collapse/expand ketika guru mengaktifkan visibilitas rubrik pada soal tersebut.",
      "Cara pakai: buka detail soal -> klik panel Rubrik untuk melihat aspek dan deskriptor -> tutup kembali agar area kerja jawaban lebih lega.",
      "Fungsi ini menjaga keseimbangan antara keterbacaan rubrik dan kerapian halaman pengerjaan.",
    ],
    keywords: ["rubrik", "collapse", "expand", "pengerjaan soal"],
  },
  {
    id: "nilai-hasil-disembunyikan",
    category: "Nilai & Feedback",
    question: "Kenapa kadang muncul status “Hasil disembunyikan”?",
    answer: [
      "Guru dapat mengatur visibilitas hasil per sesi/card soal.",
      "Jika status ini muncul, fungsi sistem adalah menahan akses detail nilai sementara meskipun submit tetap berjalan normal.",
      "Kamu bisa lanjut mengerjakan/submit, lalu cek kembali setelah hasil dirilis oleh guru.",
    ],
    keywords: ["hasil disembunyikan", "visibilitas hasil", "release nilai"],
  },
  {
    id: "nilai-ajukan-banding-template",
    category: "Nilai & Feedback",
    question: "Bagaimana alur Ajukan Banding terbaru?",
    answer: [
      "Fungsi fitur banding adalah memberi jalur resmi untuk meminta review ulang nilai.",
      "Cara pakai: klik Ajukan Banding -> pilih template alasan (radio) yang paling sesuai -> jika memilih “Lainnya”, isi alasan custom pada textbox yang muncul.",
      "Agar proses cepat, tulis alasan spesifik berdasarkan aspek rubrik, bagian jawaban, atau ketidaksesuaian skor yang kamu temukan.",
    ],
    keywords: ["ajukan banding", "template alasan", "radio", "lainnya"],
  },
  {
    id: "fitur-search-content-ctrlk",
    category: "Fitur Student",
    question: "Ctrl/Cmd+K sekarang bisa cari isi konten juga?",
    answer: [
      "Fungsi Command Search (Ctrl/Cmd+K) adalah membuka halaman/fitur dengan cepat lewat satu kolom pencarian.",
      "Pencarian dapat membaca nama menu dan konten belajar yang relevan sehingga hasil lebih tepat.",
      "Cara pakai: tekan Ctrl/Cmd+K -> ketik topik/frasa soal/istilah penting -> pilih hasil untuk langsung pindah ke halaman target.",
    ],
    keywords: ["ctrl k", "cmd k", "search konten", "global search"],
  },
  {
    id: "materi-submit-mode",
    category: "Materi & Tugas",
    question: "Apa beda submit per soal vs submit semua jawaban sekaligus?",
    answer: [
      "Per soal: jawaban dikirim satu per satu saat kamu menekan submit di card soal terkait.",
      "Submit semua: semua jawaban di dalam sesi dikirim sekaligus lewat tombol submit akhir.",
      "Mode yang aktif mengikuti pengaturan guru pada sesi/soal tersebut.",
    ],
    keywords: ["submit semua", "bulk submit", "submit per soal", "mode submit"],
  },
  {
    id: "materi-attempt-cooldown",
    category: "Materi & Tugas",
    question: "Bagaimana aturan percobaan ulang (attempt) dan cooldown?",
    answer: [
      "Setiap soal bisa punya batas percobaan berbeda sesuai setelan guru.",
      "Jika ada cooldown, kamu harus menunggu durasi tertentu sebelum bisa mencoba lagi.",
      "Pada beberapa sesi, percobaan tak terbatas juga bisa diaktifkan oleh guru.",
    ],
    keywords: ["attempt", "coba ulang", "cooldown", "batas percobaan"],
  },
  {
    id: "materi-integritas-ujian",
    category: "Materi & Tugas",
    question: "Kenapa saat ujian fullscreen/pindah tab bisa muncul peringatan?",
    answer: [
      "Sebagian sesi memakai pengaturan integritas pengerjaan dari guru.",
      "Jika mode fullscreen wajib atau deteksi perpindahan tab aktif, sistem akan memberi peringatan saat aturan dilanggar.",
      "Ikuti instruksi popup agar pengerjaan tetap valid dan tidak terkunci.",
    ],
    keywords: ["fullscreen", "pindah tab", "integritas", "peringatan ujian"],
  },
  {
    id: "nilai-status-ai",
    category: "Nilai & Feedback",
    question: "Apa arti status Queued/Processing/Waiting Review di nilai?",
    answer: [
      "Queued: jawaban sudah masuk antrean penilaian AI.",
      "Processing: AI sedang memproses jawaban.",
      "Waiting Review: hasil AI ada, tetapi masih menunggu review/revisi guru (jika diperlukan).",
    ],
    keywords: ["queued", "processing", "waiting review", "status ai"],
  },
  {
    id: "kelas-tab-materi-nilai",
    category: "Kelas",
    question: "Di detail kelas ada tab Materi dan Nilai, bedanya apa?",
    answer: [
      "Tab Materi fokus ke daftar materi, progres belajar, dan akses pengerjaan soal.",
      "Tab Nilai fokus ke ringkasan nilai per materi/per soal serta status feedback.",
      "Gunakan tab Nilai untuk cek cepat performa tanpa harus membuka tiap materi satu per satu.",
    ],
    keywords: ["tab materi", "tab nilai", "detail kelas", "progres"],
  },
];

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default function StudentHelpPage() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<FAQCategory | "Semua">("Semua");
  const [openIds, setOpenIds] = useState<string[]>([]);

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
        <h1 className="text-2xl font-semibold text-slate-900">Bantuan</h1>
        <p className="text-sm text-slate-500">Pusat bantuan lengkap penggunaan LMS siswa dari alur belajar sampai fitur-fitur student.</p>
      </div>

      <section className="sage-panel p-4">
        <label className="relative block">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="sage-input pl-10"
            placeholder="Cari bantuan: nilai akhir, notifikasi, join kelas, materi..."
          />
        </label>
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
                FAQ Lengkap
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
