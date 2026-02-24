import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-6 pb-16 pt-10 md:pt-16">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[color:var(--sage-700)] text-white flex items-center justify-center font-bold">
              S
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--sage-700)]">
                SAGE LMS
              </p>
              <p className="text-xs text-[color:var(--ink-500)]">Smart Academic Grading Engine</p>
            </div>
          </div>
          <nav className="hidden items-center gap-4 md:flex">
            <Link href="/login" className="sage-button-outline">
              Masuk
            </Link>
            <Link href="/register" className="sage-button">
              Daftar
            </Link>
          </nav>
        </header>

        <section className="mt-12 grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div className="space-y-6">
            <span className="sage-pill">LMS Akademik</span>
            <h1 className="text-5xl leading-tight text-[color:var(--ink-900)] md:text-6xl">
              Penilaian esai otomatis dengan nuansa akademik yang rapi.
            </h1>
            <p className="text-lg text-[color:var(--ink-500)]">
              SAGE membantu guru merancang rubrik, menilai jawaban, dan memberi umpan balik terstruktur. 
              Semua dalam satu ruang kelas digital yang fokus pada kualitas pembelajaran.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/login" className="sage-button">
                Mulai dari Dashboard
              </Link>
              <Link href="/register" className="sage-button-outline">
                Buat Akun Baru
              </Link>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-[color:var(--ink-500)]">
              <div>
                <p className="text-2xl font-semibold text-[color:var(--sage-700)]">24%</p>
                <p>Penghematan waktu koreksi</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-[color:var(--sage-700)]">3 langkah</p>
                <p>Dari rubrik ke feedback</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-[color:var(--sage-700)]">100%</p>
                <p>Transparansi penilaian</p>
              </div>
            </div>
          </div>

          <div className="sage-panel p-6 md:p-8">
            <div className="space-y-6">
              <div className="rounded-2xl border border-black/10 bg-[color:var(--sand-50)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--ink-500)]">
                  Overview
                </p>
                <p className="mt-3 text-2xl font-semibold text-[color:var(--ink-900)]">
                  Kelas Sosiologi XI
                </p>
                <p className="text-sm text-[color:var(--ink-500)]">Rangkuman performa minggu ini</p>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div className="rounded-xl bg-white p-3 shadow-soft">
                    <p className="text-[color:var(--ink-500)]">Submission</p>
                    <p className="text-xl font-semibold text-[color:var(--sage-700)]">42</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 shadow-soft">
                    <p className="text-[color:var(--ink-500)]">Rata-rata</p>
                    <p className="text-xl font-semibold text-[color:var(--sage-700)]">86</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-black/10 bg-white p-4">
                <p className="text-sm font-semibold text-[color:var(--ink-900)]">
                  Checklist Pelaksanaan
                </p>
                <div className="mt-3 space-y-2 text-sm text-[color:var(--ink-500)]">
                  <p>✓ Rubrik terdefinisi per aspek</p>
                  <p>✓ Umpan balik AI terintegrasi</p>
                  <p>✓ Review guru siap ditambahkan</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16 grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Rubrik Terstruktur",
              desc: "Bangun aspek penilaian, bobot, dan indikator dengan editor rubrik yang jelas.",
            },
            {
              title: "Grading AI yang Transparan",
              desc: "AI memberikan skor per aspek agar guru tetap memegang kendali akademik.",
            },
            {
              title: "Umpan Balik Siap Aksi",
              desc: "Feedback berfokus pada perbaikan, disandingkan dengan revisi guru.",
            },
          ].map((item) => (
            <div key={item.title} className="sage-card p-6">
              <h3 className="text-xl font-semibold text-[color:var(--ink-900)]">
                {item.title}
              </h3>
              <p className="mt-3 text-sm text-[color:var(--ink-500)]">{item.desc}</p>
            </div>
          ))}
        </section>

        <section className="mt-16">
          <div className="rounded-3xl bg-[color:var(--navy-900)] px-8 py-10 text-white">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--gold-500)]">
                  Siap dipakai
                </p>
                <h2 className="mt-2 text-3xl font-semibold">
                  Bawa kelas ke level akademik berikutnya.
                </h2>
              </div>
              <Link href="/login" className="sage-button">
                Masuk ke Dashboard
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
