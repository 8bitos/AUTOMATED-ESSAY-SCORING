"use client";

import Link from "next/link";
import { useTheme } from "@/context/ThemeContext";
import { useState, useEffect, useRef, type CSSProperties, useCallback } from "react";

/* ──────────────────────── data ──────────────────────── */

const stats = [
  { value: 24, suffix: "%", label: "Waktu koreksi guru lebih hemat" },
  { value: 99, suffix: ".2%", label: "Tingkat ketepatan penilaian AI" },
  { value: 3, suffix: " langkah", label: "Rubrik → Penilaian AI → Umpan balik" },
  { value: 100, suffix: "%", label: "Nilai terbuka dan bisa dilihat per aspek" },
];

const steps = [
  {
    num: "01",
    title: "Buat Rubrik",
    desc: "Guru membuat rubrik berisi kriteria penilaian, penjelasan tiap kriteria, dan bobotnya. Rubrik dikunci sebelum penilaian dimulai supaya standar nilainya tetap sama.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 14l2 2 4-4" />
      </svg>
    ),
  },
  {
    num: "02",
    title: "Siswa Submit Esai",
    desc: "Siswa mengirim esai lewat platform. Sistem otomatis mengunci rubrik yang sudah dibuat guru agar standar penilaiannya tidak berubah.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
        <path d="M10 9H8" />
      </svg>
    ),
  },
  {
    num: "03",
    title: "AI Menilai Otomatis",
    desc: "AI membaca esai dan memberi nilai untuk setiap kriteria rubrik secara terpisah. Hasilnya konsisten — esai yang sama akan mendapat nilai yang sama.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
        <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4Z" />
        <path d="M16 14h.01" />
        <path d="M8 14h.01" />
        <path d="M12 18v4" />
        <path d="M8 22h8" />
        <path d="M7 10H5a1 1 0 0 0-1 1v2a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-2a1 1 0 0 0-1-1h-2" />
      </svg>
    ),
  },
  {
    num: "04",
    title: "Guru Review & Finalisasi",
    desc: "Guru melihat rincian nilai per kriteria, alasan AI memberi skor tersebut, dan bisa mengubah nilai jika perlu. Semua perubahan tercatat rapi.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
];

const features = [
  {
    title: "Rubrik yang Fleksibel",
    desc: "Buat rubrik sesuai kebutuhan — tentukan kriteria, penjelasan, dan bobot nilainya. AI akan menilai sesuai rubrik yang guru buat.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" />
      </svg>
    ),
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    title: "Penilaian AI yang Konsisten",
    desc: "Esai yang sama akan selalu mendapat nilai yang sama. Sistem menjaga agar standar penilaian tidak bergeser dari waktu ke waktu.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4Z" />
        <path d="M16 14h.01" />
        <path d="M8 14h.01" />
        <path d="M7 10H5a1 1 0 0 0-1 1v2a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-2a1 1 0 0 0-1-1h-2" />
      </svg>
    ),
    gradient: "from-sky-500 to-blue-600",
  },
  {
    title: "Laporan yang Jelas",
    desc: "Lihat ringkasan nilai kelas, ketepatan penilaian AI, dan riwayat penilaian dalam satu halaman. Data bisa diunduh kapan saja.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M3 3v18h18" />
        <path d="m19 9-5 5-4-4-3 3" />
      </svg>
    ),
    gradient: "from-violet-500 to-purple-600",
  },
  {
    title: "Guru Tetap Penentu",
    desc: "Guru bisa meninjau dan mengubah nilai AI kapan saja. Setiap perubahan tercatat lengkap dengan alasan dan waktunya.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
    gradient: "from-amber-500 to-orange-600",
  },
  {
    title: "Jejak Penilaian Tercatat",
    desc: "Setiap nilai dari AI dan perubahan dari guru tercatat rapi. Tidak ada nilai tanpa bukti — siap untuk keperluan akreditasi.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
      </svg>
    ),
    gradient: "from-rose-500 to-pink-600",
  },
  {
    title: "Banyak Kelas, Tetap Lancar",
    desc: "Kelola puluhan kelas sekaligus. Sistem antrian memastikan penilaian tetap berjalan lancar meski esai yang masuk sangat banyak.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
    gradient: "from-cyan-500 to-teal-600",
  },
];

const benefits = [
  {
    title: "Untuk Guru",
    items: [
      "Hemat waktu koreksi hingga 24%",
      "Umpan balik otomatis per kriteria rubrik",
      "Ubah nilai AI kapan saja, perubahannya tercatat",
      "Pantau perkembangan kelas secara langsung",
    ],
    accent: "emerald",
  },
  {
    title: "Untuk Siswa",
    items: [
      "Dapat penjelasan nilai di setiap kriteria",
      "Tahu persis kenapa nilainya segitu",
      "Nilai keluar lebih cepat",
      "Bisa perbaiki esai berdasarkan masukan yang jelas",
    ],
    accent: "sky",
  },
  {
    title: "Untuk Institusi",
    items: [
      "Standar penilaian yang sama di semua kelas",
      "Jejak penilaian lengkap untuk akreditasi",
      "Laporan penilaian terpusat dan mudah diakses",
      "Bisa dipakai banyak kelas dan guru sekaligus",
    ],
    accent: "violet",
  },
];

const faqs = [
  {
    q: "Apakah AI menggantikan peran guru?",
    a: "Tidak. SAGE hanya membantu sebagai asisten. AI memberikan nilai awal dan penjelasan per kriteria, tapi guru tetap yang menentukan nilai akhir. Setiap perubahan tercatat rapi.",
  },
  {
    q: "Bagaimana cara kerja penilaian AI?",
    a: "AI membaca esai dan mencocokkannya dengan rubrik yang sudah dibuat guru. Setiap kriteria dinilai satu per satu, lalu hasilnya disajikan dalam bentuk yang mudah dibaca. Sistem dirancang agar hasil penilaiannya selalu konsisten.",
  },
  {
    q: "Apakah data esai siswa aman?",
    a: "Ya. Semua data tersimpan di server yang aman. Esai hanya bisa diakses oleh guru kelas terkait dan admin. Kami tidak menggunakan data esai untuk melatih model AI.",
  },
  {
    q: "Bisakah dipakai bersama sistem yang sudah ada di sekolah?",
    a: "SAGE bisa digunakan sendiri tanpa tergantung sistem lain. Platform ini sudah menyediakan fitur lengkap: kelola kelas, kirim esai, dan penilaian otomatis.",
  },
  {
    q: "Berapa lama waktu penilaian AI?",
    a: "Rata-rata hanya 1-3 detik per esai. Meski ada ratusan esai masuk bersamaan, sistem antrian memastikan semuanya diproses dengan lancar.",
  },
];

/* ──────────────── counter hook ──────────────── */

function useCountUp(target: number, duration = 2000, trigger = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration, trigger]);
  return count;
}

/* ──────────────── intersection observer hook ──────────────── */

function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, isInView };
}

/* ──────────────── stat counter component ──────────────── */

function StatCounter({ value, suffix, label, delay, trigger }: {
  value: number; suffix: string; label: string; delay: number; trigger: boolean;
}) {
  const count = useCountUp(value, 2000, trigger);
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border p-5 text-center transition-all duration-500 hover:scale-[1.03] hover:shadow-xl stat-card"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100 dark-hidden" />
      <p className="text-3xl font-bold tracking-tight sm:text-4xl stat-value">
        {count}{suffix}
      </p>
      <p className="mt-2 text-sm stat-label">{label}</p>
    </div>
  );
}

/* ──────────────── FAQ item ──────────────── */

function FAQItem({ q, a, isOpen, onToggle }: {
  q: string; a: string; isOpen: boolean; onToggle: () => void;
}) {
  return (
    <div className="faq-item rounded-2xl border transition-all duration-300">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 p-5 text-left"
      >
        <span className="text-sm font-semibold sm:text-base faq-question">{q}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className={`h-5 w-5 shrink-0 transition-transform duration-300 faq-chevron ${isOpen ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-48 pb-5" : "max-h-0"}`}
      >
        <p className="px-5 text-sm leading-relaxed faq-answer">{a}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════ LANDING PAGE ═══════════════════════ */

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [pointer, setPointer] = useState({ x: 50, y: 35 });
  const statsView = useInView(0.3);
  const stepsView = useInView(0.15);
  const featuresView = useInView(0.15);

  const heroStyle = {
    "--mx": `${pointer.x}%`,
    "--my": `${pointer.y}%`,
  } as CSSProperties;

  const handleHeroMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPointer({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  }, []);

  return (
    <main
      className={`landing-root relative min-h-screen overflow-hidden ${isDark ? "landing-dark" : "landing-light"}`}
    >
      {/* ─── ambient background ─── */}
      <div
        className="pointer-events-none absolute inset-0 landing-ambient"
        style={heroStyle}
      />
      <div className="pointer-events-none absolute inset-0 opacity-30 sage-noise" />

      {/* ─── floating orbs ─── */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full bg-gradient-to-br from-emerald-400/20 to-teal-300/10 blur-[100px] animate-float" />
      <div className="pointer-events-none absolute top-1/3 -right-40 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-sky-400/20 to-indigo-400/10 blur-[100px] animate-float" style={{ animationDelay: "-3s" }} />
      <div className="pointer-events-none absolute bottom-0 left-1/4 h-[350px] w-[350px] rounded-full bg-gradient-to-br from-violet-400/15 to-purple-300/10 blur-[100px] animate-float" style={{ animationDelay: "-6s" }} />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-0 px-4 py-4 sm:px-6 sm:py-6 lg:py-8">

        {/* ═══════════ NAVBAR ═══════════ */}
        <header className="relative z-20 flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-lg shadow-emerald-500/20">
              <img src="/logo.png" alt="SAGE Logo" className="h-full w-full object-cover" />
            </div>
            <div className="hidden sm:block">
              <span className="block text-sm font-bold tracking-widest nav-brand">S A G E</span>
              <span className="block text-[10px] uppercase tracking-wider nav-subtitle">Smart Automated Grading Engine</span>
            </div>
          </div>
          <nav className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="nav-btn-icon"
            >
              {isDark ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="M5 5l1.5 1.5" /><path d="M17.5 17.5L19 19" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="M5 19l1.5-1.5" /><path d="M17.5 6.5L19 5" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.8A8 8 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8Z" />
                </svg>
              )}
            </button>
            <Link href="/login" className="nav-btn-outline hidden sm:inline-flex">
              Masuk
            </Link>
            <Link href="/register" className="nav-btn-primary">
              Daftar
            </Link>
          </nav>
        </header>

        {/* ═══════════ HERO ═══════════ */}
        <section
          className="relative mt-8 flex flex-col items-center text-center sm:mt-14 lg:mt-20"
          onMouseMove={handleHeroMove}
        >
          <div className="hero-badge animate-drift">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)] animate-pulse" />
            <span>Penilaian Esai AI yang Transparan</span>
          </div>

          <h1 className="mt-6 max-w-3xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl hero-title">
            Penilaian{" "}
            <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 bg-clip-text text-transparent">
              Cerdas, Konsisten, Transparan
            </span>
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-relaxed sm:text-lg hero-subtitle">
            Platform penilaian esai dengan bantuan AI yang terbuka dan jelas. Rubrik dikunci, AI memberi nilai per kriteria, dan guru tetap memegang keputusan akhir.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Link href="/login" className="hero-btn-primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="m10 17 5-5-5-5" /><path d="M15 12H3" />
              </svg>
              Masuk ke Dashboard
            </Link>
            <Link href="/register" className="hero-btn-secondary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Daftar Sekarang
            </Link>
          </div>

          {/* Hero visual card */}
          <div className="hero-visual-card mt-14 w-full max-w-4xl">
            <div className="hero-card-inner rounded-3xl border p-4 sm:p-6 shadow-2xl backdrop-blur-xl">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                {/* Grading preview */}
                <div className="sm:col-span-2 rounded-2xl border p-4 hero-inner-card">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-xs font-semibold uppercase tracking-wider hero-inner-label">Contoh Penilaian AI</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { aspect: "Isi & Argumentasi", score: 4, max: 5, color: "bg-emerald-500" },
                      { aspect: "Struktur & Organisasi", score: 4, max: 5, color: "bg-sky-500" },
                      { aspect: "Tata Bahasa", score: 5, max: 5, color: "bg-violet-500" },
                      { aspect: "Referensi", score: 2, max: 3, color: "bg-amber-500" },
                    ].map((item) => (
                      <div key={item.aspect} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="hero-inner-text">{item.aspect}</span>
                          <span className="font-semibold hero-inner-score">{item.score}/{item.max}</span>
                        </div>
                        <div className="h-2 w-full rounded-full hero-progress-bg overflow-hidden">
                          <div
                            className={`h-full rounded-full ${item.color} transition-all duration-1000`}
                            style={{ width: `${(item.score / item.max) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-xl p-3 hero-feedback-box">
                    <p className="text-[11px] font-semibold uppercase tracking-wider hero-inner-label mb-1">
                      Masukan AI
                    </p>
                    <p className="text-xs leading-relaxed hero-inner-text">
                      &ldquo;Argumentasi cukup kuat dengan 3 poin utama. Perlu penambahan referensi jurnal terkini untuk memperkuat klaim di paragraf 2.&rdquo;
                    </p>
                  </div>
                </div>

                {/* Live status */}
                <div className="rounded-2xl border p-4 hero-inner-card">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider hero-inner-label">Status Sistem</span>
                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)] animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    {[
                      { name: "Antrian", value: "Lancar", color: "text-emerald-500" },
                      { name: "Ketepatan AI", value: "99.2%", color: "text-sky-500" },
                      { name: "Kecepatan", value: "1.4 detik", color: "text-amber-500" },
                      { name: "Jejak Nilai", value: "Aktif", color: "text-violet-500" },
                    ].map((signal) => (
                      <div key={signal.name} className="flex items-center justify-between rounded-xl py-2 px-3 text-xs hero-signal-row">
                        <span className="hero-inner-text">{signal.name}</span>
                        <span className={`font-bold ${signal.color}`}>{signal.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-xl p-3 hero-feedback-box">
                    <p className="text-[11px] font-semibold uppercase tracking-wider hero-inner-label mb-1">
                      Keandalan Sistem
                    </p>
                    <p className="text-lg font-bold hero-inner-score">99.9%</p>
                    <p className="text-[11px] hero-inner-text">selalu aktif & siap digunakan</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ STATS ═══════════ */}
        <section ref={statsView.ref} className="mt-20 sm:mt-28">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {stats.map((stat, i) => (
              <StatCounter
                key={stat.label}
                value={stat.value}
                suffix={stat.suffix}
                label={stat.label}
                delay={i * 150}
                trigger={statsView.isInView}
              />
            ))}
          </div>
        </section>

        {/* ═══════════ HOW IT WORKS ═══════════ */}
        <section ref={stepsView.ref} className="mt-24 sm:mt-32">
          <div className="text-center">
            <p className="section-overline">Cara Kerja</p>
            <h2 className="section-title mt-3">
              Dari Rubrik Sampai{" "}
              <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
                Skor Final
              </span>
            </h2>
            <p className="section-subtitle mx-auto mt-4 max-w-2xl">
              Alur penilaian yang jelas dan terbuka. Setiap langkah bisa ditelusuri, dari awal sampai akhir.
            </p>
          </div>
          <div className="relative mt-14 grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-4">
            {/* connector line (desktop) */}
            <div className="absolute top-12 left-[calc(12.5%+20px)] right-[calc(12.5%+20px)] hidden h-[2px] lg:block steps-connector" />
            {steps.map((step, i) => (
              <div
                key={step.num}
                className={`step-card group relative rounded-3xl border p-6 transition-all duration-500 hover:-translate-y-2 hover:shadow-xl ${stepsView.isInView ? "animate-slide-up" : "opacity-0"}`}
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <div className="flex items-center gap-3">
                  <div className="step-num flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-lg">
                    {step.num}
                  </div>
                  <div className="step-icon">{step.icon}</div>
                </div>
                <h3 className="mt-4 text-base font-bold step-title">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed step-desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════ FEATURES ═══════════ */}
        <section ref={featuresView.ref} className="mt-24 sm:mt-32">
          <div className="text-center">
            <p className="section-overline">Fitur Unggulan</p>
            <h2 className="section-title mt-3">
              Semua yang Guru{" "}
              <span className="bg-gradient-to-r from-sky-500 to-violet-500 bg-clip-text text-transparent">
                Butuhkan
              </span>
            </h2>
            <p className="section-subtitle mx-auto mt-4 max-w-2xl">
              Dibuat khusus untuk kebutuhan pendidikan di Indonesia. Mudah dipakai, hasilnya akurat, dan prosesnya terbuka.
            </p>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <article
                key={f.title}
                className={`feature-card group relative overflow-hidden rounded-3xl border p-6 transition-all duration-500 hover:-translate-y-2 hover:shadow-xl ${featuresView.isInView ? "animate-slide-up" : "opacity-0"}`}
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {/* hover glow */}
                <div className={`absolute -right-12 -top-12 h-28 w-28 rounded-full bg-gradient-to-br ${f.gradient} opacity-0 blur-2xl transition-all duration-500 group-hover:opacity-30 group-hover:scale-150`} />
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${f.gradient} text-white shadow-lg`}>
                  {f.icon}
                </div>
                <h3 className="mt-4 text-base font-bold feature-title">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed feature-desc">{f.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ═══════════ BENEFITS ═══════════ */}
        <section className="mt-24 sm:mt-32">
          <div className="text-center">
            <p className="section-overline">Manfaat</p>
            <h2 className="section-title mt-3">
              Siapa yang{" "}
              <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                Diuntungkan?
              </span>
            </h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {benefits.map((b) => (
              <div key={b.title} className="benefit-card rounded-3xl border p-6 transition-all duration-300 hover:shadow-lg">
                <h3 className={`text-lg font-bold ${
                  b.accent === "emerald" ? "text-emerald-500" :
                  b.accent === "sky" ? "text-sky-500" : "text-violet-500"
                }`}>
                  {b.title}
                </h3>
                <ul className="mt-4 space-y-3">
                  {b.items.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm benefit-item">
                      <svg viewBox="0 0 24 24" fill="none" className={`mt-0.5 h-5 w-5 shrink-0 ${
                        b.accent === "emerald" ? "text-emerald-500" :
                        b.accent === "sky" ? "text-sky-500" : "text-violet-500"
                      }`} stroke="currentColor" strokeWidth={2}>
                        <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="12" r="10" />
                      </svg>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════ FAQ ═══════════ */}
        <section className="mt-24 sm:mt-32">
          <div className="text-center">
            <p className="section-overline">FAQ</p>
            <h2 className="section-title mt-3">Pertanyaan yang Sering Diajukan</h2>
          </div>
          <div className="mx-auto mt-10 max-w-3xl space-y-3">
            {faqs.map((faq, i) => (
              <FAQItem
                key={faq.q}
                q={faq.q}
                a={faq.a}
                isOpen={openFaq === i}
                onToggle={() => setOpenFaq(openFaq === i ? null : i)}
              />
            ))}
          </div>
        </section>

        {/* ═══════════ CTA ═══════════ */}
        <section className="mt-24 mb-12 sm:mt-32 sm:mb-16">
          <div className="cta-card relative overflow-hidden rounded-[2rem] p-8 sm:p-12 text-center">
            {/* decoration */}
            <div className="absolute -top-20 -left-20 h-60 w-60 rounded-full bg-gradient-to-br from-emerald-400/30 to-teal-400/20 blur-[80px]" />
            <div className="absolute -bottom-20 -right-20 h-60 w-60 rounded-full bg-gradient-to-br from-sky-400/30 to-indigo-400/20 blur-[80px]" />
            <div className="relative z-10">
              <h2 className="text-2xl font-extrabold sm:text-3xl lg:text-4xl cta-title">
                Siap Mengubah Cara Menilai Esai?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm sm:text-base cta-subtitle">
                Mulai sekarang dan rasakan bagaimana SAGE membuat penilaian esai jadi lebih cepat, transparan, dan akuntabel.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
                <Link href="/register" className="cta-btn-primary">
                  Buat Akun Gratis
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                  </svg>
                </Link>
                <Link href="/login" className="cta-btn-secondary">
                  Masuk ke Dashboard
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ FOOTER ═══════════ */}
        <footer className="border-t py-8 text-center footer-root">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-[10px] font-bold text-white">
              S
            </div>
            <span className="text-sm font-bold footer-brand">SAGE</span>
          </div>
          <p className="text-xs footer-copy">
            © {new Date().getFullYear()} SAGE — Smart Automated Grading Engine. Built for Indonesian educators.
          </p>
        </footer>
      </div>
    </main>
  );
}
