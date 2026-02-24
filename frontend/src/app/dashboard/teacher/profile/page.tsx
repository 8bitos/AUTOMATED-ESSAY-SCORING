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
  mata_pelajaran?: string | null;
  mata_pelajaran_tambahan?: string | null;
  pengalaman_mengajar?: number | null;
  tingkat_ajar?: string | null;
  rombel_aktif?: string | null;
  is_wali_kelas?: boolean | null;
  no_whatsapp?: string | null;
  bio_singkat?: string | null;
  institusi?: string | null;
  last_login_at?: string | null;
}

const parseTingkatAjar = (value?: string | null): Array<"10" | "11" | "12"> => {
  if (!value) return [];
  const parts = value
    .split(",")
    .map((v) => v.trim())
    .filter((v): v is "10" | "11" | "12" => v === "10" || v === "11" || v === "12");
  return Array.from(new Set(parts));
};

export default function TeacherProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [tingkatAjar, setTingkatAjar] = useState<Array<"10" | "11" | "12">>([]);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/profile", { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load profile");
        const data = await res.json();
        setProfile(data);
        setTingkatAjar(parseTingkatAjar(data?.tingkat_ajar));
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

  const handleToggleTingkat = (grade: "10" | "11" | "12") => {
    setTingkatAjar((prev) =>
      prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade].sort((a, b) => Number(a) - Number(b))
    );
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
          mata_pelajaran: profile.mata_pelajaran ?? "",
          mata_pelajaran_tambahan: profile.mata_pelajaran_tambahan ?? "",
          pengalaman_mengajar: Number(profile.pengalaman_mengajar ?? 0),
          tingkat_ajar: tingkatAjar.join(","),
          rombel_aktif: profile.rombel_aktif ?? "",
          is_wali_kelas: !!profile.is_wali_kelas,
          no_whatsapp: profile.no_whatsapp ?? "",
          bio_singkat: profile.bio_singkat ?? "",
          institusi: profile.institusi ?? "",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to update profile");
      }

      const updated = await res.json();
      const nextUser = updated.user ?? updated;
      setProfile(nextUser);
      setTingkatAjar(parseTingkatAjar(nextUser?.tingkat_ajar));

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
    const name = (profile?.nama_lengkap || user?.nama_lengkap || "G").trim();
    return name ? name.charAt(0).toUpperCase() : "G";
  }, [profile?.nama_lengkap, user?.nama_lengkap]);

  if (loading) return <div className="text-slate-500">Loading profile...</div>;
  if (error && !profile) return <div className="text-red-500">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Profil Guru</h1>
        <p className="text-sm text-slate-500">Kelola identitas, informasi profesional, dan keamanan akun.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr] items-start">
        <div className="space-y-6">
          <form onSubmit={handleSaveProfile} className="sage-panel p-6 space-y-5">
            <h2 className="text-lg font-semibold text-slate-900">Edit Profil</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-sm text-slate-600">Nama Lengkap</label>
                <input className="sage-input mt-1" value={profile?.nama_lengkap ?? ""} onChange={(e) => updateField("nama_lengkap", e.target.value)} />
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
                <label className="text-sm text-slate-600">Mata Pelajaran Utama</label>
                <input className="sage-input mt-1" value={profile?.mata_pelajaran ?? ""} onChange={(e) => updateField("mata_pelajaran", e.target.value)} />
              </div>

              <div>
                <label className="text-sm text-slate-600">Mata Pelajaran Tambahan</label>
                <input
                  className="sage-input mt-1"
                  value={profile?.mata_pelajaran_tambahan ?? ""}
                  onChange={(e) => updateField("mata_pelajaran_tambahan", e.target.value)}
                  placeholder="Pisahkan dengan koma"
                />
              </div>

              <div>
                <label className="text-sm text-slate-600">Nomor Induk / NIP / NUPTK</label>
                <input className="sage-input mt-1" value={profile?.nomor_identitas ?? ""} onChange={(e) => updateField("nomor_identitas", e.target.value)} />
              </div>

              <div>
                <label className="text-sm text-slate-600">Pengalaman Mengajar (tahun)</label>
                <input
                  type="number"
                  min={0}
                  className="sage-input mt-1"
                  value={profile?.pengalaman_mengajar ?? 0}
                  onChange={(e) => updateField("pengalaman_mengajar", Number(e.target.value || 0))}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm text-slate-600">Tingkat yang diajar</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {(["10", "11", "12"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => handleToggleTingkat(g)}
                      className={`rounded-lg border px-3 py-2 text-sm ${tingkatAjar.includes(g) ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}
                    >
                      Kelas {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-600">Rombel Aktif</label>
                <input
                  className="sage-input mt-1"
                  value={profile?.rombel_aktif ?? ""}
                  onChange={(e) => updateField("rombel_aktif", e.target.value)}
                  placeholder="Contoh: 10A, 10B, 11A"
                />
              </div>

              <div>
                <label className="text-sm text-slate-600">Institusi / Sekolah</label>
                <input className="sage-input mt-1" value={profile?.institusi ?? ""} onChange={(e) => updateField("institusi", e.target.value)} />
              </div>

              <div>
                <label className="text-sm text-slate-600">No. WhatsApp</label>
                <input className="sage-input mt-1" value={profile?.no_whatsapp ?? ""} onChange={(e) => updateField("no_whatsapp", e.target.value)} />
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm text-slate-600">Bio Singkat (max 160)</label>
                <textarea
                  className="sage-input mt-1"
                  rows={3}
                  maxLength={160}
                  value={profile?.bio_singkat ?? ""}
                  onChange={(e) => updateField("bio_singkat", e.target.value)}
                />
                <p className="text-xs text-slate-500 mt-1 text-right">{(profile?.bio_singkat || "").length}/160</p>
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm text-slate-600">Foto Profil (max 500KB)</label>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <label className="sage-button-outline cursor-pointer">
                    <FiUploadCloud /> {uploadingPhoto ? "Uploading..." : "Upload Foto"}
                    <input type="file" accept="image/*" className="hidden" disabled={uploadingPhoto} onChange={(e) => handleUploadPhoto(e.target.files?.[0] ?? null)} />
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={!!profile?.is_wali_kelas}
                      onChange={(e) => updateField("is_wali_kelas", e.target.checked)}
                    />
                    Wali Kelas
                  </label>
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
                <img src={profile.foto_profil_url} alt="Foto profil" className="h-16 w-16 rounded-full object-cover border border-slate-200" />
              ) : (
                <div className="h-16 w-16 rounded-full bg-slate-900 text-white flex items-center justify-center text-xl font-semibold">{avatarLetter}</div>
              )}
              <div>
                <p className="font-semibold text-slate-900">{profile?.nama_lengkap || "-"}</p>
                <p className="text-sm text-slate-500">@{profile?.username || "-"}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-slate-500">Mata Pelajaran</p>
                <p className="text-slate-900 font-medium">{profile?.mata_pelajaran || "-"}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-slate-500">Tingkat Ajar</p>
                <p className="text-slate-900 font-medium">{tingkatAjar.length ? tingkatAjar.join(", ") : "-"}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-slate-500">Rombel Aktif</p>
                <p className="text-slate-900 font-medium">{profile?.rombel_aktif || "-"}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-slate-500">Institusi</p>
                <p className="text-slate-900 font-medium">{profile?.institusi || "-"}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-slate-500">Status</p>
                <p className="text-slate-900 font-medium">{profile?.is_wali_kelas ? "Wali Kelas" : "Guru Pengampu"}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-slate-500 inline-flex items-center gap-1"><FiCalendar size={14} /> Bio</p>
                <p className="text-slate-900 font-medium">{profile?.bio_singkat || "-"}</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
