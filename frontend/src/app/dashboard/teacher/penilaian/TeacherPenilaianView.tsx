"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiCheckCircle,
  FiClipboard,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiFileText,
  FiChevronsLeft,
  FiChevronsRight,
  FiRefreshCw,
  FiSearch,
  FiX,
} from "react-icons/fi";

interface TeacherClass {
  id: string;
  class_name: string;
}

interface ClassStudent {
  id: string;
  user_id?: string;
  student_name?: string;
  student_email?: string;
  foto_profil_url?: string | null;
}

interface MaterialItem {
  id: string;
  judul: string;
  material_type?: "materi" | "soal" | "tugas";
  isi_materi?: string;
}

interface EssayQuestion {
  id: string;
  teks_soal: string;
  weight?: number;
  rubrics?: unknown;
}

interface QuestionCatalog extends EssayQuestion {
  material_id: string;
  material_type?: "materi" | "soal" | "tugas";
}

interface RubricAspect {
  nama_aspek?: string;
  aspek?: string;
  bobot?: number;
  deskripsi?: string;
}

interface RubricScore {
  aspek: string;
  skor_diperoleh: number;
}

interface Submission {
  id: string;
  question_id: string;
  student_id?: string;
  student_name?: string;
  student_email?: string;
  submitted_at?: string;
  teks_jawaban?: string;
  skor_ai?: number;
  umpan_balik_ai?: string;
  revised_score?: number;
  teacher_feedback?: string;
  rubric_scores?: RubricScore[];
}

interface ReviewQueueItem {
  submissionId: string;
  classId: string;
  className: string;
  materialId: string;
  materialTitle: string;
  questionId: string;
  questionText: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  submittedAt?: string;
  answerText?: string;
  aiScore?: number;
  aiFeedback?: string;
  revisedScore?: number;
  teacherFeedback?: string;
  rubricScores: RubricScore[];
  questionWeight?: number;
  questionRubrics: RubricAspect[];
  materialType?: "materi" | "soal" | "tugas";
}

type StatusTab = "pending" | "reviewed" | "all";
type DetailPanelTab = "soal" | "detail";
type ReviewViewMode = "list" | "spreadsheet";
type SpreadsheetCellCursor = { rowIdx: number; colIdx: number };
type PenilaianMainTab = "penilaian" | "banding";

interface GradeAppealRow {
  id: string;
  submission_id: string;
  class_id: string;
  class_name?: string;
  student_id: string;
  student_name?: string;
  student_email?: string;
  question_text?: string;
  reason_type: string;
  reason_text: string;
  status: "open" | "in_review" | "resolved_accepted" | "resolved_rejected" | "withdrawn";
  teacher_response?: string;
  ai_score?: number;
  revised_score?: number;
  created_at?: string;
}

interface ContentCatalog {
  key: string;
  classId: string;
  className: string;
  sectionId: string;
  sectionTitle: string;
  linkedMaterialId?: string | null;
  materialTitle: string;
  category: "soal" | "tugas";
  contentTitle: string;
  questionIds?: string[];
}

interface ContentGroup {
  key: string;
  total: number;
  pending: number;
  reviewed: number;
  latestSubmittedAt?: string;
}

interface AssignmentSectionGroup {
  key: string;
  materialId: string;
  materialTitle: string;
  total: number;
  pending: number;
  reviewed: number;
  contents: ContentCatalog[];
}

interface AssignmentClassGroup {
  key: string;
  classId: string;
  className: string;
  total: number;
  pending: number;
  reviewed: number;
  sections: AssignmentSectionGroup[];
}

interface StudentQueueRow {
  studentId: string;
  studentName: string;
  studentEmail: string;
  photoUrl?: string;
  totalQuestions: number;
  answeredCount: number;
  unansweredCount: number;
  reviewedCount: number;
  pendingCount: number;
  latestSubmittedAt?: string;
}

interface StudentQuestionView {
  questionId: string;
  questionText: string;
  questionWeight?: number;
  questionRubrics: RubricAspect[];
  category: "soal" | "tugas";
  submission: ReviewQueueItem | null;
}

const isReviewed = (item: ReviewQueueItem): boolean =>
  item.revisedScore != null || (item.teacherFeedback || "").trim().length > 0;

const getSubmissionStatus = (item: ReviewQueueItem): "returned" | "turned_in" | "missing" => {
  if (!item.submittedAt) return "missing";
  if (isReviewed(item)) return "returned";
  return "turned_in";
};

const parseRubrics = (raw: unknown): RubricAspect[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as RubricAspect[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as RubricAspect[]) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const inferQuestionCategory = (text: string, materialType?: "materi" | "soal" | "tugas"): "tugas" | "soal" => {
  if (materialType === "tugas") return "tugas";
  if (materialType === "soal") return "soal";
  const normalized = text.toLowerCase();
  if (normalized.includes("tugas_submission") || normalized.includes("unggah tugas") || normalized.includes("pengumpulan tugas")) {
    return "tugas";
  }
  return "soal";
};

const inferContentType = (contentTypeRaw: string): "soal" | "tugas" | null => {
  const v = (contentTypeRaw || "").toLowerCase().trim();
  if (v === "soal") return "soal";
  if (v === "tugas") return "tugas";
  return null;
};

const normalizeStudentKey = (...values: Array<string | undefined | null>): string => {
  for (const raw of values) {
    const v = (raw || "").trim();
    if (v.length > 0) return v.toLowerCase();
  }
  return "";
};

const getInitial = (name: string): string => {
  const trimmed = (name || "").trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
};

const getAppealStatusMeta = (status: GradeAppealRow["status"]) => {
  if (status === "open") return { label: "Menunggu Review", cls: "border border-amber-200 bg-amber-50 text-amber-700" };
  if (status === "in_review") return { label: "Diproses", cls: "border border-sky-200 bg-sky-50 text-sky-700" };
  if (status === "resolved_accepted") return { label: "Diterima", cls: "border border-emerald-200 bg-emerald-50 text-emerald-700" };
  if (status === "resolved_rejected") return { label: "Ditolak", cls: "border border-rose-200 bg-rose-50 text-rose-700" };
  return { label: "Dibatalkan", cls: "border border-slate-200 bg-slate-50 text-slate-700" };
};

const TASK_TEXT_MARKER = "Jawaban Teks:";
const TASK_FILE_MARKER = "File Jawaban:";

function parseTaskSubmissionAnswer(raw?: string): { textAnswer: string; attachmentUrls: string[] } {
  const value = (raw || "").trim();
  if (!value) return { textAnswer: "", attachmentUrls: [] };

  const fileMarkerIdx = value.indexOf(TASK_FILE_MARKER);
  const textMarkerIdx = value.indexOf(TASK_TEXT_MARKER);
  const textAnswer =
    textMarkerIdx >= 0
      ? value
          .slice(textMarkerIdx + TASK_TEXT_MARKER.length, fileMarkerIdx >= 0 ? fileMarkerIdx : value.length)
          .trim()
      : value;

  const filePart = fileMarkerIdx >= 0 ? value.slice(fileMarkerIdx + TASK_FILE_MARKER.length).trim() : "";
  const directUrls = filePart
    .split(/\s+/)
    .map((line) => line.trim())
    .filter((line) => /^https?:\/\//i.test(line) || /^\/uploads\//i.test(line));
  const fallbackUrls =
    directUrls.length > 0
      ? directUrls
      : (value.match(/https?:\/\/[^\s)]+|\/uploads\/[^\s)]+/gi) || []).map((u) => u.trim());

  return { textAnswer, attachmentUrls: Array.from(new Set(fallbackUrls)) };
}

function getAttachmentKind(url: string): "image" | "pdf" | "other" {
  const lower = url.toLowerCase();
  if (/\.(png|jpg|jpeg|webp|gif|bmp|svg)(\?|#|$)/i.test(lower)) return "image";
  if (/\.pdf(\?|#|$)/i.test(lower)) return "pdf";
  return "other";
}

function parseSectionCards(raw?: string): Array<{ id: string; type: "soal" | "tugas"; title: string; questionIds: string[] }> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as
      | {
          format?: string;
          items?: Array<{
            id?: unknown;
            type?: unknown;
            title?: unknown;
            meta?: { question_ids?: unknown } | null;
          }>;
        }
      | Array<{
          id?: unknown;
          type?: unknown;
          title?: unknown;
          meta?: { question_ids?: unknown } | null;
        }>;
    const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : [];
    if (!Array.isArray(items)) return [];
    return items
      .map((item) => {
        const type = typeof item?.type === "string" ? inferContentType(item.type) : null;
        if (!type) return null;
        const title = typeof item?.title === "string" ? item.title.trim() : "";
        if (!title) return null;
        const questionIds = Array.isArray(item?.meta?.question_ids)
          ? item.meta!.question_ids!.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
          : [];
        return {
          id: typeof item?.id === "string" && item.id ? item.id : `${type}_${title}`,
          type,
          title,
          questionIds,
        };
      })
      .filter((v): v is { id: string; type: "soal" | "tugas"; title: string; questionIds: string[] } => v !== null);
  } catch {
    return [];
  }
}

export function TeacherPenilaianView({ scopedClassIdOverride }: { scopedClassIdOverride?: string } = {}) {
  const searchParams = useSearchParams();
  const scopedClassId = (scopedClassIdOverride ?? searchParams.get("classId") ?? "").trim();
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [contentCatalogs, setContentCatalogs] = useState<ContentCatalog[]>([]);
  const [questionsByMaterialId, setQuestionsByMaterialId] = useState<Record<string, QuestionCatalog[]>>({});
  const [studentsByClassId, setStudentsByClassId] = useState<Record<string, ClassStudent[]>>({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [assignmentQuery, setAssignmentQuery] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [showSummaryCards, setShowSummaryCards] = useState(true);
  const [collapsedClasses, setCollapsedClasses] = useState<Record<string, boolean>>({});
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const [selectedAssignmentKey, setSelectedAssignmentKey] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewScore, setReviewScore] = useState("");
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
  const [deletingSubmissionId, setDeletingSubmissionId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);
  const [detailPanelTab, setDetailPanelTab] = useState<DetailPanelTab>("soal");
  const [reviewViewMode, setReviewViewMode] = useState<ReviewViewMode>("list");
  const [identityCollapsed, setIdentityCollapsed] = useState(false);
  const [classificationCollapsed, setClassificationCollapsed] = useState(false);
  const [contentViewIndex, setContentViewIndex] = useState(0);
  const [reviewViewIndex, setReviewViewIndex] = useState(0);
  const [quickScoreByCell, setQuickScoreByCell] = useState<Record<string, string>>({});
  const [quickFeedbackByCell, setQuickFeedbackByCell] = useState<Record<string, string>>({});
  const [quickDirtyByCell, setQuickDirtyByCell] = useState<Record<string, boolean>>({});
  const [quickSavingCell, setQuickSavingCell] = useState<string | null>(null);
  const [quickSavingBatch, setQuickSavingBatch] = useState(false);
  const [quickSaveError, setQuickSaveError] = useState<string | null>(null);
  const [quickSaveSuccess, setQuickSaveSuccess] = useState<string | null>(null);
  const [activeSpreadsheetCell, setActiveSpreadsheetCell] = useState<SpreadsheetCellCursor | null>(null);
  const [mainTab, setMainTab] = useState<PenilaianMainTab>("penilaian");
  const [appeals, setAppeals] = useState<GradeAppealRow[]>([]);
  const [appealsLoading, setAppealsLoading] = useState(false);
  const [appealsError, setAppealsError] = useState<string | null>(null);
  const [appealStatusFilter, setAppealStatusFilter] = useState<"open" | "in_review" | "resolved_accepted" | "resolved_rejected" | "all">("open");
  const [appealClassFilter, setAppealClassFilter] = useState<string>("all");
  const [reviewingAppealId, setReviewingAppealId] = useState<string | null>(null);
  const scoreInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const spreadsheetCellRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
  const saveSpreadsheetBatchRef = useRef<() => Promise<void>>(async () => {});
  const visibleSummaryCards = showSummaryCards && !detailOpen;
  const panelHeightVh = visibleSummaryCards ? 74 : 84;

  const loadQueue = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const classRes = await fetch("/api/classes", { credentials: "include" });
      if (!classRes.ok) throw new Error("Gagal memuat kelas.");
      const classes: TeacherClass[] = await classRes.json();
      const classesToLoad =
        scopedClassId.length > 0 ? classes.filter((cls) => cls.id === scopedClassId) : classes;

      if (scopedClassId.length > 0 && classesToLoad.length === 0) {
        throw new Error("Kelas yang dipilih tidak ditemukan atau tidak dapat diakses.");
      }

      const classChunks = await Promise.all(
        classesToLoad.map(async (cls) => {
          const [materialsRes, studentsRes] = await Promise.all([
            fetch(`/api/classes/${cls.id}/materials`, { credentials: "include" }),
            fetch(`/api/classes/${cls.id}/students`, { credentials: "include" }),
          ]);

          const materials: MaterialItem[] = materialsRes.ok ? await materialsRes.json() : [];
          const classStudents: ClassStudent[] = studentsRes.ok ? await studentsRes.json() : [];
          const catalogs: ContentCatalog[] = [];
          const questionMap: Record<string, QuestionCatalog[]> = {};

          materials.forEach((material) => {
            const cards = parseSectionCards(material.isi_materi);
            if (cards.length === 0) {
              if (material.material_type === "soal" || material.material_type === "tugas") {
                catalogs.push({
                  key: `${cls.id}__${material.id}__fallback__${material.material_type}`,
                  classId: cls.id,
                  className: cls.class_name,
                  sectionId: material.id,
                  sectionTitle: material.judul || "Tanpa Section",
                  linkedMaterialId: material.id,
                  materialTitle: material.judul || "-",
                  category: material.material_type,
                  contentTitle: material.judul || (material.material_type === "tugas" ? "Tugas" : "Soal"),
                });
              }
              return;
            }
            cards.forEach((card) => {
              catalogs.push({
                key: `${cls.id}__${material.id}__${card.id}__${card.type}`,
                classId: cls.id,
                className: cls.class_name,
                sectionId: material.id,
                sectionTitle: material.judul || "Tanpa Section",
                linkedMaterialId: material.id,
                materialTitle: material.judul || "-",
                category: card.type,
                contentTitle: card.title,
                questionIds: card.questionIds,
              });
            });
          });

          const materialChunks = await Promise.all(
            materials.map(async (material) => {
              const questionRes = await fetch(`/api/materials/${material.id}/essay-questions`, { credentials: "include" });
              const questions: EssayQuestion[] = questionRes.ok ? await questionRes.json() : [];
              questionMap[material.id] = questions.map((q) => ({
                ...q,
                material_id: material.id,
                material_type: material.material_type,
              }));

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
                    questionWeight: question.weight,
                    questionRubrics: parseRubrics(question.rubrics),
                    studentId: normalizeStudentKey(submission.student_id, submission.student_email, submission.id),
                    studentName: submission.student_name || "Unknown",
                    studentEmail: submission.student_email || "-",
                    submittedAt: submission.submitted_at,
                    answerText: submission.teks_jawaban,
                    aiScore: submission.skor_ai,
                    aiFeedback: submission.umpan_balik_ai,
                    revisedScore: submission.revised_score,
                    teacherFeedback: submission.teacher_feedback,
                    rubricScores: Array.isArray(submission.rubric_scores) ? submission.rubric_scores : [],
                    materialType: material.material_type,
                  }));
                })
              );

              return submissionChunks.flat();
            })
          );

          return {
            queueItems: materialChunks.flat(),
            catalogs,
            classStudents,
            questionMap,
            classId: cls.id,
          };
        })
      );

      const flat = classChunks.flatMap((chunk) => chunk.queueItems).sort((a, b) => {
        const aTime = new Date(a.submittedAt || 0).getTime();
        const bTime = new Date(b.submittedAt || 0).getTime();
        return bTime - aTime;
      });

      const catalogMap = new Map<string, ContentCatalog>();
      classChunks.flatMap((chunk) => chunk.catalogs).forEach((entry) => {
        catalogMap.set(entry.key, entry);
      });

      const mergedQuestions: Record<string, QuestionCatalog[]> = {};
      classChunks.forEach((chunk) => {
        Object.entries(chunk.questionMap).forEach(([materialId, questions]) => {
          mergedQuestions[materialId] = questions;
        });
      });

      const mergedStudents: Record<string, ClassStudent[]> = {};
      classChunks.forEach((chunk) => {
        mergedStudents[chunk.classId] = chunk.classStudents;
      });

      setItems(flat);
      setContentCatalogs([...catalogMap.values()]);
      setQuestionsByMaterialId(mergedQuestions);
      setStudentsByClassId(mergedStudents);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat antrian penilaian.");
    } finally {
      if (initial) setLoading(false);
      else setRefreshing(false);
    }
  }, [scopedClassId]);

  useEffect(() => {
    loadQueue(true);
  }, [loadQueue]);

  const classOptions = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((item) => {
      if (!map.has(item.classId)) map.set(item.classId, item.className);
    });
    return Array.from(map.entries()).map(([id, class_name]) => ({ id, class_name }));
  }, [items]);

  const loadAppeals = useCallback(async () => {
    setAppealsLoading(true);
    setAppealsError(null);
    try {
      const params = new URLSearchParams();
      params.set("status", appealStatusFilter);
      if (appealClassFilter !== "all") params.set("class_id", appealClassFilter);
      const endpoints = [
        `/api/grade-appeals?${params.toString()}`,
        `/api/teacher/grade-appeals?${params.toString()}`,
        `/api/teacher/teacher/grade-appeals?${params.toString()}`,
      ];
      let rows: GradeAppealRow[] = [];
      let lastError = "Gagal memuat banding nilai.";
      let loaded = false;
      for (const endpoint of endpoints) {
        const res = await fetch(endpoint, { credentials: "include" });
        if (res.ok) {
          const body = (await res.json()) as GradeAppealRow[];
          rows = Array.isArray(body) ? body : [];
          loaded = true;
          break;
        }
        const body = await res.json().catch(() => ({}));
        lastError = body?.message || `Gagal memuat banding nilai (${res.status}).`;
        if (res.status !== 404) break;
      }
      if (!loaded) throw new Error(lastError);
      setAppeals(Array.isArray(rows) ? rows : []);
    } catch (err: unknown) {
      setAppealsError(err instanceof Error ? err.message : "Gagal memuat banding nilai.");
    } finally {
      setAppealsLoading(false);
    }
  }, [appealStatusFilter, appealClassFilter]);

  useEffect(() => {
    if (mainTab !== "banding") return;
    void loadAppeals();
  }, [mainTab, loadAppeals]);

  const summary = useMemo(() => {
    const pending = items.filter((item) => !isReviewed(item)).length;
    const reviewed = items.length - pending;
    return { pending, reviewed, total: items.length };
  }, [items]);

  const contentGroups = useMemo<ContentGroup[]>(() => {
    return contentCatalogs
      .map((catalog) => {
        const matched = items.filter((item) => {
          if (item.classId !== catalog.classId) return false;
          if (catalog.linkedMaterialId && item.materialId !== catalog.linkedMaterialId) return false;
          if (Array.isArray(catalog.questionIds) && catalog.questionIds.length > 0) {
            return catalog.questionIds.includes(item.questionId);
          }
          return inferQuestionCategory(item.questionText, item.materialType) === catalog.category;
        });

        const total = matched.length;
        const reviewed = matched.filter((item) => isReviewed(item)).length;
        const pending = total - reviewed;
        const latestSubmittedAt = matched
          .map((m) => m.submittedAt || "")
          .sort((a, b) => new Date(b || 0).getTime() - new Date(a || 0).getTime())[0];

        return {
          key: catalog.key,
          total,
          pending,
          reviewed,
          latestSubmittedAt,
        };
      })
      .sort((a, b) => {
        if (a.pending !== b.pending) return b.pending - a.pending;
        const aTime = new Date(a.latestSubmittedAt || 0).getTime();
        const bTime = new Date(b.latestSubmittedAt || 0).getTime();
        return bTime - aTime;
      });
  }, [contentCatalogs, items]);

  const contentStatsMap = useMemo(() => {
    const map = new Map<string, ContentGroup>();
    contentGroups.forEach((g) => map.set(g.key, g));
    return map;
  }, [contentGroups]);

  const filteredContentCatalogs = useMemo(() => {
    const q = assignmentQuery.trim().toLowerCase();
    if (!q) return contentCatalogs;
    return contentCatalogs.filter((content) => {
      const label = content.category === "tugas" ? "tugas" : "soal";
      const haystack = `${content.className} ${content.sectionTitle} ${content.contentTitle} ${label}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [contentCatalogs, assignmentQuery]);

  const groupedAssignments = useMemo<AssignmentClassGroup[]>(() => {
    const classMap = new Map<string, AssignmentClassGroup>();

    filteredContentCatalogs.forEach((content) => {
      const stats = contentStatsMap.get(content.key);
      const total = stats?.total ?? 0;
      const pending = stats?.pending ?? 0;
      const reviewed = stats?.reviewed ?? 0;
      let cls = classMap.get(content.classId);

      if (!cls) {
        cls = {
          key: content.classId,
          classId: content.classId,
          className: content.className,
          total: 0,
          pending: 0,
          reviewed: 0,
          sections: [],
        };
        classMap.set(content.classId, cls);
      }

      cls.total += total;
      cls.pending += pending;
      cls.reviewed += reviewed;

      let section = cls.sections.find((s) => s.key === `${content.classId}__${content.sectionId}`);
      if (!section) {
        section = {
          key: `${content.classId}__${content.sectionId}`,
          materialId: content.sectionId,
          materialTitle: content.sectionTitle,
          total: 0,
          pending: 0,
          reviewed: 0,
          contents: [],
        };
        cls.sections.push(section);
      }

      section.total += total;
      section.pending += pending;
      section.reviewed += reviewed;
      section.contents.push(content);
    });

    return [...classMap.values()]
      .map((cls) => ({
        ...cls,
        sections: cls.sections
          .map((section) => ({
            ...section,
            contents: [...section.contents].sort(
              (a, b) => (contentStatsMap.get(b.key)?.pending ?? 0) - (contentStatsMap.get(a.key)?.pending ?? 0)
            ),
          }))
          .sort((a, b) => b.pending - a.pending),
      }))
      .sort((a, b) => b.pending - a.pending);
  }, [filteredContentCatalogs, contentStatsMap]);

  useEffect(() => {
    if (filteredContentCatalogs.length === 0) {
      setSelectedAssignmentKey(null);
      return;
    }
    if (!selectedAssignmentKey || !filteredContentCatalogs.some((c) => c.key === selectedAssignmentKey)) {
      const firstWithStats = filteredContentCatalogs.find((c) => contentGroups.some((g) => g.key === c.key));
      setSelectedAssignmentKey((firstWithStats || filteredContentCatalogs[0]).key);
    }
  }, [filteredContentCatalogs, contentGroups, selectedAssignmentKey]);

  const selectedContent = useMemo(
    () => filteredContentCatalogs.find((c) => c.key === selectedAssignmentKey) || null,
    [filteredContentCatalogs, selectedAssignmentKey]
  );

  const selectedContentQuestions = useMemo(() => {
    if (!selectedContent) return [] as QuestionCatalog[];
    const materialId = selectedContent.linkedMaterialId || selectedContent.sectionId;
    const pool = questionsByMaterialId[materialId] || [];
    if (selectedContent.questionIds && selectedContent.questionIds.length > 0) {
      const explicit = pool.filter((q) => selectedContent.questionIds!.includes(q.id));
      return selectedContent.category === "tugas" ? explicit.slice(0, 1) : explicit;
    }

    const byCategory = pool.filter(
      (q) => inferQuestionCategory(q.teks_soal, q.material_type) === selectedContent.category
    );
    if (byCategory.length > 0) return byCategory;

    if (selectedContent.category === "tugas") {
      const byTaskMarker = pool.filter((q) => /tugas_submission|unggah tugas|pengumpulan tugas/i.test(q.teks_soal || ""));
      if (byTaskMarker.length > 0) return byTaskMarker.slice(0, 1);
      return pool.slice(0, 1);
    }

    return pool;
  }, [selectedContent, questionsByMaterialId]);

  const submissionMapByStudent = useMemo(() => {
    const map = new Map<string, Map<string, ReviewQueueItem>>();
    if (!selectedContent) return map;

    const relevant = items.filter((item) => {
      if (item.classId !== selectedContent.classId) return false;
      if (selectedContent.linkedMaterialId && item.materialId !== selectedContent.linkedMaterialId) return false;
      if (selectedContent.questionIds && selectedContent.questionIds.length > 0) {
        return selectedContent.questionIds.includes(item.questionId);
      }
      return inferQuestionCategory(item.questionText, item.materialType) === selectedContent.category;
    });

    relevant.forEach((item) => {
      const key = normalizeStudentKey(item.studentId, item.studentEmail, item.submissionId);
      if (!map.has(key)) map.set(key, new Map<string, ReviewQueueItem>());
      map.get(key)!.set(item.questionId, item);
    });

    return map;
  }, [items, selectedContent]);

  const studentRows = useMemo(() => {
    if (!selectedContent) return [] as StudentQueueRow[];

    const roster = studentsByClassId[selectedContent.classId] || [];
    const questionIds = selectedContentQuestions.map((q) => q.id);

    const rosterRows: StudentQueueRow[] = roster.map((student) => {
      const key = normalizeStudentKey(student.user_id, student.id, student.student_email);
      const perQuestion = submissionMapByStudent.get(key) || new Map<string, ReviewQueueItem>();
      const answeredItems = questionIds.map((qid) => perQuestion.get(qid)).filter((v): v is ReviewQueueItem => Boolean(v));
      const reviewedCount = answeredItems.filter((item) => isReviewed(item)).length;
      const latestSubmittedAt = answeredItems
        .map((v) => v.submittedAt || "")
        .sort((a, b) => new Date(b || 0).getTime() - new Date(a || 0).getTime())[0];

      return {
        studentId: key || normalizeStudentKey(student.student_email, student.student_name, "unknown"),
        studentName: student.student_name || "Unknown",
        studentEmail: student.student_email || "-",
        photoUrl: student.foto_profil_url || undefined,
        totalQuestions: questionIds.length,
        answeredCount: answeredItems.length,
        unansweredCount: Math.max(0, questionIds.length - answeredItems.length),
        reviewedCount,
        pendingCount: Math.max(0, answeredItems.length - reviewedCount),
        latestSubmittedAt,
      };
    });

    const fallbackOnlyFromSubmissions: StudentQueueRow[] = [];
    if (rosterRows.length === 0) {
      submissionMapByStudent.forEach((perQuestion, studentId) => {
        const sample = [...perQuestion.values()][0];
        const answeredItems = questionIds.map((qid) => perQuestion.get(qid)).filter((v): v is ReviewQueueItem => Boolean(v));
        const reviewedCount = answeredItems.filter((item) => isReviewed(item)).length;
        const latestSubmittedAt = answeredItems
          .map((v) => v.submittedAt || "")
          .sort((a, b) => new Date(b || 0).getTime() - new Date(a || 0).getTime())[0];
        fallbackOnlyFromSubmissions.push({
          studentId,
          studentName: sample?.studentName || "Unknown",
          studentEmail: sample?.studentEmail || "-",
          photoUrl: undefined,
          totalQuestions: questionIds.length,
          answeredCount: answeredItems.length,
          unansweredCount: Math.max(0, questionIds.length - answeredItems.length),
          reviewedCount,
          pendingCount: Math.max(0, answeredItems.length - reviewedCount),
          latestSubmittedAt,
        });
      });
    }

    const rows = (rosterRows.length > 0 ? rosterRows : fallbackOnlyFromSubmissions).filter((row) => {
      if (statusTab === "pending" && row.pendingCount === 0) return false;
      if (statusTab === "reviewed" && !(row.answeredCount > 0 && row.pendingCount === 0)) return false;
      const q = studentQuery.trim().toLowerCase();
      if (!q) return true;
      return row.studentName.toLowerCase().includes(q) || row.studentEmail.toLowerCase().includes(q);
    });

    rows.sort((a, b) => {
      const aTime = new Date(a.latestSubmittedAt || 0).getTime();
      const bTime = new Date(b.latestSubmittedAt || 0).getTime();
      if (sortBy === "oldest") return aTime - bTime;
      return bTime - aTime;
    });

    return rows;
  }, [selectedContent, studentsByClassId, selectedContentQuestions, submissionMapByStudent, statusTab, studentQuery, sortBy]);

  useEffect(() => {
    if (studentRows.length === 0) {
      setSelectedStudentId(null);
      return;
    }
    if (!selectedStudentId || !studentRows.some((s) => s.studentId === selectedStudentId)) {
      setSelectedStudentId(studentRows[0].studentId);
    }
  }, [studentRows, selectedStudentId]);

  const selectedStudentRow = useMemo(
    () => studentRows.find((s) => s.studentId === selectedStudentId) || null,
    [studentRows, selectedStudentId]
  );

  const studentQuestionViews = useMemo(() => {
    if (!selectedStudentRow || !selectedContent) return [] as StudentQuestionView[];
    const perQuestion = submissionMapByStudent.get(selectedStudentRow.studentId) || new Map<string, ReviewQueueItem>();

    return selectedContentQuestions.map((question) => {
      const sub = perQuestion.get(question.id) || null;
      return {
        questionId: question.id,
        questionText: question.teks_soal,
        questionWeight: question.weight,
        questionRubrics: parseRubrics(question.rubrics),
        category: inferQuestionCategory(question.teks_soal, selectedContent.category),
        submission: sub,
      };
    });
  }, [selectedStudentRow, selectedContent, submissionMapByStudent, selectedContentQuestions]);

  useEffect(() => {
    if (studentQuestionViews.length === 0) {
      setSelectedQuestionId(null);
      return;
    }
    if (!selectedQuestionId || !studentQuestionViews.some((q) => q.questionId === selectedQuestionId)) {
      setSelectedQuestionId(studentQuestionViews[0].questionId);
    }
  }, [studentQuestionViews, selectedQuestionId]);

  const selectedQuestionIndex = useMemo(
    () => studentQuestionViews.findIndex((q) => q.questionId === selectedQuestionId),
    [studentQuestionViews, selectedQuestionId]
  );

  const selectedQuestionView = useMemo(
    () => studentQuestionViews.find((q) => q.questionId === selectedQuestionId) || null,
    [studentQuestionViews, selectedQuestionId]
  );
  const hasSubmissionForSelectedQuestion = Boolean(selectedQuestionView?.submission);
  const isTaskMode = selectedContent?.category === "tugas";
  const taskParsedAnswer = useMemo(
    () => parseTaskSubmissionAnswer(selectedQuestionView?.submission?.answerText),
    [selectedQuestionView?.submission?.answerText]
  );

  const rubricCards = useMemo(() => {
    if (!selectedQuestionView) return [] as Array<{ label: string; value: string }>;
    if (selectedQuestionView.submission?.rubricScores && selectedQuestionView.submission.rubricScores.length > 0) {
      return selectedQuestionView.submission.rubricScores.map((aspect) => ({
        label: aspect.aspek,
        value: String(aspect.skor_diperoleh),
      }));
    }
    if (selectedQuestionView.questionRubrics.length > 0) {
      return selectedQuestionView.questionRubrics.map((aspect, idx) => ({
        label: aspect.nama_aspek || aspect.aspek || `Aspek ${idx + 1}`,
        value: "belum dinilai AI",
      }));
    }
    return [];
  }, [selectedQuestionView]);

  useEffect(() => {
    setContentViewIndex(0);
    setReviewViewIndex(0);
  }, [selectedQuestionId]);

  useEffect(() => {
    if (!hasSubmissionForSelectedQuestion) {
      setContentViewIndex(0);
      setReviewViewIndex(0);
    }
  }, [hasSubmissionForSelectedQuestion]);

  const gotoQuestionAt = (idx: number) => {
    const target = studentQuestionViews[idx];
    if (!target) return;
    setSelectedQuestionId(target.questionId);
  };

  useEffect(() => {
    const fetchReview = async () => {
      const submissionId = selectedQuestionView?.submission?.submissionId;
      if (!detailOpen || !submissionId) {
        setReviewId(null);
        setReviewScore("");
        setReviewFeedback("");
        setReviewError(null);
        setReviewSuccess(null);
        return;
      }

      setReviewLoading(true);
      setReviewError(null);
      setReviewSuccess(null);
      try {
        const res = await fetch(`/api/teacher-reviews/submission/${submissionId}`, { credentials: "include" });
        if (res.status === 404) {
          setReviewId(null);
          setReviewScore(selectedQuestionView?.submission?.revisedScore != null ? String(selectedQuestionView.submission.revisedScore) : "");
          setReviewFeedback(selectedQuestionView?.submission?.teacherFeedback || "");
          return;
        }
        if (!res.ok) throw new Error("Gagal memuat review guru.");
        const data = await res.json();
        setReviewId(data?.id || null);
        setReviewScore(data?.revised_score != null ? String(data.revised_score) : "");
        setReviewFeedback(data?.teacher_feedback || "");
      } catch (err: unknown) {
        setReviewError(err instanceof Error ? err.message : "Gagal memuat review guru.");
      } finally {
        setReviewLoading(false);
      }
    };

    fetchReview();
  }, [detailOpen, selectedQuestionView]);

  const handleSaveReview = async () => {
    const submission = selectedQuestionView?.submission;
    if (!submission) {
      setReviewError("Siswa belum menjawab soal ini.");
      return;
    }

    const parsedScore = Number(reviewScore);
    if (!Number.isFinite(parsedScore)) {
      setReviewError("Nilai revisi harus berupa angka.");
      return;
    }

    setSavingReview(true);
    setReviewError(null);
    setReviewSuccess(null);
    try {
      const method = reviewId ? "PUT" : "POST";
      const url = reviewId ? `/api/teacher-reviews/${reviewId}` : "/api/teacher-reviews";
      const body = reviewId
        ? { revised_score: parsedScore, teacher_feedback: reviewFeedback || null }
        : { submission_id: submission.submissionId, revised_score: parsedScore, teacher_feedback: reviewFeedback || null };

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Gagal menyimpan review.");

      const saved = await res.json();
      if (!reviewId && saved?.id) setReviewId(saved.id);

      setItems((prev) =>
        prev.map((row) =>
          row.submissionId === submission.submissionId
            ? { ...row, revisedScore: parsedScore, teacherFeedback: reviewFeedback || undefined }
            : row
        )
      );
      setReviewSuccess("Review tersimpan dan dikembalikan ke siswa.");
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : "Gagal menyimpan review.");
    } finally {
      setSavingReview(false);
    }
  };

  const handleDeleteSubmission = async () => {
    const submission = selectedQuestionView?.submission;
    if (!submission) {
      setReviewError("Submission tidak ditemukan.");
      return;
    }
    const ok = window.confirm("Hapus jawaban/submission siswa ini? Siswa akan bisa input ulang.");
    if (!ok) return;

    setDeletingSubmissionId(submission.submissionId);
    setReviewError(null);
    setReviewSuccess(null);
    try {
      const res = await fetch(`/api/submissions/${submission.submissionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Gagal menghapus submission.");

      setItems((prev) => prev.filter((row) => row.submissionId !== submission.submissionId));
      setReviewId(null);
      setReviewScore("");
      setReviewFeedback("");
      setReviewSuccess("Submission dihapus. Siswa bisa submit ulang.");
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : "Gagal menghapus submission.");
    } finally {
      setDeletingSubmissionId(null);
    }
  };

  const dirtyCellCount = useMemo(
    () => Object.values(quickDirtyByCell).filter(Boolean).length,
    [quickDirtyByCell]
  );

  const spreadsheetCellKeys = useMemo(
    () =>
      studentRows.map((row) =>
        selectedContentQuestions.map((question) => `${row.studentId}__${question.id}`)
      ),
    [studentRows, selectedContentQuestions]
  );

  const saveQuickCellScore = async (submission: ReviewQueueItem, cellKey: string): Promise<boolean> => {
    const fallbackScore =
      submission.revisedScore != null ? String(submission.revisedScore) : submission.aiScore != null ? String(submission.aiScore) : "";
    const raw = (quickScoreByCell[cellKey] ?? fallbackScore).trim();
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      setQuickSaveError("Nilai harus angka 0-100.");
      return false;
    }
    const feedback = (quickFeedbackByCell[cellKey] ?? submission.teacherFeedback ?? "").trim();

    setQuickSavingCell(cellKey);
    setQuickSaveError(null);
    setQuickSaveSuccess(null);
    try {
      const saveRes = await fetch("/api/teacher-reviews/batch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: [
            {
              submission_id: submission.submissionId,
              revised_score: parsed,
              teacher_feedback: feedback || null,
            },
          ],
        }),
      });
      if (!saveRes.ok) throw new Error("Gagal menyimpan nilai cepat.");
      const saveBody = await saveRes.json().catch(() => ({}));
      if (Array.isArray(saveBody?.failed) && saveBody.failed.length > 0) {
        throw new Error(saveBody.failed[0]?.message || "Sebagian update gagal disimpan.");
      }

      setItems((prev) =>
        prev.map((row) =>
          row.submissionId === submission.submissionId
            ? { ...row, revisedScore: parsed, teacherFeedback: feedback || undefined }
            : row
        )
      );
      if (selectedQuestionView?.submission?.submissionId === submission.submissionId) {
        setReviewScore(String(parsed));
        setReviewFeedback(feedback);
      }
      setQuickScoreByCell((prev) => ({ ...prev, [cellKey]: String(parsed) }));
      setQuickFeedbackByCell((prev) => ({ ...prev, [cellKey]: feedback }));
      setQuickDirtyByCell((prev) => ({ ...prev, [cellKey]: false }));
      setQuickSaveSuccess("Nilai dan feedback tersimpan.");
      return true;
    } catch (err: unknown) {
      setQuickSaveError(err instanceof Error ? err.message : "Gagal menyimpan nilai cepat.");
      return false;
    } finally {
      setQuickSavingCell(null);
    }
  };

  const saveSpreadsheetBatch = async () => {
    const dirtyKeys = Object.entries(quickDirtyByCell)
      .filter(([, dirty]) => dirty)
      .map(([key]) => key);
    if (dirtyKeys.length === 0) {
      setQuickSaveError("Belum ada perubahan untuk disimpan.");
      return;
    }

    const updates: Array<{ submission_id: string; revised_score: number; teacher_feedback: string | null }> = [];
    const submissionIdByCellKey: Record<string, string> = {};
    for (const key of dirtyKeys) {
      const [studentId, questionId] = key.split("__");
      const submission = submissionMapByStudent.get(studentId)?.get(questionId);
      if (!submission) continue;
      const fallbackScore =
        submission.revisedScore != null ? String(submission.revisedScore) : submission.aiScore != null ? String(submission.aiScore) : "";
      const rawScore = (quickScoreByCell[key] ?? fallbackScore).trim();
      const parsedScore = Number(rawScore);
      if (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > 100) {
        setQuickSaveError(`Nilai tidak valid pada ${submission.studentName} - ${submission.questionText.slice(0, 20)}.`);
        return;
      }
      const feedback = (quickFeedbackByCell[key] ?? submission.teacherFeedback ?? "").trim();
      updates.push({
        submission_id: submission.submissionId,
        revised_score: parsedScore,
        teacher_feedback: feedback || null,
      });
      submissionIdByCellKey[key] = submission.submissionId;
    }
    if (updates.length === 0) {
      setQuickSaveError("Tidak ada submission valid untuk disimpan.");
      return;
    }

    setQuickSavingBatch(true);
    setQuickSaveError(null);
    setQuickSaveSuccess(null);
    try {
      const res = await fetch("/api/teacher-reviews/batch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan batch review.");
      const body = await res.json().catch(() => ({}));
      const failedBySubmission = new Set<string>(
        Array.isArray(body?.failed) ? body.failed.map((f: { submission_id?: string }) => f?.submission_id || "") : []
      );
      const updateMap = new Map(updates.map((u) => [u.submission_id, u]));

      setItems((prev) =>
        prev.map((row) => {
          const update = updateMap.get(row.submissionId);
          if (!update || failedBySubmission.has(row.submissionId)) return row;
          return {
            ...row,
            revisedScore: update.revised_score,
            teacherFeedback: update.teacher_feedback || undefined,
          };
        })
      );
      setQuickDirtyByCell((prev) => {
        const next = { ...prev };
        Object.entries(submissionIdByCellKey).forEach(([cellKey, submissionId]) => {
          if (!failedBySubmission.has(submissionId)) next[cellKey] = false;
        });
        return next;
      });

      if (failedBySubmission.size > 0) {
        setQuickSaveError(`Sebagian gagal disimpan (${failedBySubmission.size}).`);
      } else {
        setQuickSaveSuccess(`Berhasil menyimpan ${updates.length} review.`);
      }
    } catch (err: unknown) {
      setQuickSaveError(err instanceof Error ? err.message : "Gagal menyimpan batch review.");
    } finally {
      setQuickSavingBatch(false);
    }
  };

  saveSpreadsheetBatchRef.current = saveSpreadsheetBatch;

  useEffect(() => {
    if (reviewViewMode !== "spreadsheet") return;
    if (studentRows.length === 0 || selectedContentQuestions.length === 0) {
      setActiveSpreadsheetCell(null);
      return;
    }
    setActiveSpreadsheetCell((prev) => {
      if (!prev) return { rowIdx: 0, colIdx: 0 };
      const rowIdx = Math.min(Math.max(prev.rowIdx, 0), studentRows.length - 1);
      const colIdx = Math.min(Math.max(prev.colIdx, 0), selectedContentQuestions.length - 1);
      if (rowIdx === prev.rowIdx && colIdx === prev.colIdx) return prev;
      return { rowIdx, colIdx };
    });
  }, [reviewViewMode, studentRows.length, selectedContentQuestions.length]);

  useEffect(() => {
    if (reviewViewMode === "spreadsheet" && detailPanelTab !== "detail") {
      setDetailPanelTab("detail");
    }
  }, [reviewViewMode, detailPanelTab]);

  useEffect(() => {
    if (reviewViewMode !== "spreadsheet" || !activeSpreadsheetCell) return;
    const cellKey = spreadsheetCellKeys[activeSpreadsheetCell.rowIdx]?.[activeSpreadsheetCell.colIdx];
    if (!cellKey) return;
    const cell = spreadsheetCellRefs.current[cellKey];
    if (!cell) return;
    cell.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeSpreadsheetCell, reviewViewMode, spreadsheetCellKeys]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return true;
      return target.isContentEditable;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && reviewViewMode === "spreadsheet") {
        event.preventDefault();
        void saveSpreadsheetBatchRef.current();
        return;
      }
      if (reviewViewMode !== "spreadsheet") return;
      if (!activeSpreadsheetCell) return;
      if (studentRows.length === 0 || selectedContentQuestions.length === 0) return;
      if (isEditableTarget(event.target)) return;

      let nextRow = activeSpreadsheetCell.rowIdx;
      let nextCol = activeSpreadsheetCell.colIdx;

      if (event.key === "ArrowUp") nextRow -= 1;
      else if (event.key === "ArrowDown") nextRow += 1;
      else if (event.key === "ArrowLeft") nextCol -= 1;
      else if (event.key === "ArrowRight") nextCol += 1;
      else if (event.key === "Tab") {
        if (event.shiftKey) {
          nextCol -= 1;
          if (nextCol < 0) {
            nextCol = selectedContentQuestions.length - 1;
            nextRow -= 1;
          }
        } else {
          nextCol += 1;
          if (nextCol >= selectedContentQuestions.length) {
            nextCol = 0;
            nextRow += 1;
          }
        }
      }
      else if (event.key === "Enter") {
        event.preventDefault();
        const cellKey = spreadsheetCellKeys[activeSpreadsheetCell.rowIdx]?.[activeSpreadsheetCell.colIdx];
        if (!cellKey) return;
        const scoreInput = scoreInputRefs.current[cellKey];
        if (scoreInput) {
          scoreInput.focus();
          scoreInput.select();
        } else {
          const row = studentRows[activeSpreadsheetCell.rowIdx];
          const question = selectedContentQuestions[activeSpreadsheetCell.colIdx];
          if (row && question) {
            setSelectedStudentId(row.studentId);
            setSelectedQuestionId(question.id);
            setDetailOpen(true);
          }
        }
        return;
      } else {
        return;
      }

      event.preventDefault();
      nextRow = Math.min(Math.max(nextRow, 0), studentRows.length - 1);
      nextCol = Math.min(Math.max(nextCol, 0), selectedContentQuestions.length - 1);
      setActiveSpreadsheetCell({ rowIdx: nextRow, colIdx: nextCol });
      if (detailOpen) {
        const row = studentRows[nextRow];
        const question = selectedContentQuestions[nextCol];
        if (row && question) {
          setSelectedStudentId(row.studentId);
          setSelectedQuestionId(question.id);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activeSpreadsheetCell,
    detailOpen,
    reviewViewMode,
    studentRows,
    selectedContentQuestions,
    spreadsheetCellKeys,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDetailOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleAppealReview = useCallback(
    async (appeal: GradeAppealRow, status: "in_review" | "resolved_accepted" | "resolved_rejected") => {
      setReviewingAppealId(appeal.id);
      try {
        const responseText = window.prompt(
          status === "resolved_accepted"
            ? "Respons guru untuk menerima banding (wajib):"
            : status === "resolved_rejected"
              ? "Alasan menolak banding (wajib):"
              : "Catatan proses review (opsional):",
          appeal.teacher_response || ""
        );
        if ((status === "resolved_accepted" || status === "resolved_rejected") && (!responseText || !responseText.trim())) {
          return;
        }

        let revisedScore: number | null = null;
        let teacherFeedback: string | null = null;
        if (status === "resolved_accepted") {
          const rawScore = window.prompt(
            "Nilai revisi (opsional, 0-100). Kosongkan jika tidak diubah.",
            appeal.revised_score != null ? String(appeal.revised_score) : ""
          );
          if (rawScore && rawScore.trim()) {
            const parsed = Number(rawScore.trim());
            if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
              window.alert("Nilai revisi harus 0-100.");
              return;
            }
            revisedScore = parsed;
          }
          const rawFeedback = window.prompt("Feedback guru revisi (opsional):", "");
          teacherFeedback = rawFeedback && rawFeedback.trim() ? rawFeedback.trim() : null;
        }

        const payload = JSON.stringify({
          status,
          teacher_response: responseText && responseText.trim() ? responseText.trim() : null,
          revised_score: revisedScore,
          teacher_feedback: teacherFeedback,
        });
        const endpoints = [
          `/api/grade-appeals/${appeal.id}/review`,
          `/api/teacher/grade-appeals/${appeal.id}/review`,
          `/api/teacher/teacher/grade-appeals/${appeal.id}/review`,
        ];
        let reviewed = false;
        let lastError = "Gagal memproses banding.";
        for (const endpoint of endpoints) {
          const res = await fetch(endpoint, {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: payload,
          });
          const body = await res.json().catch(() => ({}));
          if (res.ok) {
            reviewed = true;
            break;
          }
          lastError = body?.message || `Gagal memproses banding (${res.status}).`;
          if (res.status !== 404) break;
        }
        if (!reviewed) throw new Error(lastError);
        await loadAppeals();
      } catch (err: unknown) {
        window.alert(err instanceof Error ? err.message : "Gagal memproses banding.");
      } finally {
        setReviewingAppealId(null);
      }
    },
    [loadAppeals]
  );

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/70 p-4 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:to-slate-800/80">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Penilaian Kelas</h1>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {mainTab === "penilaian"
                ? "Pilih konten, pilih siswa, lalu review jawaban per soal."
                : "Kelola banding nilai siswa dan tindak lanjut review guru."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (mainTab === "banding") {
                void loadAppeals();
              } else {
                void loadQueue(false);
              }
            }}
            className="sage-button-outline !px-3 !py-2 text-xs"
            disabled={mainTab === "banding" ? appealsLoading : refreshing}
          >
            <FiRefreshCw className={mainTab === "banding" ? (appealsLoading ? "animate-spin" : "") : refreshing ? "animate-spin" : ""} />
            {mainTab === "banding" ? (appealsLoading ? "Refreshing..." : "Refresh") : refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => setShowSummaryCards((v) => !v)}
            className="sage-button-outline !px-3 !py-2 text-xs"
          >
            {visibleSummaryCards ? "Hide Ringkasan" : "Show Ringkasan"}
          </button>
        </div>
        <div className="mt-3 inline-flex rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setMainTab("penilaian")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${mainTab === "penilaian" ? "bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900" : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"}`}
          >
            Penilaian
          </button>
          <button
            type="button"
            onClick={() => setMainTab("banding")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${mainTab === "banding" ? "bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900" : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"}`}
          >
            Banding Nilai
          </button>
        </div>
      </div>

      {visibleSummaryCards && (
        <section className="grid gap-2 sm:grid-cols-3">
          <StatCard title="Perlu Dinilai" value={String(summary.pending)} icon={<FiClock className="text-amber-600" />} />
          <StatCard title="Sudah Dinilai" value={String(summary.reviewed)} icon={<FiCheckCircle className="text-emerald-600" />} />
          <StatCard title="Total Submission" value={String(summary.total)} icon={<FiFileText className="text-slate-600" />} />
        </section>
      )}

      {mainTab === "banding" ? (
        <section className="space-y-3">
          <div className="sage-panel p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_220px_180px]">
              <select
                value={appealClassFilter}
                onChange={(e) => setAppealClassFilter(e.target.value)}
                className="sage-input"
              >
                <option value="all">Semua Kelas</option>
                {classOptions.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.class_name}
                  </option>
                ))}
              </select>
              <select
                value={appealStatusFilter}
                onChange={(e) => setAppealStatusFilter(e.target.value as "open" | "in_review" | "resolved_accepted" | "resolved_rejected" | "all")}
                className="sage-input"
              >
                <option value="open">Menunggu Review</option>
                <option value="in_review">Diproses</option>
                <option value="resolved_accepted">Diterima</option>
                <option value="resolved_rejected">Ditolak</option>
                <option value="all">Semua Status</option>
              </select>
              <button type="button" className="sage-button-outline" onClick={() => void loadAppeals()}>
                Muat Ulang Banding
              </button>
            </div>
          </div>

          {appealsLoading ? (
            <div className="sage-panel p-8 text-center text-slate-500">Memuat banding nilai...</div>
          ) : appealsError ? (
            <div className="sage-panel p-6 text-red-600">{appealsError}</div>
          ) : appeals.length === 0 ? (
            <div className="sage-panel p-8 text-center text-slate-500">Belum ada banding nilai pada filter ini.</div>
          ) : (
            <div className="grid gap-3">
              {appeals.map((appeal) => (
                <div key={appeal.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  {(() => {
                    const statusMeta = getAppealStatusMeta(appeal.status);
                    const isBusy = reviewingAppealId === appeal.id;
                    const isResolved = appeal.status === "resolved_accepted" || appeal.status === "resolved_rejected";
                    const isInReview = appeal.status === "in_review";
                    const canMoveToReview = !isBusy && !isResolved && !isInReview;
                    const canResolve = !isBusy && !isResolved;
                    return (
                      <>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{appeal.class_name || "-"}</p>
                      <p className="text-sm font-semibold text-slate-900">{appeal.question_text || "-"}</p>
                      <p className="text-xs text-slate-600">
                        Siswa: {appeal.student_name || "-"} ({appeal.student_email || "-"})
                      </p>
                    </div>
                    <span className={`rounded-md px-2 py-1 text-xs ${statusMeta.cls}`}>{statusMeta.label}</span>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3 text-xs">
                    <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700">Skor AI: {appeal.ai_score ?? "-"}</span>
                    <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700">Skor Guru: {appeal.revised_score ?? "-"}</span>
                    <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700">
                      Diajukan: {appeal.created_at ? new Date(appeal.created_at).toLocaleString("id-ID") : "-"}
                    </span>
                  </div>
                  <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-700 whitespace-pre-line">
                    <span className="font-semibold">Alasan Siswa:</span> {appeal.reason_text}
                  </div>
                  {appeal.teacher_response && (
                    <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-800 whitespace-pre-line">
                      <span className="font-semibold">Respons Guru:</span> {appeal.teacher_response}
                    </div>
                  )}
                  {isResolved && (
                    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-700">
                      Banding ini sudah final. Jika perlu perubahan, gunakan alur banding baru dari siswa.
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!canMoveToReview}
                      onClick={() => void handleAppealReview(appeal, "in_review")}
                      className="sage-button-outline !px-3 !py-1.5 text-xs"
                    >
                      {isBusy ? "Memproses..." : isInReview ? "Sedang Diproses" : "Proses"}
                    </button>
                    <button
                      type="button"
                      disabled={!canResolve}
                      onClick={() => void handleAppealReview(appeal, "resolved_accepted")}
                      className="sage-button !px-3 !py-1.5 text-xs"
                    >
                      {isBusy ? "Menyimpan..." : "Terima Banding"}
                    </button>
                    <button
                      type="button"
                      disabled={!canResolve}
                      onClick={() => void handleAppealReview(appeal, "resolved_rejected")}
                      className="sage-button-outline !px-3 !py-1.5 text-xs text-rose-700"
                    >
                      {isBusy ? "Menyimpan..." : "Tolak Banding"}
                    </button>
                  </div>
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </section>
      ) : loading ? (
        <div className="sage-panel p-10 text-center text-slate-500 dark:text-slate-300">Memuat antrian penilaian...</div>
      ) : error ? (
        <div className="sage-panel p-6 text-red-600">{error}</div>
      ) : (
        <section
          className={`relative grid gap-3 overflow-hidden ${
            sidebarCollapsed ? "lg:grid-cols-[64px_minmax(0,1fr)]" : "lg:grid-cols-[240px_minmax(0,1fr)]"
          }`}
        >
          <aside className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900" style={{ height: `${panelHeightVh}vh` }}>
            <div className="border-b border-slate-200 bg-slate-50/70 p-2.5 dark:border-slate-700 dark:bg-slate-800/80">
              <div className="flex items-center justify-between gap-2">
                {!sidebarCollapsed && <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Daftar Kelas</p>}
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed((prev) => !prev)}
                  className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {sidebarCollapsed ? ">>" : "<<"}
                </button>
              </div>
              {!sidebarCollapsed && (
                <label className="relative mt-2 block">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    value={assignmentQuery}
                    onChange={(e) => setAssignmentQuery(e.target.value)}
                    placeholder="Cari konten..."
                    className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
                  />
                </label>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-1.5">
              {filteredContentCatalogs.length === 0 ? (
                <p className="p-2 text-xs text-slate-500">Belum ada data konten soal/tugas.</p>
              ) : (
                groupedAssignments.map((classGroup) => (
                  <div key={classGroup.key} className="mb-2 rounded-lg border border-slate-200 bg-slate-50/40 p-1.5">
                    {sidebarCollapsed ? (
                      <div className="space-y-1 text-center text-[10px]">
                        <div className="font-semibold text-slate-900">{classGroup.pending}</div>
                        <div className="text-slate-500">pending</div>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setCollapsedClasses((prev) => ({ ...prev, [classGroup.key]: !prev[classGroup.key] }))}
                          className="flex w-full items-center justify-between rounded-md bg-white px-2 py-1.5 text-left"
                        >
                          <div>
                          <p className="text-[11px] font-semibold text-slate-900">{classGroup.className}</p>
                          <p className="text-[10px] text-slate-500">Kelas • {classGroup.total} submission • {classGroup.pending} pending</p>
                          </div>
                          {collapsedClasses[classGroup.key] ? <FiChevronDown size={14} className="text-slate-500" /> : <FiChevronUp size={14} className="text-slate-500" />}
                        </button>

                        {!collapsedClasses[classGroup.key] && <div className="mt-1.5 space-y-1">
                          {classGroup.sections.map((section) => (
                            <div key={section.key} className="rounded-md border border-slate-200 bg-white p-1.5">
                              <button
                                type="button"
                                onClick={() => setCollapsedSections((prev) => ({ ...prev, [section.key]: !prev[section.key] }))}
                                className="flex w-full items-start justify-between text-left"
                              >
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Sub Section</p>
                                  <p className="line-clamp-1 text-[11px] font-medium text-slate-800">{section.materialTitle}</p>
                                  <p className="text-[10px] text-slate-500">
                                    {section.total} submission • {section.pending} pending
                                  </p>
                                </div>
                                {collapsedSections[section.key] ? <FiChevronDown size={14} className="text-slate-500" /> : <FiChevronUp size={14} className="text-slate-500" />}
                              </button>

                              {!collapsedSections[section.key] && <div className="mt-1.5 space-y-1">
                                {section.contents.map((content) => {
                                  const active = selectedAssignmentKey === content.key;
                                  const stats = contentStatsMap.get(content.key);
                                  return (
                                    <button
                                      key={content.key}
                                      type="button"
                                      onClick={() => setSelectedAssignmentKey(content.key)}
                                      className={`w-full rounded-md border px-2 py-1.5 text-left transition ${
                                        active ? "border-slate-700 bg-slate-50" : "border-slate-200 bg-white hover:bg-slate-50"
                                      }`}
                                      title={`${content.className} - ${content.materialTitle} - ${content.contentTitle}`}
                                    >
                                      <p className="text-[10px] text-slate-500">Konten</p>
                                      <p className="line-clamp-1 text-[11px] text-slate-800 inline-flex items-center gap-1.5">
                                        {content.category === "tugas" ? (
                                          <FiClipboard className="text-amber-600" size={12} />
                                        ) : (
                                          <FiFileText className="text-blue-600" size={12} />
                                        )}
                                        {content.category === "tugas" ? "Tugas" : "Soal"} - {content.contentTitle}
                                      </p>
                                      <p className="text-[10px] text-slate-500">
                                        {(stats?.total ?? 0)} submission • {(stats?.pending ?? 0)} pending
                                      </p>
                                    </button>
                                  );
                                })}
                              </div>}
                            </div>
                          ))}
                        </div>}
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </aside>

          <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900" style={{ height: `${panelHeightVh}vh` }}>
            <div className="sticky top-0 z-10 space-y-2 border-b border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-300">Daftar Siswa</p>
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {selectedContent
                      ? `${selectedContent.category === "tugas" ? "Tugas" : "Soal"} • ${selectedContent.contentTitle}`
                      : "Pilih konten"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <TabButton active={reviewViewMode === "list"} onClick={() => setReviewViewMode("list")}>List</TabButton>
                  <TabButton active={reviewViewMode === "spreadsheet"} onClick={() => setReviewViewMode("spreadsheet")}>Spreadsheet</TabButton>
                  {reviewViewMode === "spreadsheet" && (
                    <button
                      type="button"
                      onClick={() => void saveSpreadsheetBatch()}
                      disabled={quickSavingBatch || dirtyCellCount === 0}
                      className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      {quickSavingBatch ? "Menyimpan..." : `Simpan Semua (${dirtyCellCount})`}
                    </button>
                  )}
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as "newest" | "oldest")}
                      className="appearance-none rounded-lg border border-slate-200 bg-white py-1 pl-2.5 pr-8 text-[11px] outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      style={{ appearance: "none", WebkitAppearance: "none", MozAppearance: "none" }}
                    >
                      <option value="newest">Terbaru</option>
                      <option value="oldest">Terlama</option>
                    </select>
                    <FiChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={14} />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  <TabButton active={statusTab === "pending"} onClick={() => setStatusTab("pending")}>Pending</TabButton>
                  <TabButton active={statusTab === "reviewed"} onClick={() => setStatusTab("reviewed")}>Reviewed</TabButton>
                  <TabButton active={statusTab === "all"} onClick={() => setStatusTab("all")}>Semua</TabButton>
                </div>
                <label className="relative block min-w-[220px] flex-1 md:max-w-xs">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={14} />
                  <input
                    value={studentQuery}
                    onChange={(e) => setStudentQuery(e.target.value)}
                    placeholder="Cari siswa..."
                    className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
                  />
                </label>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-1.5">
              {!selectedContent ? (
                <p className="p-2 text-xs text-slate-500">Pilih konten dulu dari panel kiri.</p>
              ) : studentRows.length === 0 ? (
                <p className="p-2 text-xs text-slate-500">Tidak ada siswa pada filter ini.</p>
              ) : reviewViewMode === "spreadsheet" ? (
                <div className="space-y-2">
                  {quickSaveSuccess && (
                    <p className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700">{quickSaveSuccess}</p>
                  )}
                  {quickSaveError && (
                    <p className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">{quickSaveError}</p>
                  )}
                  <div className="overflow-auto rounded-lg border border-slate-200">
                    <table className="min-w-max border-collapse bg-white text-xs">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="sticky left-0 z-20 min-w-[220px] border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-left text-[11px] font-semibold text-slate-700">
                            Siswa
                          </th>
                          {selectedContentQuestions.map((q, idx) => (
                            <th key={q.id} className="w-[260px] min-w-[260px] max-w-[260px] border-b border-r border-slate-200 px-2 py-2 text-left text-[11px] font-semibold text-slate-700">
                              <p className="max-w-[240px] whitespace-normal break-words leading-snug">{`S${idx + 1} - ${q.teks_soal}`}</p>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {studentRows.map((row, rowIdx) => {
                          const perQuestion = submissionMapByStudent.get(row.studentId) || new Map<string, ReviewQueueItem>();
                          return (
                            <tr key={row.studentId} className="align-top">
                              <td className="sticky left-0 z-10 min-w-[220px] border-b border-r border-slate-200 bg-white px-2 py-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedStudentId(row.studentId);
                                    setDetailOpen(true);
                                  }}
                                  className="text-left"
                                >
                                  <p className="font-semibold text-slate-900">{row.studentName}</p>
                                  <p className="text-[11px] text-slate-500">{row.studentEmail}</p>
                                  <p className="mt-1 text-[10px] text-slate-500">{`Submit ${row.answeredCount}/${row.totalQuestions} • Pending ${row.pendingCount}`}</p>
                                </button>
                              </td>
                              {selectedContentQuestions.map((q, colIdx) => {
                                const submission = perQuestion.get(q.id) || null;
                                const cellKey = `${row.studentId}__${q.id}`;
                                const isActiveCell =
                                  activeSpreadsheetCell?.rowIdx === rowIdx &&
                                  activeSpreadsheetCell?.colIdx === colIdx;
                                const status = submission ? getSubmissionStatus(submission) : "missing";
                                const defaultScore =
                                  submission?.revisedScore != null
                                    ? String(submission.revisedScore)
                                    : submission?.aiScore != null
                                      ? String(submission.aiScore)
                                      : "";
                                const scoreValue = quickScoreByCell[cellKey] ?? defaultScore;
                                const defaultFeedback = submission?.teacherFeedback || "";
                                const feedbackValue = quickFeedbackByCell[cellKey] ?? defaultFeedback;
                                const answerPreview = (submission?.answerText || "").replace(/\s+/g, " ").trim().slice(0, 80);
                                return (
                                  <td
                                    key={q.id}
                                    ref={(node) => {
                                      spreadsheetCellRefs.current[cellKey] = node;
                                    }}
                                    onClick={() => {
                                      setActiveSpreadsheetCell({ rowIdx, colIdx });
                                      setSelectedStudentId(row.studentId);
                                      setSelectedQuestionId(q.id);
                                    }}
                                    className={`border-b border-r border-slate-200 px-2 py-2 ${
                                      isActiveCell ? "ring-2 ring-slate-500 ring-inset" : ""
                                    }`}
                                  >
                                    {!submission ? (
                                      <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-500">
                                        Belum submit
                                      </div>
                                    ) : (
                                      <div className="space-y-1.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedStudentId(row.studentId);
                                            setSelectedQuestionId(q.id);
                                            setDetailOpen(true);
                                          }}
                                          className="w-full text-left"
                                        >
                                          <StatusBadge status={status} />
                                          <p className="mt-1 max-w-[236px] whitespace-normal break-words text-[11px] leading-snug text-slate-600">
                                            {answerPreview || "Jawaban kosong"}
                                          </p>
                                        </button>
                                        <div className="flex items-center gap-1.5">
                                          <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            ref={(node) => {
                                              scoreInputRefs.current[cellKey] = node;
                                            }}
                                            value={scoreValue}
                                            onChange={(e) => {
                                              setQuickScoreByCell((prev) => ({ ...prev, [cellKey]: e.target.value }));
                                              setQuickDirtyByCell((prev) => ({ ...prev, [cellKey]: true }));
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter") {
                                                e.preventDefault();
                                                void (async () => {
                                                  const saved = await saveQuickCellScore(submission, cellKey);
                                                  if (!saved) return;
                                                  const nextRow = Math.min(rowIdx + 1, studentRows.length - 1);
                                                  setActiveSpreadsheetCell({ rowIdx: nextRow, colIdx });
                                                  const nextCellKey = spreadsheetCellKeys[nextRow]?.[colIdx];
                                                  if (!nextCellKey) return;
                                                  const nextScoreInput = scoreInputRefs.current[nextCellKey];
                                                  if (nextScoreInput) {
                                                    nextScoreInput.focus();
                                                    nextScoreInput.select();
                                                  }
                                                })();
                                              }
                                            }}
                                            className="w-20 rounded-md border border-slate-200 px-2 py-1 text-[11px] outline-none focus:border-slate-300"
                                            placeholder="0-100"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => void saveQuickCellScore(submission, cellKey)}
                                            disabled={quickSavingCell === cellKey}
                                            className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                          >
                                            {quickSavingCell === cellKey ? "..." : "Simpan"}
                                          </button>
                                        </div>
                                        <input
                                          type="text"
                                          value={feedbackValue}
                                          onChange={(e) => {
                                            setQuickFeedbackByCell((prev) => ({ ...prev, [cellKey]: e.target.value }));
                                            setQuickDirtyByCell((prev) => ({ ...prev, [cellKey]: true }));
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              e.preventDefault();
                                              void (async () => {
                                                const saved = await saveQuickCellScore(submission, cellKey);
                                                if (!saved) return;
                                                const nextRow = Math.min(rowIdx + 1, studentRows.length - 1);
                                                setActiveSpreadsheetCell({ rowIdx: nextRow, colIdx });
                                                const nextCellKey = spreadsheetCellKeys[nextRow]?.[colIdx];
                                                if (!nextCellKey) return;
                                                const nextScoreInput = scoreInputRefs.current[nextCellKey];
                                                if (nextScoreInput) {
                                                  nextScoreInput.focus();
                                                  nextScoreInput.select();
                                                }
                                              })();
                                            }
                                          }}
                                          className="w-full rounded-md border border-slate-200 px-2 py-1 text-[11px] outline-none focus:border-slate-300"
                                          placeholder="Feedback singkat..."
                                        />
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                studentRows.map((row) => {
                  const active = selectedStudentId === row.studentId;
                  const status: "returned" | "turned_in" | "missing" =
                    row.answeredCount === 0 ? "missing" : row.pendingCount > 0 ? "turned_in" : "returned";
                  return (
                    <button
                      key={row.studentId}
                      type="button"
                      onClick={() => {
                        setSelectedStudentId(row.studentId);
                        setDetailOpen(true);
                      }}
                      className={`mb-1.5 w-full rounded-lg border p-2.5 text-left transition ${
                        active ? "border-slate-700 bg-slate-50" : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-2">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 ring-1 ring-slate-200/80">
                            {row.photoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={row.photoUrl} alt={`Foto ${row.studentName}`} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-600">
                                {getInitial(row.studentName)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-900">{row.studentName}</p>
                            <p className="truncate text-[11px] text-slate-500">{row.studentEmail}</p>
                            <p className="text-[11px] text-slate-500">
                              {selectedContent?.category === "tugas" ? "Submit" : "Jawab"}: {row.answeredCount}/{row.totalQuestions} • Pending: {row.pendingCount}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={status} />
                      </div>
                      <div className="mt-2">
                        {row.latestSubmittedAt ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">
                            <FiClock size={11} />
                            Submit:{" "}
                            {new Date(row.latestSubmittedAt).toLocaleString("id-ID", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                            <FiClock size={11} />
                            Belum submit
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {detailOpen && (
            <button
              type="button"
              aria-label="Close detail overlay"
              onClick={() => setDetailOpen(false)}
              className="absolute inset-0 z-20 bg-slate-900/20"
            />
          )}

          <aside
            className={`absolute right-0 top-0 z-30 w-full max-w-[440px] border-l border-slate-200 bg-white shadow-xl transition-transform duration-200 ${
              detailOpen ? "pointer-events-auto translate-x-0" : "pointer-events-none translate-x-full"
            }`}
            style={{ height: `${panelHeightVh}vh` }}
          >
            {detailOpen && reviewViewMode !== "spreadsheet" && (
              <div className="pointer-events-auto absolute -left-[176px] top-3 z-40 w-[166px] rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Detail Submission</p>
                <p className="text-[11px] font-semibold text-slate-900">Review Panel</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <TabButton active={detailPanelTab === "soal"} onClick={() => setDetailPanelTab("soal")}>Soal</TabButton>
                  <TabButton active={detailPanelTab === "detail"} onClick={() => setDetailPanelTab("detail")}>Detail</TabButton>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setDetailOpen(false)}
              className="absolute right-3 top-3 z-40 rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 shadow-sm hover:bg-slate-100"
            >
              <FiX size={16} />
            </button>

            {detailPanelTab === "soal" && !isTaskMode && reviewViewMode !== "spreadsheet" && (
              <div className="border-b border-slate-200 bg-white px-3 py-2">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Navigasi Soal</p>
                  <span className="text-[11px] text-slate-500">
                    {selectedQuestionIndex >= 0 ? selectedQuestionIndex + 1 : 0}/{studentQuestionViews.length}
                  </span>
                </div>
                  <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => gotoQuestionAt(Math.max(0, selectedQuestionIndex - 1))}
                    disabled={selectedQuestionIndex <= 0}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-700 disabled:opacity-40"
                  >
                    <FiChevronsLeft size={14} />
                  </button>
                  <div className="flex items-center gap-1.5">
                    {studentQuestionViews.map((q, idx) => {
                      const active = q.questionId === selectedQuestionId;
                      const answered = Boolean(q.submission);
                      return (
                        <button
                          key={q.questionId}
                          type="button"
                          onClick={() => setSelectedQuestionId(q.questionId)}
                          title={`Soal ${idx + 1} - ${answered ? "Sudah dijawab" : "Belum dijawab"}`}
                          className={`h-2.5 w-2.5 rounded-full border transition ${
                            active
                              ? "border-slate-900 bg-slate-900"
                              : answered
                                ? "border-emerald-500 bg-emerald-400/80 hover:bg-emerald-500"
                                : "border-rose-500 bg-rose-400/80 hover:bg-rose-500"
                          }`}
                        />
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => gotoQuestionAt(Math.min(studentQuestionViews.length - 1, selectedQuestionIndex + 1))}
                    disabled={selectedQuestionIndex < 0 || selectedQuestionIndex >= studentQuestionViews.length - 1}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-700 disabled:opacity-40"
                  >
                    <FiChevronsRight size={14} />
                  </button>
                </div>
              </div>
            )}

            <div
              className="overflow-y-auto p-3"
              style={{ height: detailPanelTab === "soal" && !isTaskMode ? `calc(${panelHeightVh}vh - 48px)` : `${panelHeightVh}vh` }}
            >
              {!selectedStudentRow ? (
                <p className="text-xs text-slate-500">Pilih siswa pada panel tengah untuk melihat detail.</p>
              ) : (
                <div className="space-y-3">
                  {detailPanelTab === "detail" ? (
                    <>
                      <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                        <button
                          type="button"
                          onClick={() => setIdentityCollapsed((v) => !v)}
                          className="flex w-full items-center justify-between p-3 text-left"
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Info Siswa</p>
                          {identityCollapsed ? <FiChevronDown size={14} className="text-slate-500" /> : <FiChevronUp size={14} className="text-slate-500" />}
                        </button>
                        {!identityCollapsed && (
                          <div className="border-t border-slate-200 px-3 py-2.5">
                            <p className="text-xs font-semibold text-slate-900">{selectedStudentRow.studentName}</p>
                            <p className="text-[11px] text-slate-500">{selectedStudentRow.studentEmail}</p>
                            <p className="mt-1 text-[11px] text-slate-600">Jawab {selectedStudentRow.answeredCount}/{selectedStudentRow.totalQuestions}</p>
                          </div>
                        )}
                      </div>

                      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <button
                          type="button"
                          onClick={() => setClassificationCollapsed((v) => !v)}
                          className="flex w-full items-center justify-between p-3 text-left"
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Klasifikasi</p>
                          {classificationCollapsed ? <FiChevronDown size={14} className="text-slate-500" /> : <FiChevronUp size={14} className="text-slate-500" />}
                        </button>
                        {!classificationCollapsed && (
                          <div className="grid grid-cols-2 gap-2 border-t border-slate-200 px-3 py-2.5 text-[11px] text-slate-700">
                            <div>
                              <p className="text-slate-500">Kelas</p>
                              <p className="font-medium">{selectedContent?.className || "-"}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Section</p>
                              <p className="font-medium">{selectedContent?.sectionTitle || "-"}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Konten</p>
                              <p className="font-medium">{selectedContent?.contentTitle || "-"}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Kategori</p>
                              <p className="font-medium">{selectedContent?.category === "tugas" ? "Tugas" : "Soal"}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : !selectedQuestionView ? (
                    <p className="text-xs text-slate-500">Pilih soal untuk melihat detail.</p>
                  ) : isTaskMode ? (
                    <>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Detail Tugas</p>
                        <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-700">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] ${
                                hasSubmissionForSelectedQuestion ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {hasSubmissionForSelectedQuestion ? "Terkumpul" : "Belum Kumpul"}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-600">
                              <FiClock size={11} />
                              {selectedQuestionView.submission?.submittedAt
                                ? `Submit: ${new Date(selectedQuestionView.submission.submittedAt).toLocaleString("id-ID")}`
                                : "Belum submit"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Jawaban Teks Siswa</p>
                        <div className="mt-1 max-h-44 overflow-y-auto whitespace-pre-line rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-700">
                          {(taskParsedAnswer.textAnswer || "").trim() || "Siswa belum mengisi jawaban teks."}
                        </div>
                      </div>

                      {hasSubmissionForSelectedQuestion && (
                        <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                          <p className="text-[11px] uppercase tracking-wide text-slate-500">Lampiran Tugas</p>
                          {taskParsedAnswer.attachmentUrls.length === 0 ? (
                            <p className="mt-1 text-[11px] text-slate-500">Tidak ada lampiran file.</p>
                          ) : (
                            <div className="mt-1 space-y-1.5">
                              {taskParsedAnswer.attachmentUrls.map((url, idx) => (
                                <div key={`${url}-${idx}`} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block text-[11px] text-[color:var(--sage-700)] hover:underline"
                                  >
                                    Lampiran {idx + 1}: {url}
                                  </a>
                                  {getAttachmentKind(url) === "image" && (
                                    <div className="mt-1 overflow-hidden rounded border border-slate-200 bg-white">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={url} alt={`Lampiran ${idx + 1}`} className="max-h-44 w-full object-contain" />
                                    </div>
                                  )}
                                  {getAttachmentKind(url) === "pdf" && (
                                    <div className="mt-1 overflow-hidden rounded border border-slate-200 bg-white">
                                      <iframe title={`Preview PDF ${idx + 1}`} src={url} className="h-44 w-full" />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {hasSubmissionForSelectedQuestion && (
                        <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                          <p className="text-[11px] uppercase tracking-wide text-slate-500">Penilaian Guru</p>
                          {reviewError && <p className="mt-1 text-[11px] text-red-600">{reviewError}</p>}
                          {reviewSuccess && <p className="mt-1 text-[11px] text-emerald-700">{reviewSuccess}</p>}
                          <div className="mt-2 space-y-2">
                            <div>
                              <label className="text-[11px] text-slate-500">Nilai Akhir</label>
                              <input
                                type="number"
                                value={reviewScore}
                                onChange={(e) => setReviewScore(e.target.value)}
                                disabled={reviewLoading || savingReview || !selectedQuestionView.submission}
                                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-slate-300 disabled:opacity-60"
                                placeholder="Masukkan nilai"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-slate-500">Komentar Guru</label>
                              <textarea
                                value={reviewFeedback}
                                onChange={(e) => setReviewFeedback(e.target.value)}
                                disabled={reviewLoading || savingReview || !selectedQuestionView.submission}
                                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-slate-300 disabled:opacity-60"
                                rows={3}
                                placeholder="Tulis feedback untuk siswa"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 pt-2">
                            <button
                              type="button"
                              onClick={handleSaveReview}
                              disabled={savingReview || reviewLoading || deletingSubmissionId === selectedQuestionView?.submission?.submissionId || !selectedQuestionView.submission}
                              className="sage-button !py-2 text-center text-xs disabled:opacity-60"
                            >
                              {reviewLoading ? "Memuat..." : savingReview ? "Menyimpan..." : "Review & Kembalikan"}
                            </button>
                            <button
                              type="button"
                              onClick={handleDeleteSubmission}
                              disabled={savingReview || reviewLoading || deletingSubmissionId === selectedQuestionView?.submission?.submissionId || !selectedQuestionView.submission}
                              className="sage-button-outline !py-2 text-center text-xs text-rose-700 disabled:opacity-60"
                            >
                              {deletingSubmissionId === selectedQuestionView?.submission?.submissionId ? "Menghapus..." : "Hapus Submission"}
                            </button>
                            <Link
                              href={
                                selectedQuestionView.submission
                                  ? `/dashboard/teacher/material/${selectedQuestionView.submission.materialId}`
                                  : selectedContent?.linkedMaterialId
                                    ? `/dashboard/teacher/material/${selectedContent.linkedMaterialId}`
                                    : "#"
                              }
                              className="sage-button-outline !py-2 text-center text-xs"
                            >
                              Buka Materi
                            </Link>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] uppercase tracking-wide text-slate-500">
                            {contentViewIndex === 0 ? "Detail Soal" : "Nilai Rubrik"}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-500">
                              {contentViewIndex + 1}/{hasSubmissionForSelectedQuestion ? 2 : 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => setContentViewIndex(0)}
                              disabled={contentViewIndex === 0}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 disabled:opacity-40"
                            >
                              <FiChevronsLeft size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setContentViewIndex(hasSubmissionForSelectedQuestion ? 1 : 0)}
                              disabled={contentViewIndex === 1 || !hasSubmissionForSelectedQuestion}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 disabled:opacity-40"
                            >
                              <FiChevronsRight size={12} />
                            </button>
                          </div>
                        </div>
                        {contentViewIndex === 0 ? (
                          <div className="mt-2">
                            <div className="max-h-24 overflow-y-auto whitespace-pre-line rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-700">
                              {(selectedQuestionView.questionText || "").trim() || "Teks soal tidak tersedia."}
                            </div>
                            <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-500">Jawaban Siswa</p>
                            <div className="mt-1 max-h-44 overflow-y-auto whitespace-pre-line rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-700">
                              {(selectedQuestionView.submission?.answerText || "").trim() || "Siswa belum menjawab soal ini."}
                            </div>
                          </div>
                        ) : !hasSubmissionForSelectedQuestion ? (
                          <p className="mt-2 text-[11px] text-slate-500">Rubrik disembunyikan karena siswa belum menjawab.</p>
                        ) : rubricCards.length === 0 ? (
                          <p className="mt-2 text-[11px] text-slate-500">Rubrik tidak tersedia.</p>
                        ) : (
                          <div className="mt-2 space-y-1.5">
                            {rubricCards.map((card, idx) => (
                              <div key={`${card.label}-${idx}`} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                                <p className="line-clamp-2 text-[11px] text-slate-700">{card.label}</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">{card.value}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {hasSubmissionForSelectedQuestion && (
                        <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] uppercase tracking-wide text-slate-500">
                              {reviewViewIndex === 0 ? "Review Guru" : "Nilai AI + Feedback AI"}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-slate-500">{reviewViewIndex + 1}/2</span>
                              <button
                                type="button"
                                onClick={() => setReviewViewIndex(0)}
                                disabled={reviewViewIndex === 0}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 disabled:opacity-40"
                              >
                                <FiChevronsLeft size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setReviewViewIndex(1)}
                                disabled={reviewViewIndex === 1}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 disabled:opacity-40"
                              >
                                <FiChevronsRight size={12} />
                              </button>
                            </div>
                          </div>
                          {reviewError && <p className="mt-1 text-[11px] text-red-600">{reviewError}</p>}
                          {reviewSuccess && <p className="mt-1 text-[11px] text-emerald-700">{reviewSuccess}</p>}
                          {reviewViewIndex === 1 ? (
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                <p className="text-[10px] uppercase tracking-wide text-slate-500">Nilai AI</p>
                                <p className="mt-1 text-lg font-semibold text-slate-900">
                                  {selectedQuestionView.submission?.aiScore ?? "-"}
                                </p>
                              </div>
                              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                <p className="text-[10px] uppercase tracking-wide text-slate-500">Feedback AI</p>
                                <p className="mt-1 line-clamp-3 text-[11px] text-slate-700">
                                  {(selectedQuestionView.submission?.aiFeedback || "").trim() || "Belum ada feedback AI."}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="mt-2 space-y-2">
                                <div>
                                  <label className="text-[11px] text-slate-500">Nilai Revisi</label>
                                  <input
                                    type="number"
                                    value={reviewScore}
                                    onChange={(e) => setReviewScore(e.target.value)}
                                    disabled={reviewLoading || savingReview || !selectedQuestionView.submission}
                                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-slate-300 disabled:opacity-60"
                                    placeholder="Masukkan nilai"
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Feedback Guru</label>
                                  <textarea
                                    value={reviewFeedback}
                                    onChange={(e) => setReviewFeedback(e.target.value)}
                                    disabled={reviewLoading || savingReview || !selectedQuestionView.submission}
                                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-slate-300 disabled:opacity-60"
                                    rows={3}
                                    placeholder="Tulis feedback untuk siswa"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-2 pt-2">
                                <button
                                  type="button"
                                  onClick={handleSaveReview}
                                  disabled={savingReview || reviewLoading || deletingSubmissionId === selectedQuestionView?.submission?.submissionId || !selectedQuestionView.submission}
                                  className="sage-button !py-2 text-center text-xs disabled:opacity-60"
                                >
                                  {reviewLoading ? "Memuat..." : savingReview ? "Menyimpan..." : "Review & Kembalikan"}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleDeleteSubmission}
                                  disabled={savingReview || reviewLoading || deletingSubmissionId === selectedQuestionView?.submission?.submissionId || !selectedQuestionView.submission}
                                  className="sage-button-outline !py-2 text-center text-xs text-rose-700 disabled:opacity-60"
                                >
                                  {deletingSubmissionId === selectedQuestionView?.submission?.submissionId ? "Menghapus..." : "Hapus Submission"}
                                </button>
                                <Link
                                  href={
                                    selectedQuestionView.submission
                                      ? `/dashboard/teacher/material/${selectedQuestionView.submission.materialId}`
                                      : selectedContent?.linkedMaterialId
                                        ? `/dashboard/teacher/material/${selectedContent.linkedMaterialId}`
                                        : "#"
                                  }
                                  className="sage-button-outline !py-2 text-center text-xs"
                                >
                                  Buka Materi
                                </Link>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </aside>
        </section>
      )}
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">{title}</p>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: "returned" | "turned_in" | "missing" }) {
  if (status === "returned") {
    return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">Returned</span>;
  }
  if (status === "turned_in") {
    return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">Turned In</span>;
  }
  return <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">Missing</span>;
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[11px] transition ${
        active
          ? "bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900"
          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      }`}
    >
      {children}
    </button>
  );
}
