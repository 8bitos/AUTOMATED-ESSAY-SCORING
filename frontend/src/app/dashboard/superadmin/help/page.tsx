"use client";

import { useMemo, useState } from "react";
import { FiChevronDown, FiHelpCircle, FiSearch } from "react-icons/fi";

type FAQCategory =
  | "Akses & Role"
  | "Operasional Admin"
  | "Monitoring & Audit"
  | "AI Ops & Queue"
  | "Konfigurasi Sistem";

interface FAQItem {
  id: string;
  category: FAQCategory;
  question: string;
  answer: string[];
  keywords: string[];
}

const FAQ_ITEMS: FAQItem[] = [
  {
    id: "admin-scope",
    category: "Akses & Role",
    question: "Apa scope utama superadmin di sistem ini?",
    answer: [
      "Superadmin fokus pada kontrol sistem: monitoring, approval, manajemen user, konfigurasi, dan audit.",
      "Superadmin bukan pengganti workflow belajar harian student/teacher, tetapi pengendali kebijakan platform.",
    ],
    keywords: ["superadmin", "scope", "role", "akses"],
  },
  {
    id: "admin-impersonate",
    category: "Operasional Admin",
    question: "Menu Impersonate dipakai untuk apa?",
    answer: [
      "Impersonate dipakai untuk simulasi akun user saat troubleshooting kasus spesifik.",
      "Gunakan hanya untuk investigasi operasional, lalu keluar dari mode impersonate setelah selesai.",
    ],
    keywords: ["impersonate", "debug", "troubleshoot", "simulasi akun"],
  },
  {
    id: "admin-approval",
    category: "Operasional Admin",
    question: "Approval/Profile Requests dikelola di mana?",
    answer: [
      "Gunakan menu Approval untuk review permintaan perubahan data profil user.",
      "Setiap keputusan approval akan berdampak langsung pada data profil dan hak akses terkait.",
    ],
    keywords: ["approval", "profile request", "permintaan profil"],
  },
  {
    id: "admin-user-management",
    category: "Operasional Admin",
    question: "Apa fungsi utama menu Manajemen User?",
    answer: [
      "Kelola data user lintas role, lakukan pencarian cepat, dan update data administratif.",
      "Untuk perubahan sensitif, pastikan ada jejak audit dan alasan perubahan yang jelas.",
    ],
    keywords: ["manajemen user", "users", "admin data"],
  },
  {
    id: "admin-monitoring",
    category: "Monitoring & Audit",
    question: "Bedanya Monitoring dan Audit Log apa?",
    answer: [
      "Monitoring fokus pada kondisi sistem saat ini (status operasional dan anomali).",
      "Audit Log fokus pada histori aksi administratif untuk kebutuhan pelacakan dan kepatuhan.",
    ],
    keywords: ["monitoring", "audit log", "beda"],
  },
  {
    id: "admin-ai-ops",
    category: "AI Ops & Queue",
    question: "Kapan gunakan menu AI Ops?",
    answer: [
      "AI Ops dipakai untuk melihat kesehatan proses grading AI dan parameter operasional terkait.",
      "Gunakan menu ini saat ada indikasi bottleneck, error grading, atau perlu kalibrasi kebijakan AI.",
    ],
    keywords: ["ai ops", "grading ai", "error ai"],
  },
  {
    id: "admin-queue",
    category: "AI Ops & Queue",
    question: "Queue Monitor dipakai kapan?",
    answer: [
      "Queue Monitor dipakai saat perlu memantau antrean job, lonjakan beban, dan job yang tertahan.",
      "Menu ini membantu menentukan apakah proses berjalan normal atau perlu tindakan administratif.",
    ],
    keywords: ["queue", "job", "antrean", "monitor"],
  },
  {
    id: "admin-feature-flags",
    category: "Konfigurasi Sistem",
    question: "Pengaturan feature flag ada di mana?",
    answer: [
      "Feature flag dikelola di menu Feature Flags pada area superadmin.",
      "Gunakan flag untuk mengatur visibilitas/aktivasi fitur secara bertahap tanpa redeploy penuh.",
    ],
    keywords: ["feature flags", "konfigurasi", "rollout fitur"],
  },
  {
    id: "admin-config-settings",
    category: "Konfigurasi Sistem",
    question: "Menu Config dan Settings dipakai untuk apa?",
    answer: [
      "Config dipakai untuk parameter sistem tingkat aplikasi, sementara Settings untuk preferensi operasional panel admin.",
      "Perubahan konfigurasi sebaiknya dilakukan terkontrol dan diverifikasi dampaknya setelah disimpan.",
    ],
    keywords: ["config", "settings", "parameter sistem"],
  },
];

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default function SuperadminHelpPage() {
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

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Bantuan Superadmin</h1>
        <p className="text-sm text-slate-500">Ringkasan fungsi menu admin untuk operasional, monitoring, audit, dan konfigurasi sistem.</p>
      </div>

      <section className="sage-panel p-4">
        <label className="relative block">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="sage-input pl-10"
            placeholder="Cari bantuan admin: approval, ai ops, queue, audit..."
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
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FiHelpCircle />
            FAQ Superadmin
          </p>
          <p className="mt-1 text-xs text-slate-500">{filteredItems.length} topik ditemukan</p>
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
