"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiAlertTriangle, FiBarChart2, FiChevronDown, FiChevronUp, FiClock, FiFilter, FiMessageSquare, FiSearch } from "react-icons/fi";
import TeacherProfileModal from "@/components/TeacherProfileModal";

interface RubricScore {
  aspek?: string;
  score?: number;
  skor_diperoleh?: number;
}

interface RubricDescriptor {
  score: string | number;
}

interface QuestionRubric {
  nama_aspek: string;
  descriptors?: RubricDescriptor[] | Record<string, unknown>;
}

interface EssayQuestion {
  id: string;
  teks_soal?: string;
  submission_id?: string;
  skor_ai?: number;
  revised_score?: number;
  teacher_feedback?: string;
  umpan_balik_ai?: string;
  weight?: number;
  ai_grading_status?: "queued" | "processing" | "completed" | "failed";
  rubric_scores?: RubricScore[];
  rubrics?: QuestionRubric[];
}

interface Material {
  id: string;
  judul: string;
  material_type?: "materi" | "soal" | "tugas";
  created_at?: string;
  updated_at?: string;
  essay_questions?: EssayQuestion[];
}

interface ClassItem {
  id: string;
  class_name: string;
  teacher_name?: string;
  teacher_id?: string;
  pengajar_id?: string;
  materials?: Material[];
}

interface GradeAppealItem {
  id: string;
  submission_id: string;
  status: "open" | "in_review" | "resolved_accepted" | "resolved_rejected" | "withdrawn";
  reason_text: string;
  teacher_response?: string;
  created_at?: string;
}

type GradeFilter = "all" | "reviewed" | "waiting_review" | "needs_improvement" | "has_appeal";
type GradeSort = "latest" | "score_high" | "score_low" | "alphabet";

type QuestionState = "belum_submit" | "queued" | "processing" | "reviewed" | "waiting_review" | "ai_failed";

interface QuestionGradeItem {
  id: string;
  title: string;
  submissionId: string;
  aiScore: number | null;
  teacherScore: number | null;
  finalScore: number | null;
  status: QuestionState;
  aiStatus?: string;
  aiFeedback: string;
  teacherFeedback: string;
  rubricRows: Array<{ aspek: string; score: number; maxScore: number }>;
}

interface MaterialGradeRow {
  classId: string;
  className: string;
  teacherId?: string;
  teacherName?: string;
  materialId: string;
  materialType: "materi" | "soal" | "tugas";
  materialTitle: string;
  totalQuestions: number;
  answeredQuestions: number;
  reviewedQuestions: number;
  score: number | null;
  aiAverageScore: number | null;
  updatedAt?: string;
  latestFeedback?: string;
  questionItems: QuestionGradeItem[];
}

const getRubricMaxScore = (rubric?: QuestionRubric): number => {
  if (!rubric?.descriptors) return 0;
  const entries = Array.isArray(rubric.descriptors)
    ? rubric.descriptors
    : Object.entries(rubric.descriptors).map(([score]) => ({ score }));
  return entries.reduce((max, item) => {
    const value = Number(item.score);
    if (!Number.isFinite(value)) return max;
    return value > max ? value : max;
  }, 0);
};

const getRubricScoreEntries = (question: EssayQuestion) => {
  const rows = Array.isArray(question.rubric_scores) ? question.rubric_scores : [];
  if (rows.length === 0) return [] as Array<{ aspek: string; score: number; maxScore: number }>;
  const rubrics = Array.isArray(question.rubrics) ? question.rubrics : [];
  const normalize = (v: unknown) => String(v ?? "").trim().toLowerCase();
  return rows.map((row, index) => {
    const aspek = row.aspek || "-";
    const score = Number(row.skor_diperoleh ?? row.score ?? 0);
    const matchedRubric = rubrics.find((r) => normalize(r.nama_aspek) === normalize(aspek)) ?? rubrics[index];
    const maxScore = Math.max(1, getRubricMaxScore(matchedRubric));
    return {
      aspek,
      score: Number.isFinite(score) ? score : 0,
      maxScore,
    };
  });
};

const getQuestionState = (q: EssayQuestion): QuestionState => {
  if (!q.submission_id) return "belum_submit";
  const hasTeacher = typeof q.revised_score === "number" || (q.teacher_feedback ?? "").trim().length > 0;
  if (hasTeacher) return "reviewed";
  const aiStatus = (q.ai_grading_status || "").toLowerCase();
  if (aiStatus === "queued") return "queued";
  if (aiStatus === "processing") return "processing";
  if (aiStatus === "failed") return "ai_failed";
  return "waiting_review";
};

const getAppealLabel = (status?: GradeAppealItem["status"]) => {
  if (status === "open") return "Banding Diajukan";
  if (status === "in_review") return "Banding Diproses";
  if (status === "resolved_accepted") return "Banding Diterima";
  if (status === "resolved_rejected") return "Banding Ditolak";
  if (status === "withdrawn") return "Banding Dibatalkan";
  return "";
};

const getAppealTone = (status?: GradeAppealItem["status"]) => {
  if (status === "open") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "in_review") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "resolved_accepted") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "resolved_rejected") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
};

export default function StudentGradesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [appealsBySubmission, setAppealsBySubmission] = useState<Record<string, GradeAppealItem>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<GradeFilter>("all");
  const [sortBy, setSortBy] = useState<GradeSort>("latest");
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [creatingAppealFor, setCreatingAppealFor] = useState<string>("");
  const [appealComposerOpen, setAppealComposerOpen] = useState<Record<string, boolean>>({});
  const [appealReasonBySubmission, setAppealReasonBySubmission] = useState<Record<string, string>>({});
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [selectedTeacherName, setSelectedTeacherName] = useState<string | null>(null);

  const loadAppeals = useCallback(async () => {
    try {
      const res = await fetch("/api/grade-appeals/mine", { credentials: "include" });
      if (!res.ok) return;
      const rows = (await res.json()) as GradeAppealItem[];
      const next: Record<string, GradeAppealItem> = {};
      (Array.isArray(rows) ? rows : []).forEach((row) => {
        const sid = (row.submission_id || "").trim();
        if (!sid) return;
        const prev = next[sid];
        if (!prev) {
          next[sid] = row;
          return;
        }
        const prevTime = new Date(prev.created_at || 0).getTime();
        const curTime = new Date(row.created_at || 0).getTime();
        if (curTime > prevTime) next[sid] = row;
      });
      setAppealsBySubmission(next);
    } catch {
      setAppealsBySubmission({});
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/student/my-classes", { credentials: "include" });
        if (!res.ok) throw new Error("Gagal memuat data nilai.");
        const data = await res.json();
        setClasses(Array.isArray(data) ? data : []);
        await loadAppeals();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, [loadAppeals]);

  const classOptions = useMemo(() => classes.map((cls) => ({ id: cls.id, name: cls.class_name })), [classes]);

  const calculateFinalScore = (questions: EssayQuestion[]) => {
    const totalQuestions = questions.length;
    if (totalQuestions === 0) return null;
    const scoredQuestions = questions.filter((q) => {
      const score = q.revised_score ?? q.skor_ai;
      return q.submission_id && typeof score === "number";
    });
    if (scoredQuestions.length === 0) return 0;

    let weightedSum = 0;
    let totalWeight = 0;
    scoredQuestions.forEach((q) => {
      const score = (q.revised_score ?? q.skor_ai) as number;
      const weight = typeof q.weight === "number" && q.weight > 0 ? q.weight : 1;
      weightedSum += score * weight;
      totalWeight += weight;
    });
    if (totalWeight <= 0) return 0;
    const weightedAverage = weightedSum / totalWeight;
    const completionFactor = scoredQuestions.length / totalQuestions;
    return weightedAverage * completionFactor;
  };

  const allRows = useMemo<MaterialGradeRow[]>(() => {
    const rows: MaterialGradeRow[] = [];
    classes.forEach((cls) => {
      const materials = Array.isArray(cls.materials) ? cls.materials : [];
      materials.forEach((material) => {
        const questions = Array.isArray(material.essay_questions) ? material.essay_questions : [];
        const questionItems: QuestionGradeItem[] = questions.map((q, idx) => {
          const state = getQuestionState(q);
          return {
            id: q.id,
            title: (q.teks_soal || "").trim() || `Soal ${idx + 1}`,
            submissionId: q.submission_id || "",
            aiScore: typeof q.skor_ai === "number" ? q.skor_ai : null,
            teacherScore: typeof q.revised_score === "number" ? q.revised_score : null,
            finalScore: typeof (q.revised_score ?? q.skor_ai) === "number" ? Number(q.revised_score ?? q.skor_ai) : null,
            status: state,
            aiStatus: q.ai_grading_status,
            aiFeedback: String(q.umpan_balik_ai || "").trim(),
            teacherFeedback: String(q.teacher_feedback || "").trim(),
            rubricRows: getRubricScoreEntries(q),
          };
        });
        const answeredQuestions = questionItems.filter((q) => q.submissionId.length > 0).length;
        const reviewedQuestions = questionItems.filter((q) => q.status === "reviewed").length;
        const aiScores = questionItems
          .map((q) => q.aiScore)
          .filter((score): score is number => typeof score === "number");
        const latestFeedback = questionItems.map((q) => q.teacherFeedback).find((text) => text.length > 0);

        rows.push({
          classId: cls.id,
          className: cls.class_name,
          teacherId: cls.teacher_id || cls.pengajar_id,
          teacherName: cls.teacher_name,
          materialId: material.id,
          materialType: (material.material_type || "materi") as "materi" | "soal" | "tugas",
          materialTitle: material.judul,
          totalQuestions: questions.length,
          answeredQuestions,
          reviewedQuestions,
          score: calculateFinalScore(questions),
          aiAverageScore: aiScores.length > 0 ? aiScores.reduce((sum, value) => sum + value, 0) / aiScores.length : null,
          updatedAt: material.updated_at || material.created_at,
          latestFeedback,
          questionItems,
        });
      });
    });
    return rows;
  }, [classes]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = allRows.filter((row) => {
      if (selectedClassId !== "all" && row.classId !== selectedClassId) return false;
      const matchQuery =
        !q ||
        row.materialTitle.toLowerCase().includes(q) ||
        row.className.toLowerCase().includes(q) ||
        String(row.teacherName || "").toLowerCase().includes(q);

      const hasAppeal = row.questionItems.some((item) => {
        if (!item.submissionId) return false;
        const appeal = appealsBySubmission[item.submissionId];
        return Boolean(appeal && (appeal.status === "open" || appeal.status === "in_review"));
      });
      const needsImprovement = typeof row.score === "number" && row.score < 75;
      const waitingReview = row.answeredQuestions > row.reviewedQuestions;
      const reviewed = row.totalQuestions > 0 && row.answeredQuestions > 0 && !waitingReview;

      const matchFilter =
        filter === "all" ||
        (filter === "reviewed" && reviewed) ||
        (filter === "waiting_review" && waitingReview) ||
        (filter === "needs_improvement" && needsImprovement) ||
        (filter === "has_appeal" && hasAppeal);

      return matchQuery && matchFilter;
    });

    return rows.sort((a, b) => {
      if (sortBy === "score_high") return (b.score ?? -1) - (a.score ?? -1);
      if (sortBy === "score_low") return (a.score ?? 999) - (b.score ?? 999);
      if (sortBy === "alphabet") return a.materialTitle.localeCompare(b.materialTitle, "id", { sensitivity: "base" });
      const at = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bt = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bt - at;
    });
  }, [allRows, appealsBySubmission, filter, query, selectedClassId, sortBy]);

  const summary = useMemo(() => {
    const numericScores = allRows
      .map((r) => r.score)
      .filter((score): score is number => typeof score === "number");
    const averageScore = numericScores.length > 0 ? numericScores.reduce((a, b) => a + b, 0) / numericScores.length : 0;
    const allQuestionItems = allRows.flatMap((row) => row.questionItems);
    const answeredQuestions = allQuestionItems.filter((q) => q.submissionId.length > 0).length;
    const reviewedQuestions = allQuestionItems.filter((q) => q.status === "reviewed").length;
    const waitingReview = allQuestionItems.filter((q) => q.status === "queued" || q.status === "processing" || q.status === "waiting_review").length;
    const openAppeals = Object.values(appealsBySubmission).filter((a) => a.status === "open" || a.status === "in_review").length;

    return {
      averageScore,
      answeredQuestions,
      reviewedQuestions,
      waitingReview,
      openAppeals,
      reviewedProgress: answeredQuestions > 0 ? Math.round((reviewedQuestions / answeredQuestions) * 100) : 0,
    };
  }, [allRows, appealsBySubmission]);

  const priorityRows = useMemo(() => {
    const waitingRows = filteredRows.filter((row) => row.answeredQuestions > row.reviewedQuestions).slice(0, 2);
    const lowRows = filteredRows.filter((row) => typeof row.score === "number" && row.score < 75).slice(0, 2);
    const openAppealRows = filteredRows.filter((row) =>
      row.questionItems.some((item) => {
        if (!item.submissionId) return false;
        const appeal = appealsBySubmission[item.submissionId];
        return Boolean(appeal && (appeal.status === "open" || appeal.status === "in_review"));
      })
    ).slice(0, 2);

    return {
      waitingRows,
      lowRows,
      openAppealRows,
    };
  }, [appealsBySubmission, filteredRows]);

  const getRowStatus = (row: MaterialGradeRow) => {
    const hasOpenAppeal = row.questionItems.some((item) => {
      if (!item.submissionId) return false;
      const appeal = appealsBySubmission[item.submissionId];
      return Boolean(appeal && (appeal.status === "open" || appeal.status === "in_review"));
    });
    if (hasOpenAppeal) return { label: "Banding Aktif", cls: "bg-sky-100 text-sky-700" };
    if (row.totalQuestions === 0) return { label: "Tanpa Soal", cls: "bg-slate-100 text-slate-700" };
    if (row.answeredQuestions === 0) return { label: "Belum Dikerjakan", cls: "bg-slate-100 text-slate-700" };
    if (row.answeredQuestions > row.reviewedQuestions) return { label: "Menunggu Review", cls: "bg-amber-100 text-amber-800" };
    if (typeof row.score === "number" && row.score < 75) return { label: "Perlu Perbaikan", cls: "bg-rose-100 text-rose-700" };
    return { label: "Reviewed", cls: "bg-emerald-100 text-emerald-800" };
  };

  const handleCreateAppeal = async (submissionId: string, reasonText: string) => {
    const reason = reasonText.trim();
    if (reason.length < 10) {
      window.alert("Alasan banding minimal 10 karakter agar guru bisa menindaklanjuti.");
      return;
    }
    setCreatingAppealFor(submissionId);
    try {
      const res = await fetch("/api/grade-appeals", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_id: submissionId,
          reason_type: "nilai_tidak_sesuai",
          reason_text: reason.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(body?.message || "Gagal mengajukan banding.");
        return;
      }
      window.alert("Banding nilai berhasil diajukan ke guru.");
      setAppealReasonBySubmission((prev) => ({ ...prev, [submissionId]: "" }));
      setAppealComposerOpen((prev) => ({ ...prev, [submissionId]: false }));
      await loadAppeals();
    } catch {
      window.alert("Terjadi kesalahan saat mengajukan banding.");
    } finally {
      setCreatingAppealFor("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Nilai & Feedback</h1>
        <p className="text-sm text-slate-500">Halaman ini jadi pusat keputusan: lihat progres review, prioritas perbaikan, dan banding nilai.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="sage-panel p-4">
          <p className="text-xs text-slate-500">Rata-rata Nilai Akhir</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{summary.averageScore.toFixed(2)}</p>
        </div>
        <div className="sage-panel p-4">
          <p className="text-xs text-slate-500">Progress Review Guru</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">{summary.reviewedQuestions}/{summary.answeredQuestions}</p>
          <p className="text-xs text-slate-500">{summary.reviewedProgress}% dari jawaban yang sudah dikirim</p>
        </div>
        <div className="sage-panel p-4">
          <p className="text-xs text-slate-500">Menunggu Review</p>
          <p className="mt-1 text-2xl font-semibold text-amber-700">{summary.waitingReview}</p>
        </div>
        <div className="sage-panel p-4">
          <p className="text-xs text-slate-500">Banding Aktif</p>
          <p className="mt-1 text-2xl font-semibold text-sky-700">{summary.openAppeals}</p>
        </div>
      </section>

      <section className="sage-panel p-4">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
          <FiAlertTriangle />
          Prioritas Aksi
        </p>
        <div className="mt-3 grid gap-3 xl:grid-cols-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Menunggu Review</p>
            {priorityRows.waitingRows.length === 0 ? (
              <p className="mt-1 text-sm text-amber-800">Tidak ada materi menunggu review saat ini.</p>
            ) : (
              <div className="mt-2 space-y-1.5">
                {priorityRows.waitingRows.map((row) => (
                  <Link key={`wait-${row.classId}-${row.materialId}`} href={`/dashboard/student/classes/${row.classId}/materials/${row.materialId}`} className="block text-sm text-amber-900 hover:underline">
                    {row.materialTitle} ({row.className})
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Perlu Perbaikan (&lt;75)</p>
            {priorityRows.lowRows.length === 0 ? (
              <p className="mt-1 text-sm text-rose-800">Belum ada nilai yang perlu perbaikan.</p>
            ) : (
              <div className="mt-2 space-y-1.5">
                {priorityRows.lowRows.map((row) => (
                  <Link key={`low-${row.classId}-${row.materialId}`} href={`/dashboard/student/classes/${row.classId}/materials/${row.materialId}`} className="block text-sm text-rose-900 hover:underline">
                    {row.materialTitle} ({row.score?.toFixed(2)})
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Banding Sedang Diproses</p>
            {priorityRows.openAppealRows.length === 0 ? (
              <p className="mt-1 text-sm text-sky-800">Tidak ada banding aktif.</p>
            ) : (
              <div className="mt-2 space-y-1.5">
                {priorityRows.openAppealRows.map((row) => (
                  <Link key={`appeal-${row.classId}-${row.materialId}`} href={`/dashboard/student/classes/${row.classId}/materials/${row.materialId}`} className="block text-sm text-sky-900 hover:underline">
                    {row.materialTitle} ({row.className})
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="sage-panel p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
          <label className="relative block">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-500)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari materi, kelas, atau guru..."
              className="sage-input pl-10"
            />
          </label>
          <label className="relative block">
            <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-500)]" />
            <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="sage-input pl-10 min-w-52">
              <option value="all">Semua Kelas</option>
              {classOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </select>
          </label>
          <label className="relative block">
            <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-500)]" />
            <select value={filter} onChange={(e) => setFilter(e.target.value as GradeFilter)} className="sage-input pl-10 min-w-52">
              <option value="all">Status: Semua</option>
              <option value="reviewed">Status: Reviewed</option>
              <option value="waiting_review">Status: Menunggu Review</option>
              <option value="needs_improvement">Status: Perlu Perbaikan</option>
              <option value="has_appeal">Status: Banding Aktif</option>
            </select>
          </label>
          <label className="relative block">
            <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-500)]" />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as GradeSort)} className="sage-input pl-10 min-w-52">
              <option value="latest">Urutkan: Terbaru</option>
              <option value="score_high">Urutkan: Nilai Tertinggi</option>
              <option value="score_low">Urutkan: Nilai Terendah</option>
              <option value="alphabet">Urutkan: Materi A-Z</option>
            </select>
          </label>
        </div>
      </section>

      <section className="sage-panel p-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-3 py-2 font-medium">Kelas</th>
              <th className="px-3 py-2 font-medium">Konten</th>
              <th className="px-3 py-2 font-medium">AI</th>
              <th className="px-3 py-2 font-medium">Final</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Update</th>
              <th className="px-3 py-2 font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                  Memuat nilai...
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-red-600">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && filteredRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                  Belum ada data nilai sesuai filter.
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              filteredRows.map((row) => {
                const status = getRowStatus(row);
                const rowKey = `${row.classId}-${row.materialId}`;
                const expanded = !!expandedRows[rowKey];
                return (
                  <Fragment key={rowKey}>
                    <tr className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-3">
                        <p className="font-medium text-slate-900">{row.className}</p>
                        <button
                          type="button"
                          className="text-xs text-[color:var(--sage-700)] hover:underline"
                          onClick={() => {
                            setSelectedTeacherId(row.teacherId || null);
                            setSelectedTeacherName(row.teacherName || null);
                            setProfileModalOpen(true);
                          }}
                        >
                          {row.teacherName || "-"}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        <p className="font-medium">{row.materialTitle}</p>
                        <p className="text-[11px] text-slate-500">
                          {row.materialType === "soal" ? "Soal" : row.materialType === "tugas" ? "Tugas" : "Materi"} • Submit {row.answeredQuestions}/{row.totalQuestions}
                        </p>
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-700">{row.aiAverageScore == null ? "-" : row.aiAverageScore.toFixed(2)}</td>
                      <td className="px-3 py-3 font-semibold text-slate-900">{row.score == null ? "-" : row.score.toFixed(2)}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status.cls}`}>{status.label}</span>
                      </td>
                      <td className="px-3 py-3 text-slate-500">
                        {row.updatedAt
                          ? new Date(row.updatedAt).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
                          : "-"}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            onClick={() => setExpandedRows((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }))}
                          >
                            {expanded ? <FiChevronUp className="mr-1" /> : <FiChevronDown className="mr-1" />}
                            Detail
                          </button>
                          <Link
                            href={`/dashboard/student/classes/${row.classId}/materials/${row.materialId}`}
                            className="inline-flex items-center rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                          >
                            Buka
                          </Link>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <td colSpan={7} className="px-3 py-3">
                          <div className="grid gap-2">
                            {row.questionItems.length === 0 && (
                              <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                                Konten ini belum punya soal.
                              </div>
                            )}
                            {row.questionItems.map((item, idx) => {
                              const appeal = item.submissionId ? appealsBySubmission[item.submissionId] : undefined;
                              const appealLabel = getAppealLabel(appeal?.status);
                              const appealTone = getAppealTone(appeal?.status);
                              return (
                                <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <p className="text-sm font-semibold text-slate-900">
                                      {idx + 1}. {item.title}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                      <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5">AI: {item.aiScore ?? "-"}</span>
                                      <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5">Guru: {item.teacherScore ?? "-"}</span>
                                      <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5">Final: {item.finalScore ?? "-"}</span>
                                      {appealLabel && (
                                        <span className={`rounded border px-1.5 py-0.5 ${appealTone}`}>{appealLabel}</span>
                                      )}
                                      {(item.status === "queued" || item.status === "processing") && (
                                        <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-amber-700 inline-flex items-center gap-1">
                                          <FiClock size={12} />
                                          {item.status === "queued" ? "Queued" : "Processing"}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2">
                                    <p className="mb-1 text-[11px] font-semibold text-slate-700">Rubrik Soal #{idx + 1}</p>
                                    {item.rubricRows.length === 0 ? (
                                      <p className="text-[11px] text-slate-500">Belum ada skor rubrik per aspek untuk soal ini.</p>
                                    ) : (
                                      <div className="flex flex-wrap gap-1.5 text-[11px]">
                                        {item.rubricRows.map((rubric) => (
                                          <span key={`${item.id}-${rubric.aspek}`} className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-slate-700">
                                            {rubric.aspek}: {rubric.score} / {rubric.maxScore}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className="mt-2 grid gap-2 lg:grid-cols-2">
                                    <div className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700">
                                      <p className="mb-0.5 font-semibold text-slate-600">Feedback AI (Soal Ini)</p>
                                      <p className="whitespace-pre-line">{item.aiFeedback || "-"}</p>
                                    </div>
                                    <div className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] text-emerald-800">
                                      <p className="mb-0.5 font-semibold">Feedback Guru (Soal Ini)</p>
                                      <p className="whitespace-pre-line">{item.teacherFeedback || "-"}</p>
                                    </div>
                                  </div>
                                  {appeal && (
                                    <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-700">
                                      <p>
                                        <span className="font-semibold">Alasan banding:</span> {appeal.reason_text}
                                      </p>
                                      {(appeal.teacher_response || "").trim().length > 0 && (
                                        <p className="mt-1">
                                          <span className="font-semibold">Respons guru:</span> {appeal.teacher_response}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                  {item.submissionId && (!appeal || appeal.status === "resolved_accepted" || appeal.status === "resolved_rejected") && (
                                    <div className="mt-2 rounded border border-sky-200 bg-sky-50 p-2">
                                      {!appealComposerOpen[item.submissionId] ? (
                                        <button
                                          type="button"
                                          className="rounded border border-sky-300 bg-white px-2 py-1 text-[11px] font-medium text-sky-800 hover:bg-sky-100 disabled:opacity-60"
                                          disabled={creatingAppealFor === item.submissionId}
                                          onClick={() => setAppealComposerOpen((prev) => ({ ...prev, [item.submissionId]: true }))}
                                        >
                                          Ajukan Banding untuk Soal Ini
                                        </button>
                                      ) : (
                                        <div className="space-y-2">
                                          <p className="text-[11px] font-semibold text-sky-900">
                                            Jelaskan alasan banding (contoh: aspek rubrik mana yang tidak sesuai).
                                          </p>
                                          <textarea
                                            value={appealReasonBySubmission[item.submissionId] || ""}
                                            onChange={(e) =>
                                              setAppealReasonBySubmission((prev) => ({ ...prev, [item.submissionId]: e.target.value }))
                                            }
                                            className="sage-input min-h-24 text-xs"
                                            placeholder="Contoh: Pada aspek ketepatan konsep, jawaban saya sudah menyebutkan ...."
                                          />
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                                              disabled={creatingAppealFor === item.submissionId}
                                              onClick={() =>
                                                setAppealComposerOpen((prev) => ({ ...prev, [item.submissionId]: false }))
                                              }
                                            >
                                              Batal
                                            </button>
                                            <button
                                              type="button"
                                              className="rounded border border-sky-400 bg-sky-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-sky-700 disabled:opacity-60"
                                              disabled={creatingAppealFor === item.submissionId}
                                              onClick={() =>
                                                void handleCreateAppeal(
                                                  item.submissionId,
                                                  appealReasonBySubmission[item.submissionId] || ""
                                                )
                                              }
                                            >
                                              {creatingAppealFor === item.submissionId ? "Mengajukan..." : "Kirim Banding"}
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
          </tbody>
        </table>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="sage-panel p-4">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FiMessageSquare />
            Feedback Terbaru
          </p>
          <div className="mt-3 space-y-3">
            {allRows
              .filter((row) => (row.latestFeedback || "").trim().length > 0)
              .sort((a, b) => {
                const at = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                const bt = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                return bt - at;
              })
              .slice(0, 5)
              .map((item) => (
                <div key={`${item.classId}-${item.materialId}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{item.className}</p>
                  <p className="text-sm font-medium text-slate-900">{item.materialTitle}</p>
                  <p className="mt-1 text-xs text-slate-700 line-clamp-3">{item.latestFeedback}</p>
                  <Link href={`/dashboard/student/classes/${item.classId}/materials/${item.materialId}`} className="mt-2 inline-flex text-xs text-[color:var(--sage-700)] hover:underline">
                    Buka materi
                  </Link>
                </div>
              ))}
            {allRows.filter((row) => (row.latestFeedback || "").trim().length > 0).length === 0 && (
              <p className="text-sm text-slate-500">Belum ada feedback guru yang tercatat.</p>
            )}
          </div>
        </div>
        <div className="sage-panel p-4">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FiBarChart2 />
            Arah Perbaikan
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              Prioritaskan materi dengan status <b>Perlu Perbaikan</b> agar dampak ke nilai rata-rata lebih cepat.
            </li>
            <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              Jika sudah submit tapi belum direview, pantau status <b>Menunggu Review</b>.
            </li>
            <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              Gunakan <b>Ajukan Banding</b> hanya saat ada ketidaksesuaian rubrik/feedback.
            </li>
          </ul>
        </div>
      </section>

      <TeacherProfileModal
        teacherId={selectedTeacherId}
        teacherName={selectedTeacherName}
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </div>
  );
}
