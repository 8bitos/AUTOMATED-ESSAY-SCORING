"use client";

import { useState } from "react";
import { FiEye, FiEyeOff, FiLock, FiShield } from "react-icons/fi";

export default function TeacherSecuritySettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const passwordStrength = (() => {
    if (!newPassword) return { label: "-", color: "bg-slate-300", text: "text-slate-500", width: "w-0" };
    let score = 0;
    if (newPassword.length >= 6) score += 1;
    if (newPassword.length >= 10) score += 1;
    if (/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) score += 1;
    if (/\d/.test(newPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 1;

    if (score <= 2) return { label: "Weak", color: "bg-red-500", text: "text-red-600", width: "w-1/3" };
    if (score <= 4) return { label: "Medium", color: "bg-amber-500", text: "text-amber-600", width: "w-2/3" };
    return { label: "Strong", color: "bg-emerald-500", text: "text-emerald-600", width: "w-full" };
  })();

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password tidak sama.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Gagal memperbarui password.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password berhasil diperbarui.");
    } catch (err: any) {
      setError(err.message || "Gagal memperbarui password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Keamanan</h1>
        <p className="text-sm text-slate-500">Kelola password untuk menjaga keamanan akun.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] items-start">
        <form onSubmit={handleChangePassword} className="sage-panel p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 inline-flex items-center gap-2">
            <FiLock />
            Ubah Password
          </h2>

          <div>
            <label className="text-sm text-slate-600">Password Saat Ini</label>
            <div className="relative mt-1">
              <input
                type={showCurrent ? "text" : "password"}
                className="sage-input pr-11"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent((prev) => !prev)}
                className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-700"
                aria-label={showCurrent ? "Sembunyikan password saat ini" : "Lihat password saat ini"}
              >
                {showCurrent ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-600">Password Baru</label>
            <div className="relative mt-1">
              <input
                type={showNew ? "text" : "password"}
                className="sage-input pr-11"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setShowNew((prev) => !prev)}
                className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-700"
                aria-label={showNew ? "Sembunyikan password baru" : "Lihat password baru"}
              >
                {showNew ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
            <div className="mt-2">
              <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color} ${passwordStrength.width}`} />
              </div>
              <p className={`mt-1 text-xs font-medium ${passwordStrength.text}`}>
                Strength: {passwordStrength.label}
              </p>
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-600">Konfirmasi Password Baru</label>
            <div className="relative mt-1">
              <input
                type={showConfirm ? "text" : "password"}
                className="sage-input pr-11"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm((prev) => !prev)}
                className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-700"
                aria-label={showConfirm ? "Sembunyikan konfirmasi password" : "Lihat konfirmasi password"}
              >
                {showConfirm ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-emerald-700">{message}</p>}

          <div className="flex justify-end">
            <button type="submit" className="sage-button" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan Password"}
            </button>
          </div>
        </form>

        <aside className="lg:sticky lg:top-6">
          <div className="sage-panel p-6 space-y-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <FiShield size={22} />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Keamanan Akun</h3>
            <p className="text-sm text-slate-600 leading-relaxed text-justify">
              Gunakan password kuat minimal 6 karakter dan pastikan tidak sama dengan password lama. Setelah mengubah password,
              gunakan password baru untuk login berikutnya pada semua perangkat.
            </p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              Tips: kombinasikan huruf besar, huruf kecil, angka, dan simbol agar akun lebih aman.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
