"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  FiBookOpen,
  FiCheckCircle,
  FiChevronDown,
  FiChevronUp,
  FiClipboard,
  FiClock,
  FiExternalLink,
  FiFileText,
  FiImage,
  FiLayers,
  FiLink,
  FiPaperclip,
  FiSearch,
  FiX,
} from "react-icons/fi";
import TeacherProfileModal from "@/components/TeacherProfileModal";
import SafeHtml from "@/components/ui/SafeHtml";

interface EssayQuestion {
  id: string;
  teks_soal?: string;
  weight?: number;
  submission_id?: string;
  skor_ai?: number;
  umpan_balik_ai?: string;
  revised_score?: number;
  teacher_feedback?: string;
  rubric_scores?: Array<{ aspek?: string; score?: number; skor_diperoleh?: number }>;
  rubrics?: Array<{ nama_aspek: string; descriptors?: Array<{ score: string | number }> | Record<string, unknown> }>;
}

interface EssayRubric {
  nama_aspek: string;
  descriptors?: Array<{ score: string | number }> | Record<string, unknown>;
}

type SectionContentType = "materi" | "soal" | "tugas" | "penilaian" | "gambar" | "video" | "upload";

interface SectionContentCardData {
  id: string;
  type: SectionContentType;
  title: string;
  body: string;
  created_at: string;
  meta?: {
    question_ids?: string[];
    materi_mode?: "singkat" | "lengkap";
    materi_description?: string;
    description?: string;
    tugas_instruction?: string;
    tugas_due_at?: string;
    tugas_max_score?: number;
    tugas_submission_type?: "teks" | "file" | "keduanya";
    tugas_allowed_formats?: string[];
    tugas_max_file_mb?: number;
  };
}

interface Material {
  id: string;
  judul: string;
  display_order?: number;
  material_type?: "materi" | "soal" | "tugas";
  isi_materi?: string;
  capaian_pembelajaran?: string;
  file_url?: string;
  updated_at?: string;
  created_at?: string;
  essay_questions?: EssayQuestion[];
}

interface ClassDetail {
  id: string;
  teacher_id?: string;
  pengajar_id?: string;
  class_name: string;
  teacher_name?: string;
  class_code: string;
  deskripsi: string;
  materials?: Material[];
}

type MaterialFilter = "all" | "pending" | "submitted" | "reviewed";
type MaterialSort = "section_order" | "updated_desc";
type ClassTab = "materi" | "nilai";

interface GradeAppealItem {
  id: string;
  submission_id: string;
  status: "open" | "in_review" | "resolved_accepted" | "resolved_rejected" | "withdrawn";
  reason_text: string;
  teacher_response?: string;
  created_at?: string;
}

type AppealReasonTemplate = {
  id: string;
  label: string;
  reasonType: string;
  reasonText: string;
};

const APPEAL_REASON_TEMPLATES: AppealReasonTemplate[] = [
  {
    id: "rubrik_tidak_sesuai",
    label: "Skor AI tidak sesuai rubrik",
    reasonType: "nilai_tidak_sesuai",
    reasonText: "Skor AI tidak sesuai rubrik pada beberapa aspek penilaian.",
  },
  {
    id: "feedback_tidak_relevan",
    label: "Feedback AI tidak relevan",
    reasonType: "feedback_tidak_relevan",
    reasonText: "Feedback AI tidak relevan dengan jawaban yang saya kirim.",
  },
  {
    id: "penilaian_tidak_konsisten",
    label: "Penilaian tidak konsisten",
    reasonType: "penilaian_tidak_konsisten",
    reasonText: "Penilaian terlihat tidak konsisten dengan kriteria soal.",
  },
  {
    id: "lainnya",
    label: "Lainnya",
    reasonType: "lainnya",
    reasonText: "",
  },
];

const parseSectionContentCards = (raw?: string): SectionContentCardData[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { format?: string; items?: unknown[] };
    if (parsed?.format !== "sage_section_cards_v1" || !Array.isArray(parsed?.items)) return [];
    const cards: SectionContentCardData[] = [];
    for (const item of parsed.items) {
      if (typeof item !== "object" || item === null) continue;
      const row = item as Record<string, unknown>;
      const type = String(row.type || "materi") as SectionContentType;
      if (!["materi", "soal", "tugas", "penilaian", "gambar", "video", "upload"].includes(type)) continue;
      cards.push({
        id: typeof row.id === "string" && row.id ? row.id : `card-${Math.random().toString(36).slice(2, 8)}`,
        type,
        title: typeof row.title === "string" && row.title.trim() ? row.title : "Konten",
        body: typeof row.body === "string" ? row.body : "",
        created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
        meta: typeof row.meta === "object" && row.meta !== null ? (row.meta as SectionContentCardData["meta"]) : undefined,
      });
    }
    return cards;
  } catch {
    return [];
  }
};

const decodeHtmlEntities = (value?: string): string => {
  const input = value || "";
  if (!input) return "";
  if (typeof window === "undefined") return input;
  const textarea = document.createElement("textarea");
  textarea.innerHTML = input;
  return textarea.value;
};

const toPlainText = (value?: string): string =>
  decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const containsHtmlTag = (value?: string): boolean => /<([a-z][\w-]*)\b[^>]*>/i.test(decodeHtmlEntities(value));

const normalizeEmbedUrl = (url: string): string => {
  if (!url) return url;
  const trimmed = url.trim();
  const yShort = trimmed.match(/https?:\/\/youtu\.be\/([\w-]+)/i);
  if (yShort) return `https://www.youtube.com/embed/${yShort[1]}`;
  const yWatch = trimmed.match(/https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([\w-]+)/i);
  if (yWatch) return `https://www.youtube.com/embed/${yWatch[1]}`;
  return trimmed;
};

const parseDueDate = (value?: string): Date | null => {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T23:59:59`);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const getTypeLabel = (type: SectionContentType): string => {
  if (type === "soal") return "Soal";
  if (type === "tugas") return "Tugas";
  if (type === "penilaian") return "Penilaian";
  if (type === "gambar") return "Gambar";
  if (type === "video") return "Video";
  if (type === "upload") return "Dokumen";
  return "Materi";
};

const getTypeTone = (type: SectionContentType): string => {
  if (type === "soal") return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200";
  if (type === "tugas") return "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200";
  if (type === "penilaian") return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200";
  if (type === "gambar" || type === "video" || type === "upload") return "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200";
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200";
};

const getSectionSurfaceTone = (type: "materi" | "soal" | "tugas"): string => {
  if (type === "soal") {
    return "border-blue-200/90 bg-gradient-to-br from-white via-white to-blue-50/70 dark:border-slate-700 dark:bg-slate-900";
  }
  if (type === "tugas") {
    return "border-violet-200/90 bg-gradient-to-br from-white via-white to-violet-50/70 dark:border-slate-700 dark:bg-slate-900";
  }
  return "border-emerald-200/90 bg-gradient-to-br from-white via-white to-emerald-50/70 dark:border-slate-700 dark:bg-slate-900";
};

const getSectionAccentTone = (type: "materi" | "soal" | "tugas"): string => {
  if (type === "soal") return "from-blue-500 to-cyan-400";
  if (type === "tugas") return "from-violet-500 to-fuchsia-400";
  return "from-emerald-500 to-teal-400";
};

const normalizeQuestionIds = (raw: unknown): string[] =>
  Array.isArray(raw)
    ? raw.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];

const getRubricMaxScore = (rubric?: EssayRubric): number => {
  if (!rubric?.descriptors) return 0;
  const entries = Array.isArray(rubric.descriptors)
    ? rubric.descriptors
    : Object.entries(rubric.descriptors).map(([score]) => ({ score }));
  return entries.reduce<number>((max, row) => {
    const value = Number(row.score);
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

const summarizeMaterial = (material: Material, isRead: boolean) => {
  const cards = parseSectionContentCards(material.isi_materi);
  const questionList = Array.isArray(material.essay_questions) ? material.essay_questions : [];
  const questionById = new Map(questionList.map((q) => [q.id, q]));
  const assignmentCards = cards.filter((card) => card.type === "soal" || card.type === "tugas");

  // Card-based progress: hanya hitung assignment yang benar-benar terhubung ke question_ids.
  const assignmentTotal = assignmentCards.length;
  const assignmentCompleted = assignmentCards.filter((card) => {
    const ids = normalizeQuestionIds(card.meta?.question_ids);
    if (ids.length === 0) return false;
    return ids.every((id) => Boolean(questionById.get(id)?.submission_id));
  }).length;
  const assignmentReviewed = assignmentCards.filter((card) => {
    const ids = normalizeQuestionIds(card.meta?.question_ids);
    if (ids.length === 0) return false;
    return ids.every((id) => {
      const q = questionById.get(id);
      return Boolean(q?.submission_id) && (q?.revised_score !== undefined || (q?.teacher_feedback ?? "").trim().length > 0);
    });
  }).length;

  // Fallback untuk data lama yang belum card-based.
  const fallbackTotal = questionList.length;
  const fallbackCompleted = questionList.filter((q) => !!q.submission_id).length;
  const fallbackReviewed = questionList.filter(
    (q) => !!q.submission_id && (q.revised_score !== undefined || (q.teacher_feedback ?? "").trim().length > 0)
  ).length;

  const totalAssignments = assignmentTotal > 0 ? assignmentTotal : fallbackTotal;
  const completedAssignments = assignmentTotal > 0 ? assignmentCompleted : fallbackCompleted;
  const reviewedAssignments = assignmentTotal > 0 ? assignmentReviewed : fallbackReviewed;
  const totalUnits = totalAssignments + 1; // +1 unit untuk aktivitas membaca/membuka materi.
  const completedUnits = completedAssignments + (isRead ? 1 : 0);
  const progress = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;
  const status: "pending" | "submitted" | "no-assignment" =
    totalAssignments === 0
      ? isRead
        ? "submitted"
        : "no-assignment"
      : completedAssignments === totalAssignments && isRead
        ? "submitted"
        : "pending";

  return {
    totalAssignments,
    completedAssignments,
    reviewedAssignments,
    isRead,
    progress,
    status,
  };
};

const resolveTaskQuestionFromCard = (material: Material, card: SectionContentCardData): EssayQuestion | null => {
  const list = Array.isArray(material.essay_questions) ? material.essay_questions : [];
  if (list.length === 0) return null;
  const explicitIds = normalizeQuestionIds(card.meta?.question_ids);
  if (explicitIds.length === 0) return null;
  return list.find((q) => explicitIds.includes(q.id)) || null;
};

export default function StudentClassMaterialsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const classId = params.classId as string;

  const [cls, setCls] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MaterialFilter>("all");
  const [sortBy, setSortBy] = useState<MaterialSort>("section_order");
  const [expandedMaterials, setExpandedMaterials] = useState<Record<string, boolean>>({});
  const [collapsedContentCards, setCollapsedContentCards] = useState<Record<string, boolean>>({});
  const [seenUpdateByMaterial, setSeenUpdateByMaterial] = useState<Record<string, string>>({});
  const [taskAnswerTextByMaterial, setTaskAnswerTextByMaterial] = useState<Record<string, string>>({});
  const [taskVideoUrlByMaterial, setTaskVideoUrlByMaterial] = useState<Record<string, string>>({});
  const [taskEnabledInputsByMaterial, setTaskEnabledInputsByMaterial] = useState<
    Record<string, { text: boolean; video: boolean; file: boolean; image: boolean }>
  >({});
  const [taskAnswerFileUrlByMaterial, setTaskAnswerFileUrlByMaterial] = useState<Record<string, string>>({});
  const [taskAnswerFileNameByMaterial, setTaskAnswerFileNameByMaterial] = useState<Record<string, string>>({});
  const [taskPendingDocByMaterial, setTaskPendingDocByMaterial] = useState<Record<string, File | null>>({});
  const [taskPendingImageByMaterial, setTaskPendingImageByMaterial] = useState<Record<string, File | null>>({});
  const [taskUploadingByMaterial, setTaskUploadingByMaterial] = useState<Record<string, boolean>>({});
  const [taskSubmitLoadingByMaterial, setTaskSubmitLoadingByMaterial] = useState<Record<string, boolean>>({});
  const [taskSubmitMessageByMaterial, setTaskSubmitMessageByMaterial] = useState<Record<string, string>>({});
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ClassTab>("materi");
  const [collapsedGradeSections, setCollapsedGradeSections] = useState<Record<string, boolean>>({});
  const [collapsedGradeContents, setCollapsedGradeContents] = useState<Record<string, boolean>>({});
  const [collapsedGradeQuestions, setCollapsedGradeQuestions] = useState<Record<string, boolean>>({});
  const [gradeAppealsBySubmission, setGradeAppealsBySubmission] = useState<Record<string, GradeAppealItem>>({});
  const [appealDialog, setAppealDialog] = useState<{
    submissionId: string;
    questionTitle: string;
    selectedTemplateId: string;
    customReason: string;
    loading: boolean;
  } | null>(null);

  const fetchClassDetails = useCallback(async () => {
    if (!classId) return;
    try {
      const res = await fetch(`/api/student/classes/${classId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Gagal memuat kelas.");
      const data = await res.json();
      setCls(data);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    void fetchClassDetails();
  }, [fetchClassDetails]);

  useEffect(() => {
    if (!classId) return;
    try {
      const raw = window.localStorage.getItem(`student_material_seen_updates_${classId}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (parsed && typeof parsed === "object") {
        setSeenUpdateByMaterial(parsed);
      }
    } catch {
      setSeenUpdateByMaterial({});
    }
  }, [classId]);

  useEffect(() => {
    const tab = (searchParams.get("tab") || "").toLowerCase();
    setActiveTab(tab === "nilai" ? "nilai" : "materi");
  }, [searchParams]);

  const loadMyAppeals = useCallback(async () => {
    if (!classId) return;
    try {
      const res = await fetch(`/api/grade-appeals/mine?class_id=${encodeURIComponent(classId)}`, { credentials: "include" });
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
      setGradeAppealsBySubmission(next);
    } catch {
      // ignore load appeal error
    }
  }, [classId]);

  useEffect(() => {
    void loadMyAppeals();
  }, [loadMyAppeals]);

  const closeAppealDialog = () => {
    setAppealDialog((prev) => {
      if (!prev || prev.loading) return prev;
      return null;
    });
  };

  const submitAppealDialog = useCallback(async () => {
    if (!appealDialog || appealDialog.loading) return;
    const selectedTemplate = APPEAL_REASON_TEMPLATES.find((t) => t.id === appealDialog.selectedTemplateId) || APPEAL_REASON_TEMPLATES[0];
    const reasonText =
      selectedTemplate.id === "lainnya" ? appealDialog.customReason.trim() : selectedTemplate.reasonText.trim();

    if (!reasonText || reasonText.length < 10) {
      window.alert("Alasan banding minimal 10 karakter agar guru bisa menindaklanjuti.");
      return;
    }

    try {
      setAppealDialog((prev) => (prev ? { ...prev, loading: true } : prev));
      const res = await fetch("/api/grade-appeals", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_id: appealDialog.submissionId,
          reason_type: selectedTemplate.reasonType,
          reason_text: reasonText,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(body?.message || "Gagal mengajukan banding.");
        setAppealDialog((prev) => (prev ? { ...prev, loading: false } : prev));
        return;
      }
      window.alert("Banding nilai berhasil diajukan ke guru.");
      setAppealDialog(null);
      await loadMyAppeals();
    } catch {
      window.alert("Terjadi kesalahan saat mengajukan banding.");
      setAppealDialog((prev) => (prev ? { ...prev, loading: false } : prev));
    }
  }, [appealDialog, loadMyAppeals]);

  const materialUpdateSignature = (material: Material): string => material.updated_at || material.created_at || "";
  const isMaterialRead = (material: Material): boolean => {
    const signature = materialUpdateSignature(material);
    if (!signature) return false;
    return seenUpdateByMaterial[material.id] === signature;
  };

  const markMaterialSeen = (material: Material) => {
    const signature = materialUpdateSignature(material);
    if (!signature) return;
    setSeenUpdateByMaterial((prev) => {
      const next = { ...prev, [material.id]: signature };
      try {
        window.localStorage.setItem(`student_material_seen_updates_${classId}`, JSON.stringify(next));
      } catch {
        // ignore write failure
      }
      return next;
    });
  };

  const appendTaskText = (materialId: string, snippet: string) => {
    const clean = snippet.trim();
    if (!clean) return;
    setTaskAnswerTextByMaterial((prev) => {
      const current = (prev[materialId] || "").trimEnd();
      return { ...prev, [materialId]: current ? `${current}\n\n${clean}` : clean };
    });
  };

  const handlePickTaskAsset = (materialId: string, file: File | null, kind: "document" | "image") => {
    if (kind === "image") {
      setTaskPendingImageByMaterial((prev) => ({ ...prev, [materialId]: file }));
      return;
    }
    setTaskPendingDocByMaterial((prev) => ({ ...prev, [materialId]: file }));
    setTaskAnswerFileNameByMaterial((prev) => ({ ...prev, [materialId]: file?.name || "" }));
  };

  const toggleTaskInput = (
    materialId: string,
    key: "text" | "video" | "file" | "image",
    allowed: boolean
  ) => {
    if (!allowed) return;
    setTaskEnabledInputsByMaterial((prev) => {
      const current = prev[materialId] || { text: false, video: false, file: false, image: false };
      return { ...prev, [materialId]: { ...current, [key]: !current[key] } };
    });
  };

  const handleUploadTaskAssetInline = async (material: Material, card: SectionContentCardData, kind: "document" | "image") => {
    const materialId = material.id;
    const submissionType = card.meta?.tugas_submission_type || "teks";
    const allowsFile = submissionType !== "teks";
    const allowsImageInline = submissionType !== "file";
    if (kind === "document" && !allowsFile) {
      setTaskSubmitMessageByMaterial((prev) => ({ ...prev, [materialId]: "Tugas ini tidak menerima upload dokumen." }));
      return;
    }
    if (kind === "image" && !allowsImageInline) {
      setTaskSubmitMessageByMaterial((prev) => ({ ...prev, [materialId]: "Tugas ini hanya menerima jawaban teks." }));
      return;
    }
    const pendingFile = kind === "image" ? taskPendingImageByMaterial[materialId] : taskPendingDocByMaterial[materialId];
    if (!pendingFile) return;

    const maxFileMb = typeof card.meta?.tugas_max_file_mb === "number" ? card.meta.tugas_max_file_mb : 10;
    if (pendingFile.size > maxFileMb * 1024 * 1024) {
      setTaskSubmitMessageByMaterial((prev) => ({ ...prev, [materialId]: `Ukuran file melebihi ${maxFileMb} MB.` }));
      return;
    }
    if (kind === "image" && !pendingFile.type.startsWith("image/")) {
      setTaskSubmitMessageByMaterial((prev) => ({ ...prev, [materialId]: "File gambar harus berformat image." }));
      return;
    }
    if (kind === "document") {
      const allowed = Array.isArray(card.meta?.tugas_allowed_formats) ? card.meta.tugas_allowed_formats : [];
      if (allowed.length > 0) {
        const ext = (pendingFile.name.split(".").pop() || "").toLowerCase();
        if (ext && !allowed.map((x) => x.toLowerCase()).includes(ext)) {
          setTaskSubmitMessageByMaterial((prev) => ({ ...prev, [materialId]: `Format file tidak diizinkan. Gunakan: ${allowed.join(", ")}` }));
          return;
        }
      }
    }

    setTaskUploadingByMaterial((prev) => ({ ...prev, [materialId]: true }));
    try {
      const formData = new FormData();
      formData.append("file", pendingFile);
      const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: formData });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Gagal upload file.");
      const filePath = typeof body?.filePath === "string" ? body.filePath : "";
      if (!filePath) throw new Error("Respons upload tidak valid.");

      if (kind === "image") {
        appendTaskText(materialId, `[Gambar] ${filePath}`);
        setTaskPendingImageByMaterial((prev) => ({ ...prev, [materialId]: null }));
        setTaskSubmitMessageByMaterial((prev) => ({ ...prev, [materialId]: "Gambar ditambahkan ke jawaban." }));
      } else {
        setTaskAnswerFileUrlByMaterial((prev) => ({ ...prev, [materialId]: filePath }));
        setTaskPendingDocByMaterial((prev) => ({ ...prev, [materialId]: null }));
        appendTaskText(materialId, `[Dokumen] ${filePath}`);
        setTaskSubmitMessageByMaterial((prev) => ({ ...prev, [materialId]: "Dokumen berhasil diupload." }));
      }
    } catch (err: any) {
      setTaskSubmitMessageByMaterial((prev) => ({ ...prev, [materialId]: err?.message || "Gagal upload file." }));
    } finally {
      setTaskUploadingByMaterial((prev) => ({ ...prev, [materialId]: false }));
    }
  };

  const handleInsertTaskVideoLink = (materialId: string) => {
    const url = (taskVideoUrlByMaterial[materialId] || "").trim();
    if (!url) {
      setTaskSubmitMessageByMaterial((prev) => ({ ...prev, [materialId]: "Masukkan link terlebih dahulu." }));
      return;
    }
    appendTaskText(materialId, `[Link] ${url}`);
    setTaskVideoUrlByMaterial((prev) => ({ ...prev, [materialId]: "" }));
    setTaskSubmitMessageByMaterial((prev) => ({ ...prev, [materialId]: "Link ditambahkan ke jawaban." }));
  };

  const handleSubmitTaskInline = async (material: Material, card: SectionContentCardData) => {
    const materialId = material.id;
    const taskQuestion = resolveTaskQuestionFromCard(material, card);
    const taskQuestionId = taskQuestion?.id || "";
    if (!taskQuestionId) {
      setTaskSubmitMessageByMaterial((prev) => ({ ...prev, [materialId]: "Soal tugas belum tersedia." }));
      return;
    }

    const submissionType = card.meta?.tugas_submission_type || "teks";
    const requiresBoth = submissionType === "keduanya";
    const allowsText = submissionType !== "file";
    const allowsFile = submissionType !== "teks";

    const text = (taskAnswerTextByMaterial[materialId] || "").trim();
    const file = (taskAnswerFileUrlByMaterial[materialId] || "").trim();
    const hasText = Boolean(text);
    const hasFile = Boolean(file);

    if (requiresBoth && (!hasText || !hasFile)) {
      setTaskSubmitMessageByMaterial((prev) => ({ ...prev, [materialId]: "Tugas ini wajib mengisi jawaban dan upload file." }));
      return;
    }
    if (!requiresBoth && allowsText && !allowsFile && !hasText) {
      setTaskSubmitMessageByMaterial((prev) => ({ ...prev, [materialId]: "Tugas ini wajib mengisi jawaban teks." }));
      return;
    }
    if (!requiresBoth && allowsFile && !allowsText && !hasFile) {
      setTaskSubmitMessageByMaterial((prev) => ({ ...prev, [materialId]: "Tugas ini wajib upload file." }));
      return;
    }
    if (!hasText && !hasFile) {
      setTaskSubmitMessageByMaterial((prev) => ({ ...prev, [materialId]: "Isi jawaban atau upload file terlebih dahulu." }));
      return;
    }

    const payloadLines = [text ? `Jawaban Teks:\n${text}` : "", file ? `File Jawaban:\n${file}` : ""].filter(Boolean);
    const finalAnswer = payloadLines.join("\n\n");

    setTaskSubmitLoadingByMaterial((prev) => ({ ...prev, [materialId]: true }));
    setTaskSubmitMessageByMaterial((prev) => ({ ...prev, [materialId]: "" }));
    try {
      const res = await fetch("/api/task-submissions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: taskQuestionId, teks_jawaban: finalAnswer }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Gagal mengirim tugas.");
      setTaskSubmitMessageByMaterial((prev) => ({ ...prev, [materialId]: body?.grading_message || "Tugas berhasil dikirim." }));
      await fetchClassDetails();
    } catch (err: any) {
      setTaskSubmitMessageByMaterial((prev) => ({ ...prev, [materialId]: err?.message || "Terjadi kesalahan saat submit tugas." }));
    } finally {
      setTaskSubmitLoadingByMaterial((prev) => ({ ...prev, [materialId]: false }));
    }
  };

  const materials = cls?.materials ?? [];

  const filteredMaterials = useMemo(() => {
    const sorted = [...materials].sort((a, b) => {
      if (sortBy === "updated_desc") {
        const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
        const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
        return bTime - aTime;
      }
      const aOrder = typeof a.display_order === "number" ? a.display_order : Number.MAX_SAFE_INTEGER;
      const bOrder = typeof b.display_order === "number" ? b.display_order : Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return aTime - bTime;
    });

    return sorted.filter((material) => {
      const summary = summarizeMaterial(material, isMaterialRead(material));
      const matchQuery = material.judul.toLowerCase().includes(query.trim().toLowerCase());
      const matchFilter =
        filter === "all" ||
        (filter === "pending" && summary.status === "pending") ||
        (filter === "submitted" && summary.status === "submitted") ||
        (filter === "reviewed" && summary.reviewedAssignments > 0);
      return matchQuery && matchFilter;
    });
  }, [materials, query, filter, sortBy, seenUpdateByMaterial]);

  useEffect(() => {
    setExpandedMaterials((prev) => {
      const next: Record<string, boolean> = {};
      filteredMaterials.forEach((material, idx) => {
        next[material.id] = typeof prev[material.id] === "boolean" ? prev[material.id] : idx === 0;
      });
      return next;
    });
  }, [filteredMaterials]);

  const submittedMaterials = materials.filter((m) => summarizeMaterial(m, isMaterialRead(m)).status === "submitted").length;
  const reviewedMaterials = materials.filter((m) => summarizeMaterial(m, isMaterialRead(m)).reviewedAssignments > 0).length;
  const pendingMaterials = materials.filter((m) => summarizeMaterial(m, isMaterialRead(m)).status === "pending").length;
  const gradeOverview = useMemo(() => {
    const sectionRows = materials.map((material, index) => {
      const cards = parseSectionContentCards(material.isi_materi);
      const questionList = Array.isArray(material.essay_questions) ? material.essay_questions : [];
      const questionById = new Map(questionList.map((q) => [q.id, q]));
      const contentRows = cards
        .filter((card) => card.type === "soal" || card.type === "tugas")
        .map((card, cardIndex) => {
          const explicitIds = normalizeQuestionIds(card.meta?.question_ids);
          const relatedQuestions =
            explicitIds.length > 0
              ? explicitIds.map((id) => questionById.get(id)).filter((q): q is EssayQuestion => Boolean(q))
              : questionList.length === 1
                ? [questionList[0]]
                : [];
          const submittedByCard = relatedQuestions.filter((q) => Boolean(q.submission_id)).length;
          const finalScores = relatedQuestions
            .map((q) => {
              const value = q.revised_score ?? q.skor_ai;
              return typeof value === "number" ? Number(value) : null;
            })
            .filter((v): v is number => v !== null);
          const aiScores = relatedQuestions
            .map((q) => (typeof q.skor_ai === "number" ? Number(q.skor_ai) : null))
            .filter((v): v is number => v !== null);
          const teacherScores = relatedQuestions
            .map((q) => (typeof q.revised_score === "number" ? Number(q.revised_score) : null))
            .filter((v): v is number => v !== null);
          const feedbackTexts = relatedQuestions.map((q) => String(q.teacher_feedback || "").trim()).filter((v) => v.length > 0);
          const aiFeedbackTexts = relatedQuestions.map((q) => String(q.umpan_balik_ai || "").trim()).filter((v) => v.length > 0);
          const questionItems = relatedQuestions.map((q, idx) => {
            const finalScore = typeof (q.revised_score ?? q.skor_ai) === "number" ? Number(q.revised_score ?? q.skor_ai) : null;
            const status: "belum_submit" | "menunggu_review" | "sudah_dinilai" =
              !q.submission_id
                ? "belum_submit"
                : typeof q.revised_score === "number" || String(q.teacher_feedback || "").trim().length > 0
                  ? "sudah_dinilai"
                  : "menunggu_review";
            const rubricRows = getRubricScoreEntries(q);
            return {
              id: q.id,
              title: (q.teks_soal || "").trim() || `Soal ${idx + 1}`,
              submissionId: q.submission_id || "",
              finalScore,
              aiScore: typeof q.skor_ai === "number" ? Number(q.skor_ai) : null,
              teacherScore: typeof q.revised_score === "number" ? Number(q.revised_score) : null,
              rubricRows,
              aiFeedback: String(q.umpan_balik_ai || "").trim(),
              teacherFeedback: String(q.teacher_feedback || "").trim(),
              status,
            };
          });
          const averageByCard =
            finalScores.length > 0 ? Math.round(finalScores.reduce((sum, value) => sum + value, 0) / finalScores.length) : null;
          const aiAverage = aiScores.length > 0 ? Math.round(aiScores.reduce((sum, value) => sum + value, 0) / aiScores.length) : null;
          const teacherAverage =
            teacherScores.length > 0 ? Math.round(teacherScores.reduce((sum, value) => sum + value, 0) / teacherScores.length) : null;
          const cardStatus: "belum_submit" | "menunggu_review" | "sudah_dinilai" =
            submittedByCard === 0
              ? "belum_submit"
              : teacherScores.length > 0 || feedbackTexts.length > 0
                ? "sudah_dinilai"
                : "menunggu_review";
          return {
            id: card.id,
            order: cardIndex + 1,
            type: card.type,
            title: card.title || `Konten ${cardIndex + 1}`,
            submittedCount: submittedByCard,
            totalQuestions: relatedQuestions.length,
            gradedCount: teacherScores.length,
            averageScore: averageByCard,
            aiAverageScore: aiAverage,
            teacherAverageScore: teacherAverage,
            feedback: feedbackTexts[0] || "",
            aiFeedback: aiFeedbackTexts[0] || "",
            questionItems,
            status: cardStatus,
          };
        });
      const submittedCount = questionList.filter((q) => Boolean(q.submission_id)).length;
      const gradedQuestions = questionList.filter((q) => typeof q.revised_score === "number");
      const feedbackCount = questionList.filter((q) => String(q.teacher_feedback || "").trim().length > 0).length;
      const finalScoresBySection = questionList
        .map((q) => {
          const value = q.revised_score ?? q.skor_ai;
          return typeof value === "number" ? Number(value) : null;
        })
        .filter((v): v is number => v !== null);
      const averageScore =
        finalScoresBySection.length > 0
          ? Math.round(finalScoresBySection.reduce((sum, q) => sum + q, 0) / finalScoresBySection.length)
          : null;
      const status: "belum_submit" | "menunggu_review" | "sudah_dinilai" =
        submittedCount === 0 ? "belum_submit" : gradedQuestions.length > 0 || feedbackCount > 0 ? "sudah_dinilai" : "menunggu_review";
      const summary = summarizeMaterial(material, isMaterialRead(material));
      return {
        id: material.id,
        title: material.judul || `Section ${index + 1}`,
        sectionNo: index + 1,
        submittedCount,
        totalQuestions: questionList.length,
        gradedCount: gradedQuestions.length,
        feedbackCount,
        averageScore,
        status,
        progress: summary.progress,
        contents: contentRows,
      };
    });

    const allQuestions = materials.flatMap((m) => (Array.isArray(m.essay_questions) ? m.essay_questions : []));
    const graded = allQuestions.filter((q) => typeof q.revised_score === "number");
    const finalScored = allQuestions.filter((q) => typeof (q.revised_score ?? q.skor_ai) === "number");
    const reviewed = allQuestions.filter(
      (q) => typeof q.revised_score === "number" || String(q.teacher_feedback || "").trim().length > 0
    );
    const submitted = allQuestions.filter((q) => Boolean(q.submission_id));
    const classAvg =
      finalScored.length > 0
        ? Math.round(
            finalScored.reduce((sum, q) => sum + Number((q.revised_score ?? q.skor_ai) || 0), 0) / finalScored.length
          )
        : null;

    return {
      rows: sectionRows,
      totalQuestions: allQuestions.length,
      submittedCount: submitted.length,
      gradedCount: graded.length,
      reviewedCount: reviewed.length,
      classAverage: classAvg,
    };
  }, [materials, seenUpdateByMaterial]);

  useEffect(() => {
    setCollapsedGradeSections((prev) => {
      const next: Record<string, boolean> = {};
      gradeOverview.rows.forEach((row) => {
        next[row.id] = typeof prev[row.id] === "boolean" ? prev[row.id] : false;
      });
      return next;
    });
    setCollapsedGradeContents((prev) => {
      const next: Record<string, boolean> = {};
      gradeOverview.rows.forEach((row) => {
        row.contents.forEach((content: { id: string }) => {
          const key = `${row.id}:${content.id}`;
          next[key] = typeof prev[key] === "boolean" ? prev[key] : false;
        });
      });
      return next;
    });
    setCollapsedGradeQuestions((prev) => {
      const next: Record<string, boolean> = {};
      gradeOverview.rows.forEach((row) => {
        row.contents.forEach((content: { id: string; questionItems?: Array<{ id: string }> }) => {
          (content.questionItems || []).forEach((item) => {
            const key = `${row.id}:${content.id}:${item.id}`;
            next[key] = typeof prev[key] === "boolean" ? prev[key] : true;
          });
        });
      });
      return next;
    });
  }, [gradeOverview.rows]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-[color:var(--ink-500)]">Loading...</div>;
  }

  if (error) {
    return <div className="sage-panel p-6 text-red-500">{error}</div>;
  }

  if (!cls) return null;

  return (
    <div className="student-class-view space-y-6">
      <section className="sage-panel p-6">
        <Link href="/dashboard/student/my-classes" className="text-sm text-[color:var(--sage-700)] hover:underline">
          ← Kembali ke kelas saya
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl text-[color:var(--ink-900)]">{cls.class_name}</h1>
            <p className="text-[color:var(--ink-500)] mt-1">{cls.deskripsi}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-[color:var(--ink-600)]">
          <span className="sage-pill">Kode: {cls.class_code}</span>
          <span className="sage-pill">
            Guru:{" "}
            <button
              type="button"
              onClick={() => setProfileModalOpen(true)}
              className="text-[color:var(--sage-700)] hover:underline"
            >
              {cls.teacher_name || "-"}
            </button>
          </span>
          <span className="sage-pill">{materials.length} Section</span>
          <span className="sage-pill">{submittedMaterials} Materi Selesai</span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-300 bg-gradient-to-br from-white to-slate-50 px-3 py-2 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:to-slate-800">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Perlu Dikerjakan</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{pendingMaterials}</p>
          </div>
          <div className="rounded-lg border border-slate-300 bg-gradient-to-br from-white to-slate-50 px-3 py-2 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:to-slate-800">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Sudah Selesai</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{submittedMaterials}</p>
          </div>
          <div className="rounded-lg border border-slate-300 bg-gradient-to-br from-white to-slate-50 px-3 py-2 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:to-slate-800">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Sudah Direview</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{reviewedMaterials}</p>
          </div>
        </div>
        <div className="mt-4 inline-flex rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setActiveTab("materi")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              activeTab === "materi" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Materi
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("nilai")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              activeTab === "nilai" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Nilai & Feedback
          </button>
        </div>
      </section>

      {activeTab === "materi" && (
        <>
      <section className="sage-panel sticky top-16 z-20 border border-slate-300/90 bg-white/95 p-4 backdrop-blur">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="relative block">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-500)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari section/materi..."
              className="sage-input pl-10"
            />
          </label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as MaterialSort)} className="sage-input min-w-44">
            <option value="section_order">Urutan Section</option>
            <option value="updated_desc">Update Terbaru</option>
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { id: "all", label: "Semua" },
            { id: "pending", label: "Perlu Dikerjakan" },
            { id: "submitted", label: "Sudah Selesai" },
            { id: "reviewed", label: "Sudah Direview" },
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFilter(chip.id as MaterialFilter)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === chip.id ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-5">
        {filteredMaterials.length === 0 && (
          <div className="sage-panel p-8 text-center text-[color:var(--ink-500)]">Tidak ada materi sesuai filter.</div>
        )}

        {filteredMaterials.map((material, index) => {
          const summary = summarizeMaterial(material, isMaterialRead(material));
          const cards = parseSectionContentCards(material.isi_materi);
          const sectionCardKeys = cards.map((card) => `${material.id}:${card.id}`);
          const updateSignature = materialUpdateSignature(material);
          const hasUnreadUpdate = Boolean(updateSignature && seenUpdateByMaterial[material.id] !== updateSignature);
          const isExpanded = !!expandedMaterials[material.id];
          const statusLabel =
            summary.status === "submitted"
              ? "Selesai"
              : summary.status === "pending"
                ? "Belum Selesai"
                : "Tanpa Tugas";
          const statusTone =
            summary.status === "submitted"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
              : summary.status === "pending"
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
                : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200";
          const type = (material.material_type || "materi") as "materi" | "soal" | "tugas";
          const typeIcon =
            type === "soal" ? <FiFileText size={16} className="text-blue-600" /> : type === "tugas" ? <FiClipboard size={16} className="text-purple-600" /> : <FiBookOpen size={16} className="text-emerald-600" />;

          const briefDescription =
            cards.length > 0
              ? `Berisi ${cards.length} konten section.`
              : toPlainText(material.capaian_pembelajaran || material.isi_materi || "") || "Deskripsi materi belum tersedia.";

          return (
            <div
              key={material.id}
              className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-[1px] hover:shadow-md sm:p-5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/30"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-slate-300 bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
                      Section {index + 1}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${type === "soal" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200" : type === "tugas" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"}`}
                    >
                      {type === "soal" ? "Soal" : type === "tugas" ? "Tugas" : "Materi"}
                    </span>
                    {hasUnreadUpdate && <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" title="Ada update materi" />}
                  </div>
                  <h2 className="inline-flex items-start gap-2 text-lg font-semibold text-[color:var(--ink-900)]">
                    {typeIcon}
                    <span className="line-clamp-2">{material.judul}</span>
                  </h2>
                  <p className="line-clamp-2 max-w-3xl text-sm leading-relaxed text-[color:var(--ink-600)]">{briefDescription}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[color:var(--ink-600)]">
                    <span>{summary.completedAssignments}/{summary.totalAssignments} aktivitas</span>
                    <span>{summary.reviewedAssignments}/{summary.totalAssignments} direview</span>
                    <span>{cards.length} konten</span>
                    <span>{summary.isRead ? "Materi dibaca" : "Belum dibaca"}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTone}`}>{statusLabel}</span>
                    <span className="font-semibold text-[color:var(--ink-800)]">Progress {summary.progress}%</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 h-2 rounded-full bg-[color:var(--sand-100)] overflow-hidden">
                <div className="h-full bg-[color:var(--sage-700)]" style={{ width: `${summary.progress}%` }} />
              </div>

              <div className="mt-4 p-0">
                <div className="w-full inline-flex items-center justify-between text-sm text-[color:var(--ink-700)]">
                  <button
                    type="button"
                    className="text-left font-medium hover:underline"
                    onClick={() => {
                      setExpandedMaterials((prev) => ({ ...prev, [material.id]: !prev[material.id] }));
                      markMaterialSeen(material);
                    }}
                  >
                    Lihat konten section
                  </button>
                  <div className="inline-flex items-center gap-2">
                    {cards.length > 0 && (
                      <>
                        <button
                          type="button"
                          className="sage-button-outline !px-3 !py-1 text-xs"
                          onClick={() =>
                            setCollapsedContentCards((prev) => {
                              const next = { ...prev };
                              sectionCardKeys.forEach((key) => {
                                next[key] = false;
                              });
                              return next;
                            })
                          }
                        >
                          Buka Semua
                        </button>
                        <button
                          type="button"
                          className="sage-button-outline !px-3 !py-1 text-xs"
                          onClick={() =>
                            setCollapsedContentCards((prev) => {
                              const next = { ...prev };
                              sectionCardKeys.forEach((key) => {
                                next[key] = true;
                              });
                              return next;
                            })
                          }
                        >
                          Tutup Semua
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedMaterials((prev) => ({ ...prev, [material.id]: !prev[material.id] }));
                        markMaterialSeen(material);
                      }}
                      className="inline-flex items-center justify-center rounded-md p-1 hover:bg-slate-200"
                      aria-label={isExpanded ? "Tutup konten section" : "Buka konten section"}
                    >
                      {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 space-y-3">
                    {cards.length === 0 && (
                      <div className="rounded-md border border-slate-200 bg-white p-3 text-sm text-[color:var(--ink-600)] whitespace-pre-line">
                        {toPlainText(material.capaian_pembelajaran || material.isi_materi || "") || "Konten section belum tersedia."}
                        <div className="mt-3">
                          <Link
                            href={`/dashboard/student/classes/${classId}/materials/${material.id}`}
                            className="sage-button-outline !px-3 !py-1.5 text-xs inline-flex items-center gap-1"
                            onClick={() => markMaterialSeen(material)}
                          >
                            <FiExternalLink size={12} />
                            Masuk ke Materi
                          </Link>
                        </div>
                      </div>
                    )}

                    {cards.length > 0 && (
                      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm divide-y divide-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:divide-slate-700 dark:shadow-black/20">
                    {cards.map((card, cardIndex) => {
                      const hasInlineView = card.type === "materi" || card.type === "gambar" || card.type === "video" || card.type === "upload";
                      const shouldOpenDetail = card.type === "soal" || card.type === "tugas" || card.type === "penilaian";
                      const materiMode = (card.meta?.materi_mode || "singkat").toLowerCase();
                      const isMateriLengkap = card.type === "materi" && materiMode === "lengkap";
                      const isMateriSingkat = card.type === "materi" && !isMateriLengkap;
                      const collapseKey = `${material.id}:${card.id}`;
                      const isCollapsed = !!collapsedContentCards[collapseKey];
                      const cardBody =
                        toPlainText(
                          card.type === "tugas"
                            ? card.meta?.tugas_instruction || card.body
                            : isMateriLengkap
                              ? card.meta?.materi_description || card.meta?.description || "Materi lengkap tersedia di halaman detail."
                              : card.type === "materi"
                                ? card.body || card.meta?.materi_description || card.meta?.description
                              : card.meta?.description || card.meta?.materi_description || card.body
                        ) || "Konten tersedia di halaman materi.";
                      const shortBody = cardBody.length > 150 ? `${cardBody.slice(0, 150).trimEnd()}...` : cardBody;
                      return (
                        <div key={card.id} className="bg-white dark:bg-slate-900">
                          <button
                            type="button"
                            onClick={() =>
                              setCollapsedContentCards((prev) => ({
                                ...prev,
                                [collapseKey]: !prev[collapseKey],
                              }))
                            }
                            className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/70"
                          >
                            <div className="flex min-w-0 items-start gap-2">
                              <span className={`inline-flex h-6 w-[74px] shrink-0 items-center justify-center rounded-full px-2.5 text-[11px] font-medium ${getTypeTone(card.type)}`}>
                                {getTypeLabel(card.type)}
                              </span>
                              <p className="line-clamp-2 text-sm font-semibold text-[color:var(--ink-900)]">
                                {cardIndex + 1}. {card.title}
                              </p>
                            </div>
                            {isCollapsed ? <FiChevronDown className="shrink-0" /> : <FiChevronUp className="shrink-0" />}
                          </button>

                          {!isCollapsed && (
                            <div className="px-3 pb-3">
                              {(card.type !== "materi" || isMateriLengkap) && (
                                <p className="mt-1 text-sm text-[color:var(--ink-600)]">{shortBody}</p>
                              )}

                              {hasInlineView && isMateriSingkat && (
                                (() => {
                                  const fullContent = decodeHtmlEntities(
                                    (card.body || card.meta?.materi_description || card.meta?.description || "").trim()
                                  );
                                  if (!fullContent) {
                                    return (
                                      <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-[color:var(--ink-500)]">
                                        Konten materi belum tersedia.
                                      </div>
                                    );
                                  }
                                  return (
                                    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                                      {containsHtmlTag(fullContent) ? (
                                        <SafeHtml
                                          className="prose prose-slate max-w-none text-[color:var(--ink-700)]"
                                          html={fullContent}
                                        />
                                      ) : (
                                        <p className="text-sm text-[color:var(--ink-700)] whitespace-pre-line">{fullContent}</p>
                                      )}
                                    </div>
                                  );
                                })()
                              )}

                              {hasInlineView && card.type === "gambar" && (
                                <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                                  {card.body ? (
                                    <div className="space-y-2">
                                      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                                        <img src={card.body} alt={card.title} className="h-auto w-full object-cover" />
                                      </div>
                                      <a href={card.body} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--sage-700)] hover:underline">
                                        <FiExternalLink size={12} /> Buka gambar
                                      </a>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-[color:var(--ink-500)]">Gambar belum tersedia.</p>
                                  )}
                                </div>
                              )}

                              {hasInlineView && card.type === "video" && (
                                <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                                  {card.body ? (
                                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                                      <iframe
                                        src={normalizeEmbedUrl(card.body)}
                                        title={card.title}
                                        className="h-56 w-full"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        referrerPolicy="strict-origin-when-cross-origin"
                                        allowFullScreen
                                      />
                                    </div>
                                  ) : (
                                    <p className="text-xs text-[color:var(--ink-500)]">Video belum tersedia.</p>
                                  )}
                                </div>
                              )}

                              {hasInlineView && card.type === "upload" && (
                                <div className="mt-2">
                                  {card.body ? (
                                    <a href={card.body} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--sage-700)] hover:underline">
                                      <FiExternalLink size={12} /> Buka dokumen
                                    </a>
                                  ) : (
                                    <p className="text-xs text-[color:var(--ink-500)]">Dokumen belum tersedia.</p>
                                  )}
                                </div>
                              )}

                              {card.type === "tugas" && (
                                <div className="mt-2 space-y-3">
                                  {(() => {
                                    const materialId = material.id;
                                    const submissionType = card.meta?.tugas_submission_type || "teks";
                                    const allowsTextOrLink = submissionType !== "file";
                                    const allowsFile = submissionType !== "teks";
                                    const allowsImageInline = submissionType !== "file";
                                    const dueDate = parseDueDate(card.meta?.tugas_due_at);
                                    const isLate = Boolean(dueDate && Date.now() > dueDate.getTime());
                                    const taskQuestion = resolveTaskQuestionFromCard(material, card);
                                    const taskSubmitted = Boolean(taskQuestion?.submission_id);
                                    const taskMessage = taskSubmitMessageByMaterial[materialId];
                                    const enabledInputs = taskEnabledInputsByMaterial[materialId] || {
                                      text: false,
                                      video: false,
                                      file: false,
                                      image: false,
                                    };
                                    const showVideoInput = enabledInputs.video || Boolean(taskVideoUrlByMaterial[materialId]?.trim());
                                    const showFileInput =
                                      enabledInputs.file ||
                                      Boolean(taskPendingDocByMaterial[materialId]) ||
                                      Boolean(taskAnswerFileUrlByMaterial[materialId]?.trim());
                                    const showImageInput = enabledInputs.image || Boolean(taskPendingImageByMaterial[materialId]);

                                    return (
                                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-3">
                                        {!taskSubmitted && isLate && (
                                          <div className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                                            Peringatan: waktu pengumpulan sudah lewat. Kamu masih bisa submit, tapi tercatat terlambat.
                                          </div>
                                        )}
                                        {taskSubmitted && (
                                          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-800">
                                            Tugas ini sudah kamu submit.
                                          </div>
                                        )}
                                        {!taskSubmitted && (
                                          <>
                                            <div className="rounded-md border border-slate-300 bg-white p-3">
                                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mode Pengumpulan</p>
                                              <div className="mt-2 flex flex-wrap gap-2">
                                                {allowsTextOrLink && (
                                                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                                    Jawaban Teks <span className="ml-1 text-[10px] font-semibold">Wajib</span>
                                                  </span>
                                                )}
                                                {allowsFile && (
                                                  <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                                                    Upload Dokumen <span className="ml-1 text-[10px] font-semibold">Wajib</span>
                                                  </span>
                                                )}
                                                {allowsImageInline && (
                                                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                                                    Gambar/Link <span className="ml-1 text-[10px] font-semibold">Opsional</span>
                                                  </span>
                                                )}
                                              </div>
                                              <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                                                <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                                                  <span className="font-semibold text-slate-700">Tenggat:</span>{" "}
                                                  {card.meta?.tugas_due_at || "-"}
                                                </div>
                                                <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                                                  <span className="font-semibold text-slate-700">Maks file:</span>{" "}
                                                  {typeof card.meta?.tugas_max_file_mb === "number" ? `${card.meta.tugas_max_file_mb} MB` : "-"}
                                                </div>
                                                <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                                                  <span className="font-semibold text-slate-700">Format:</span>{" "}
                                                  {Array.isArray(card.meta?.tugas_allowed_formats) && card.meta.tugas_allowed_formats.length > 0
                                                    ? card.meta.tugas_allowed_formats.join(", ")
                                                    : "-"}
                                                </div>
                                              </div>
                                              <div className="mt-3 flex items-center gap-2">
                                                {allowsFile && (
                                                  <button
                                                    type="button"
                                                    title="Upload dokumen"
                                                    aria-label="Upload dokumen"
                                                    className={`inline-flex h-8 w-8 items-center justify-center rounded-md border text-sm transition ${
                                                      showFileInput
                                                        ? "border-[color:var(--sage-500)] bg-[color:var(--sage-50)] text-[color:var(--sage-700)]"
                                                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                                    }`}
                                                    onClick={() => toggleTaskInput(materialId, "file", allowsFile)}
                                                  >
                                                    <FiPaperclip />
                                                  </button>
                                                )}
                                                {allowsTextOrLink && (
                                                  <button
                                                    type="button"
                                                    title="Tambahkan link"
                                                    aria-label="Tambahkan link"
                                                    className={`inline-flex h-8 w-8 items-center justify-center rounded-md border text-sm transition ${
                                                      showVideoInput
                                                        ? "border-[color:var(--sage-500)] bg-[color:var(--sage-50)] text-[color:var(--sage-700)]"
                                                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                                    }`}
                                                    onClick={() => toggleTaskInput(materialId, "video", allowsTextOrLink)}
                                                  >
                                                    <FiLink />
                                                  </button>
                                                )}
                                                {allowsImageInline && (
                                                  <button
                                                    type="button"
                                                    title="Tambahkan gambar"
                                                    aria-label="Tambahkan gambar"
                                                    className={`inline-flex h-8 w-8 items-center justify-center rounded-md border text-sm transition ${
                                                      showImageInput
                                                        ? "border-[color:var(--sage-500)] bg-[color:var(--sage-50)] text-[color:var(--sage-700)]"
                                                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                                    }`}
                                                    onClick={() => toggleTaskInput(materialId, "image", allowsImageInline)}
                                                  >
                                                    <FiImage />
                                                  </button>
                                                )}
                                              </div>
                                            </div>

                                            {allowsTextOrLink && (
                                              <div className="rounded-md border border-slate-300 bg-white p-3">
                                                <label className="text-xs font-semibold text-[color:var(--ink-700)]">
                                                  Jawaban Teks <span className="text-rose-500">*</span>
                                                </label>
                                                <textarea
                                                  className="sage-input mt-1 min-h-28"
                                                  placeholder="Tulis jawaban tugas di sini..."
                                                  title="Isi jawaban teks untuk tugas."
                                                  value={taskAnswerTextByMaterial[materialId] || ""}
                                                  onChange={(e) =>
                                                    setTaskAnswerTextByMaterial((prev) => ({ ...prev, [materialId]: e.target.value }))
                                                  }
                                                />
                                              </div>
                                            )}

                                            {allowsFile && showFileInput && (
                                              <div className="rounded-md border border-slate-300 bg-white p-3">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                  <label className="text-xs font-semibold text-[color:var(--ink-700)]">
                                                    Upload Dokumen <span className="text-rose-500">*</span>
                                                  </label>
                                                  {typeof card.meta?.tugas_max_file_mb === "number" && (
                                                    <span className="text-[11px] text-slate-500">Maks {card.meta.tugas_max_file_mb} MB</span>
                                                  )}
                                                </div>
                                                <input
                                                  type="file"
                                                  title="Pilih file dokumen yang akan diunggah sebagai jawaban."
                                                  onChange={(e) => handlePickTaskAsset(materialId, e.target.files?.[0] || null, "document")}
                                                  className="mt-2 block w-full text-xs text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1.5"
                                                />
                                                {taskPendingDocByMaterial[materialId] && (
                                                  <p className="mt-2 truncate text-xs text-[color:var(--ink-600)]" title={taskPendingDocByMaterial[materialId]?.name}>
                                                    File dipilih: {taskPendingDocByMaterial[materialId]?.name}
                                                  </p>
                                                )}
                                                <div className="mt-2">
                                                  <button
                                                    type="button"
                                                    className="sage-button-outline !py-1.5 !px-3 text-xs"
                                                    title="Unggah dokumen terpilih ke sistem."
                                                    disabled={!taskPendingDocByMaterial[materialId] || !!taskUploadingByMaterial[materialId]}
                                                    onClick={() => void handleUploadTaskAssetInline(material, card, "document")}
                                                  >
                                                    {taskUploadingByMaterial[materialId] ? "Uploading..." : "Upload File"}
                                                  </button>
                                                </div>
                                                {taskAnswerFileUrlByMaterial[materialId] && (
                                                  <a
                                                    href={taskAnswerFileUrlByMaterial[materialId]}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="mt-2 block truncate text-xs text-[color:var(--sage-700)] hover:underline"
                                                    title={taskAnswerFileNameByMaterial[materialId] || taskAnswerFileUrlByMaterial[materialId]}
                                                  >
                                                    File terupload: {taskAnswerFileNameByMaterial[materialId] || taskAnswerFileUrlByMaterial[materialId]}
                                                  </a>
                                                )}
                                              </div>
                                            )}

                                            {allowsTextOrLink && showVideoInput && (
                                              <div className="rounded-md border border-slate-200 bg-white p-3">
                                                <label className="text-xs font-medium text-[color:var(--ink-700)]">Tambahkan Link</label>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                  <input
                                                    className="sage-input !py-1.5 text-xs flex-1 min-w-52"
                                                    placeholder="Tempel link..."
                                                    title="Masukkan tautan apa pun yang ingin disertakan di jawaban."
                                                    value={taskVideoUrlByMaterial[materialId] || ""}
                                                    onChange={(e) =>
                                                      setTaskVideoUrlByMaterial((prev) => ({ ...prev, [materialId]: e.target.value }))
                                                    }
                                                  />
                                                  <button
                                                    type="button"
                                                    className="sage-button-outline !py-1.5 !px-3 text-xs"
                                                    title="Tambahkan link ke isi jawaban teks."
                                                    onClick={() => handleInsertTaskVideoLink(materialId)}
                                                  >
                                                    Tambah Link
                                                  </button>
                                                </div>
                                              </div>
                                            )}
                                            {allowsImageInline && showImageInput && (
                                              <div className="rounded-md border border-slate-200 bg-white p-3">
                                                <label className="text-xs font-medium text-[color:var(--ink-700)]">Tambahkan Gambar</label>
                                                <div className="mt-2 space-y-2">
                                                  <input
                                                    type="file"
                                                    accept="image/*"
                                                    title="Pilih file gambar yang akan ditambahkan ke jawaban."
                                                    onChange={(e) => handlePickTaskAsset(materialId, e.target.files?.[0] || null, "image")}
                                                    className="block w-full text-xs text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1.5"
                                                  />
                                                  {taskPendingImageByMaterial[materialId] && (
                                                    <p className="truncate text-xs text-[color:var(--ink-600)]" title={taskPendingImageByMaterial[materialId]?.name}>
                                                      Gambar dipilih: {taskPendingImageByMaterial[materialId]?.name}
                                                    </p>
                                                  )}
                                                  <button
                                                    type="button"
                                                    className="sage-button-outline !py-1.5 !px-3 text-xs"
                                                    title="Unggah gambar terpilih dan tambahkan ke jawaban."
                                                    disabled={!taskPendingImageByMaterial[materialId] || !!taskUploadingByMaterial[materialId]}
                                                    onClick={() => void handleUploadTaskAssetInline(material, card, "image")}
                                                  >
                                                    {taskUploadingByMaterial[materialId] ? "Uploading..." : "Upload Gambar"}
                                                  </button>
                                                </div>
                                              </div>
                                            )}
                                            <button
                                              type="button"
                                              className="sage-button !py-1.5 !px-3 text-xs"
                                              title="Kirim jawaban tugas yang sudah diisi."
                                              disabled={!!taskSubmitLoadingByMaterial[materialId]}
                                              onClick={() => void handleSubmitTaskInline(material, card)}
                                            >
                                              {taskSubmitLoadingByMaterial[materialId] ? "Mengirim..." : "Submit Tugas"}
                                            </button>
                                          </>
                                        )}
                                        {taskMessage && (
                                          <p className={`text-xs ${taskMessage.toLowerCase().includes("berhasil") ? "text-[color:var(--sage-700)]" : "text-red-500"}`}>
                                            {taskMessage}
                                          </p>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}

                              {((shouldOpenDetail && card.type !== "tugas") || isMateriLengkap) && (
                                <div className="mt-3">
                                  <Link
                                    href={`/dashboard/student/classes/${classId}/materials/${material.id}${
                                      card.type === "soal"
                                        ? `?view=soal&sectionCardId=${encodeURIComponent(card.id)}`
                                        : ""
                                    }`}
                                    className="sage-button-outline !px-3 !py-1.5 text-xs inline-flex items-center gap-1"
                                    onClick={() => markMaterialSeen(material)}
                                  >
                                    <FiExternalLink size={12} />
                                    {card.type === "soal"
                                      ? "Jawab Soal"
                                      : card.type === "penilaian"
                                          ? "Buka Penilaian"
                                          : isMateriLengkap
                                            ? "Buka Materi Lengkap"
                                            : "Buka"}
                                  </Link>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>
        </>
      )}

      {activeTab === "nilai" && (
        <section className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Rata-rata Kelas</p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{gradeOverview.classAverage ?? "-"}</p>
            </div>
            <div className="rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Sudah Submit</p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {gradeOverview.submittedCount}/{gradeOverview.totalQuestions}
              </p>
            </div>
            <div className="rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Sudah Dinilai</p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {gradeOverview.gradedCount}/{gradeOverview.totalQuestions}
              </p>
            </div>
            <div className="rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Sudah Direview</p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {gradeOverview.reviewedCount}/{gradeOverview.totalQuestions}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="sage-button-outline !px-3 !py-1.5 text-xs"
              onClick={() =>
                setCollapsedGradeSections(
                  gradeOverview.rows.reduce((acc, row) => ({ ...acc, [row.id]: false }), {} as Record<string, boolean>)
                )
              }
            >
              Buka Semua Section
            </button>
            <button
              type="button"
              className="sage-button-outline !px-3 !py-1.5 text-xs"
              onClick={() =>
                setCollapsedGradeSections(
                  gradeOverview.rows.reduce((acc, row) => ({ ...acc, [row.id]: true }), {} as Record<string, boolean>)
                )
              }
            >
              Tutup Semua Section
            </button>
          </div>

          {gradeOverview.rows.length === 0 ? (
            <div className="sage-panel p-8 text-center text-[color:var(--ink-500)]">Belum ada data penilaian di kelas ini.</div>
          ) : (
            <div className="space-y-3">
              {gradeOverview.rows.map((row) => {
                const sectionCollapsed = !!collapsedGradeSections[row.id];
                const soalContents = row.contents.filter((content) => content.type === "soal");
                const tugasContents = row.contents.filter((content) => content.type === "tugas");
                return (
                <div key={row.id} className="rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => setCollapsedGradeSections((prev) => ({ ...prev, [row.id]: !prev[row.id] }))}
                    className="flex w-full items-start justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Section {row.sectionNo}</p>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{row.title}</h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Nilai Rata-rata</p>
                        <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{row.averageScore ?? "-"}</p>
                      </div>
                      {sectionCollapsed ? <FiChevronDown className="mt-1 shrink-0 text-slate-500 dark:text-slate-300" /> : <FiChevronUp className="mt-1 shrink-0 text-slate-500 dark:text-slate-300" />}
                    </div>
                  </button>
                  {!sectionCollapsed && (
                    <>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          Submit: {row.submittedCount}/{row.totalQuestions}
                        </span>
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          Dinilai: {row.gradedCount}/{row.totalQuestions}
                        </span>
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          Feedback: {row.feedbackCount}
                        </span>
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          Progress: {row.progress}%
                        </span>
                        <span
                          className={`rounded-md px-2 py-1 ${
                            row.status === "sudah_dinilai"
                              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                              : row.status === "menunggu_review"
                                ? "border border-amber-200 bg-amber-50 text-amber-700"
                                : "border border-slate-200 bg-slate-50 text-slate-700"
                          }`}
                        >
                          {row.status === "sudah_dinilai"
                            ? "Sudah Dinilai"
                            : row.status === "menunggu_review"
                              ? "Menunggu Review"
                              : "Belum Submit"}
                        </span>
                      </div>

                      <div className="mt-3 space-y-3">
                        {row.contents.length === 0 && (
                          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            Belum ada konten soal/tugas dengan data penilaian pada section ini.
                          </div>
                        )}

                        {soalContents.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Konten Soal</p>
                            {soalContents.map((content) => {
                              const key = `${row.id}:${content.id}`;
                              const contentCollapsed = !!collapsedGradeContents[key];
                              return (
                                <div key={content.id} className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-800/50 dark:bg-blue-950/30">
                                  <button
                                    type="button"
                                    onClick={() => setCollapsedGradeContents((prev) => ({ ...prev, [key]: !prev[key] }))}
                                    className="flex w-full items-start justify-between gap-2 text-left"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{content.title}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="rounded-md border border-blue-200 bg-white px-2 py-0.5 text-xs font-semibold text-blue-700 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-200">
                                        Skor: {content.averageScore ?? "-"}
                                      </span>
                                      {contentCollapsed ? <FiChevronDown className="mt-0.5 shrink-0" /> : <FiChevronUp className="mt-0.5 shrink-0" />}
                                    </div>
                                  </button>

                                  {!contentCollapsed && (
                                    <>
                                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                                        <div className="rounded-md border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900">
                                          <p className="text-slate-500 dark:text-slate-400">Total Nilai</p>
                                          <p className="font-semibold text-slate-900 dark:text-slate-100">{content.averageScore ?? "-"}</p>
                                        </div>
                                        <div className="rounded-md border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900">
                                          <p className="text-slate-500 dark:text-slate-400">Skor AI</p>
                                          <p className="font-semibold text-slate-900 dark:text-slate-100">{content.aiAverageScore ?? "-"}</p>
                                        </div>
                                        <div className="rounded-md border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900">
                                          <p className="text-slate-500 dark:text-slate-400">Skor Guru</p>
                                          <p className="font-semibold text-slate-900 dark:text-slate-100">{content.teacherAverageScore ?? "-"}</p>
                                        </div>
                                        <div className="rounded-md border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900">
                                          <p className="text-slate-500 dark:text-slate-400">Submit</p>
                                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                                            {content.submittedCount}/{content.totalQuestions}
                                          </p>
                                        </div>
                                        <div className="rounded-md border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900">
                                          <p className="text-slate-500 dark:text-slate-400">Dinilai Guru</p>
                                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                                            {content.gradedCount}/{content.totalQuestions}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="mt-3 rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                                        <p className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Daftar Soal & Nilai</p>
                                        {content.questionItems.length === 0 ? (
                                          <p className="text-xs text-slate-500">Belum ada soal yang terhubung di konten ini.</p>
                                        ) : (
                                          <div className="space-y-1.5">
                                            {content.questionItems.map((item, idx) => (
                                              <div key={item.id} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800/80">
                                                {(() => {
                                                  const appeal = item.submissionId ? gradeAppealsBySubmission[item.submissionId] : null;
                                                  const questionKey = `${row.id}:${content.id}:${item.id}`;
                                                  const questionCollapsed = !!collapsedGradeQuestions[questionKey];
                                                  const appealLabel =
                                                    appeal?.status === "open"
                                                      ? "Banding Diajukan"
                                                      : appeal?.status === "in_review"
                                                        ? "Banding Diproses"
                                                        : appeal?.status === "resolved_accepted"
                                                          ? "Banding Diterima"
                                                          : appeal?.status === "resolved_rejected"
                                                            ? "Banding Ditolak"
                                                            : null;
                                                  return (
                                                    <>
                                                      <button
                                                        type="button"
                                                        onClick={() =>
                                                          setCollapsedGradeQuestions((prev) => ({
                                                            ...prev,
                                                            [questionKey]: !prev[questionKey],
                                                          }))
                                                        }
                                                        className="flex w-full items-start justify-between gap-2 text-left"
                                                      >
                                                        <p className="min-w-0 flex-1 font-medium text-slate-800 dark:text-slate-100">
                                                          {idx + 1}. {item.title}
                                                        </p>
                                                        <div className="flex items-center gap-1.5">
                                                          <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                                            Nilai: {item.finalScore ?? "-"}
                                                          </span>
                                                          {questionCollapsed ? <FiChevronDown className="shrink-0" /> : <FiChevronUp className="shrink-0" />}
                                                        </div>
                                                      </button>
                                                      {!questionCollapsed && (
                                                        <>
                                                          <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-slate-700 dark:text-slate-200">
                                                            <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 dark:border-slate-700 dark:bg-slate-900">
                                                              AI: {item.aiScore ?? "-"}
                                                            </span>
                                                            <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 dark:border-slate-700 dark:bg-slate-900">
                                                              Guru: {item.teacherScore ?? "-"}
                                                            </span>
                                                            <span
                                                              className={`rounded px-1.5 py-0.5 ${
                                                                item.status === "sudah_dinilai"
                                                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
                                                                  : item.status === "menunggu_review"
                                                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
                                                                    : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                                                              }`}
                                                            >
                                                              {item.status === "sudah_dinilai"
                                                                ? "Sudah Dinilai"
                                                                : item.status === "menunggu_review"
                                                                  ? "Menunggu Review"
                                                                  : "Belum Submit"}
                                                            </span>
                                                          </div>
                                                          <div className="mt-2 rounded border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                                                            <p className="mb-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                                                              Rubrik Soal #{idx + 1}
                                                            </p>
                                                            {item.rubricRows.length === 0 ? (
                                                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                                Belum ada skor rubrik per aspek untuk soal ini.
                                                              </p>
                                                            ) : (
                                                              <div className="flex flex-wrap gap-1.5 text-[11px]">
                                                                {item.rubricRows.map((rubric) => (
                                                                  <span
                                                                    key={`${item.id}-${rubric.aspek}`}
                                                                    className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                                                  >
                                                                    {rubric.aspek}: {rubric.score} / {rubric.maxScore}
                                                                  </span>
                                                                ))}
                                                              </div>
                                                            )}
                                                          </div>
                                                          <div className="mt-2 grid gap-2 lg:grid-cols-2">
                                                            <div className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                                              <p className="mb-0.5 font-semibold text-slate-600 dark:text-slate-300">Feedback AI (Soal Ini)</p>
                                                              <p className="whitespace-pre-line">{item.aiFeedback || "-"}</p>
                                                            </div>
                                                            <div className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                                                              <p className="mb-0.5 font-semibold">Feedback Guru (Soal Ini)</p>
                                                              <p className="whitespace-pre-line">{item.teacherFeedback || "-"}</p>
                                                            </div>
                                                          </div>
                                                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                                            {appealLabel && (
                                                              <span
                                                                className={`rounded border px-1.5 py-0.5 text-[10px] ${
                                                                  appeal?.status === "resolved_accepted"
                                                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                                    : appeal?.status === "resolved_rejected"
                                                                      ? "border-rose-200 bg-rose-50 text-rose-700"
                                                                      : "border-amber-200 bg-amber-50 text-amber-700"
                                                                }`}
                                                              >
                                                                {appealLabel}
                                                              </span>
                                                            )}
                                                            {item.submissionId && (!appeal || appeal.status === "resolved_accepted" || appeal.status === "resolved_rejected") && (
                                                              <button
                                                                type="button"
                                                                className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-700 hover:bg-slate-100"
                                                                onClick={() => {
                                                                  setAppealDialog({
                                                                    submissionId: item.submissionId || "",
                                                                    questionTitle: item.title || "Soal",
                                                                    selectedTemplateId: APPEAL_REASON_TEMPLATES[0].id,
                                                                    customReason: "",
                                                                    loading: false,
                                                                  });
                                                                }}
                                                              >
                                                                Ajukan Banding
                                                              </button>
                                                            )}
                                                          </div>
                                                        </>
                                                      )}
                                                    </>
                                                  );
                                                })()}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>

                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {tugasContents.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">Konten Tugas</p>
                            {tugasContents.map((content) => {
                              const key = `${row.id}:${content.id}`;
                              const contentCollapsed = !!collapsedGradeContents[key];
                              return (
                                <div key={content.id} className="rounded-lg border border-violet-200 bg-violet-50/40 p-3 dark:border-violet-800/50 dark:bg-violet-950/30">
                                  <button
                                    type="button"
                                    onClick={() => setCollapsedGradeContents((prev) => ({ ...prev, [key]: !prev[key] }))}
                                    className="flex w-full items-start justify-between gap-2 text-left"
                                  >
                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{content.title}</p>
                                    <div className="flex items-center gap-2">
                                      <span className="rounded-md border border-violet-200 bg-white px-2 py-0.5 text-xs font-semibold text-violet-700 dark:border-violet-800 dark:bg-slate-900 dark:text-violet-200">
                                        Skor: {content.averageScore ?? "-"}
                                      </span>
                                      {contentCollapsed ? <FiChevronDown className="mt-0.5 shrink-0" /> : <FiChevronUp className="mt-0.5 shrink-0" />}
                                    </div>
                                  </button>
                                  {!contentCollapsed && (
                                    <>
                                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                        <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                          Submit: {content.submittedCount}/{content.totalQuestions}
                                        </span>
                                        <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                          Skor AI: {content.aiAverageScore ?? "-"}
                                        </span>
                                        <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                          Skor Guru: {content.teacherAverageScore ?? "-"}
                                        </span>
                                      </div>
                                      <div className="mt-2 grid gap-2 lg:grid-cols-2">
                                        <div className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                          <p className="mb-1 font-semibold text-slate-600 dark:text-slate-300">Feedback AI</p>
                                          <p className="whitespace-pre-line">{content.aiFeedback || "-"}</p>
                                        </div>
                                        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                                          <p className="mb-1 font-semibold">Feedback Guru</p>
                                          <p className="whitespace-pre-line">{content.feedback || "-"}</p>
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )})}
            </div>
          )}
        </section>
      )}

      <TeacherProfileModal
        teacherId={cls.teacher_id || cls.pengajar_id}
        teacherName={cls.teacher_name}
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />

      {appealDialog && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/55 p-4" role="dialog" aria-modal="true" aria-label="Ajukan Banding Nilai">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Ajukan Banding Nilai</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{appealDialog.questionTitle}</p>
              </div>
              <button
                type="button"
                onClick={closeAppealDialog}
                disabled={appealDialog.loading}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Tutup popup banding"
              >
                <FiX size={16} />
              </button>
            </div>

            <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Pilih Alasan</p>
              {APPEAL_REASON_TEMPLATES.map((template) => (
                <label
                  key={`appeal-template-${template.id}`}
                  className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <input
                    type="radio"
                    name="appeal_reason_template"
                    className="mt-0.5"
                    checked={appealDialog.selectedTemplateId === template.id}
                    onChange={() =>
                      setAppealDialog((prev) =>
                        prev
                          ? {
                              ...prev,
                              selectedTemplateId: template.id,
                            }
                          : prev
                      )
                    }
                    disabled={appealDialog.loading}
                  />
                  <span>{template.label}</span>
                </label>
              ))}

              {appealDialog.selectedTemplateId === "lainnya" && (
                <div className="mt-2">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-200">Alasan Lainnya</label>
                  <textarea
                    className="sage-input mt-1 min-h-24"
                    placeholder="Tulis alasan banding kamu..."
                    value={appealDialog.customReason}
                    onChange={(e) =>
                      setAppealDialog((prev) =>
                        prev
                          ? {
                              ...prev,
                              customReason: e.target.value,
                            }
                          : prev
                      )
                    }
                    disabled={appealDialog.loading}
                  />
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeAppealDialog}
                disabled={appealDialog.loading}
                className="sage-button-outline !px-3 !py-2 text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void submitAppealDialog()}
                disabled={appealDialog.loading}
                className="sage-button !px-3 !py-2 text-xs"
              >
                {appealDialog.loading ? "Mengirim..." : "Kirim Banding"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
