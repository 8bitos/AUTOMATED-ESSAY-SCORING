"use client";

import { useEffect, useState } from "react";
import {
  FiActivity,
  FiAward,
  FiBarChart2,
  FiBookOpen,
  FiCheckCircle,
  FiClock,
  FiLayers,
  FiSearch,
  FiX,
} from "react-icons/fi";
import LoadingDialog from "@/components/ui/LoadingDialog";

type MaterialType = "materi" | "soal" | "tugas";

interface MaterialLike {
  id: string;
  judul: string;
  material_type?: MaterialType;
  isi_materi?: string;
  capaian_pembelajaran?: string;
}

interface ClassMemberLike {
  id: string;
  student_name: string;
  student_email: string;
  student_username?: string | null;
  foto_profil_url?: string | null;
  nomor_identitas?: string | null;
  kelas_tingkat?: string | null;
  institusi?: string | null;
  tanggal_lahir?: string | null;
  last_login_at?: string | null;
  joined_at: string;
}

interface StudentSubmission {
  id: string;
  question_id: string;
  submitted_at?: string;
  skor_ai?: number;
  revised_score?: number;
}

interface InvitableStudent {
  id: string;
  name: string;
  email: string;
}

function extractDescription(raw?: string): string {
  const plain = String(raw || "")
    .replace(/\[\[SG_BLOCKS_V1\]\][\s\S]*$/i, "")
    .replace(/\[\[SG_SECTIONS_V1\]\][\s\S]*$/i, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.slice(0, 100);
}

function formatDateLabel(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(d);
}

function formatDateTimeLabel(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function getInitial(name?: string): string {
  const safe = (name || "").trim();
  if (!safe) return "S";
  return safe.charAt(0).toUpperCase();
}

function deriveUsername(student: Pick<ClassMemberLike, "student_username" | "student_email">): string {
  const fromProfile = (student.student_username || "").trim();
  if (fromProfile) return fromProfile;
  const email = (student.student_email || "").trim();
  if (!email || !email.includes("@")) return "-";
  return email.split("@")[0];
}

function SearchInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative w-full max-w-sm">
      <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-slate-300"
      />
    </div>
  );
}

function ProfileLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <p className="text-slate-500">{label}</p>
      <p className="text-slate-900 font-medium break-words">{value || "-"}</p>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">{label}</p>
        <span className="text-slate-500">{icon}</span>
      </div>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export function AddMaterialNameModal({
  isOpen,
  onClose,
  classId,
  onFinished,
}: {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  onFinished: () => void;
}) {
  const [judul, setJudul] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setJudul("");
      setError("");
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!judul.trim()) {
      setError("Nama section wajib diisi.");
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          class_id: classId,
          judul: judul.trim(),
          material_type: "materi",
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || "Gagal menambahkan section.");
      }

      await onFinished();
      onClose();
    } catch (err: any) {
      setError(err.message || "Gagal menambahkan section.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="animate-fade-in fixed inset-0 z-50 bg-black/45 p-4 flex items-center justify-center">
      <div className="animate-pop-in w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Tutup"
        >
          <FiX />
        </button>

        <h3 className="text-lg font-semibold text-slate-900">Tambah Section</h3>
        <p className="mt-1 text-sm text-slate-500">Section baru otomatis ditambahkan ke urutan paling atas. Konten bisa ditambahkan setelah section dibuat.</p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Nama Section</label>
            <input
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              placeholder="Contoh: Section 1 - Pengantar"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              autoFocus
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="sage-button-outline">
              Batal
            </button>
            <button type="submit" className="sage-button" disabled={isSubmitting}>
              {isSubmitting ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
      <LoadingDialog isOpen={isSubmitting} message="Menyimpan section..." />
    </div>
  );
}

export function EditMaterialQuickModal({
  isOpen,
  onClose,
  material,
  onFinished,
}: {
  isOpen: boolean;
  onClose: () => void;
  material: MaterialLike | null;
  onFinished: () => void;
}) {
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [materialType, setMaterialType] = useState<MaterialType>("materi");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !material) return;
    setJudul(material.judul || "");
    setMaterialType((material.material_type || "materi") as MaterialType);
    setDeskripsi(
      ((material.capaian_pembelajaran || "").trim() || extractDescription(material.isi_materi || "")).slice(0, 100)
    );
    setError("");
  }, [isOpen, material]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!material) return;
    if (!judul.trim()) {
      setError("Nama materi wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/materials/${material.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          judul: judul.trim(),
          material_type: materialType,
          capaian_pembelajaran: deskripsi.trim() ? deskripsi.trim() : "",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || "Gagal mengupdate materi.");
      }
      await onFinished();
    } catch (err: any) {
      setError(err.message || "Gagal mengupdate materi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !material) return null;

  return (
    <div className="animate-fade-in fixed inset-0 z-50 bg-black/45 p-4 flex items-center justify-center">
      <div className="animate-pop-in w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Tutup"
        >
          <FiX />
        </button>
        <h3 className="text-lg font-semibold text-slate-900">Edit Materi</h3>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Tipe Konten</label>
            <select
              value={materialType}
              onChange={(e) => setMaterialType(e.target.value as MaterialType)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            >
              <option value="materi">Materi</option>
              <option value="soal">Soal</option>
              <option value="tugas">Tugas</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Nama Materi</label>
            <input
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Deskripsi (maks. 100 karakter)</label>
            <textarea
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value.slice(0, 100))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            />
            <p className="mt-1 text-xs text-slate-500 text-right">{deskripsi.length}/100</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="sage-button-outline">
              Batal
            </button>
            <button type="submit" className="sage-button" disabled={isSubmitting}>
              {isSubmitting ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
      <LoadingDialog isOpen={isSubmitting} message="Menyimpan perubahan materi..." />
    </div>
  );
}

export function StudentProfileModal({
  isOpen,
  onClose,
  student,
  questionMaterialMap,
}: {
  isOpen: boolean;
  onClose: () => void;
  student: ClassMemberLike | null;
  questionMaterialMap: Record<string, { materialId: string; materialTitle: string }>;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [lastAccess, setLastAccess] = useState<{ materialTitle: string; when: string } | null>(null);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [lastSubmittedAt, setLastSubmittedAt] = useState<string | null>(null);
  const [materialsTouched, setMaterialsTouched] = useState(0);

  useEffect(() => {
    const load = async () => {
      if (!isOpen || !student) return;
      setIsLoading(true);
      setError("");
      setAvgScore(null);
      setLastAccess(null);
      setTotalSubmissions(0);
      setReviewedCount(0);
      setBestScore(null);
      setLastSubmittedAt(null);
      setMaterialsTouched(0);
      try {
        const res = await fetch(`/api/students/${student.id}/submissions`, { credentials: "include" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message || "Gagal memuat detail siswa.");
        }
        const data = (await res.json()) as StudentSubmission[];
        const submissions = Array.isArray(data) ? data : [];

        setTotalSubmissions(submissions.length);
        setReviewedCount(submissions.filter((s) => typeof s.revised_score === "number").length);

        const numericScores = submissions
          .map((s) => (typeof s.revised_score === "number" ? s.revised_score : s.skor_ai))
          .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
        if (numericScores.length > 0) {
          const avg = numericScores.reduce((a, b) => a + b, 0) / numericScores.length;
          setAvgScore(Math.round(avg * 100) / 100);
          setBestScore(Math.max(...numericScores));
        }

        const latestSubmission = [...submissions]
          .filter((s) => s.submitted_at)
          .sort((a, b) => new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime())[0];
        if (latestSubmission) {
          const mapped = questionMaterialMap[latestSubmission.question_id];
          setLastAccess({
            materialTitle: mapped?.materialTitle || "Materi tidak ditemukan",
            when: latestSubmission.submitted_at || "",
          });
          setLastSubmittedAt(latestSubmission.submitted_at || "");
        }

        const materialSet = new Set(
          submissions
            .map((s) => questionMaterialMap[s.question_id]?.materialId)
            .filter((v): v is string => Boolean(v))
        );
        setMaterialsTouched(materialSet.size);
      } catch (err: any) {
        setError(err.message || "Gagal memuat detail siswa.");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [isOpen, student, questionMaterialMap]);

  if (!isOpen || !student) return null;
  const reviewRate = totalSubmissions > 0 ? Math.round((reviewedCount / totalSubmissions) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/45 p-4 flex items-center justify-center">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Tutup"
        >
          <FiX />
        </button>

        <h3 className="text-lg font-semibold text-slate-900">Profil Siswa</h3>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              {student.foto_profil_url ? (
                <img
                  src={student.foto_profil_url}
                  alt={`Foto ${student.student_name}`}
                  className="h-16 w-16 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-slate-900 text-white text-xl font-semibold flex items-center justify-center">
                  {getInitial(student.student_name)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-lg font-semibold text-slate-900 truncate">{student.student_name}</p>
                <p className="text-sm text-slate-500 truncate">@{deriveUsername(student)}</p>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <ProfileLine label="Username" value={`@${deriveUsername(student)}`} />
              <ProfileLine label="Email" value={student.student_email} />
              <ProfileLine label="Kelas" value={student.kelas_tingkat || "-"} />
              <ProfileLine label="NIS/NISN" value={student.nomor_identitas || "-"} />
              <ProfileLine label="Institusi" value={student.institusi || "-"} />
              <ProfileLine label="Tanggal Lahir" value={formatDateLabel(student.tanggal_lahir ?? undefined)} />
              <ProfileLine label="Gabung Kelas" value={formatDateTimeLabel(student.joined_at)} />
              <ProfileLine label="Login Terakhir" value={formatDateTimeLabel(student.last_login_at ?? undefined)} />
            </div>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="text-sm text-slate-500">Memuat statistik siswa...</div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard icon={<FiAward />} label="Nilai Rata-rata" value={avgScore != null ? String(avgScore) : "-"} />
                  <StatCard icon={<FiBarChart2 />} label="Nilai Tertinggi" value={bestScore != null ? String(bestScore) : "-"} />
                  <StatCard icon={<FiBookOpen />} label="Total Submisi" value={String(totalSubmissions)} />
                  <StatCard icon={<FiCheckCircle />} label="Review Guru" value={`${reviewedCount}/${totalSubmissions}`} />
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-500">Progress Review</p>
                  <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-slate-900" style={{ width: `${reviewRate}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{reviewRate}% submisi sudah direview guru.</p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                  <p className="text-xs text-slate-500">Aktivitas Terbaru</p>
                  <div className="flex items-start gap-2 text-sm text-slate-700">
                    <FiActivity className="mt-0.5 text-slate-400" />
                    <div>
                      <p className="font-medium text-slate-900">{lastAccess?.materialTitle || "-"}</p>
                      <p className="text-xs text-slate-500">Materi terakhir diakses</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <FiClock /> {lastSubmittedAt ? formatDateTimeLabel(lastSubmittedAt) : "-"}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-500">Cakupan Materi</p>
                  <p className="mt-1 text-sm font-medium text-slate-900 inline-flex items-center gap-2">
                    <FiLayers className="text-slate-500" />
                    {materialsTouched} materi sudah pernah dikerjakan
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
      </div>
    </div>
  );
}

export function InviteStudentModal({
  isOpen,
  onClose,
  classId,
  onInvite,
}: {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  onInvite: (studentId: string) => Promise<boolean>;
}) {
  const [students, setStudents] = useState<InvitableStudent[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!isOpen) return;
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/classes/${classId}/invitable-students`, { credentials: "include" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message || "Gagal memuat daftar siswa.");
        }
        const data = await res.json();
        setStudents(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setError(err?.message || "Gagal memuat daftar siswa.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen, classId]);

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(query.trim().toLowerCase()) ||
      s.email.toLowerCase().includes(query.trim().toLowerCase())
  );

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/45 p-4 flex items-center justify-center">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Tutup"
        >
          <FiX />
        </button>
        <h3 className="text-lg font-semibold text-slate-900">Pilih Siswa untuk Invite</h3>
        <div className="mt-3">
          <SearchInput placeholder="Cari nama/email siswa..." value={query} onChange={setQuery} />
        </div>

        <div className="mt-4 max-h-[55vh] overflow-y-auto space-y-2 pr-1">
          {loading && <p className="text-sm text-slate-500">Memuat daftar siswa...</p>}
          {!loading && filtered.length === 0 && <p className="text-sm text-slate-500">Tidak ada siswa tersedia untuk invite.</p>}
          {!loading &&
            filtered.map((s) => (
              <div key={s.id} className="rounded-lg border border-slate-200 p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{s.name}</p>
                  <p className="text-xs text-slate-500">{s.email}</p>
                </div>
                <button
                  type="button"
                  className="sage-button !px-3 !py-1.5 text-xs"
                  disabled={invitingId === s.id}
                  onClick={async () => {
                    setInvitingId(s.id);
                    const ok = await onInvite(s.id);
                    setInvitingId(null);
                    if (ok) {
                      setStudents((prev) => prev.filter((item) => item.id !== s.id));
                    }
                  }}
                >
                  {invitingId === s.id ? "Mengundang..." : "Invite"}
                </button>
              </div>
            ))}
        </div>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </div>
    </div>
  );
}
