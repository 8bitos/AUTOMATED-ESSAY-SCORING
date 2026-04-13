"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';

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


export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey || !e.shiftKey) return;
      if (e.key === "\\" || e.code === "Backslash") {
        e.preventDefault();
        router.push("/register-admin");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Email/Username atau password salah.');
      }
      
      // Pass the entire user object to the login function from AuthContext
      await login(data);
      
      // Redirect based on role
      if (data.peran === 'student') {
        router.push('/dashboard/student');
      } else if (data.peran === 'superadmin') {
        router.push('/dashboard/superadmin');
      } else {
        router.push('/dashboard/teacher');
      }

    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Email/Username atau password salah.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 items-center justify-items-center gap-6 px-4 py-8 sm:px-6 sm:py-10 md:grid-cols-[1fr_1fr] md:justify-items-stretch md:gap-10 md:py-12">
        <section className="hidden space-y-6 md:block">
          <span className="sage-pill">Portal Akademik</span>
          <h1 className="text-4xl text-[color:var(--ink-900)] md:text-5xl">
            Masuk ke ruang kerja akademik SAGE.
          </h1>
          <p className="text-lg text-[color:var(--ink-500)]">
            Lanjutkan pengelolaan kelas, rubrik, dan umpan balik esai dengan standar akademik
            yang konsisten.
          </p>
          <div className="sage-card p-6">
            <p className="text-sm font-semibold text-[color:var(--ink-900)]">Yang bisa kamu lakukan</p>
            <div className="mt-3 space-y-2 text-sm text-[color:var(--ink-500)]">
              <p>- Menilai esai secara otomatis dan transparan</p>
              <p>- Mengelola materi, modul, dan pertanyaan</p>
              <p>- Memberi review guru untuk validasi nilai</p>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md sage-panel p-5 sm:p-8 md:mx-0 md:max-w-none md:p-10">
          <div className="mb-6">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-transparent">
              <Image 
                src="/logo.png" 
                alt="SAGE Logo" 
                width={48} 
                height={48} 
                className="h-12 w-12 object-contain"
                priority
              />
            </div>
            <h2 className="text-xl font-semibold text-[color:var(--ink-900)] sm:text-2xl">Login</h2>
            <p className="text-sm text-[color:var(--ink-500)]">Masukkan kredensial akun kamu.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[color:var(--ink-700)]" htmlFor="identifier">
                Email atau Username
              </label>
              <input
                type="text"
                id="identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
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
                  placeholder="--------"
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

            {error && <p className="text-center text-sm text-red-500">{error}</p>}

            <button type="submit" disabled={loading} className="sage-button w-full">
              {loading ? "Loading..." : "Login"}
            </button>
          </form>
          <p className="auth-alt-copy mt-6 text-center text-sm text-[color:var(--ink-500)]">
            Belum punya akun?{" "}
            <Link
              href="/register"
              className="auth-alt-link font-semibold text-[color:var(--sage-700)] hover:underline"
            >
              Daftar di sini
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

