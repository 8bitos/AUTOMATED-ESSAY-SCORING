"use client";

import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";

interface TeacherPublicProfile {
  id: string;
  nama_lengkap: string;
  foto_profil_url?: string | null;
  mata_pelajaran?: string | null;
  mata_pelajaran_tambahan?: string | null;
  pengalaman_mengajar?: number | null;
  tingkat_ajar?: string | null;
  rombel_aktif?: string | null;
  is_wali_kelas?: boolean | null;
  institusi?: string | null;
  bio_singkat?: string | null;
}

interface TeacherProfileModalProps {
  teacherId?: string | null;
  teacherName?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function TeacherProfileModal({ teacherId, teacherName, isOpen, onClose }: TeacherProfileModalProps) {
  const [profile, setProfile] = useState<TeacherPublicProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (!teacherId) {
      setProfile(null);
      setError("Profil guru belum tersedia untuk kelas ini.");
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/teachers/${teacherId}/public`, { credentials: "include" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message || "Gagal memuat profil guru.");
        }
        const data = await res.json();
        setProfile(data);
      } catch (err: any) {
        setProfile(null);
        setError(err?.message || "Gagal memuat profil guru.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isOpen, teacherId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[95] bg-black/45 p-4 flex items-center justify-center">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Tutup popup profil guru"
        >
          <FiX />
        </button>

        <h3 className="text-lg font-semibold text-slate-900">Profil Guru</h3>
        {teacherName && <p className="text-sm text-slate-500 mt-1">{teacherName}</p>}

        {loading ? (
          <p className="text-sm text-slate-500 mt-4">Memuat profil...</p>
        ) : error ? (
          <p className="text-sm text-red-600 mt-4">{error}</p>
        ) : profile ? (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-3">
              {profile.foto_profil_url ? (
                <img
                  src={profile.foto_profil_url}
                  alt={profile.nama_lengkap}
                  className="h-14 w-14 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <div className="h-14 w-14 rounded-full bg-slate-900 text-white flex items-center justify-center text-lg font-semibold">
                  {(profile.nama_lengkap || "G").charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-base font-semibold text-slate-900">{profile.nama_lengkap}</p>
                <p className="text-sm text-slate-500">{profile.is_wali_kelas ? "Wali Kelas" : "Guru Pengampu"}</p>
              </div>
            </div>

            <div className="grid gap-2 text-sm rounded-xl border border-slate-200 bg-slate-50 p-4">
              <ProfileLine label="Mata Pelajaran" value={profile.mata_pelajaran || "-"} />
              <ProfileLine label="Mapel Tambahan" value={profile.mata_pelajaran_tambahan || "-"} />
              <ProfileLine label="Pengalaman" value={profile.pengalaman_mengajar != null ? `${profile.pengalaman_mengajar} tahun` : "-"} />
              <ProfileLine label="Tingkat Ajar" value={profile.tingkat_ajar || "-"} />
              <ProfileLine label="Rombel Aktif" value={profile.rombel_aktif || "-"} />
              <ProfileLine label="Institusi" value={profile.institusi || "-"} />
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Bio</p>
              <p className="mt-1 text-sm text-slate-700 whitespace-pre-line">{profile.bio_singkat || "-"}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500 mt-4">Data profil guru tidak tersedia.</p>
        )}
      </div>
    </div>
  );
}

function ProfileLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2">
      <p className="text-slate-500">{label}</p>
      <p className="font-medium text-slate-900 break-words">{value}</p>
    </div>
  );
}
