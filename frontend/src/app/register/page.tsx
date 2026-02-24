"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import NoticeDialog from '@/components/ui/NoticeDialog';
import LoadingDialog from '@/components/ui/LoadingDialog';

// --- SVG Icon Components ---
const EyeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" x2="22" y1="2" y2="22" />
  </svg>
);
// --- End of SVG Icon Components ---

export default function RegisterPage() {
  const [namaLengkap, setNamaLengkap] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [peran, setPeran] = useState('student'); // Default role
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama_lengkap: namaLengkap,
          username,
          email,
          password,
          peran,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Gagal untuk mendaftar.');
      }

      setSuccessOpen(true);
      window.setTimeout(() => {
        router.push('/login');
      }, 700);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <main className="min-h-screen">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 gap-10 px-6 py-12 md:grid-cols-[1fr_1fr] md:items-center">
        <section className="space-y-6">
          <span className="sage-pill">Onboarding Akademik</span>
          <h1 className="text-4xl text-[color:var(--ink-900)] md:text-5xl">
            Mulai perjalanan belajar dengan SAGE.
          </h1>
          <p className="text-lg text-[color:var(--ink-500)]">
            Buat akun untuk mengakses kelas, rubrik, dan hasil penilaian yang transparan.
          </p>
          <div className="sage-card p-6">
            <p className="text-sm font-semibold text-[color:var(--ink-900)]">Kenapa SAGE</p>
            <div className="mt-3 space-y-2 text-sm text-[color:var(--ink-500)]">
              <p>• LMS akademik dengan grading berbasis rubrik</p>
              <p>• Kontrol penuh guru atas nilai akhir</p>
              <p>• Pelacakan progres belajar per siswa</p>
            </div>
          </div>
        </section>

        <section className="sage-panel p-8 sm:p-10">
          <div className="mb-6">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--sage-700)] text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"><path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4s1.79 4 4 4Zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4Z"/></svg>
            </div>
            <h2 className="text-2xl font-semibold text-[color:var(--ink-900)]">Daftar Akun</h2>
            <p className="text-sm text-[color:var(--ink-500)]">Lengkapi data untuk akses LMS.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[color:var(--ink-700)]" htmlFor="namaLengkap">
                Nama Lengkap
              </label>
              <input
                type="text"
                id="namaLengkap"
                value={namaLengkap}
                onChange={(e) => setNamaLengkap(e.target.value)}
                className="sage-input"
                placeholder="Nama Anda"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[color:var(--ink-700)]" htmlFor="username">
                Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="sage-input"
                placeholder="username_unik"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[color:var(--ink-700)]" htmlFor="email">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="sage-input"
                placeholder="anda@email.com"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[color:var(--ink-700)]" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="sage-input pr-12"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-[color:var(--ink-500)] hover:text-[color:var(--sage-700)]"
                >
                  {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[color:var(--ink-700)]" htmlFor="peran">
                Saya mendaftar sebagai
              </label>
              <select
                id="peran"
                value={peran}
                onChange={(e) => setPeran(e.target.value)}
                className="sage-input"
              >
                <option value="student">Siswa (Student)</option>
                <option value="teacher">Guru (Teacher)</option>
              </select>
            </div>

            {error && <p className="text-center text-sm text-red-500 pt-2">{error}</p>}

            <button type="submit" disabled={loading} className="sage-button w-full">
              {loading ? "Mendaftar..." : "Daftar Akun"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-[color:var(--ink-500)]">
            Sudah punya akun?{" "}
            <Link href="/login" className="font-semibold text-[color:var(--sage-700)] hover:underline">
              Login di sini
            </Link>
          </p>
        </section>
      </div>
    </main>
      <NoticeDialog
        isOpen={successOpen}
        title="Registrasi Berhasil"
        message="Akun berhasil dibuat. Anda akan diarahkan ke halaman login."
        tone="success"
        onClose={() => setSuccessOpen(false)}
      />
      <LoadingDialog isOpen={loading} message="Mendaftarkan akun..." />
    </>
  );
}
