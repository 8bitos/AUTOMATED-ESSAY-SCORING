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
