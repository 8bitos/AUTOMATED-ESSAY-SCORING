"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import NoticeDialog from "@/components/ui/NoticeDialog";
import LoadingDialog from "@/components/ui/LoadingDialog";

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

export default function RegisterAdminPage() {
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [namaLengkap, setNamaLengkap] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const router = useRouter();

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.trim() !== "2801") {
      setPinError("PIN salah.");
      return;
    }
    setPinError("");
    setPinUnlocked(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
          const res = await fetch(`/api/register-admin`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nama_lengkap: namaLengkap,
              username,
              email,
              password,
              admin_password: adminPassword,
            }),
          });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Gagal membuat admin.");
      }

      setSuccessOpen(true);
      window.setTimeout(() => {
        router.push("/login");
      }, 700);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Gagal membuat admin."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <main className="min-h-screen">
        <div className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 items-center justify-items-center gap-6 px-4 py-8 sm:px-6 sm:py-10 md:grid-cols-[1fr_1fr] md:justify-items-stretch md:gap-10 md:py-12">
          <section className="hidden space-y-6 md:block">
            <span className="sage-pill">Mode Rahasia</span>
            <h1 className="text-4xl text-[color:var(--ink-900)] md:text-5xl">
              Daftar Superadmin SAGE.
            </h1>
            <p className="text-lg text-[color:var(--ink-500)]">
              Panel khusus ini hanya untuk bootstrap admin awal. Simpan dengan aman.
            </p>
            <div className="sage-card p-6">
              <p className="text-sm font-semibold text-[color:var(--ink-900)]">Catatan</p>
              <div className="mt-3 space-y-2 text-sm text-[color:var(--ink-500)]">
                <p>- Gunakan password admin khusus.</p>
                <p>- Setelah berhasil, login via halaman utama.</p>
                <p>- Batasi akses panel ini.</p>
              </div>
            </div>
          </section>

          <section className="mx-auto w-full max-w-md sage-panel p-5 sm:p-8 md:mx-0 md:max-w-none md:p-10">
            <div className="mb-6">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--sage-700)] text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"><path fill="currentColor" d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5m-3 8V6a3 3 0 0 1 6 0v3Z"/></svg>
              </div>
              <h2 className="text-xl font-semibold text-[color:var(--ink-900)] sm:text-2xl">Register Admin</h2>
              <p className="text-sm text-[color:var(--ink-500)]">Lengkapi data superadmin.</p>
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
                  placeholder="Nama Admin"
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
                  placeholder="admin_utama"
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
                  placeholder="admin@email.com"
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
                    placeholder="********"
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
                <label className="text-sm font-medium text-[color:var(--ink-700)]" htmlFor="adminPassword">
                  Password Admin
                </label>
                <input
                  type="password"
                  id="adminPassword"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="sage-input"
                  placeholder="Masukkan password admin"
                  required
                />
              </div>

              {error && <p className="text-center text-sm text-red-500 pt-2">{error}</p>}

              <button type="submit" disabled={loading} className="sage-button w-full">
                {loading ? "Mendaftarkan..." : "Buat Superadmin"}
              </button>
            </form>
          </section>
        </div>
      </main>
      {!pinUnlocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-slate-900 shadow-xl">
            <h3 className="text-lg font-semibold">Masukkan PIN</h3>
            <p className="mt-1 text-sm text-slate-500">
              Akses panel ini memerlukan PIN.
            </p>
            <form onSubmit={handlePinSubmit} className="mt-4 space-y-3">
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="sage-input"
                placeholder="PIN"
                autoFocus
              />
              {pinError && <p className="text-sm text-red-600">{pinError}</p>}
              <button type="submit" className="sage-button w-full">
                Masuk
              </button>
            </form>
          </div>
        </div>
      )}
      <NoticeDialog
        isOpen={successOpen}
        title="Registrasi Admin Berhasil"
        message="Akun superadmin berhasil dibuat. Anda akan diarahkan ke halaman login."
        tone="success"
        onClose={() => setSuccessOpen(false)}
      />
      <LoadingDialog isOpen={loading} message="Mendaftarkan admin..." />
    </>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

