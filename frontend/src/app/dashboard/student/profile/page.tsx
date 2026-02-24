"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { FiUploadCloud, FiCalendar } from "react-icons/fi";

interface ProfileData {
  id: string;
  nama_lengkap: string;
  email: string;
  peran: string;
  username?: string | null;
  nomor_identitas?: string | null;
  foto_profil_url?: string | null;
  kelas_tingkat?: string | null;
  institusi?: string | null;
  tanggal_lahir?: string | null;
  last_login_at?: string | null;
}

const toDateInput = (value?: string | null): string => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

const formatDateDisplay = (value?: string | null): string => {
  if (!value) return "-";
  const normalized = value.includes("T") ? value : `${value}T00:00:00`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(d);
};

export default function StudentProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [tanggalLahirInput, setTanggalLahirInput] = useState("");
  const [kelasLevel, setKelasLevel] = useState<"10" | "11" | "12">("10");
  const [kelasParalel, setKelasParalel] = useState("A");

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/profile", { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load profile");
        const data = await res.json();
        setProfile(data);
        setTanggalLahirInput(toDateInput(data?.tanggal_lahir));
        const rawKelas = String(data?.kelas_tingkat || "").trim().toUpperCase();
        const match = rawKelas.match(/^(10|11|12)\s*([A-Z])$/);
        if (match) {
          setKelasLevel(match[1] as "10" | "11" | "12");
          setKelasParalel(match[2]);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const updateField = (field: keyof ProfileData, value: any) => {
    if (!profile) return;
    setProfile({ ...profile, [field]: value });
  };

  const handleUploadPhoto = async (file?: File | null) => {
    if (!file) return;
    setError(null);
    setMessage(null);

    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar.");
      return;
    }
    if (file.size > 500 * 1024) {
      setError("Ukuran foto maksimal 500KB.");
      return;
    }

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Gagal upload foto.");

      const filePath = body?.filePath;
      if (!filePath) throw new Error("Respons upload tidak valid.");
      updateField("foto_profil_url", filePath);
      setMessage("Foto berhasil diupload. Klik Simpan Profil untuk menerapkan.");
    } catch (err: any) {
      setError(err.message || "Gagal upload foto.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nama_lengkap: profile.nama_lengkap,
          nomor_identitas: profile.nomor_identitas ?? "",
          foto_profil_url: profile.foto_profil_url ?? "",
          kelas_tingkat: kelasGabungan,
          institusi: profile.institusi ?? "",
          tanggal_lahir: tanggalLahirInput || "",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to update profile");
      }

      const updated = await res.json();
      const nextUser = updated.user ?? updated;
      setProfile(nextUser);
      setTanggalLahirInput(toDateInput(nextUser?.tanggal_lahir));

      if (updated.pending_fields && updated.pending_fields.length > 0) {
        setMessage(`Sebagian perubahan menunggu approval: ${updated.pending_fields.join(", ")}`);
      } else {
        setMessage("Profil berhasil diperbarui.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const avatarLetter = useMemo(() => {
    const name = (profile?.nama_lengkap || user?.nama_lengkap || "S").trim();
    return name ? name.charAt(0).toUpperCase() : "S";
  }, [profile?.nama_lengkap, user?.nama_lengkap]);
  const kelasGabungan = `${kelasLevel} ${kelasParalel}`;

  if (loading) return <div className="text-slate-500">Loading profile...</div>;
  if (error && !profile) return <div className="text-red-500">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Profil Siswa</h1>
        <p className="text-sm text-slate-500">Kelola data akun dan identitas akademik Anda.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr] items-start">
        <div className="space-y-6">
          <form onSubmit={handleSaveProfile} className="sage-panel p-6 space-y-5">
            <h2 className="text-lg font-semibold text-slate-900">Edit Profil</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-sm text-slate-600">Nama Lengkap</label>
                <input
                  className="sage-input mt-1"
                  value={profile?.nama_lengkap ?? ""}
                  onChange={(e) => updateField("nama_lengkap", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm text-slate-600">Username</label>
                <input className="sage-input mt-1 bg-slate-100" value={profile?.username ?? ""} disabled />
              </div>

              <div>
                <label className="text-sm text-slate-600">Email</label>
                <input className="sage-input mt-1 bg-slate-100" value={profile?.email ?? ""} disabled />
              </div>

              <div>
                <label className="text-sm text-slate-600">Tanggal Lahir</label>
                <input
                  type="date"
                  className="sage-input mt-1"
                  value={tanggalLahirInput}
                  onChange={(e) => setTanggalLahirInput(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm text-slate-600">Kelas</label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <select className="sage-input" value={kelasLevel} onChange={(e) => setKelasLevel(e.target.value as "10" | "11" | "12")}>
                    <option value="10">10</option>
                    <option value="11">11</option>
                    <option value="12">12</option>
                  </select>
                  <select className="sage-input" value={kelasParalel} onChange={(e) => setKelasParalel(e.target.value)}>
                    {Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).map((letter) => (
                      <option key={letter} value={letter}>
                        {letter}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-600">Nomor Identitas (opsional)</label>
                <input
                  className="sage-input mt-1"
                  value={profile?.nomor_identitas ?? ""}
                  onChange={(e) => updateField("nomor_identitas", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm text-slate-600">Institusi / Sekolah</label>
                <input
                  className="sage-input mt-1"
                  value={profile?.institusi ?? ""}
                  onChange={(e) => updateField("institusi", e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm text-slate-600">Foto Profil (max 500KB)</label>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <label className="sage-button-outline cursor-pointer">
                    <FiUploadCloud /> {uploadingPhoto ? "Uploading..." : "Upload Foto"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingPhoto}
                      onChange={(e) => handleUploadPhoto(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <p className="text-xs text-slate-500">PNG/JPG/WebP disarankan.</p>
                </div>
              </div>
            </div>

            {(message || error) && (
              <div className="space-y-1">
                {message && <p className="text-sm text-green-600">{message}</p>}
                {error && <p className="text-sm text-red-500">{error}</p>}
              </div>
            )}

            <div className="flex justify-end">
              <button className="sage-button" disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan Profil"}
              </button>
            </div>
          </form>

        </div>

        <aside className="lg:sticky lg:top-6">
          <div className="sage-panel p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Preview Profil</h2>

            <div className="flex items-center gap-4">
              {profile?.foto_profil_url ? (
                <img
                  src={profile.foto_profil_url}
                  alt="Foto profil"
                  className="h-16 w-16 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-slate-900 text-white flex items-center justify-center text-xl font-semibold">
                  {avatarLetter}
                </div>
              )}
              <div>
                <p className="font-semibold text-slate-900">{profile?.nama_lengkap || "-"}</p>
                <p className="text-sm text-slate-500">@{profile?.username || "-"}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-slate-500">Peran</p>
                <p className="text-slate-900 font-medium">{user?.peran || "student"}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-slate-500">Kelas</p>
                <p className="text-slate-900 font-medium">{kelasGabungan || "-"}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-slate-500">Institusi</p>
                <p className="text-slate-900 font-medium">{profile?.institusi || "-"}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-slate-500 inline-flex items-center gap-1"><FiCalendar size={14} /> Tanggal Lahir</p>
                <p className="text-slate-900 font-medium">{formatDateDisplay(tanggalLahirInput)}</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
