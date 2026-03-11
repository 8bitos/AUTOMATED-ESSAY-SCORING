"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import TeacherProfileModal from '@/components/TeacherProfileModal';

interface Class {
  id: string;
  teacher_id: string;
  pengajar_id?: string;
  teacher_name?: string;
  class_name: string;
  deskripsi: string;
  class_code: string;
  is_archived?: boolean;
  created_at: string;
  updated_at: string;
}

interface PendingClass {
  class_id: string;
  class_name: string;
  class_code: string;
  teacher_id: string;
  teacher_name: string;
  status: string;
  requested_at: string;
}

interface StudentProfile {
  kelas_tingkat?: string | null;
}

interface ClassMaterial {
  id: string;
  judul?: string;
  material_type?: "materi" | "soal" | "tugas";
  display_order?: number;
  essay_questions?: Array<{ id: string; submission_id?: string; revised_score?: number; teacher_feedback?: string }>;
}

interface ClassDetailForQuickAccess {
  id: string;
  materials?: ClassMaterial[];
}

interface ClassSummary {
  totalMaterials: number;
  totalSoal: number;
  answeredSoal: number;
  reviewedSoal: number;
  gradedSoal: number;
  averageScore: number | null;
  pendingSoal: number;
  totalTugas: number;
  firstSoalMaterialId?: string;
}

interface NoticeState {
  type: "success" | "error";
  text: string;
}

const extractGradeLevel = (value?: string | null): string | null => {
  if (!value) return null;
  const normalized = value.toUpperCase();
  const match = normalized.match(/\b(10|11|12)\b/);
  return match ? match[1] : null;
};

const getClassCardAccent = (className: string, classCode: string): string => {
  const level = extractGradeLevel(`${className} ${classCode}`);
  if (level === "10") return "border-t-sky-500";
  if (level === "11") return "border-t-emerald-500";
  if (level === "12") return "border-t-amber-500";
  return "border-t-slate-400";
};

export default function StudentMyClassesPage() {
  const { user } = useAuth();
  const [classCode, setClassCode] = useState('');
  const [joinNotice, setJoinNotice] = useState<NoticeState | null>(null);
  const [browseNotice, setBrowseNotice] = useState<NoticeState | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const [pendingClasses, setPendingClasses] = useState<PendingClass[]>([]);
  const [browseClasses, setBrowseClasses] = useState<Class[]>([]);
  const [browseQuery, setBrowseQuery] = useState('');
  const [joiningCode, setJoiningCode] = useState<string | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browsePage, setBrowsePage] = useState(1);
  const [fetchingClasses, setFetchingClasses] = useState(true);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [selectedTeacherName, setSelectedTeacherName] = useState<string | null>(null);
  const [studentGradeLevel, setStudentGradeLevel] = useState<string | null>(null);
  const [classSummaries, setClassSummaries] = useState<Record<string, ClassSummary>>({});
  const [loadingSummaries, setLoadingSummaries] = useState(false);
  const [classQuery, setClassQuery] = useState('');
  const [classSort, setClassSort] = useState<"updated_desc" | "name_asc" | "pending_desc">("updated_desc");
  const [pendingOpen, setPendingOpen] = useState(false);
  const browseDialogRef = useRef<HTMLDivElement | null>(null);
  const browseSearchInputRef = useRef<HTMLInputElement | null>(null);

  const fetchClasses = async () => {
    setFetchingClasses(true);
    setPageError(null);
    try {
      const [classesRes, pendingRes, allClassesRes, profileRes] = await Promise.all([
        fetch(`/api/student/my-classes`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        }),
        fetch(`/api/student/pending-classes`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        }),
        fetch(`/api/classes-public`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        }),
        fetch(`/api/profile`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        }),
      ]);

      if (!classesRes.ok) throw new Error('Gagal memuat kelas aktif.');
      if (!pendingRes.ok) throw new Error('Gagal memuat kelas pending.');
      if (!allClassesRes.ok) throw new Error('Gagal memuat daftar kelas.');
      if (!profileRes.ok) throw new Error('Gagal memuat profil.');

      const classesData: Class[] = await classesRes.json();
      const pendingData: PendingClass[] = await pendingRes.json();
      const allClassesData: Class[] = await allClassesRes.json();
      const profileData: StudentProfile = await profileRes.json();
      setClasses(Array.isArray(classesData) ? classesData : []);
      setPendingClasses(Array.isArray(pendingData) ? pendingData : []);
      setBrowseClasses(Array.isArray(allClassesData) ? allClassesData : []);
      setStudentGradeLevel(extractGradeLevel(profileData?.kelas_tingkat));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan saat memuat kelas.";
      setPageError(message);
    } finally {
      setFetchingClasses(false);
    }
  };

  useEffect(() => { fetchClasses(); }, []);

  const openTeacherProfile = (teacherId?: string, teacherName?: string) => {
    setSelectedTeacherId(teacherId || null);
    setSelectedTeacherName(teacherName || null);
    setProfileModalOpen(true);
  };

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinNotice(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/student/join-class`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ class_code: classCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal mengirim permintaan bergabung.');
      setJoinNotice({ type: "success", text: data.message || 'Permintaan bergabung berhasil dikirim.' });
      setClassCode('');
      void fetchClasses();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal mengirim permintaan bergabung.";
      setJoinNotice({ type: "error", text: message });
    } finally { setLoading(false); }
  };

  const handleJoinByCode = async (targetCode: string) => {
    setBrowseNotice(null);
    setJoiningCode(targetCode);
    try {
      const res = await fetch(`/api/student/join-class`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ class_code: targetCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal bergabung ke kelas.');
      setBrowseNotice({ type: "success", text: data.message || 'Permintaan bergabung berhasil dikirim.' });
      void fetchClasses();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal bergabung ke kelas.";
      setBrowseNotice({ type: "error", text: message });
    } finally {
      setJoiningCode(null);
    }
  };

  const BROWSE_PAGE_SIZE = 6;
  const filteredBrowseClasses = useMemo(() => {
    const joinedClassIds = new Set(classes.map((c) => c.id));
    const pendingClassIds = new Set(pendingClasses.map((c) => c.class_id));
    const needle = browseQuery.trim().toLowerCase();
    const pool = browseClasses.filter((c) => {
      if (c.is_archived) return false;
      if (joinedClassIds.has(c.id)) return false;
      if (pendingClassIds.has(c.id)) return false;
      if (!needle) return true;
      const haystack = `${c.class_name} ${c.teacher_name || ''} ${c.class_code || ''} ${c.deskripsi || ''}`.toLowerCase();
      return haystack.includes(needle);
    });
    const withScore = pool.map((c) => {
      const classLevel = extractGradeLevel(`${c.class_name} ${c.class_code}`);
      const recommended = Boolean(studentGradeLevel && classLevel && classLevel === studentGradeLevel);
      return { c, recommended };
    });
    withScore.sort((a, b) => {
      if (a.recommended === b.recommended) {
        return a.c.class_name.localeCompare(b.c.class_name, "id-ID");
      }
      return a.recommended ? -1 : 1;
    });
    return withScore.map((item) => item.c);
  }, [browseClasses, browseQuery, classes, pendingClasses, studentGradeLevel]);
  const totalBrowsePages = Math.max(1, Math.ceil(filteredBrowseClasses.length / BROWSE_PAGE_SIZE));
  const currentBrowsePage = Math.min(browsePage, totalBrowsePages);
  const pagedBrowseClasses = filteredBrowseClasses.slice(
    (currentBrowsePage - 1) * BROWSE_PAGE_SIZE,
    currentBrowsePage * BROWSE_PAGE_SIZE,
  );

  useEffect(() => {
    setBrowsePage(1);
  }, [browseQuery, browseOpen]);

  useEffect(() => {
    const loadClassSummaries = async () => {
      if (classes.length === 0) {
        setClassSummaries({});
        return;
      }
      setLoadingSummaries(true);
      try {
        const results = await Promise.all(
          classes.map(async (cls) => {
            const res = await fetch(`/api/student/classes/${cls.id}`, { credentials: "include" });
            if (!res.ok) return null;
            const data = (await res.json()) as ClassDetailForQuickAccess;
            const materials = Array.isArray(data?.materials) ? [...data.materials] : [];
            materials.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
            const firstSoal =
              materials.find((m) => m.material_type === "soal") ||
              materials.find((m) => Array.isArray(m.essay_questions) && m.essay_questions.length > 0);
            const totalSoal = materials.reduce((sum, m) => sum + (Array.isArray(m.essay_questions) ? m.essay_questions.length : 0), 0);
            const answeredSoal = materials.reduce(
              (sum, m) => sum + (Array.isArray(m.essay_questions) ? m.essay_questions.filter((q) => !!q.submission_id).length : 0),
              0
            );
            const reviewedSoal = materials.reduce(
              (sum, m) =>
                sum +
                (Array.isArray(m.essay_questions)
                  ? m.essay_questions.filter(
                      (q) => !!q.submission_id && (q.revised_score !== undefined || String(q.teacher_feedback || "").trim().length > 0)
                    ).length
                  : 0),
              0
            );
            const gradedScores = materials.flatMap((m) =>
              Array.isArray(m.essay_questions)
                ? m.essay_questions
                    .map((q) => (typeof q.revised_score === "number" ? Number(q.revised_score) : null))
                    .filter((v): v is number => v !== null)
                : []
            );
            const gradedSoal = gradedScores.length;
            const averageScore =
              gradedScores.length > 0
                ? Math.round(gradedScores.reduce((sum, value) => sum + value, 0) / gradedScores.length)
                : null;
            const summary: ClassSummary = {
              totalMaterials: materials.length,
              totalSoal,
              answeredSoal,
              reviewedSoal,
              gradedSoal,
              averageScore,
              pendingSoal: Math.max(0, totalSoal - answeredSoal),
              totalTugas: materials.filter((m) => m.material_type === "tugas").length,
              firstSoalMaterialId: firstSoal?.id,
            };
            return { classId: cls.id, summary };
          })
        );
        const mapped: Record<string, ClassSummary> = {};
        results.forEach((item) => {
          if (!item) return;
          mapped[item.classId] = item.summary;
        });
        setClassSummaries(mapped);
      } finally {
        setLoadingSummaries(false);
      }
    };
    void loadClassSummaries();
  }, [classes]);

  const dashboardSummary = useMemo(() => {
    const summaries = Object.values(classSummaries);
    const totalPendingSoal = summaries.reduce((sum, row) => sum + row.pendingSoal, 0);
    const totalTugas = summaries.reduce((sum, row) => sum + row.totalTugas, 0);
    const totalReviewedSoal = summaries.reduce((sum, row) => sum + row.reviewedSoal, 0);
    return {
      totalKelas: classes.length,
      totalPendingSoal,
      totalReviewedSoal,
      totalTugas,
    };
  }, [classes.length, classSummaries]);

  const filteredClasses = useMemo(() => {
    const needle = classQuery.trim().toLowerCase();
    const filtered = classes.filter((cls) => {
      if (!needle) return true;
      const haystack = `${cls.class_name} ${cls.class_code} ${cls.teacher_name || ""} ${cls.deskripsi || ""}`.toLowerCase();
      return haystack.includes(needle);
    });

    const sorted = [...filtered];
    if (classSort === "name_asc") {
      sorted.sort((a, b) => a.class_name.localeCompare(b.class_name, "id-ID"));
      return sorted;
    }
    if (classSort === "pending_desc") {
      sorted.sort((a, b) => {
        const aPending = classSummaries[a.id]?.pendingSoal ?? 0;
        const bPending = classSummaries[b.id]?.pendingSoal ?? 0;
        if (aPending !== bPending) return bPending - aPending;
        return a.class_name.localeCompare(b.class_name, "id-ID");
      });
      return sorted;
    }
    sorted.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
    return sorted;
  }, [classes, classQuery, classSort, classSummaries]);

  useEffect(() => {
    if (!browseOpen) return;

    const previousFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => {
      browseSearchInputRef.current?.focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setBrowseOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const container = browseDialogRef.current;
      if (!container) return;
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (active === first || !container.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocused?.focus();
    };
  }, [browseOpen]);

  return (
    <div className="space-y-4">
      <header className="sage-panel p-6 flex flex-col gap-2">
        <p className="sage-pill">Kelas Saya</p>
        <h1 className="text-3xl text-slate-900">Daftar Kelas Aktif</h1>
        <p className="text-slate-500">
          Selamat datang, {user?.nama_lengkap} ({user?.peran})
        </p>
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Gabung Kelas Baru</h2>
              <p className="text-sm text-slate-500">Masukkan kode kelas dari guru Anda.</p>
            </div>
            <div className="flex w-full max-w-xl flex-col gap-3 sm:flex-row">
              <form onSubmit={handleJoinClass} className="flex flex-1 flex-col gap-3 sm:flex-row">
                <input
                  id="join-class-input"
                  type="text"
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value)}
                  placeholder="Kode kelas"
                  className="sage-input flex-1"
                  required
                />
                <button type="submit" disabled={loading} className="sage-button whitespace-nowrap">
                  {loading ? "Mengirim..." : "Gabung"}
                </button>
              </form>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <button type="button" className="sage-button-outline whitespace-nowrap" onClick={() => setBrowseOpen(true)}>
                  Jelajah Kelas
                </button>
                {!fetchingClasses && pendingClasses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPendingOpen((prev) => !prev)}
                    className="whitespace-nowrap text-sm rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-red-700 hover:border-red-300 hover:bg-red-100"
                  >
                    Menunggu ACC ({pendingClasses.length})
                  </button>
                )}
              </div>
            </div>
          </div>
          {joinNotice && (
            <p className={`mt-3 text-sm ${joinNotice.type === "error" ? "text-red-500" : "text-slate-700"}`}>
              {joinNotice.text}
            </p>
          )}
        </div>
        {!fetchingClasses && pendingClasses.length > 0 && pendingOpen && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pendingClasses.map((item) => (
                <div key={item.class_id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <h3 className="text-sm font-semibold text-slate-900">{item.class_name}</h3>
                  <p className="text-xs text-slate-600 mt-1">Kode: {item.class_code}</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Guru:{" "}
                    <button
                      type="button"
                      onClick={() => openTeacherProfile(item.teacher_id, item.teacher_name)}
                      className="text-[color:var(--sage-700)] hover:underline"
                    >
                      {item.teacher_name || "-"}
                    </button>
                  </p>
                  <p className="mt-2 text-[11px] text-amber-800">Status: Menunggu persetujuan</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Diajukan:{" "}
                    {new Date(item.requested_at).toLocaleString("id-ID", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </header>

      {pageError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {pageError}
        </div>
      )}

      {fetchingClasses ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, idx) => (
            <div key={`skeleton-${idx}`} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200" />
              <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-slate-200" />
              <div className="mt-4 h-16 animate-pulse rounded bg-slate-100" />
              <div className="mt-4 h-9 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
      ) : classes.length === 0 ? (
        <div className="sage-panel p-10 text-center">
          <p className="text-slate-600">Kamu belum bergabung ke kelas mana pun.</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={() => setBrowseOpen(true)} className="sage-button-outline">
              Jelajah Kelas
            </button>
            <button type="button" onClick={() => document.getElementById("join-class-input")?.focus()} className="sage-button">
              Masukkan Kode Kelas
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="sage-panel p-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <input
                type="text"
                value={classQuery}
                onChange={(e) => setClassQuery(e.target.value)}
                placeholder="Cari kelas, guru, atau kode..."
                className="sage-input w-full sm:max-w-lg"
              />
              <select
                value={classSort}
                onChange={(e) => setClassSort(e.target.value as "updated_desc" | "name_asc" | "pending_desc")}
                className="sage-input w-full sm:w-56"
              >
                <option value="updated_desc">Terbaru Diupdate</option>
                <option value="name_asc">Nama Kelas (A-Z)</option>
                <option value="pending_desc">Soal Pending Terbanyak</option>
              </select>
            </div>
          </div>

          {filteredClasses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              Tidak ada kelas yang sesuai dengan pencarian/filter.
            </div>
          ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredClasses.map((cls) => (
            <div
              key={cls.id}
              className={`rounded-xl border border-slate-200 border-t-4 ${getClassCardAccent(cls.class_name, cls.class_code)} bg-white p-3 shadow-sm transition hover:shadow-md`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-1 text-base font-semibold text-slate-900">{cls.class_name}</h3>
                  {(classSummaries[cls.id]?.pendingSoal ?? 0) > 0 && (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      Pending {classSummaries[cls.id]?.pendingSoal}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">Kode: {cls.class_code}</p>
                <p className="text-xs text-slate-500">
                  Guru Pengampu:{" "}
                  <button
                    type="button"
                    onClick={() => openTeacherProfile(cls.teacher_id || cls.pengajar_id, cls.teacher_name)}
                    className="text-[color:var(--sage-700)] hover:underline"
                  >
                    {cls.teacher_name || '-'}
                  </button>
                </p>
                <p className="line-clamp-2 text-xs text-slate-500">{cls.deskripsi || "-"}</p>
                <Link href={`/dashboard/student/classes/${cls.id}`} className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
                  Masuk Kelas
                </Link>
              </div>
              <p className="mt-3 text-[11px] text-slate-400">
                Kelas dibuat: {new Date(cls.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit" })}
              </p>
            </div>
          ))}
        </div>
          )}
        </>
      )}

      <TeacherProfileModal
        teacherId={selectedTeacherId}
        teacherName={selectedTeacherName}
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />

      {browseOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/45 p-4 flex items-center justify-center"
          onClick={() => setBrowseOpen(false)}
          aria-hidden="true"
        >
          <div
            ref={browseDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="browse-kelas-title"
            className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="browse-kelas-title" className="text-xl font-semibold text-slate-900">Jelajah Kelas</h2>
                <p className="text-sm text-slate-500">Cari kelas mana pun dan kirim permintaan join.</p>
                {studentGradeLevel && (
                  <p className="text-xs mt-1 text-[color:var(--sage-700)]">
                    Rekomendasi diprioritaskan untuk kelas {studentGradeLevel}.
                  </p>
                )}
              </div>
              <button type="button" className="sage-button-outline !px-3 !py-1.5" onClick={() => setBrowseOpen(false)}>
                Tutup
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <input
                ref={browseSearchInputRef}
                type="text"
                value={browseQuery}
                onChange={(e) => setBrowseQuery(e.target.value)}
                placeholder="Cari nama kelas, guru, kode..."
                className="sage-input w-full sm:max-w-lg"
              />
              <span className="sage-pill">{filteredBrowseClasses.length} hasil</span>
            </div>
            {browseNotice && (
              <p className={`mt-3 text-sm ${browseNotice.type === "error" ? "text-red-500" : "text-slate-700"}`}>
                {browseNotice.text}
              </p>
            )}

            <div className="mt-4">
              {fetchingClasses ? (
                <p className="text-sm text-slate-500">Memuat daftar kelas...</p>
              ) : filteredBrowseClasses.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                  Tidak ada kelas yang cocok atau semua kelas sudah Anda ikuti.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pagedBrowseClasses.map((cls) => (
                      <div key={`browse-${cls.id}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-base font-semibold text-slate-900">{cls.class_name}</p>
                          {studentGradeLevel && extractGradeLevel(`${cls.class_name} ${cls.class_code}`) === studentGradeLevel && (
                            <span className="rounded-full border border-[color:var(--sage-500)] bg-[color:var(--sage-100)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--sage-800)]">
                              Direkomendasikan
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 mt-1">Kode: {cls.class_code}</p>
                        <p className="text-sm text-slate-600 mt-1">
                          Guru:{" "}
                          <button
                            type="button"
                            onClick={() => openTeacherProfile(cls.teacher_id || cls.pengajar_id, cls.teacher_name)}
                            className="text-[color:var(--sage-700)] hover:underline"
                          >
                            {cls.teacher_name || "-"}
                          </button>
                        </p>
                        <p className="text-xs text-slate-500 mt-2 line-clamp-3">{cls.deskripsi || "-"}</p>
                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            className="sage-button"
                            disabled={joiningCode === cls.class_code}
                            onClick={() => handleJoinByCode(cls.class_code)}
                          >
                            {joiningCode === cls.class_code ? "Mengirim..." : "Gabung Kelas"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      Halaman {currentBrowsePage} dari {totalBrowsePages}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="sage-button-outline !px-3 !py-1.5 text-xs"
                        disabled={currentBrowsePage <= 1}
                        onClick={() => setBrowsePage((p) => Math.max(1, p - 1))}
                      >
                        Sebelumnya
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={totalBrowsePages}
                        value={currentBrowsePage}
                        onChange={(e) => {
                          const n = Number(e.target.value || 1);
                          if (Number.isNaN(n)) return;
                          setBrowsePage(Math.min(totalBrowsePages, Math.max(1, n)));
                        }}
                        className="sage-input w-20 !py-1.5 text-center"
                      />
                      <button
                        type="button"
                        className="sage-button-outline !px-3 !py-1.5 text-xs"
                        disabled={currentBrowsePage >= totalBrowsePages}
                        onClick={() => setBrowsePage((p) => Math.min(totalBrowsePages, p + 1))}
                      >
                        Berikutnya
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
