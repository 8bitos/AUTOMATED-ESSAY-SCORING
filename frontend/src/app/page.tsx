import Link from "next/link";

const highlights = [
  {
    label: "24%",
    caption: "Waktu koreksi guru bisa dipangkas",
  },
  {
    label: "3 langkah",
    caption: "Rubrik → AI grading → feedback",
  },
  {
    label: "100%",
    caption: "Transparansi nilai per aspek",
  },
];

const features = [
  {
    title: "Rubrik presisi",
    detail: "Editor rubrik menyusun aspek, deskripsi, dan bobot (C1=5, C2=10, C3=15) agar AI tahu batas nilai.",
  },
  {
    title: "AI deterministik",
    detail: "Prompt tertata, grammar sederhana, dan output JSON memaksa AI hanya pakai skor rubrik asli.",
  },
  {
    title: "Insight transparan",
    detail: "Dashboard menampilkan rata-rata, pengecekan akurasi AI, dan timeline penilaian setiap materi.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-16 -right-32 h-72 w-72 rounded-full bg-slate-700/40 blur-3xl animate-blob" />
        <div className="pointer-events-none absolute top-24 left-10 h-36 w-36 rounded-full bg-sky-500/30 blur-3xl animate-blob animation-delay-2000" />
        <div className="pointer-events-none absolute bottom-16 right-16 h-40 w-40 rounded-full bg-emerald-500/40 blur-3xl animate-blob animation-delay-4000" />
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-10 md:py-16">
          <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-xl font-semibold text-white backdrop-blur">
                S
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">SAGE LMS</p>
                <p className="text-sm text-slate-300">Smart Academic Grading Engine</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/login" className="sage-button-outline text-xs">
                Masuk
              </Link>
              <Link href="/register" className="sage-button text-xs">
                Daftar
              </Link>
            </div>
          </header>

          <section className="grid gap-8 rounded-3xl bg-white/5 p-6 md:grid-cols-[1.15fr_0.85fr] md:p-10">
            <div className="space-y-6">
              <span className="text-xs font-semibold uppercase tracking-[0.4em] text-emerald-300">
                Sistem penilaian kelas 10
              </span>
              <h1 className="text-4xl font-semibold leading-tight text-white md:text-5xl">
                Penilaian esai otomatis tanpa kompromi akurasi, siap untuk kelas menengah atas.
              </h1>
              <p className="text-lg text-slate-300">
                SAGE menggabungkan rubrik guru, AI Gemini yang deterministik, dan dashboard transparan supaya nilai yang keluar selalu berbasis bukti dan bisa diaudit kapan saja.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/login" className="sage-button">
                  Masuk ke Dashboard
                </Link>
                <Link href="/register" className="sage-button-outline">
                  Daftar Akun Baru
                </Link>
              </div>
              <div className="flex flex-wrap gap-6 text-sm text-slate-300">
                {highlights.map((item) => (
                  <div key={item.label}>
                    <p className="text-2xl font-semibold text-emerald-300">{item.label}</p>
                    <p>{item.caption}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-900/10 p-6 shadow-xl">
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Overview AI</p>
                <h2 className="text-2xl font-semibold text-white">Rangkaian penilaian</h2>
                <p className="text-sm text-slate-300">
                  Siswa mengunggah esai → AI menilai per aspek dalam JSON → skor dihitung & disimpan → guru bisa periksa lalu beri revisi.
                </p>
                <div className="space-y-3 text-sm text-slate-400">
                  <div className="flex items-center justify-between">
                    <span>Cache grading</span>
                    <span className="text-emerald-300">Hit/miss</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Mode grading</span>
                    <span className="text-sky-300">Instant / queued</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Evidence tracking</span>
                    <span className="text-amber-300">Rubrik + ideal answer</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 rounded-3xl bg-white/5 p-6 md:p-10">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Bagaimana AI menilai</p>
                <h2 className="text-2xl font-semibold text-white">Akurasi tanpa hallucination</h2>
              </div>
              <Link href="/dashboard/superadmin/settings/grading-mode" className="sage-button-outline text-xs">
                Lihat mode grading
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {features.map((feature) => (
                <article key={feature.title} className="rounded-2xl bg-slate-900/60 p-5 text-sm text-slate-300 shadow-lg shadow-slate-900/40">
                  <h3 className="text-base font-semibold text-white">{feature.title}</h3>
                  <p className="mt-3 leading-relaxed">{feature.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-6 rounded-3xl bg-gradient-to-br from-indigo-500/30 to-slate-900/60 p-6 text-slate-900 shadow-xl md:grid-cols-2">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-200">Timeline penilaian</p>
              <ol className="space-y-3 text-sm text-slate-900">
                <li className="rounded-xl bg-white/80 p-4 shadow">
                  <p className="font-semibold">1. Submission</p>
                  <p className="text-[0.85rem] text-slate-600">Siswa kirim esai, sistem menyimpan teks + rubrik.</p>
                </li>
                <li className="rounded-xl bg-white/80 p-4 shadow">
                  <p className="font-semibold">2. AI grading</p>
                  <p className="text-[0.85rem] text-slate-600">Prompt deterministik ke Gemini; hasil di-parse lalu dihitung skor total.</p>
                </li>
                <li className="rounded-xl bg-white/80 p-4 shadow">
                  <p className="font-semibold">3. Feedback & monitoring</p>
                  <p className="text-[0.85rem] text-slate-600">Skor disimpan, guru bisa review, dan siswa lihat notifikasi.</p>
                </li>
              </ol>
            </div>
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-200">Overview sistem</p>
              <p className="text-sm text-white/80">
                SAGE terdiri dari backend Go (JWT auth, queue grading, migrations), database PostgreSQL, frontend Next.js, serta antarmuka superadmin/teacher/student. AIService bertugas berkomunikasi dengan Gemini, AI grading cache menjaga determinisme, dan setting grading mode membuat kamu bisa pilih instant atau queued sesuai kebutuhan kelas.
              </p>
              <div className="grid gap-3 text-sm">
                <div className="rounded-xl bg-white/80 p-3 text-slate-900">
                  <p className="font-semibold">3x retry otomatis</p>
                  <p className="text-[0.85rem] text-slate-600">Backoff 0–2–5 detik untuk menghindari timeout API.</p>
                </div>
                <div className="rounded-xl bg-white/80 p-3 text-slate-900">
                  <p className="font-semibold">Cache deterministik</p>
                  <p className="text-[0.85rem] text-slate-600">Hash question+essay+rubrik dilihat sebelum memanggil AI.</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
