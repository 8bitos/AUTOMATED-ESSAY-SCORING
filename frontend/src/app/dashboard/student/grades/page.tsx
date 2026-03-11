"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiChevronDown, FiChevronUp, FiClock, FiFilter, FiSearch } from "react-icons/fi";
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
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [detailSortBy, setDetailSortBy] = useState<Record<string, "default" | "score_high" | "score_low" | "status">>({});
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
  }, [allRows, appealsBySubmission, filter, query, sortBy]);

  const summary = useMemo(() => {
    const numericScores = allRows
      .map((r) => r.score)
      .filter((score): score is number => typeof score === "number");
    const averageScore = numericScores.length > 0 ? numericScores.reduce((a, b) => a + b, 0) / numericScores.length : 0;
    const allQuestionItems = allRows.flatMap((row) => row.questionItems);
    const submittedQuestions = allQuestionItems.filter((q) => q.submissionId.length > 0).length;
    const waitingReview = allQuestionItems.filter((q) => q.status === "queued" || q.status === "processing" || q.status === "waiting_review").length;
    const scoredRows = allRows.filter((row) => typeof row.score === "number").length;
    const needsImprovement = allRows.filter((row) => typeof row.score === "number" && row.score < 75).length;
    const waitingReviewPct = submittedQuestions > 0 ? Math.round((waitingReview / submittedQuestions) * 100) : 0;
    const improvementPct = scoredRows > 0 ? Math.round((needsImprovement / scoredRows) * 100) : 0;

    return {
      averageScore,
      submittedQuestions,
      waitingReview,
      needsImprovement,
      waitingReviewPct,
      improvementPct,
    };
  }, [allRows, appealsBySubmission]);

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
    <div className="space-y-4">
      <div className="sage-panel p-4 space-y-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Nilai & Feedback</h1>
          <p className="text-sm text-slate-500">Ringkas, fokus ke hasil dan tindak lanjut.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3" title="Rata-rata nilai akhir dari semua materi yang sudah dinilai.">
            <p className="text-xs text-slate-500">Rata-rata Nilai</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{summary.averageScore.toFixed(2)}</p>
            <div className="mt-2 h-1.5 rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.min(100, Math.max(0, summary.averageScore))}%` }} />
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3" title="Jumlah jawaban yang masih menunggu review guru.">
            <p className="text-xs text-amber-800">Menunggu Review</p>
            <p className="mt-1 text-lg font-semibold text-amber-900">{summary.waitingReview}</p>
            <div className="mt-2 h-1.5 rounded-full bg-amber-100">
              <div className="h-full rounded-full bg-amber-500" style={{ width: `${summary.waitingReviewPct}%` }} />
            </div>
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3" title="Jumlah materi dengan nilai di bawah 75.">
            <p className="text-xs text-rose-800">Perlu Perbaikan</p>
            <p className="mt-1 text-lg font-semibold text-rose-900">{summary.needsImprovement}</p>
            <div className="mt-2 h-1.5 rounded-full bg-rose-100">
              <div className="h-full rounded-full bg-rose-500" style={{ width: `${summary.improvementPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      <section className="sage-panel p-3">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="relative block">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-500)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari materi, kelas, atau guru..."
              className="sage-input h-9 pl-9 text-sm"
            />
          </label>
          <label className="relative block">
            <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-500)]" />
            <select value={filter} onChange={(e) => setFilter(e.target.value as GradeFilter)} className="sage-input h-9 pl-9 text-sm min-w-44">
              <option value="all">Status: Semua</option>
              <option value="reviewed">Status: Reviewed</option>
              <option value="waiting_review">Status: Menunggu Review</option>
              <option value="needs_improvement">Status: Perlu Perbaikan</option>
            </select>
          </label>
          <label className="relative block">
            <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-500)]" />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as GradeSort)} className="sage-input h-9 pl-9 text-sm min-w-44">
              <option value="latest">Terbaru</option>
              <option value="score_high">Nilai Tertinggi</option>
              <option value="score_low">Nilai Terendah</option>
              <option value="alphabet">Materi A-Z</option>
            </select>
          </label>
        </div>
      </section>

      <section className="sage-panel p-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-3 py-2 font-medium">Konten</th>
              <th className="px-3 py-2 font-medium">Skor</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Update</th>
              <th className="px-3 py-2 font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  Memuat nilai...
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-red-600">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && filteredRows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
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
                      <td className="px-3 py-3 text-slate-700">
                        <p className="text-xs text-slate-500">{row.className}</p>
                        <p className="font-medium text-slate-900">{row.materialTitle}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                          <span>{row.materialType === "soal" ? "Soal" : row.materialType === "tugas" ? "Tugas" : "Materi"}</span>
                          <span>•</span>
                          <span>Submit {row.answeredQuestions}/{row.totalQuestions}</span>
                          <span>•</span>
                          <button
                            type="button"
                            className="text-[color:var(--sage-700)] hover:underline"
                            onClick={() => {
                              setSelectedTeacherId(row.teacherId || null);
                              setSelectedTeacherName(row.teacherName || null);
                              setProfileModalOpen(true);
                            }}
                          >
                            {row.teacherName || "-"}
                          </button>
                        </div>
                      </td>
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
                            href={`/dashboard/student/classes/${row.classId}/materials/${row.materialId}?view=${row.materialType === "tugas" ? "tugas" : "soal"}`}
                            className="inline-flex items-center rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                          >
                            Buka
                          </Link>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <td colSpan={5} className="px-3 py-3">
                          <div className="grid gap-2">
                            {row.questionItems.length > 0 && (
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-slate-600">Detail Soal</p>
                                <label className="text-xs text-slate-500 inline-flex items-center gap-2">
                                  Urutkan:
                                  <select
                                    value={detailSortBy[rowKey] || "default"}
                                    onChange={(e) =>
                                      setDetailSortBy((prev) => ({
                                        ...prev,
                                        [rowKey]: e.target.value as "default" | "score_high" | "score_low" | "status",
                                      }))
                                    }
                                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                                  >
                                    <option value="default">Urutan Soal</option>
                                    <option value="score_high">Nilai Tertinggi</option>
                                    <option value="score_low">Nilai Terendah</option>
                                    <option value="status">Status</option>
                                  </select>
                                </label>
                              </div>
                            )}
                            {row.questionItems.length === 0 && (
                              <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                                Konten ini belum punya soal.
                              </div>
                            )}
                            {[...row.questionItems]
                              .map((item, idx) => ({ item, idx }))
                              .sort((a, b) => {
                                const sortKey = detailSortBy[rowKey] || "default";
                                if (sortKey === "default") return a.idx - b.idx;
                                if (sortKey === "status") {
                                  const order: Record<string, number> = {
                                    reviewed: 1,
                                    waiting_review: 2,
                                    queued: 3,
                                    processing: 4,
                                    ai_failed: 5,
                                    belum_submit: 6,
                                  };
                                  return (order[a.item.status] ?? 99) - (order[b.item.status] ?? 99);
                                }
                                const scoreA = a.item.finalScore ?? a.item.teacherScore ?? a.item.aiScore ?? -1;
                                const scoreB = b.item.finalScore ?? b.item.teacherScore ?? b.item.aiScore ?? -1;
                                if (sortKey === "score_high") return scoreB - scoreA;
                                if (sortKey === "score_low") return scoreA - scoreB;
                                return 0;
                              })
                              .map(({ item, idx }) => {
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

      <TeacherProfileModal
        teacherId={selectedTeacherId}
        teacherName={selectedTeacherName}
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </div>
  );
}
