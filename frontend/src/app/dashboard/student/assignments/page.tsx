"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiBookOpen, FiClipboard, FiFileText, FiFilter, FiSearch } from "react-icons/fi";
import TeacherProfileModal from "@/components/TeacherProfileModal";

interface EssayQuestion {
  id: string;
  submission_id?: string;
}

interface Material {
  id: string;
  judul: string;
  material_type?: "materi" | "soal" | "tugas";
  updated_at?: string;
  created_at?: string;
  essay_questions?: EssayQuestion[];
}

interface ClassItem {
  id: string;
  teacher_id?: string;
  pengajar_id?: string;
  class_name: string;
  teacher_name?: string;
  materials?: Material[];
}

type TaskFilter = "all" | "pending" | "done";
type TaskSort = "latest" | "lowest_progress" | "highest_pending";

interface AssignmentRow {
  classId: string;
  teacherId?: string;
  className: string;
  teacherName?: string;
  materialId: string;
  materialType: "materi" | "soal" | "tugas";
  materialTitle: string;
  totalQuestions: number;
  submittedQuestions: number;
  pendingQuestions: number;
  progress: number;
  updatedAt?: string;
}

export default function StudentAssignmentsPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [sortBy, setSortBy] = useState<TaskSort>("latest");
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [selectedTeacherName, setSelectedTeacherName] = useState<string | null>(null);

  useEffect(() => {
    const fetchAssignments = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/student/my-classes", { credentials: "include" });
        if (!res.ok) throw new Error("Gagal memuat data kelas.");
        const data = await res.json();
        setClasses(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setError(err?.message || "Terjadi kesalahan saat memuat data.");
      } finally {
        setLoading(false);
      }
    };
    fetchAssignments();
  }, []);

  const assignmentRows = useMemo<AssignmentRow[]>(() => {
    const rows: AssignmentRow[] = [];
    classes.forEach((cls) => {
      const materials = Array.isArray(cls.materials) ? cls.materials : [];
      materials.forEach((material) => {
        const questions = Array.isArray(material.essay_questions) ? material.essay_questions : [];
        const totalQuestions = questions.length;
        const submittedQuestions = questions.filter((q) => !!q.submission_id).length;
        const pendingQuestions = Math.max(0, totalQuestions - submittedQuestions);
        const progress = totalQuestions > 0 ? Math.round((submittedQuestions / totalQuestions) * 100) : 0;

        rows.push({
          classId: cls.id,
          teacherId: cls.teacher_id || cls.pengajar_id,
          className: cls.class_name,
          teacherName: cls.teacher_name,
          materialId: material.id,
          materialType: (material.material_type || "materi") as "materi" | "soal" | "tugas",
          materialTitle: material.judul,
          totalQuestions,
          submittedQuestions,
          pendingQuestions,
          progress,
          updatedAt: material.updated_at || material.created_at,
        });
      });
    });
    return rows;
  }, [classes]);

  const filteredRows = useMemo(() => {
    const filtered = assignmentRows.filter((row) => {
      const q = query.trim().toLowerCase();
      const matchQuery =
        !q ||
        row.materialTitle.toLowerCase().includes(q) ||
        row.className.toLowerCase().includes(q) ||
        String(row.teacherName || "").toLowerCase().includes(q);
      const matchFilter =
        filter === "all" ||
        (filter === "pending" && row.pendingQuestions > 0) ||
        (filter === "done" && row.totalQuestions > 0 && row.pendingQuestions === 0);
      return matchQuery && matchFilter;
    });

    return filtered.sort((a, b) => {
      if (sortBy === "lowest_progress") {
        if (a.progress !== b.progress) return a.progress - b.progress;
        return b.pendingQuestions - a.pendingQuestions;
      }
      if (sortBy === "highest_pending") {
        if (a.pendingQuestions !== b.pendingQuestions) return b.pendingQuestions - a.pendingQuestions;
        return a.progress - b.progress;
      }
      const at = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bt = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bt - at;
    });
  }, [assignmentRows, query, filter, sortBy]);

  const summary = useMemo(() => {
    const totalMaterials = assignmentRows.length;
    const pendingMaterials = assignmentRows.filter((r) => r.pendingQuestions > 0).length;
    const doneMaterials = assignmentRows.filter((r) => r.totalQuestions > 0 && r.pendingQuestions === 0).length;
    return { totalMaterials, pendingMaterials, doneMaterials };
  }, [assignmentRows]);

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Materi & Tugas</h1>
        <p className="text-sm text-slate-500">Pantau materi per kelas, progres pengerjaan soal, dan tugas yang masih pending.</p>
      </div>

      <section className="sage-panel p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <label className="relative block">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-500)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari materi, kelas, atau nama guru..."
              className="sage-input pl-10"
            />
          </label>
          <label className="relative block">
            <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-500)]" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as TaskFilter)}
              className="sage-input pl-10 min-w-56"
            >
              <option value="all">Semua Materi</option>
              <option value="pending">Perlu Dikerjakan</option>
              <option value="done">Sudah Selesai</option>
            </select>
          </label>
          <label className="relative block">
            <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-500)]" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as TaskSort)}
              className="sage-input pl-10 min-w-56"
            >
              <option value="latest">Urutkan: Terbaru</option>
              <option value="lowest_progress">Urutkan: Progress Terendah</option>
              <option value="highest_pending">Urutkan: Pending Terbanyak</option>
            </select>
          </label>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="sage-panel p-4">
          <p className="text-xs text-slate-500">Total Materi</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{summary.totalMaterials}</p>
        </div>
        <div className="sage-panel p-4">
          <p className="text-xs text-slate-500">Perlu Dikerjakan</p>
          <p className="mt-1 text-2xl font-semibold text-amber-700">{summary.pendingMaterials}</p>
        </div>
        <div className="sage-panel p-4">
          <p className="text-xs text-slate-500">Selesai</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">{summary.doneMaterials}</p>
        </div>
      </section>

      {loading ? (
        <div className="sage-panel p-8 text-center text-slate-500">Memuat materi dan tugas...</div>
      ) : error ? (
        <div className="sage-panel p-8 text-center text-red-600">{error}</div>
      ) : filteredRows.length === 0 ? (
        <div className="sage-panel p-8 text-center text-slate-500">
          Tidak ada materi/tugas yang sesuai filter.
        </div>
      ) : (
        <section className="grid gap-4">
          {filteredRows.map((row) => {
            const typeIcon =
              row.materialType === "soal" ? <FiFileText size={16} className="text-blue-600" /> : row.materialType === "tugas" ? <FiClipboard size={16} className="text-purple-600" /> : <FiBookOpen size={16} className="text-emerald-600" />;
            return (
              <article key={`${row.classId}-${row.materialId}`} className="sage-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 flex items-center gap-2">
                    <span>{row.className}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        row.materialType === "soal"
                          ? "bg-blue-100 text-blue-700"
                          : row.materialType === "tugas"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {row.materialType === "soal" ? "Soal" : row.materialType === "tugas" ? "Tugas" : "Materi"}
                    </span>
                  </p>
                  <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
                    {typeIcon}
                    <span>{row.materialTitle}</span>
                  </h2>
                  <p className="text-sm text-slate-500">
                    Guru:{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTeacherId(row.teacherId || null);
                        setSelectedTeacherName(row.teacherName || null);
                        setProfileModalOpen(true);
                      }}
                      className="text-[color:var(--sage-700)] hover:underline"
                    >
                      {row.teacherName || "-"}
                    </button>
                  </p>
                </div>

                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                    row.totalQuestions === 0
                      ? "bg-slate-100 text-slate-700"
                      : row.pendingQuestions > 0
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {row.totalQuestions === 0
                    ? "Tanpa Soal"
                    : row.pendingQuestions > 0
                      ? `${row.pendingQuestions} Belum Dikerjakan`
                      : "Selesai"}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Total Soal</p>
                  <p className="mt-1 text-base font-semibold text-slate-900">{row.totalQuestions}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Sudah Submit</p>
                  <p className="mt-1 text-base font-semibold text-emerald-700">{row.submittedQuestions}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Progress</p>
                  <p className="mt-1 text-base font-semibold text-slate-900">{row.progress}%</p>
                </div>
              </div>

              <div className="mt-3 h-2 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full bg-[color:var(--sage-700)]" style={{ width: `${row.progress}%` }} />
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Update: {row.updatedAt ? new Date(row.updatedAt).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}
                </p>
                <Link
                  href={`/dashboard/student/classes/${row.classId}/materials/${row.materialId}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
                >
                  <FiBookOpen />
                  Buka Materi
                </Link>
              </div>
              </article>
            );
          })}
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard/student/my-classes" className="sage-button-outline">
          <FiBookOpen /> Ke Kelas Saya
        </Link>
        <Link href="/dashboard/student/notifikasi" className="sage-button-outline">
          <FiClipboard /> Ke Notifikasi
        </Link>
      </div>

      <TeacherProfileModal
        teacherId={selectedTeacherId}
        teacherName={selectedTeacherName}
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </div>
  );
}
