"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiChevronDown, FiClock, FiRefreshCw, FiSearch, FiX } from "react-icons/fi";

interface TeacherClass {
  id: string;
  class_name: string;
}

interface MaterialItem {
  id: string;
  judul: string;
}

interface EssayQuestion {
  id: string;
  teks_soal: string;
}

interface Submission {
  id: string;
  question_id: string;
  student_name?: string;
  student_email?: string;
  submitted_at?: string;
  skor_ai?: number;
  revised_score?: number;
  teacher_feedback?: string;
}

interface ReviewQueueItem {
  submissionId: string;
  classId: string;
  className: string;
  materialId: string;
  materialTitle: string;
  questionId: string;
  questionText: string;
  studentName: string;
  studentEmail: string;
  submittedAt?: string;
  aiScore?: number;
  revisedScore?: number;
  teacherFeedback?: string;
}

export default function TeacherPenilaianPage() {
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");

  const loadQueue = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const classRes = await fetch("/api/classes", { credentials: "include" });
      if (!classRes.ok) throw new Error("Gagal memuat kelas.");
      const classes: TeacherClass[] = await classRes.json();

      const allQueueItems = await Promise.all(
        classes.map(async (cls) => {
          const materialsRes = await fetch(`/api/classes/${cls.id}/materials`, { credentials: "include" });
          const materials: MaterialItem[] = materialsRes.ok ? await materialsRes.json() : [];

          const materialChunks = await Promise.all(
            materials.map(async (material) => {
              const questionRes = await fetch(`/api/materials/${material.id}/essay-questions`, { credentials: "include" });
              const questions: EssayQuestion[] = questionRes.ok ? await questionRes.json() : [];

              const submissionChunks = await Promise.all(
                questions.map(async (question) => {
                  const submissionRes = await fetch(`/api/essay-questions/${question.id}/submissions`, { credentials: "include" });
                  const submissions: Submission[] = submissionRes.ok ? await submissionRes.json() : [];

                  return submissions.map((submission) => ({
                    submissionId: submission.id,
                    classId: cls.id,
                    className: cls.class_name,
                    materialId: material.id,
                    materialTitle: material.judul,
                    questionId: question.id,
                    questionText: question.teks_soal,
                    studentName: submission.student_name || "Unknown",
                    studentEmail: submission.student_email || "-",
                    submittedAt: submission.submitted_at,
                    aiScore: submission.skor_ai,
                    revisedScore: submission.revised_score,
                    teacherFeedback: submission.teacher_feedback,
                  }));
                })
              );

              return submissionChunks.flat();
            })
          );

          return materialChunks.flat();
        })
      );

      const flat = allQueueItems.flat().sort((a, b) => {
        const aTime = new Date(a.submittedAt || 0).getTime();
        const bTime = new Date(b.submittedAt || 0).getTime();
        return bTime - aTime;
      });
      setItems(flat);
    } catch (err: any) {
      setError(err?.message || "Gagal memuat antrian penilaian.");
    } finally {
      if (initial) setLoading(false);
      else setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadQueue(true);
  }, [loadQueue]);

  const summary = useMemo(() => {
    const pending = items.filter((item) => item.revisedScore == null && !(item.teacherFeedback || "").trim()).length;
    const reviewed = items.length - pending;
    return { pending, reviewed, total: items.length };
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = items.filter((item) => {
      const reviewed = item.revisedScore != null || (item.teacherFeedback || "").trim().length > 0;
      if (onlyPending && reviewed) return false;
      if (!q) return true;
      return (
        item.studentName.toLowerCase().includes(q) ||
        item.studentEmail.toLowerCase().includes(q) ||
        item.materialTitle.toLowerCase().includes(q) ||
        item.className.toLowerCase().includes(q)
      );
    });

    return [...base].sort((a, b) => {
      const aTime = new Date(a.submittedAt || 0).getTime();
      const bTime = new Date(b.submittedAt || 0).getTime();
      return sortBy === "oldest" ? aTime - bTime : bTime - aTime;
    });
  }, [items, query, onlyPending, sortBy]);

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Penilaian</h1>
            <p className="text-sm text-slate-500">Antrian submission siswa lintas kelas untuk diproses cepat.</p>
          </div>
          <button
            type="button"
            onClick={() => loadQueue(false)}
            className="sage-button-outline !px-3 !py-2 text-xs"
            disabled={refreshing}
          >
            <FiRefreshCw className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Pending Review" value={String(summary.pending)} icon={<FiClock className="text-amber-600" />} />
        <StatCard title="Sudah Direview" value={String(summary.reviewed)} icon={<FiCheckCircle className="text-emerald-600" />} />
        <StatCard title="Total Submission" value={String(summary.total)} icon={<FiCheckCircle className="text-slate-600" />} />
      </section>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative block w-full sm:max-w-md">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari siswa, kelas, atau materi..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-300"
            />
          </label>

          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={onlyPending}
              onChange={(e) => setOnlyPending(e.target.checked)}
              className="h-4 w-4"
            />
            Hanya Pending
          </label>

          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "newest" | "oldest")}
              className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm outline-none focus:border-slate-300"
              style={{ appearance: "none", WebkitAppearance: "none", MozAppearance: "none" }}
            >
              <option value="newest">Urut: Terbaru</option>
              <option value="oldest">Urut: Terlama</option>
            </select>
            <FiChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="sage-panel p-10 text-center text-slate-500">Memuat antrian penilaian...</div>
      ) : error ? (
        <div className="sage-panel p-6 text-red-600">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="sage-panel p-10 text-center text-slate-500">Tidak ada data submission.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const reviewed = item.revisedScore != null || (item.teacherFeedback || "").trim().length > 0;
            return (
              <div key={item.submissionId} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-start">
                  <div className="space-y-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{item.studentName}</p>
                    <p className="text-xs text-slate-500">{item.studentEmail}</p>
                    <p className="text-xs text-slate-600 text-justify">
                      {item.className} · {item.materialTitle}
                    </p>
                    <p className="text-xs text-slate-500 text-justify">
                      Soal: {item.questionText}
                    </p>
                  </div>

                  <div className="text-right space-y-1 md:min-w-[140px]">
                    <p className="text-xs text-slate-500 whitespace-nowrap">
                      {item.submittedAt ? new Date(item.submittedAt).toLocaleString("id-ID") : "-"}
                    </p>
                    <p className="text-xs text-slate-600 whitespace-nowrap">AI: {item.aiScore ?? "-"}</p>
                    <p className="text-xs text-slate-600 whitespace-nowrap">Guru: {item.revisedScore ?? "-"}</p>
                  </div>

                  <div className="md:border-l md:border-slate-200 md:pl-3 flex md:block items-center justify-end">
                    {reviewed ? (
                      <FiCheckCircle className="text-emerald-600" title="Reviewed" />
                    ) : (
                      <FiX className="text-rose-600" title="Pending" />
                    )}
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <Link href={`/dashboard/teacher/material/${item.materialId}`} className="sage-button-outline !px-3 !py-1.5 text-xs">
                    Buka & Review
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
