"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from "recharts";
import SafeHtml from "@/components/ui/SafeHtml";

interface RubricScore {
  aspek?: string;
  score?: number;
  skor_diperoleh?: number;
}

interface RubricDescriptor {
  score: string | number;
  description?: string;
}

interface QuestionRubric {
  nama_aspek: string;
  descriptors?: RubricDescriptor[] | Record<string, unknown>;
}

interface EssayQuestion {
  id: string;
  teks_soal: string;
  ideal_answer?: string;
  weight?: number;
  created_at?: string;
  updated_at?: string;
  rubrics?: QuestionRubric[];
  submission_id?: string;
  student_essay_text?: string;
  ai_grading_status?: "queued" | "processing" | "completed" | "failed";
  ai_grading_error?: string;
  skor_ai?: number;
  umpan_balik_ai?: string;
  revised_score?: number;
  teacher_feedback?: string;
  rubric_scores?: RubricScore[];
  submission_attempt_count?: number;
  submission_submitted_at?: string;
}

interface Material {
  id: string;
  judul: string;
  material_type?: "materi" | "soal" | "tugas";
  isi_materi?: string;
  file_url?: string;
  essay_questions?: EssayQuestion[];
}

interface ClassDetail {
  id: string;
  class_name: string;
  materials?: Material[];
}

type ActiveSection = "overview" | "questions" | "results";
type QuestionSort = "default" | "weight_desc" | "alphabet" | "unanswered_first";
type ResultSort = "default" | "score_high" | "score_low" | "latest_score" | "newly_reviewed";

type MaterialBlockType = "heading" | "paragraph" | "video" | "image" | "link" | "pdf" | "ppt" | "bullet_list" | "number_list";
type BlockAlign = "left" | "center" | "right" | "justify";
type MediaSize = "small" | "medium" | "large" | "full";
interface MaterialContentBlock {
  id: string;
  type: MaterialBlockType;
  value: string;
  align?: BlockAlign;
  size?: MediaSize;
}

const getErrorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof Error && err.message.trim().length > 0) return err.message;
  return fallback;
};

interface SectionTaskMeta {
  tugas_instruction?: string;
  tugas_due_at?: string;
  tugas_max_score?: number;
  tugas_submission_type?: "teks" | "file" | "keduanya";
  tugas_allowed_formats?: string[];
  tugas_max_file_mb?: number;
  tugas_attachment_url?: string;
  tugas_attachment_name?: string;
}

type StudentAnswerMode = "list" | "card";
type TimerMode = "none" | "per_question" | "all_questions";
interface SectionQuizSettings {
  answer_mode: StudentAnswerMode;
  timer_mode: TimerMode;
  per_question_seconds: number;
  total_seconds: number;
  extra_time_seconds: number;
  auto_next_on_submit: boolean;
  bulk_submit_mode: boolean;
  allow_back_navigation: boolean;
  lock_question_after_leave: boolean;
  randomize_question_order: boolean;
  random_subset_count: number;
  schedule_start_at: string;
  schedule_end_at: string;
  grace_period_minutes: number;
  attempt_limit: number;
  attempt_scoring_method: "best" | "last";
  attempt_cooldown_minutes: number;
  auto_submit_on_timeout: boolean;
  result_release_mode: "immediate" | "after_close" | "manual";
  result_manual_published: boolean;
  result_manual_published_at: string;
  show_ideal_answer: boolean;
  show_rubric_breakdown: boolean;
  show_rubric_in_question: boolean;
  hide_results_tab: boolean;
  warn_on_tab_switch: boolean;
  max_tab_switch: number;
  auto_lock_on_tab_switch_limit: boolean;
  require_fullscreen: boolean;
}

interface SectionTaskCard {
  id: string;
  type: string;
  title?: string;
  body?: string;
  questionIds?: string[];
  meta?: SectionTaskMeta;
}

interface SectionSoalCard {
  id: string;
  type: "soal" | "tugas";
  title: string;
  body: string;
  questionIds: string[];
  meta?: SectionTaskMeta;
}

interface SectionContentCardData {
  id: string;
  type: "materi" | "soal" | "tugas" | "penilaian" | "gambar" | "video" | "upload";
  title: string;
  body: string;
  meta?: {
    materi_mode?: "singkat" | "lengkap";
    materi_description?: string;
    description?: string;
  };
}

const parseMaterialBlocks = (raw?: string): MaterialContentBlock[] | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { format?: unknown; blocks?: unknown[] };
    if (parsed?.format !== "sage_blocks" || !Array.isArray(parsed?.blocks)) return null;
    return parsed.blocks
      .map((block) => {
        const b = typeof block === "object" && block !== null ? (block as Record<string, unknown>) : {};
        const align = typeof b.align === "string" ? b.align : "";
        const size = typeof b.size === "string" ? b.size : "";
        return {
          id: typeof b.id === "string" && b.id ? b.id : `blk_${Math.random().toString(36).slice(2, 9)}`,
          type: b.type as MaterialBlockType,
          value: typeof b.value === "string" ? b.value : "",
          align: ["left", "center", "right", "justify"].includes(align) ? (align as BlockAlign) : "left",
          size: ["small", "medium", "large", "full"].includes(size) ? (size as MediaSize) : "medium",
        };
      })
      .filter((b: MaterialContentBlock) => ["heading", "paragraph", "video", "image", "link", "pdf", "ppt", "bullet_list", "number_list"].includes(b.type));
  } catch {
    return null;
  }
};

const parseTaskCardConfig = (raw?: string): SectionTaskCard | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { format?: string; items?: unknown[] };
    if (parsed?.format !== "sage_section_cards_v1" || !Array.isArray(parsed?.items)) return null;
    for (const item of parsed.items) {
      if (typeof item !== "object" || item === null) continue;
      const row = item as Record<string, unknown>;
      if (row.type !== "tugas") continue;
      const ids =
        typeof row.meta === "object" && row.meta !== null ? (row.meta as { question_ids?: unknown }).question_ids : undefined;
      const questionIds = Array.isArray(ids)
        ? ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
        : [];
      return {
        id: typeof row.id === "string" ? row.id : "",
        type: "tugas",
        title: typeof row.title === "string" ? row.title : "",
        body: typeof row.body === "string" ? row.body : "",
        questionIds,
        meta: (typeof row.meta === "object" && row.meta !== null ? row.meta : {}) as SectionTaskMeta,
      };
    }
    return null;
  } catch {
    return null;
  }
};

const parseSectionQuestionCards = (raw?: string): SectionSoalCard[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { format?: string; items?: unknown[] };
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    const out: SectionSoalCard[] = [];
    items.forEach((item) => {
      if (typeof item !== "object" || item === null) return;
      const row = item as Record<string, unknown>;
      const type = row.type === "soal" || row.type === "tugas" ? (row.type as "soal" | "tugas") : null;
      if (!type) return;
      const ids = typeof row.meta === "object" && row.meta !== null ? (row.meta as { question_ids?: unknown }).question_ids : undefined;
      const questionIds = Array.isArray(ids)
        ? ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
        : [];
      out.push({
        id: typeof row.id === "string" ? row.id : "",
        type,
        title: typeof row.title === "string" ? row.title : "",
        body: typeof row.body === "string" ? row.body : "",
        questionIds,
        meta: (typeof row.meta === "object" && row.meta !== null ? row.meta : {}) as SectionTaskMeta,
      });
    });
    return out;
  } catch {
    return [];
  }
};

const parseSectionContentCards = (raw?: string): SectionContentCardData[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { format?: string; items?: unknown[] };
    if (parsed?.format !== "sage_section_cards_v1" || !Array.isArray(parsed?.items)) return [];
    const out: SectionContentCardData[] = [];
    parsed.items.forEach((item) => {
      if (typeof item !== "object" || item === null) return;
      const row = item as Record<string, unknown>;
      const rawType = typeof row.type === "string" ? row.type : "";
      if (!["materi", "soal", "tugas", "penilaian", "gambar", "video", "upload"].includes(rawType)) return;
      out.push({
        id: typeof row.id === "string" ? row.id : "",
        type: rawType as SectionContentCardData["type"],
        title: typeof row.title === "string" ? row.title : "",
        body: typeof row.body === "string" ? row.body : "",
        meta: (typeof row.meta === "object" && row.meta !== null ? row.meta : undefined) as SectionContentCardData["meta"],
      });
    });
    return out;
  } catch {
    return [];
  }
};

const containsHtmlTag = (value?: string): boolean => /<([a-z][\w-]*)\b[^>]*>/i.test(value || "");

const normalizeEmbedUrl = (url: string): string => {
  const trimmed = (url || "").trim();
  if (!trimmed) return "";
  const ytMatch = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/i);
  if (ytMatch?.[1]) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const ytShortsMatch = trimmed.match(/youtube\.com\/shorts\/([^&?/]+)/i);
  if (ytShortsMatch?.[1]) return `https://www.youtube.com/embed/${ytShortsMatch[1]}`;
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

const clampDuration = (value: unknown, fallback: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.round(n));
};

const readBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === "boolean") return value;
  return fallback;
};

const parseSectionQuizSettings = (activeCard: SectionSoalCard | null): SectionQuizSettings => {
  const meta = (activeCard?.meta || {}) as Record<string, unknown>;
  const raw =
    typeof meta.quiz_settings === "object" && meta.quiz_settings !== null
      ? (meta.quiz_settings as Record<string, unknown>)
      : {};
  const answerModeRaw = typeof raw.answer_mode === "string" ? raw.answer_mode : "";
  const timerModeRaw = typeof raw.timer_mode === "string" ? raw.timer_mode : "";
  return {
    answer_mode: answerModeRaw === "card" ? "card" : "list",
    timer_mode:
      timerModeRaw === "per_question" || timerModeRaw === "all_questions" ? (timerModeRaw as TimerMode) : "none",
    per_question_seconds: clampDuration(raw.per_question_seconds, 60),
    total_seconds: clampDuration(raw.total_seconds, 900),
    extra_time_seconds: clampDuration(raw.extra_time_seconds, 0),
    auto_next_on_submit: readBoolean(raw.auto_next_on_submit, true),
    bulk_submit_mode: readBoolean(raw.bulk_submit_mode, false),
    allow_back_navigation: readBoolean(raw.allow_back_navigation, true),
    lock_question_after_leave: readBoolean(raw.lock_question_after_leave, false),
    randomize_question_order: readBoolean(raw.randomize_question_order, false),
    random_subset_count: clampDuration(raw.random_subset_count, 0),
    schedule_start_at: typeof raw.schedule_start_at === "string" ? raw.schedule_start_at : "",
    schedule_end_at: typeof raw.schedule_end_at === "string" ? raw.schedule_end_at : "",
    grace_period_minutes: clampDuration(raw.grace_period_minutes, 0),
    attempt_limit: Math.max(0, clampDuration(raw.attempt_limit, 1)),
    attempt_scoring_method: raw.attempt_scoring_method === "best" ? "best" : "last",
    attempt_cooldown_minutes: clampDuration(raw.attempt_cooldown_minutes, 0),
    auto_submit_on_timeout: readBoolean(raw.auto_submit_on_timeout, false),
    result_release_mode:
      raw.result_release_mode === "after_close" || raw.result_release_mode === "manual"
        ? raw.result_release_mode
        : "immediate",
    result_manual_published: readBoolean(raw.result_manual_published, false),
    result_manual_published_at: typeof raw.result_manual_published_at === "string" ? raw.result_manual_published_at : "",
    show_ideal_answer: readBoolean(raw.show_ideal_answer, false),
    show_rubric_breakdown: readBoolean(raw.show_rubric_breakdown, true),
    show_rubric_in_question: readBoolean(raw.show_rubric_in_question, false),
    hide_results_tab: readBoolean(raw.hide_results_tab, false),
    warn_on_tab_switch: readBoolean(raw.warn_on_tab_switch, false),
    max_tab_switch: clampDuration(raw.max_tab_switch, 3),
    auto_lock_on_tab_switch_limit: readBoolean(raw.auto_lock_on_tab_switch_limit, false),
    require_fullscreen: readBoolean(raw.require_fullscreen, false),
  };
};

const shuffleQuestions = (items: EssayQuestion[]): EssayQuestion[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
};

const isImageLikeUrl = (url: string): boolean =>
  /\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?.*)?$/i.test((url || "").trim());

const getTextAlignClass = (align?: BlockAlign) => {
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  if (align === "justify") return "text-justify";
  return "text-left";
};

const getMediaWidthClass = (size?: MediaSize) => {
  if (size === "small") return "w-full md:w-1/3";
  if (size === "large") return "w-full md:w-5/6";
  if (size === "full") return "w-full";
  return "w-full md:w-2/3";
};

const resolveTaskSubmissionQuestion = (
  pool: EssayQuestion[],
  explicitIds?: string[] | null
): EssayQuestion | null => {
  if (!Array.isArray(pool) || pool.length === 0) return null;
  const ids = Array.isArray(explicitIds) ? explicitIds.filter((id) => typeof id === "string" && id.trim().length > 0) : [];
  if (ids.length === 0) return null;
  return pool.find((q) => ids.includes(q.id)) || null;
};

const PdfBlockCard = ({ url }: { url: string }) => {
  const [showPreview, setShowPreview] = useState(false);
  return (
    <div className="border border-black/5 rounded-xl p-3 bg-white space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[color:var(--ink-800)]">PDF Materi</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPreview((prev) => !prev)}
            className="sage-button-outline"
          >
            {showPreview ? "Tutup Preview" : "Preview"}
          </button>
          <a href={url} download className="sage-button-outline">
            Download
          </a>
        </div>
      </div>
      {showPreview && (
        <div className="rounded-lg overflow-hidden border border-black/5 bg-black/5">
          <iframe
            src={url}
            title="PDF Preview"
            className="w-full h-80"
          />
        </div>
      )}
    </div>
  );
};

const normalizeRubricDescriptors = (
  rubric?: QuestionRubric
): Array<{ score: string; description: string }> => {
  if (!rubric?.descriptors) return [];
  const rows = Array.isArray(rubric.descriptors)
    ? rubric.descriptors
    : Object.entries(rubric.descriptors).map(([score, description]) => ({ score, description }));
  return rows
    .map((row) => {
      const score = String((row as RubricDescriptor).score ?? "").trim();
      const rawDesc = (row as RubricDescriptor).description;
      const description =
        typeof rawDesc === "string"
          ? rawDesc
          : typeof rawDesc === "number"
            ? String(rawDesc)
            : typeof rawDesc === "object" && rawDesc !== null
              ? String((rawDesc as Record<string, unknown>).description ?? (rawDesc as Record<string, unknown>).deskripsi ?? "").trim()
              : "";
      return { score, description: description || "-" };
    })
    .filter((row) => row.score.length > 0);
};

const getRubricMaxScore = (rubric?: QuestionRubric): number => {
  const entries = normalizeRubricDescriptors(rubric);
  return entries.reduce((max, item) => {
    const value = Number(item.score);
    if (!Number.isFinite(value)) return max;
    return value > max ? value : max;
  }, 0);
};

const getRubricScoreEntries = (question: EssayQuestion) => {
  if (!question.rubric_scores?.length) return [];
  const normalize = (v: unknown) => String(v ?? "").trim().toLowerCase();
  const rubricList = Array.isArray(question.rubrics) ? question.rubrics : [];

  return question.rubric_scores.map((row, index) => {
    const aspek = row.aspek ?? "-";
    const scoreRaw = row.skor_diperoleh ?? row.score;
    const score = Number(scoreRaw);
    const matchedRubric = rubricList.find((r) => normalize(r.nama_aspek) === normalize(aspek)) ?? rubricList[index];
    const maxScore = getRubricMaxScore(matchedRubric);
    return {
      aspek,
      score: Number.isFinite(score) ? score : 0,
      maxScore: maxScore > 0 ? maxScore : 3,
    };
  });
};

const getQuestionGradingState = (
  question: EssayQuestion
): "not_submitted" | "queued" | "processing" | "completed" | "failed" | "waiting_result" => {
  if (!question.submission_id) return "not_submitted";
  const status = (question.ai_grading_status || "").toLowerCase();
  if (status === "queued") return "queued";
  if (status === "processing") return "processing";
  if (status === "failed") return "failed";
  const hasScore = typeof question.revised_score === "number" || typeof question.skor_ai === "number";
  const hasFeedback = (question.teacher_feedback ?? "").trim().length > 0 || (question.umpan_balik_ai ?? "").trim().length > 0;
  if (hasScore || hasFeedback) return "completed";
  if (status === "completed") return "waiting_result";
  return "waiting_result";
};

export default function StudentMaterialDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const classId = params.classId as string;
  const materialId = params.materialId as string;
  const viewMode = searchParams.get("view");
  const sectionCardId = searchParams.get("sectionCardId");

  const [cls, setCls] = useState<ClassDetail | null>(null);
  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<ActiveSection>("overview");
  const [selectedResultQuestionId, setSelectedResultQuestionId] = useState<string | null>(null);
  const [openResults, setOpenResults] = useState<Record<string, boolean>>({});
  const [expandedFeedback, setExpandedFeedback] = useState<Record<string, boolean>>({});
  const [answerInputs, setAnswerInputs] = useState<Record<string, string>>({});
  const [submitLoading, setSubmitLoading] = useState<Record<string, boolean>>({});
  const [submitMessage, setSubmitMessage] = useState<Record<string, string>>({});
  const [questionSort, setQuestionSort] = useState<QuestionSort>("default");
  const [resultSort, setResultSort] = useState<ResultSort>("default");
  const [hideAnsweredQuestions, setHideAnsweredQuestions] = useState(false);
  const [openQuestionDetails, setOpenQuestionDetails] = useState<Record<string, boolean>>({});
  const [openStudentAnswers, setOpenStudentAnswers] = useState<Record<string, boolean>>({});
  const [taskAnswerText, setTaskAnswerText] = useState("");
  const [taskAnswerLink, setTaskAnswerLink] = useState("");
  const [taskAnswerFileUrl, setTaskAnswerFileUrl] = useState("");
  const [taskAnswerFileName, setTaskAnswerFileName] = useState("");
  const [taskPendingFile, setTaskPendingFile] = useState<File | null>(null);
  const [taskUploading, setTaskUploading] = useState(false);
  const [backgroundSyncing, setBackgroundSyncing] = useState(false);
  const [bulkSubmitLoading, setBulkSubmitLoading] = useState(false);
  const [bulkSubmitMessage, setBulkSubmitMessage] = useState("");
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [tabLocked, setTabLocked] = useState(false);
  const [lockedQuestionIds, setLockedQuestionIds] = useState<Record<string, boolean>>({});
  const [integrityPopupOpen, setIntegrityPopupOpen] = useState(false);
  const [integrityPopupMessage, setIntegrityPopupMessage] = useState("");
  const [hardlockPending, setHardlockPending] = useState(false);
  const [reattemptQuestionIds, setReattemptQuestionIds] = useState<Record<string, boolean>>({});
  const [retryConfirmQuestionId, setRetryConfirmQuestionId] = useState<string | null>(null);
  const [retryPopupMessage, setRetryPopupMessage] = useState("");
  const [liveTickMs, setLiveTickMs] = useState(Date.now());
  const tabChangePendingRef = useRef(false);

  const fetchData = useCallback(async (showLoader = true): Promise<Material | null> => {
    if (!classId || !materialId) return null;

    if (showLoader) setLoading(true);
    if (!showLoader) setBackgroundSyncing(true);
    try {
      const res = await fetch(`/api/student/classes/${classId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Gagal memuat data materi.");
      const data = await res.json();
      setCls(data);
      const selected = data?.materials?.find((m: Material) => m.id === materialId) ?? null;
      setMaterial(selected);
      if (!selected) throw new Error("Materi tidak ditemukan di kelas ini.");

      setAnswerInputs((prev) => {
        const next = { ...prev };
        (selected.essay_questions ?? []).forEach((q: EssayQuestion) => {
          if (q.student_essay_text && !next[q.id]) {
            next[q.id] = q.student_essay_text;
          }
        });
        return next;
      });
      return selected;
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Terjadi kesalahan."));
      return null;
    } finally {
      if (showLoader) setLoading(false);
      if (!showLoader) setBackgroundSyncing(false);
    }
  }, [classId, materialId]);

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  const allQuestions = useMemo(() => material?.essay_questions ?? [], [material?.essay_questions]);
  const sectionCards = useMemo(() => parseSectionQuestionCards(material?.isi_materi), [material?.isi_materi]);
  const activeCard = useMemo(
    () => (sectionCardId ? sectionCards.find((card) => card.id === sectionCardId) || null : null),
    [sectionCardId, sectionCards]
  );
  const sectionQuizSettings = useMemo(() => parseSectionQuizSettings(activeCard), [activeCard]);
  const questions = useMemo(() => {
    if (!activeCard) return allQuestions;
    if (!Array.isArray(activeCard.questionIds) || activeCard.questionIds.length === 0) {
      return activeCard.type === "tugas" ? [] : allQuestions;
    }
    const byId = new Map(allQuestions.map((q) => [q.id, q]));
    const ordered = activeCard.questionIds
      .map((id) => byId.get(id) || null)
      .filter((q): q is EssayQuestion => q !== null);
    if (ordered.length > 0) return ordered;
    return allQuestions.filter((q) => activeCard.questionIds.includes(q.id));
  }, [allQuestions, activeCard]);
  const materialType = (material?.material_type || "materi") as "materi" | "soal" | "tugas";
  const isSoalType = materialType === "soal";
  const isTugasType = materialType === "tugas";
  const forceSoalView = viewMode === "soal" || activeCard?.type === "soal";
  const forceTugasView = viewMode === "tugas" || activeCard?.type === "tugas";
  const isSoalContext = isSoalType || forceSoalView;
  const isTugasContext = isTugasType || forceTugasView;
  const isCardAnswerMode = isSoalContext && !isTugasContext && sectionQuizSettings.answer_mode === "card";
  const taskCardConfig = useMemo(() => {
    if (activeCard?.type === "tugas") {
      return {
        id: activeCard.id,
        type: activeCard.type,
        title: activeCard.title,
        body: activeCard.body,
        meta: activeCard.meta,
      } as SectionTaskCard;
    }
    return parseTaskCardConfig(material?.isi_materi);
  }, [activeCard, material?.isi_materi]);
  const taskSubmissionQuestion = useMemo(() => {
    if (!isTugasContext) return null;
    const explicitIds =
      activeCard?.type === "tugas"
        ? activeCard.questionIds
        : taskCardConfig?.questionIds || (taskCardConfig?.meta as { question_ids?: string[] } | undefined)?.question_ids;
    return resolveTaskSubmissionQuestion(questions, explicitIds || null);
  }, [isTugasContext, questions, activeCard, taskCardConfig]);
  const taskSubmissionType = taskCardConfig?.meta?.tugas_submission_type || "teks";
  const taskAllowsTextOrLink = taskSubmissionType !== "file";
  const taskAllowsFile = taskSubmissionType !== "teks";
  const taskRequiresBoth = taskSubmissionType === "keduanya";
  const taskDueAtDate = useMemo(() => parseDueDate(taskCardConfig?.meta?.tugas_due_at), [taskCardConfig?.meta?.tugas_due_at]);
  const isTaskLate = Boolean(taskDueAtDate && new Date().getTime() > taskDueAtDate.getTime());
  const questionPool = useMemo(() => {
    if (!isSoalContext || isTugasContext) return questions;
    if (sectionQuizSettings.random_subset_count <= 0 || sectionQuizSettings.random_subset_count >= questions.length) {
      return questions;
    }
    const base = sectionQuizSettings.randomize_question_order ? shuffleQuestions(questions) : [...questions];
    return base.slice(0, sectionQuizSettings.random_subset_count);
  }, [isSoalContext, isTugasContext, questions, sectionQuizSettings.random_subset_count, sectionQuizSettings.randomize_question_order]);
  const cardModeQuestions = useMemo(() => {
    if (!isCardAnswerMode) return questionPool;
    if (!sectionQuizSettings.randomize_question_order) return questionPool;
    return shuffleQuestions(questionPool);
  }, [isCardAnswerMode, sectionQuizSettings.randomize_question_order, questionPool]);
  const displayQuestions = isSoalContext && !isTugasContext ? questionPool : questions;
  const submittedCount = displayQuestions.filter((q) => !!q.submission_id).length;
  const reviewedCount = displayQuestions.filter(
    (q) => !!q.submission_id && (q.revised_score !== undefined || (q.teacher_feedback ?? "").trim().length > 0)
  ).length;
  const pendingEvaluationCount = displayQuestions.filter((q) => {
    const state = getQuestionGradingState(q);
    return state === "queued" || state === "processing" || state === "waiting_result";
  }).length;
  const canShowResults = isSoalContext || isTugasContext;
  const nowMs = Date.now();
  const scheduleStartDate = useMemo(
    () => parseDueDate(sectionQuizSettings.schedule_start_at || undefined),
    [sectionQuizSettings.schedule_start_at]
  );
  const scheduleEndDate = useMemo(
    () => parseDueDate(sectionQuizSettings.schedule_end_at || undefined),
    [sectionQuizSettings.schedule_end_at]
  );
  const scheduleEndWithGraceMs =
    scheduleEndDate?.getTime() != null
      ? scheduleEndDate.getTime() + sectionQuizSettings.grace_period_minutes * 60 * 1000
      : null;
  const isBeforeSchedule = Boolean(scheduleStartDate && nowMs < scheduleStartDate.getTime());
  const isAfterSchedule = Boolean(scheduleEndWithGraceMs !== null && nowMs > scheduleEndWithGraceMs);
  const isSoalSubmissionBlockedBySchedule = isSoalContext && !isTugasContext && (isBeforeSchedule || isAfterSchedule);
  const canSubmitInCurrentState = !isSoalSubmissionBlockedBySchedule && !tabLocked;
  const allSoalAnswered =
    isSoalContext &&
    !isTugasContext &&
    displayQuestions.length > 0 &&
    displayQuestions.every((q) => Boolean(q.submission_id) && !reattemptQuestionIds[q.id]);
  const hideResultsForStudent = isSoalContext && !isTugasContext && sectionQuizSettings.hide_results_tab;
  const shouldForceFullscreen = isSoalContext && !isTugasContext && sectionQuizSettings.require_fullscreen && !allSoalAnswered;
  const isBulkSubmitMode = isSoalContext && !isTugasContext && !isCardAnswerMode && sectionQuizSettings.bulk_submit_mode;
  const isResultReleased = (() => {
    if (!isSoalContext || isTugasContext) return true;
    if (sectionQuizSettings.result_release_mode === "immediate") return true;
    if (sectionQuizSettings.result_release_mode === "manual") return sectionQuizSettings.result_manual_published;
    if (!scheduleEndDate) return false;
    return nowMs >= scheduleEndDate.getTime();
  })();
  const canOpenResultsTab = canShowResults && isResultReleased && !hideResultsForStudent;
  const [isMobileTopPanelOpen, setIsMobileTopPanelOpen] = useState(false);
  const [showMobileQuestionMeta, setShowMobileQuestionMeta] = useState(false);
  const [quizQuestionIndex, setQuizQuestionIndex] = useState(0);
  const [currentTickSec, setCurrentTickSec] = useState(() => Math.floor(Date.now() / 1000));
  const [attemptStartSec, setAttemptStartSec] = useState<number | null>(null);
  const [questionStartSecMap, setQuestionStartSecMap] = useState<Record<string, number>>({});
  const [autoAdvancedTimeoutIds, setAutoAdvancedTimeoutIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!canOpenResultsTab || pendingEvaluationCount === 0) return;
    const timer = setInterval(() => {
      void fetchData(false);
    }, 4000);
    return () => clearInterval(timer);
  }, [canOpenResultsTab, pendingEvaluationCount, fetchData]);

  useEffect(() => {
    if (!material) return;
    if ((isSoalContext || isTugasContext) && activeSection === "overview") {
      setActiveSection("questions");
      return;
    }
    if (!canOpenResultsTab && activeSection === "results") {
      setActiveSection("overview");
      return;
    }
    if (!isSoalContext && !isTugasContext && activeSection !== "overview") {
      setActiveSection("overview");
    }
  }, [material, isSoalContext, isTugasContext, canOpenResultsTab, activeSection]);

  useEffect(() => {
    if (!isCardAnswerMode) {
      setQuizQuestionIndex(0);
      setQuestionStartSecMap({});
      setAutoAdvancedTimeoutIds({});
      return;
    }
    setQuizQuestionIndex((prev) => {
      if (cardModeQuestions.length === 0) return 0;
      return Math.max(0, Math.min(prev, cardModeQuestions.length - 1));
    });
  }, [isCardAnswerMode, cardModeQuestions.length]);

  useEffect(() => {
    if (!isCardAnswerMode || activeSection !== "questions") return;
    const timer = setInterval(() => setCurrentTickSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, [isCardAnswerMode, activeSection]);

  useEffect(() => {
    if (!isSoalContext || isTugasContext || activeSection !== "questions") return;
    const timer = setInterval(() => setLiveTickMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isSoalContext, isTugasContext, activeSection]);

  const attemptStorageKey = useMemo(
    () => `sage_quiz_attempt_start:${classId}:${materialId}:${sectionCardId || "all"}`,
    [classId, materialId, sectionCardId]
  );

  useEffect(() => {
    if (!isCardAnswerMode || sectionQuizSettings.timer_mode !== "all_questions" || sectionQuizSettings.total_seconds <= 0) {
      setAttemptStartSec(null);
      return;
    }
    if (typeof window === "undefined") return;
    const existing = window.localStorage.getItem(attemptStorageKey);
    const parsed = existing ? Number(existing) : NaN;
    const now = Math.floor(Date.now() / 1000);
    if (Number.isFinite(parsed) && parsed > 0) {
      setAttemptStartSec(parsed);
    } else {
      setAttemptStartSec(now);
      window.localStorage.setItem(attemptStorageKey, String(now));
    }
  }, [isCardAnswerMode, sectionQuizSettings.timer_mode, sectionQuizSettings.total_seconds, attemptStorageKey]);

  const currentCardQuestion = isCardAnswerMode
    ? cardModeQuestions[Math.max(0, Math.min(quizQuestionIndex, Math.max(0, cardModeQuestions.length - 1)))] || null
    : null;
  const totalTimerRemainingSec =
    sectionQuizSettings.timer_mode === "all_questions" && sectionQuizSettings.total_seconds > 0 && attemptStartSec
      ? Math.max(
          0,
          sectionQuizSettings.total_seconds + sectionQuizSettings.extra_time_seconds - Math.max(0, currentTickSec - attemptStartSec)
        )
      : null;

  useEffect(() => {
    if (!isCardAnswerMode || sectionQuizSettings.timer_mode !== "per_question" || sectionQuizSettings.per_question_seconds <= 0) return;
    if (!currentCardQuestion) return;
    setQuestionStartSecMap((prev) => {
      if (typeof prev[currentCardQuestion.id] === "number") return prev;
      return { ...prev, [currentCardQuestion.id]: Math.floor(Date.now() / 1000) };
    });
  }, [isCardAnswerMode, sectionQuizSettings.timer_mode, sectionQuizSettings.per_question_seconds, currentCardQuestion]);

  const perQuestionTimerRemainingSec =
    sectionQuizSettings.timer_mode === "per_question" &&
    sectionQuizSettings.per_question_seconds > 0 &&
    currentCardQuestion &&
    typeof questionStartSecMap[currentCardQuestion.id] === "number"
      ? Math.max(
          0,
          sectionQuizSettings.per_question_seconds +
            sectionQuizSettings.extra_time_seconds -
            Math.max(0, currentTickSec - Number(questionStartSecMap[currentCardQuestion.id]))
        )
      : null;
  const activeTimerRemainingSec =
    sectionQuizSettings.timer_mode === "all_questions" ? totalTimerRemainingSec : perQuestionTimerRemainingSec;
  const isActiveTimerExpired =
    sectionQuizSettings.timer_mode !== "none" &&
    typeof activeTimerRemainingSec === "number" &&
    activeTimerRemainingSec <= 0;
  const goToCardQuestionIndex = useCallback(
    (targetIndex: number) => {
      if (!isCardAnswerMode) return;
      const normalized = Math.max(0, Math.min(targetIndex, Math.max(0, cardModeQuestions.length - 1)));
      if (sectionQuizSettings.lock_question_after_leave && currentCardQuestion?.id) {
        setLockedQuestionIds((prev) => ({ ...prev, [currentCardQuestion.id]: true }));
      }
      setQuizQuestionIndex(normalized);
    },
    [isCardAnswerMode, cardModeQuestions.length, sectionQuizSettings.lock_question_after_leave, currentCardQuestion?.id]
  );

  useEffect(() => {
    if (!isCardAnswerMode || sectionQuizSettings.timer_mode !== "per_question") return;
    if (!currentCardQuestion || !isActiveTimerExpired) return;
    if (autoAdvancedTimeoutIds[currentCardQuestion.id]) return;
    setAutoAdvancedTimeoutIds((prev) => ({ ...prev, [currentCardQuestion.id]: true }));
    if (quizQuestionIndex < cardModeQuestions.length - 1) {
      goToCardQuestionIndex(quizQuestionIndex + 1);
    }
  }, [
    isCardAnswerMode,
    sectionQuizSettings.timer_mode,
    currentCardQuestion,
    isActiveTimerExpired,
    autoAdvancedTimeoutIds,
    quizQuestionIndex,
    cardModeQuestions.length,
    goToCardQuestionIndex,
  ]);

  useEffect(() => {
    if (!isSoalContext || isTugasContext) return;
    if (!sectionQuizSettings.warn_on_tab_switch && !shouldForceFullscreen) return;
    const handler = () => {
      if (document.visibilityState === "hidden") {
        tabChangePendingRef.current = true;
        setTabSwitchCount((prev) => {
          const next = prev + 1;
          if (
            sectionQuizSettings.auto_lock_on_tab_switch_limit &&
            sectionQuizSettings.max_tab_switch > 0 &&
            next >= sectionQuizSettings.max_tab_switch
          ) {
            setHardlockPending(true);
          }
          return next;
        });
        return;
      }
      if (tabChangePendingRef.current) {
        tabChangePendingRef.current = false;
        if (hardlockPending) {
          setIntegrityPopupMessage("Batas pindah tab terlampaui. Setelah popup ini ditutup, attempt akan dikunci.");
        } else {
          setIntegrityPopupMessage("Dilarang pindah tab saat pengerjaan soal sedang berlangsung.");
        }
        setIntegrityPopupOpen(true);
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [
    isSoalContext,
    isTugasContext,
    sectionQuizSettings.warn_on_tab_switch,
    sectionQuizSettings.auto_lock_on_tab_switch_limit,
    sectionQuizSettings.max_tab_switch,
    shouldForceFullscreen,
    hardlockPending,
  ]);

  useEffect(() => {
    if (!shouldForceFullscreen) return;
    if (typeof document === "undefined") return;
    document.body.classList.add("sage-quiz-fullscreen");
    const requestFullscreen = async () => {
      const root = document.documentElement;
      if (document.fullscreenElement || !root.requestFullscreen) return;
      try {
        await root.requestFullscreen();
      } catch {
        // ignore browser restrictions
      }
    };
    void requestFullscreen();
    return () => {
      document.body.classList.remove("sage-quiz-fullscreen");
      if (document.fullscreenElement && document.exitFullscreen) {
        void document.exitFullscreen().catch(() => undefined);
      }
    };
  }, [shouldForceFullscreen]);

  useEffect(() => {
    if (!shouldForceFullscreen) return;
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
      setIntegrityPopupMessage("Dilarang kembali saat mode fullscreen pengerjaan aktif.");
      setIntegrityPopupOpen(true);
    };
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [shouldForceFullscreen]);
  const sortedQuestions = useMemo(() => {
    const withIndex = displayQuestions.map((q, index) => ({ q, index }));
    switch (questionSort) {
      case "weight_desc":
        return [...withIndex]
          .sort((a, b) => {
            const aw = typeof a.q.weight === "number" && a.q.weight > 0 ? a.q.weight : 1;
            const bw = typeof b.q.weight === "number" && b.q.weight > 0 ? b.q.weight : 1;
            if (bw !== aw) return bw - aw;
            return a.index - b.index;
          })
          .map((item) => item.q);
      case "alphabet":
        return [...withIndex]
          .sort((a, b) => a.q.teks_soal.localeCompare(b.q.teks_soal, "id", { sensitivity: "base" }))
          .map((item) => item.q);
      case "unanswered_first":
        return [...withIndex]
          .sort((a, b) => {
            const av = a.q.submission_id ? 1 : 0;
            const bv = b.q.submission_id ? 1 : 0;
            if (av !== bv) return av - bv;
            return a.index - b.index;
          })
          .map((item) => item.q);
      case "default":
      default:
        return displayQuestions;
    }
  }, [displayQuestions, questionSort]);

  const visibleQuestions = useMemo(() => {
    if (!hideAnsweredQuestions) return sortedQuestions;
    return sortedQuestions.filter((q) => !q.submission_id || !!reattemptQuestionIds[q.id]);
  }, [sortedQuestions, hideAnsweredQuestions, reattemptQuestionIds]);

  const resultItems = useMemo(() => {
    const base = displayQuestions
      .filter((q) => !!q.submission_id)
      .map((q, filteredIndex) => {
        const originalOrder = displayQuestions.findIndex((item) => item.id === q.id);
        const rubricEntries = getRubricScoreEntries(q);
        const hasTeacherPane = q.revised_score !== undefined || (q.teacher_feedback ?? "").trim().length > 0;
        const hasAIPane = q.skor_ai !== undefined || rubricEntries.length > 0;
        const finalScore = q.revised_score ?? q.skor_ai;
        const hasScore = typeof finalScore === "number";
        const updatedAtMs = q.updated_at ? new Date(q.updated_at).getTime() : 0;
        return {
          originalOrder: originalOrder >= 0 ? originalOrder : filteredIndex,
          question: q,
          rubricEntries,
          hasTeacherPane,
          hasAIPane,
          finalScore,
          hasScore,
          updatedAtMs,
          radarData: rubricEntries.map((r) => ({
            subject: r.aspek,
            score: r.score,
            full: r.maxScore,
          })),
        };
      });
    const sorted = [...base];
    switch (resultSort) {
      case "score_high":
        sorted.sort((a, b) => {
          if (a.hasScore && !b.hasScore) return -1;
          if (!a.hasScore && b.hasScore) return 1;
          if (!a.hasScore && !b.hasScore) return a.originalOrder - b.originalOrder;
          if ((b.finalScore as number) !== (a.finalScore as number)) return (b.finalScore as number) - (a.finalScore as number);
          return a.originalOrder - b.originalOrder;
        });
        break;
      case "score_low":
        sorted.sort((a, b) => {
          if (a.hasScore && !b.hasScore) return -1;
          if (!a.hasScore && b.hasScore) return 1;
          if (!a.hasScore && !b.hasScore) return a.originalOrder - b.originalOrder;
          if ((a.finalScore as number) !== (b.finalScore as number)) return (a.finalScore as number) - (b.finalScore as number);
          return a.originalOrder - b.originalOrder;
        });
        break;
      case "latest_score":
        sorted.sort((a, b) => {
          if (a.hasScore && !b.hasScore) return -1;
          if (!a.hasScore && b.hasScore) return 1;
          if (b.updatedAtMs !== a.updatedAtMs) return b.updatedAtMs - a.updatedAtMs;
          return b.originalOrder - a.originalOrder;
        });
        break;
      case "newly_reviewed":
        sorted.sort((a, b) => {
          if (a.hasTeacherPane && !b.hasTeacherPane) return -1;
          if (!a.hasTeacherPane && b.hasTeacherPane) return 1;
          if (b.updatedAtMs !== a.updatedAtMs) return b.updatedAtMs - a.updatedAtMs;
          return a.originalOrder - b.originalOrder;
        });
        break;
      case "default":
      default:
        sorted.sort((a, b) => a.originalOrder - b.originalOrder);
        break;
    }
    return sorted;
  }, [displayQuestions, resultSort]);

  const finalMaterialScore = useMemo(() => {
    const totalQuestions = displayQuestions.length;
    if (totalQuestions === 0) {
      return { score: null as number | null, counted: 0, totalWeight: 0, totalQuestions: 0 };
    }

    const scoredQuestions = displayQuestions.filter((q) => {
      const score = q.revised_score ?? q.skor_ai;
      return q.submission_id && typeof score === "number";
    });

    if (scoredQuestions.length === 0) {
      return { score: 0, counted: 0, totalWeight: 0, totalQuestions };
    }

    let weightedSum = 0;
    let totalWeight = 0;
    scoredQuestions.forEach((q) => {
      const score = (q.revised_score ?? q.skor_ai) as number;
      const weight = typeof q.weight === "number" && q.weight > 0 ? q.weight : 1;
      weightedSum += score * weight;
      totalWeight += weight;
    });

    if (totalWeight <= 0) {
      return { score: 0, counted: scoredQuestions.length, totalWeight, totalQuestions };
    }

    const weightedAverage = weightedSum / totalWeight;
    const completionFactor = scoredQuestions.length / totalQuestions;
    const score = weightedAverage * completionFactor;
    return { score, counted: scoredQuestions.length, totalWeight, totalQuestions };
  }, [displayQuestions]);

  useEffect(() => {
    if (activeSection !== "results" || !selectedResultQuestionId) return;
    setOpenResults((prev) => ({ ...prev, [selectedResultQuestionId]: true }));
    const target = document.getElementById(`result-${selectedResultQuestionId}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [activeSection, selectedResultQuestionId]);

  const toggleResult = (questionId: string) => {
    setOpenResults((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  const toggleFeedback = (key: string) => {
    setExpandedFeedback((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getFeedbackText = (text?: string, expanded?: boolean) => {
    const safeText = (text ?? "").trim();
    if (!safeText) return "-";
    if (expanded || safeText.length <= 100) return safeText;
    return `${safeText.slice(0, 100)}...`;
  };

  const getAttemptCount = (question: EssayQuestion): number => {
    if (!question.submission_id) return 0;
    const raw = Number(question.submission_attempt_count ?? 1);
    if (!Number.isFinite(raw) || raw <= 0) return 1;
    return Math.floor(raw);
  };

  const getRemainingCooldownSeconds = (question: EssayQuestion): number => {
    if (!question.submission_id) return 0;
    if (sectionQuizSettings.attempt_cooldown_minutes <= 0) return 0;
    if (!question.submission_submitted_at) return 0;
    const submittedAtMs = new Date(question.submission_submitted_at).getTime();
    if (!Number.isFinite(submittedAtMs) || submittedAtMs <= 0) return 0;
    const nextAllowedMs = submittedAtMs + sectionQuizSettings.attempt_cooldown_minutes * 60 * 1000;
    const diff = Math.ceil((nextAllowedMs - liveTickMs) / 1000);
    return diff > 0 ? diff : 0;
  };

  const canStartReattempt = (question: EssayQuestion): boolean => {
    if (!question.submission_id) return false;
    const attemptCount = getAttemptCount(question);
    if (sectionQuizSettings.attempt_limit > 0 && attemptCount >= sectionQuizSettings.attempt_limit) return false;
    if (getRemainingCooldownSeconds(question) > 0) return false;
    return true;
  };

  const formatCooldown = (seconds: number): string => {
    const safe = Math.max(0, seconds);
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const requestReattempt = (question: EssayQuestion) => {
    if (!question.submission_id) return;
    const cooldownSec = getRemainingCooldownSeconds(question);
    if (cooldownSec > 0) {
      setSubmitMessage((prev) => ({
        ...prev,
        [question.id]: `Coba ulang belum tersedia. Tunggu ${formatCooldown(cooldownSec)} lagi.`,
      }));
      return;
    }
    if (sectionQuizSettings.attempt_limit > 0 && getAttemptCount(question) >= sectionQuizSettings.attempt_limit) {
      setSubmitMessage((prev) => ({
        ...prev,
        [question.id]: "Kesempatan percobaan untuk soal ini sudah habis.",
      }));
      return;
    }
    const methodLabel = sectionQuizSettings.attempt_scoring_method === "best" ? "Nilai terbaik" : "Nilai terakhir";
    setRetryPopupMessage(`Mulai coba ulang untuk soal ini? Skema penilaian tetap ${methodLabel}.`);
    setRetryConfirmQuestionId(question.id);
  };

  const handleSubmitAnswer = async (questionId: string) => {
    if (!canSubmitInCurrentState) {
      setSubmitMessage((prev) => ({ ...prev, [questionId]: "Pengerjaan ditutup atau attempt dikunci." }));
      return;
    }
    if (lockedQuestionIds[questionId]) {
      setSubmitMessage((prev) => ({ ...prev, [questionId]: "Soal ini sudah dikunci setelah dilewati." }));
      return;
    }
    if (isCardAnswerMode && currentCardQuestion?.id === questionId && isActiveTimerExpired) {
      setSubmitMessage((prev) => ({ ...prev, [questionId]: "Waktu untuk soal ini sudah habis." }));
      return;
    }
    const answer = (answerInputs[questionId] ?? "").trim();
    if (!answer) {
      setSubmitMessage((prev) => ({ ...prev, [questionId]: "Jawaban tidak boleh kosong." }));
      return;
    }

    setSubmitLoading((prev) => ({ ...prev, [questionId]: true }));
    setSubmitMessage((prev) => ({ ...prev, [questionId]: "" }));
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: questionId,
          teks_jawaban: answer,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Gagal mengirim jawaban.");
      }

      const data = await res.json().catch(() => ({}));
      const status = String(data?.grading_status || "").toLowerCase();
      const defaultMessage =
        status === "completed"
          ? "Jawaban berhasil dinilai."
          : status === "failed"
            ? "Jawaban diterima, tetapi gagal masuk antrian AI."
            : "Jawaban diterima dan sedang diproses AI.";
      setSubmitMessage((prev) => ({ ...prev, [questionId]: data?.grading_message || defaultMessage }));
      setReattemptQuestionIds((prev) => ({ ...prev, [questionId]: false }));
      await fetchData(false);
      if (isCardAnswerMode && sectionQuizSettings.auto_next_on_submit) {
        goToCardQuestionIndex(quizQuestionIndex + 1);
      }
    } catch (err: unknown) {
      setSubmitMessage((prev) => ({ ...prev, [questionId]: getErrorMessage(err, "Terjadi kesalahan saat submit.") }));
    } finally {
      setSubmitLoading((prev) => ({ ...prev, [questionId]: false }));
    }
  };

  const handleSubmitAllAnswers = async () => {
    if (!isBulkSubmitMode) return;
    if (!canSubmitInCurrentState) {
      setBulkSubmitMessage("Pengerjaan ditutup atau attempt dikunci.");
      return;
    }
    const unansweredQuestions = displayQuestions.filter((q) => !q.submission_id || !!reattemptQuestionIds[q.id]);
    if (unansweredQuestions.length === 0) {
      setBulkSubmitMessage("Semua soal sudah tersubmit.");
      return;
    }
    const missingAnswers = unansweredQuestions.filter((q) => !(answerInputs[q.id] || "").trim());
    if (missingAnswers.length > 0) {
      setBulkSubmitMessage(`Masih ada ${missingAnswers.length} soal yang belum diisi. Lengkapi dulu sebelum submit semua.`);
      return;
    }

    setBulkSubmitLoading(true);
    setBulkSubmitMessage("");
    const nextLoadingState: Record<string, boolean> = {};
    unansweredQuestions.forEach((q) => {
      nextLoadingState[q.id] = true;
    });
    setSubmitLoading((prev) => ({ ...prev, ...nextLoadingState }));

    let successCount = 0;
    let failedCount = 0;
    for (const q of unansweredQuestions) {
      try {
        const answer = (answerInputs[q.id] || "").trim();
        const res = await fetch("/api/submissions", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question_id: q.id,
            teks_jawaban: answer,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.message || "Gagal mengirim jawaban.");
        }
        const data = await res.json().catch(() => ({}));
        const status = String(data?.grading_status || "").toLowerCase();
        const defaultMessage =
          status === "completed"
            ? "Jawaban berhasil dinilai."
            : status === "failed"
              ? "Jawaban diterima, tetapi gagal masuk antrian AI."
              : "Jawaban diterima dan sedang diproses AI.";
        setSubmitMessage((prev) => ({ ...prev, [q.id]: data?.grading_message || defaultMessage }));
        setReattemptQuestionIds((prev) => ({ ...prev, [q.id]: false }));
        successCount += 1;
      } catch (err: unknown) {
        const message = err instanceof Error && err.message ? err.message : "Terjadi kesalahan saat submit.";
        setSubmitMessage((prev) => ({ ...prev, [q.id]: message }));
        failedCount += 1;
      } finally {
        setSubmitLoading((prev) => ({ ...prev, [q.id]: false }));
      }
    }

    await fetchData(false);
    if (failedCount > 0) {
      setBulkSubmitMessage(`${successCount} jawaban berhasil dikirim, ${failedCount} gagal. Coba kirim ulang yang gagal.`);
    } else {
      setBulkSubmitMessage(`Berhasil mengirim ${successCount} jawaban sekaligus.`);
    }
    setBulkSubmitLoading(false);
  };

  const handlePickTaskFile = (file: File | null) => {
    if (!file) return;
    setTaskPendingFile(file);
    setTaskAnswerFileName(file.name);
  };

  const handleUploadTaskFile = async () => {
    if (!taskAllowsFile) {
      const qid = taskSubmissionQuestion?.id || "task";
      setSubmitMessage((prev) => ({ ...prev, [qid]: "Tugas ini tidak menerima upload file." }));
      return;
    }
    if (!taskPendingFile) return;
    const maxFileMb = typeof taskCardConfig?.meta?.tugas_max_file_mb === "number" ? taskCardConfig.meta.tugas_max_file_mb : 10;
    if (taskPendingFile.size > maxFileMb * 1024 * 1024) {
      const qid = taskSubmissionQuestion?.id || "task";
      setSubmitMessage((prev) => ({ ...prev, [qid]: `Ukuran file melebihi ${maxFileMb} MB.` }));
      return;
    }
    const allowed = Array.isArray(taskCardConfig?.meta?.tugas_allowed_formats) ? taskCardConfig!.meta!.tugas_allowed_formats! : [];
    if (allowed.length > 0) {
      const ext = (taskPendingFile.name.split(".").pop() || "").toLowerCase();
      if (ext && !allowed.map((x) => x.toLowerCase()).includes(ext)) {
        const qid = taskSubmissionQuestion?.id || "task";
        setSubmitMessage((prev) => ({ ...prev, [qid]: `Format file tidak diizinkan. Gunakan: ${allowed.join(", ")}` }));
        return;
      }
    }
    setTaskUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", taskPendingFile);
      const res = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || "Gagal upload file tugas.");
      }
      const filePath = typeof body?.filePath === "string" ? body.filePath : "";
      if (!filePath) throw new Error("Respons upload tidak valid.");
      setTaskAnswerFileUrl(filePath);
      setTaskPendingFile(null);
      if (taskSubmissionQuestion?.id) {
        setSubmitMessage((prev) => ({ ...prev, [taskSubmissionQuestion.id]: "File berhasil diupload." }));
      }
    } catch (err: unknown) {
      const qid = taskSubmissionQuestion?.id || "task";
      setSubmitMessage((prev) => ({ ...prev, [qid]: getErrorMessage(err, "Gagal upload file tugas.") }));
    } finally {
      setTaskUploading(false);
    }
  };

  const handleSubmitTask = async () => {
    if (!taskSubmissionQuestion) return;
    const text = taskAnswerText.trim();
    const link = taskAnswerLink.trim();
    const file = taskAnswerFileUrl.trim();
    const hasTextOrLink = Boolean(text || link);
    const hasFile = Boolean(file);

    if (taskRequiresBoth && (!hasTextOrLink || !hasFile)) {
      setSubmitMessage((prev) => ({ ...prev, [taskSubmissionQuestion.id]: "Tugas ini wajib mengisi teks/link dan upload file." }));
      return;
    }
    if (!taskRequiresBoth && taskAllowsTextOrLink && !taskAllowsFile && !hasTextOrLink) {
      setSubmitMessage((prev) => ({ ...prev, [taskSubmissionQuestion.id]: "Tugas ini wajib mengisi jawaban teks atau link." }));
      return;
    }
    if (!taskRequiresBoth && taskAllowsFile && !taskAllowsTextOrLink && !hasFile) {
      setSubmitMessage((prev) => ({ ...prev, [taskSubmissionQuestion.id]: "Tugas ini wajib upload file." }));
      return;
    }
    if (!hasTextOrLink && !hasFile) {
      setSubmitMessage((prev) => ({ ...prev, [taskSubmissionQuestion.id]: "Isi minimal salah satu: jawaban teks, link, atau file." }));
      return;
    }
    const payloadLines = [
      text ? `Jawaban Teks:\n${text}` : "",
      link ? `Link Jawaban:\n${link}` : "",
      file ? `File Jawaban:\n${file}` : "",
    ].filter(Boolean);
    const finalAnswer = payloadLines.join("\n\n");
    setSubmitLoading((prev) => ({ ...prev, [taskSubmissionQuestion.id]: true }));
    setSubmitMessage((prev) => ({ ...prev, [taskSubmissionQuestion.id]: "" }));
    try {
      const res = await fetch("/api/task-submissions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: taskSubmissionQuestion.id,
          teks_jawaban: finalAnswer,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Gagal mengirim tugas.");
      }
      const data = await res.json().catch(() => ({}));
      const status = String(data?.grading_status || "").toLowerCase();
      const defaultMessage =
        status === "completed"
          ? "Tugas berhasil dikirim dan siap direview guru."
          : status === "failed"
            ? "Tugas terkirim, tetapi ada masalah pada proses penilaian."
            : "Tugas berhasil dikirim.";
      setSubmitMessage((prev) => ({ ...prev, [taskSubmissionQuestion.id]: data?.grading_message || defaultMessage }));
      await fetchData(false);
    } catch (err: unknown) {
      setSubmitMessage((prev) => ({
        ...prev,
        [taskSubmissionQuestion.id]: getErrorMessage(err, "Terjadi kesalahan saat submit tugas."),
      }));
    } finally {
      setSubmitLoading((prev) => ({ ...prev, [taskSubmissionQuestion.id]: false }));
    }
  };

  useEffect(() => {
    if (!isTugasContext || !taskSubmissionQuestion?.student_essay_text) return;
    const raw = taskSubmissionQuestion.student_essay_text;
    const textMatch = raw.match(/Jawaban Teks:\n([\s\S]*?)(?:\n\n(?:Link Jawaban:|File Jawaban:)|$)/);
    const linkMatch = raw.match(/Link Jawaban:\n([\s\S]*?)(?:\n\n(?:Jawaban Teks:|File Jawaban:)|$)/);
    const fileMatch = raw.match(/File Jawaban:\n([\s\S]*?)(?:\n\n(?:Jawaban Teks:|Link Jawaban:)|$)/);
    setTaskAnswerText((textMatch?.[1] || "").trim());
    setTaskAnswerLink((linkMatch?.[1] || "").trim());
    setTaskAnswerFileUrl((fileMatch?.[1] || "").trim());
  }, [isTugasContext, taskSubmissionQuestion?.student_essay_text]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-[color:var(--ink-500)]">Loading...</div>;
  }

  if (error) {
    return <div className="sage-panel p-6 text-red-500">{error}</div>;
  }

  if (!material || !cls) return null;

  return (
    <div className={`student-material-view space-y-4 md:space-y-6 ${shouldForceFullscreen ? "min-h-screen bg-slate-950 p-4 md:p-6" : ""}`}>
      {shouldForceFullscreen && (
        <style jsx global>{`
          body.sage-quiz-fullscreen #sidebar { display: none !important; }
          body.sage-quiz-fullscreen .topbar-shell { display: none !important; }
          body.sage-quiz-fullscreen main > div { max-width: 100% !important; padding: 0 !important; }
        `}</style>
      )}
      {integrityPopupOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-5 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Peringatan Integritas</p>
            <p className="mt-2 text-sm text-slate-700">{integrityPopupMessage}</p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="sage-button"
                onClick={() => {
                  if (hardlockPending) {
                    setTabLocked(true);
                    setHardlockPending(false);
                  }
                  setIntegrityPopupOpen(false);
                }}
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
      {retryConfirmQuestionId && (
        <div className="fixed inset-0 z-[81] flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-sky-200 bg-white p-5 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Konfirmasi Coba Ulang</p>
            <p className="mt-2 text-sm text-slate-700">{retryPopupMessage}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="sage-button-outline" onClick={() => setRetryConfirmQuestionId(null)}>
                Batal
              </button>
              <button
                type="button"
                className="sage-button"
                onClick={() => {
                  if (retryConfirmQuestionId) {
                    setReattemptQuestionIds((prev) => ({ ...prev, [retryConfirmQuestionId]: true }));
                    setSubmitMessage((prev) => ({ ...prev, [retryConfirmQuestionId]: "" }));
                  }
                  setRetryConfirmQuestionId(null);
                }}
              >
                Lanjut Coba Ulang
              </button>
            </div>
          </div>
        </div>
      )}
      {!shouldForceFullscreen && (isSoalContext || isTugasContext) && (
        <>
          <button
            type="button"
            onClick={() => setIsMobileTopPanelOpen(true)}
            className="md:hidden fixed bottom-4 right-4 z-30 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/95 px-4 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur"
          >
            Panel Soal
            <FiChevronUp size={14} />
          </button>
          {isMobileTopPanelOpen && (
            <div className="md:hidden fixed inset-0 z-40 bg-slate-950/55" onClick={() => setIsMobileTopPanelOpen(false)}>
              <div
                className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-slate-700 bg-slate-950 p-4 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-slate-700" />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] uppercase tracking-wide text-slate-400">{cls.class_name}</p>
                    <p className="truncate text-lg font-semibold text-slate-100">{material.judul}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMobileTopPanelOpen(false)}
                    className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200"
                  >
                    Tutup
                    <FiChevronDown size={14} />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className={`sage-pill ${isSoalContext ? "bg-blue-100 text-blue-700" : isTugasContext ? "bg-purple-100 text-purple-700" : ""}`}>
                    Tipe: {isSoalContext ? "Soal" : isTugasContext ? "Tugas" : "Materi"}
                  </span>
                  <span className="sage-pill">{isTugasContext ? "1 Form Submisi" : `${displayQuestions.length} Soal`}</span>
                  <span className="sage-pill">{submittedCount} Submit</span>
                  <span className="sage-pill">{reviewedCount} Direview</span>
                </div>
                <div className="mt-4 grid gap-2 grid-cols-1">
                  {(isSoalContext || isTugasContext) && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSection("questions");
                        setIsMobileTopPanelOpen(false);
                      }}
                      className={`rounded-xl px-4 py-2 text-sm text-left ${activeSection === "questions" ? "bg-[color:var(--sage-700)] text-white" : "bg-slate-900 text-slate-200 border border-slate-700"}`}
                    >
                      {isTugasContext ? "Submisi" : "Soal"}
                    </button>
                  )}
                  {canOpenResultsTab && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSection("results");
                        setIsMobileTopPanelOpen(false);
                      }}
                      className={`rounded-xl px-4 py-2 text-sm text-left ${activeSection === "results" ? "bg-[color:var(--sage-700)] text-white" : "bg-slate-900 text-slate-200 border border-slate-700"}`}
                    >
                      Hasil Penilaian
                    </button>
                  )}
                </div>
                {!isTugasContext && isSoalContext && (
                  <div className="mt-4 space-y-3 rounded-2xl border border-slate-700 bg-[#071a38] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">Fokus Jawaban</p>
                        <p className="mt-1 text-sm font-semibold text-slate-100">
                          Soal {cardModeQuestions.length === 0 ? 0 : quizQuestionIndex + 1} dari {cardModeQuestions.length}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-2">
                        <span className="sage-pill">{submittedCount} Submit</span>
                        {sectionQuizSettings.timer_mode !== "none" && typeof activeTimerRemainingSec === "number" && (
                          <span className={`sage-pill ${isActiveTimerExpired ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
                            {Math.floor(activeTimerRemainingSec / 60)}:{String(activeTimerRemainingSec % 60).padStart(2, "0")}
                          </span>
                        )}
                      </div>
                    </div>
                    {isCardAnswerMode && (
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-[color:var(--sage-600)] transition-all"
                          style={{
                            width: `${cardModeQuestions.length === 0 ? 0 : ((quizQuestionIndex + 1) / cardModeQuestions.length) * 100}%`,
                          }}
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowMobileQuestionMeta((prev) => !prev)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200"
                    >
                      {showMobileQuestionMeta ? "Sembunyikan Detail Sesi" : "Tampilkan Detail Sesi"}
                      {showMobileQuestionMeta ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                    </button>
                    {showMobileQuestionMeta && (
                      <div className="space-y-2">
                        {isBeforeSchedule && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            Kuis belum dibuka. Mulai pada {sectionQuizSettings.schedule_start_at || "-"}.
                          </div>
                        )}
                        {isAfterSchedule && (
                          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            Waktu pengerjaan sudah ditutup.
                          </div>
                        )}
                        {sectionQuizSettings.warn_on_tab_switch && (
                          <div className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200">
                            Pindah tab terdeteksi: {tabSwitchCount}
                            {sectionQuizSettings.max_tab_switch > 0 ? ` / ${sectionQuizSettings.max_tab_switch}` : ""}
                            {tabLocked && " (attempt dikunci)"}
                          </div>
                        )}
                        {hideResultsForStudent && (
                          <div className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200">
                            Tab hasil penilaian disembunyikan oleh guru untuk sesi ini.
                          </div>
                        )}
                        {!hideResultsForStudent && !canOpenResultsTab && (
                          <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                            Hasil penilaian belum dirilis guru.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
      {!shouldForceFullscreen && (
      <section className={`${isSoalContext || isTugasContext ? "hidden md:block" : "block"} sage-panel p-4 md:p-6`}>
        <Link
          href={`/dashboard/student/classes/${classId}`}
          className="student-material-backlink text-sm font-medium text-[color:var(--sage-700)] transition hover:underline"
        >
          ← Kembali ke daftar materi
        </Link>
        <p className="mt-2 text-[11px] uppercase tracking-wide text-[color:var(--ink-500)]">{cls.class_name}</p>
        <h1 className="mt-1 text-2xl md:text-3xl text-[color:var(--ink-900)]">{material.judul}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-[color:var(--ink-600)]">
          <span
            className={`sage-pill ${
              isSoalContext ? "bg-blue-100 text-blue-700" : isTugasContext ? "bg-purple-100 text-purple-700" : ""
            }`}
          >
            Tipe: {isSoalContext ? "Soal" : isTugasContext ? "Tugas" : "Materi"}
          </span>
          <span className="sage-pill">{isTugasContext ? "1 Form Submisi" : `${displayQuestions.length} Soal`}</span>
          <span className="sage-pill">{submittedCount} Sudah Submit</span>
          <span className="sage-pill">{reviewedCount} Sudah Direview</span>
          {pendingEvaluationCount > 0 && <span className="sage-pill bg-amber-100 text-amber-800">{pendingEvaluationCount} Sedang Dinilai AI</span>}
        </div>
      </section>
      )}

      <section className={`${isSoalContext || isTugasContext ? "hidden md:block" : "block"} sage-panel p-2 md:p-3`}>
        <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
          {!isSoalContext && !isTugasContext && (
            <button
              type="button"
              onClick={() => setActiveSection("overview")}
              className={`rounded-xl px-4 py-2 text-sm text-left ${activeSection === "overview" ? "bg-[color:var(--sage-700)] text-white" : "bg-slate-100 text-[color:var(--ink-700)]"}`}
            >
              Materi
            </button>
          )}
          {(isSoalContext || isTugasContext) && (
            <button
              type="button"
              onClick={() => setActiveSection("questions")}
              className={`rounded-xl px-4 py-2 text-sm text-left ${activeSection === "questions" ? "bg-[color:var(--sage-700)] text-white" : "bg-slate-100 text-[color:var(--ink-700)]"}`}
            >
              {isTugasContext ? "Submisi" : "Soal"}
            </button>
          )}
          {canOpenResultsTab && (
            <button
              type="button"
              onClick={() => setActiveSection("results")}
              className={`rounded-xl px-4 py-2 text-sm text-left ${activeSection === "results" ? "bg-[color:var(--sage-700)] text-white" : "bg-slate-100 text-[color:var(--ink-700)]"}`}
            >
              Hasil Penilaian
            </button>
          )}
        </div>
      </section>

      {activeSection === "overview" && !isSoalContext && !isTugasContext && (
        <section className="sage-panel p-6 space-y-3">
          <h2 className="text-lg font-semibold text-[color:var(--ink-900)]">Isi Materi</h2>
          {(() => {
            const sectionCards = parseSectionContentCards(material.isi_materi);
            const materiCards = sectionCards.filter((card) => card.type === "materi");
            if (materiCards.length > 0) {
              const preferred =
                materiCards.find((card) => (card.meta?.materi_mode || "").toLowerCase() === "lengkap") ||
                materiCards[0];
              const content = (preferred.body || preferred.meta?.materi_description || preferred.meta?.description || "").trim();
              if (content) {
                return (
                  <div className="space-y-3">
                    {preferred.title && <h3 className="text-xl font-semibold text-[color:var(--ink-900)]">{preferred.title}</h3>}
                    {containsHtmlTag(content) ? (
                      <SafeHtml
                        className="sage-tiptap-content max-w-none text-[color:var(--ink-700)] dark:text-slate-200"
                        html={content}
                      />
                    ) : (
                      <p className="leading-relaxed text-[color:var(--ink-700)] whitespace-pre-line">{content}</p>
                    )}
                  </div>
                );
              }
            }
            const blocks = parseMaterialBlocks(material.isi_materi);
            if (blocks && blocks.length > 0) {
              return (
                <div className="space-y-4">
                  {blocks.map((block) => {
                    if (block.type === "heading") {
                      return (
                        <h3 key={block.id} className={`text-xl font-semibold text-[color:var(--ink-900)] ${getTextAlignClass(block.align)}`}>
                          {block.value}
                        </h3>
                      );
                    }
                    if (block.type === "paragraph") {
                      return (
                        <p key={block.id} className={`leading-relaxed text-[color:var(--ink-700)] whitespace-pre-line ${getTextAlignClass(block.align)}`}>
                          {block.value}
                        </p>
                      );
                    }
                    if (block.type === "bullet_list" || block.type === "number_list") {
                      const items = block.value.split("\n").map((x) => x.trim()).filter(Boolean);
                      if (items.length === 0) return null;
                      return block.type === "bullet_list" ? (
                        <ul key={block.id} className={`list-disc pl-6 text-[color:var(--ink-700)] space-y-1 ${getTextAlignClass(block.align)}`}>
                          {items.map((item, i) => <li key={`${block.id}-${i}`}>{item}</li>)}
                        </ul>
                      ) : (
                        <ol key={block.id} className={`list-decimal pl-6 text-[color:var(--ink-700)] space-y-1 ${getTextAlignClass(block.align)}`}>
                          {items.map((item, i) => <li key={`${block.id}-${i}`}>{item}</li>)}
                        </ol>
                      );
                    }
                    if (block.type === "video") {
                      const src = normalizeEmbedUrl(block.value);
                      return src ? (
                        <div key={block.id} className={`flex ${block.align === "right" ? "justify-end" : block.align === "center" ? "justify-center" : "justify-start"}`}>
                          <div className={`${getMediaWidthClass(block.size)} rounded-xl overflow-hidden border border-black/5 bg-black/5`}>
                            <iframe
                              src={src}
                              title="Video Materi"
                              className="w-full h-64"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              referrerPolicy="strict-origin-when-cross-origin"
                              allowFullScreen
                            />
                          </div>
                        </div>
                      ) : null;
                    }
                    if (block.type === "image") {
                      return block.value ? (
                        <div key={block.id} className={`flex ${block.align === "right" ? "justify-end" : block.align === "center" ? "justify-center" : "justify-start"}`}>
                          <div className={`${getMediaWidthClass(block.size)} rounded-xl overflow-hidden border border-black/5`}>
                            <Image src={block.value} alt="Gambar Materi" width={1200} height={800} unoptimized className="h-auto w-full object-cover" />
                          </div>
                        </div>
                      ) : null;
                    }
                    if (block.type === "link") {
                      if (!block.value) return null;
                      if (isImageLikeUrl(block.value)) {
                        return (
                          <div key={block.id} className={`flex ${block.align === "right" ? "justify-end" : block.align === "center" ? "justify-center" : "justify-start"}`}>
                            <div className={`${getMediaWidthClass(block.size)} rounded-xl overflow-hidden border border-black/5`}>
                              <Image src={block.value} alt="Gambar Materi" width={1200} height={800} unoptimized className="h-auto w-full object-cover" />
                            </div>
                          </div>
                        );
                      }
                      return (
                        <a
                          key={block.id}
                          href={block.value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-[color:var(--sage-700)] hover:underline dark:text-sky-300 dark:hover:text-sky-200"
                        >
                          {block.value}
                        </a>
                      );
                    }
                    if (block.type === "pdf" || block.type === "ppt") {
                      if (!block.value) return null;
                      if (block.type === "pdf") {
                        return <PdfBlockCard key={block.id} url={block.value} />;
                      }
                      return (
                        <a
                          key={block.id}
                          href={block.value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-[color:var(--sage-700)] hover:underline dark:text-sky-300 dark:hover:text-sky-200"
                        >
                          {block.type.toUpperCase()} Materi
                        </a>
                      );
                    }
                    return null;
                  })}
                </div>
              );
            }
            if (material.isi_materi) {
              if (containsHtmlTag(material.isi_materi)) {
                return <SafeHtml className="sage-tiptap-content max-w-none text-[color:var(--ink-700)] dark:text-slate-200" html={material.isi_materi} />;
              }
              return <p className="leading-relaxed text-[color:var(--ink-700)] whitespace-pre-line">{material.isi_materi}</p>;
            }
            return <p className="text-[color:var(--ink-500)]">Materi teks belum tersedia.</p>;
          })()}
          {material.file_url && (
            <a
              href={`/api/uploads/${material.file_url}`}
              target="_blank"
              className="inline-block text-[color:var(--sage-700)] hover:underline dark:text-sky-300 dark:hover:text-sky-200"
            >
              Download File Materi
            </a>
          )}
        </section>
      )}

      {activeSection === "questions" && (isSoalContext || isTugasContext) && (
        <section className="space-y-4">
          {!isTugasContext && !isCardAnswerMode && (
            <div className="sage-panel p-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <label className="text-xs font-medium uppercase tracking-wide text-[color:var(--ink-500)]">Urutkan:</label>
                <select
                  value={questionSort}
                  onChange={(e) => setQuestionSort(e.target.value as QuestionSort)}
                  className="sage-input min-w-44"
                >
                  <option value="default">Urutan Default</option>
                  <option value="weight_desc">Bobot Paling Besar</option>
                  <option value="alphabet">Alphabet</option>
                  <option value="unanswered_first">Belum Dijawab Dulu</option>
                </select>
                <label className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.02] px-2.5 py-1.5 text-xs font-medium text-[color:var(--ink-600)] dark:border-white/15 dark:bg-white/[0.03]">
                  <input
                    type="checkbox"
                    checked={hideAnsweredQuestions}
                    onChange={(e) => setHideAnsweredQuestions(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Sembunyikan yang sudah dijawab
                </label>
              </div>
            </div>
          )}
          {!isTugasContext && isBulkSubmitMode && (
            <div className="sage-panel p-4 border border-sky-200 bg-sky-50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-sky-800">
                  Mode submit semua aktif. Isi semua jawaban dulu, lalu kirim sekaligus.
                </p>
                <button
                  type="button"
                  className="sage-button"
                  disabled={bulkSubmitLoading || !canSubmitInCurrentState}
                  onClick={() => void handleSubmitAllAnswers()}
                >
                  {bulkSubmitLoading ? "Mengirim Semua..." : "Submit Semua Jawaban"}
                </button>
              </div>
              {bulkSubmitMessage && (
                <p className={`mt-2 text-sm ${bulkSubmitMessage.toLowerCase().includes("berhasil") ? "text-emerald-700 dark:text-emerald-300" : "text-red-600"}`}>
                  {bulkSubmitMessage}
                </p>
              )}
            </div>
          )}
          {!isTugasContext && isCardAnswerMode && (
            <div className="hidden md:block sage-panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-[color:var(--ink-700)]">
                    Mode Kartu Soal {sectionQuizSettings.randomize_question_order ? "(acak)" : ""}
                  </p>
                  <p className="text-xs text-[color:var(--ink-600)]">
                    Soal {cardModeQuestions.length === 0 ? 0 : quizQuestionIndex + 1} / {cardModeQuestions.length}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {sectionQuizSettings.timer_mode !== "none" && typeof activeTimerRemainingSec === "number" && (
                    <span
                      className={`sage-pill ${isActiveTimerExpired ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}
                    >
                      Sisa Waktu: {Math.floor(activeTimerRemainingSec / 60)}:{String(activeTimerRemainingSec % 60).padStart(2, "0")}
                    </span>
                  )}
                  <span className="sage-pill">{submittedCount} Sudah Submit</span>
                </div>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[color:var(--sage-600)] transition-all"
                  style={{
                    width: `${cardModeQuestions.length === 0 ? 0 : ((quizQuestionIndex + 1) / cardModeQuestions.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
          {!isTugasContext && isSoalContext && (
            <>
              {isBeforeSchedule && (
                <div className={`${showMobileQuestionMeta || !isCardAnswerMode ? "block" : "hidden"} md:block sage-panel p-3 border border-amber-200 bg-amber-50 text-sm text-amber-800`}>
                  Kuis belum dibuka. Mulai pada {sectionQuizSettings.schedule_start_at || "-"}.
                </div>
              )}
              {isAfterSchedule && (
                <div className={`${showMobileQuestionMeta || !isCardAnswerMode ? "block" : "hidden"} md:block sage-panel p-3 border border-red-200 bg-red-50 text-sm text-red-700`}>
                  Waktu pengerjaan sudah ditutup.
                </div>
              )}
              {sectionQuizSettings.warn_on_tab_switch && (
                <div className="hidden md:block sage-panel p-3 border border-slate-200 bg-slate-50 text-sm text-slate-700">
                  Pindah tab terdeteksi: {tabSwitchCount}
                  {sectionQuizSettings.max_tab_switch > 0 ? ` / ${sectionQuizSettings.max_tab_switch}` : ""}
                  {tabLocked && " (attempt dikunci)"}
                </div>
              )}
              {hideResultsForStudent && (
                <div className="hidden md:block sage-panel p-3 border border-slate-300 bg-slate-50 text-sm text-slate-700">
                  Tab hasil penilaian disembunyikan oleh guru untuk sesi ini.
                </div>
              )}
              {!hideResultsForStudent && !canOpenResultsTab && (
                <div className="hidden md:block sage-panel p-3 border border-blue-200 bg-blue-50 text-sm text-blue-700">
                  Hasil penilaian belum dirilis guru.
                </div>
              )}
            </>
          )}

          {isTugasContext && (
            <div className="sage-panel p-5 space-y-4">
              <p className="text-sm text-[color:var(--ink-600)]">
                Halaman ini khusus submisi tugas. Isi jawaban/kumpulan tugas pada form berikut.
              </p>
              {!taskSubmissionQuestion ? (
                <p className="text-sm text-[color:var(--ink-500)]">Form submisi tugas belum tersedia.</p>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    const gradingState = getQuestionGradingState(taskSubmissionQuestion);
                    if (gradingState !== "queued" && gradingState !== "processing" && gradingState !== "waiting_result") return null;
                    return (
                      <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 flex items-center gap-2">
                        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                        Nilai tugas sedang diproses. Hasil akan muncul otomatis.
                      </div>
                    );
                  })()}
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                        taskSubmissionQuestion.submission_id ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {taskSubmissionQuestion.submission_id ? "Sudah Submit" : "Belum Submit"}
                    </span>
                    {taskSubmissionQuestion.submission_id && (
                      <span className="sage-pill">
                        Nilai: {(() => {
                          const gradingState = getQuestionGradingState(taskSubmissionQuestion);
                          if (gradingState === "queued" || gradingState === "processing" || gradingState === "waiting_result") {
                            return "Sedang diproses...";
                          }
                          return taskSubmissionQuestion.revised_score ?? taskSubmissionQuestion.skor_ai ?? "-";
                        })()}
                      </span>
                    )}
                    {taskSubmissionQuestion.submission_id && ((taskSubmissionQuestion.teacher_feedback ?? "").trim().length > 0 || taskSubmissionQuestion.revised_score !== undefined) && (
                      <span className="sage-pill bg-emerald-100 text-emerald-700">Sudah direview guru</span>
                    )}
                  </div>
                  <div className="rounded-xl border border-black/5 bg-white p-4 space-y-2">
                    <p className="text-xs uppercase tracking-wide text-[color:var(--ink-500)]">Detail Tugas</p>
                    <p className="text-[color:var(--ink-800)] whitespace-pre-line">
                      {taskCardConfig?.meta?.tugas_instruction || taskCardConfig?.body || taskSubmissionQuestion.teks_soal || "Instruksi tugas belum tersedia."}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-[color:var(--ink-600)]">
                      {taskCardConfig?.meta?.tugas_due_at && <span className="sage-pill">Tenggat: {taskCardConfig.meta.tugas_due_at}</span>}
                      {typeof taskCardConfig?.meta?.tugas_max_score === "number" && <span className="sage-pill">Skor Maks: {taskCardConfig.meta.tugas_max_score}</span>}
                      {taskCardConfig?.meta?.tugas_submission_type && <span className="sage-pill">Pengumpulan: {taskCardConfig.meta.tugas_submission_type}</span>}
                      {typeof taskCardConfig?.meta?.tugas_max_file_mb === "number" && <span className="sage-pill">Maks File: {taskCardConfig.meta.tugas_max_file_mb} MB</span>}
                    </div>
                    {!taskSubmissionQuestion.submission_id && isTaskLate && (
                      <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        Peringatan: waktu pengumpulan sudah lewat. Kamu masih bisa submit, tapi akan tercatat terlambat.
                      </div>
                    )}
                    {Array.isArray(taskCardConfig?.meta?.tugas_allowed_formats) && taskCardConfig?.meta?.tugas_allowed_formats?.length > 0 && (
                      <p className="text-xs text-[color:var(--ink-600)]">Format file: {taskCardConfig.meta.tugas_allowed_formats.join(", ")}</p>
                    )}
                    {taskCardConfig?.meta?.tugas_attachment_url && (
                      <a
                        href={taskCardConfig.meta.tugas_attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex text-sm text-[color:var(--sage-700)] hover:underline dark:text-sky-300 dark:hover:text-sky-200"
                      >
                        Lampiran: {taskCardConfig.meta.tugas_attachment_name || "Buka Lampiran"}
                      </a>
                    )}
                  </div>
                  {!taskSubmissionQuestion.submission_id && (
                    <>
                      <div className="grid gap-3">
                        {taskAllowsTextOrLink && (
                          <div>
                          <label className="text-sm font-medium text-[color:var(--ink-700)]">Jawaban Teks</label>
                          <textarea
                            className="sage-input min-h-28 mt-1"
                            placeholder="Tulis jawaban tugas di sini..."
                            value={taskAnswerText}
                            onChange={(e) => setTaskAnswerText(e.target.value)}
                          />
                          </div>
                        )}
                        {taskAllowsTextOrLink && (
                          <div>
                          <label className="text-sm font-medium text-[color:var(--ink-700)]">Link Jawaban</label>
                          <input
                            className="sage-input mt-1"
                            placeholder="https://..."
                            value={taskAnswerLink}
                            onChange={(e) => setTaskAnswerLink(e.target.value)}
                          />
                          </div>
                        )}
                        {taskAllowsFile && (
                          <div className="space-y-2">
                          <label className="text-sm font-medium text-[color:var(--ink-700)]">Upload Dokumen</label>
                          <input
                            type="file"
                            onChange={(e) => handlePickTaskFile(e.target.files?.[0] || null)}
                            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2"
                          />
                          {taskPendingFile && (
                            <p className="text-xs text-[color:var(--ink-600)]">
                              Preview file: {taskPendingFile.name} ({Math.ceil(taskPendingFile.size / 1024)} KB)
                            </p>
                          )}
                          <button
                            type="button"
                            className="sage-button-outline"
                            disabled={!taskPendingFile || taskUploading}
                            onClick={() => void handleUploadTaskFile()}
                          >
                            {taskUploading ? "Uploading..." : "Upload File"}
                          </button>
                          {taskAnswerFileUrl && (
                            <a
                              href={taskAnswerFileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-sm text-[color:var(--sage-700)] hover:underline dark:text-sky-300 dark:hover:text-sky-200"
                            >
                              File terupload: {taskAnswerFileName || taskAnswerFileUrl}
                            </a>
                          )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="sage-button"
                          disabled={!!submitLoading[taskSubmissionQuestion.id]}
                          onClick={() => void handleSubmitTask()}
                        >
                          {submitLoading[taskSubmissionQuestion.id] ? "Mengirim..." : "Submit Tugas"}
                        </button>
                        {submitMessage[taskSubmissionQuestion.id] && (
                          <span
                            className={`text-sm ${
                              submitMessage[taskSubmissionQuestion.id].toLowerCase().includes("berhasil")
                                ? "text-emerald-700 dark:text-emerald-300"
                                : "text-red-500"
                            }`}
                          >
                            {submitMessage[taskSubmissionQuestion.id]}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                  {taskSubmissionQuestion.submission_id && taskSubmissionQuestion.student_essay_text && (
                    <div className="bg-white border border-black/5 rounded-xl p-4">
                      <p className="text-xs uppercase tracking-wide text-[color:var(--ink-500)]">Submisi Anda</p>
                      <p className="mt-2 text-[color:var(--ink-800)] whitespace-pre-line">{taskSubmissionQuestion.student_essay_text}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!isTugasContext && displayQuestions.length === 0 && <div className="sage-panel p-6 text-[color:var(--ink-500)]">Belum ada soal.</div>}
          {!isTugasContext && !isCardAnswerMode && displayQuestions.length > 0 && visibleQuestions.length === 0 && (
            <div className="sage-panel p-6 text-[color:var(--ink-500)]">Semua soal sudah dijawab.</div>
          )}
          {!isTugasContext && !isCardAnswerMode && visibleQuestions.map((q, index) => {
            const isReattempting = !!reattemptQuestionIds[q.id];
            const detailOpen = Boolean(openQuestionDetails[q.id]) || isReattempting;
            const attemptCount = getAttemptCount(q);
            const attemptLimitLabel = sectionQuizSettings.attempt_limit > 0 ? String(sectionQuizSettings.attempt_limit) : "tak terbatas";
            const cooldownSeconds = getRemainingCooldownSeconds(q);
            const isAttemptLimitReached =
              sectionQuizSettings.attempt_limit > 0 && attemptCount >= sectionQuizSettings.attempt_limit;
            const canReattemptNow = canStartReattempt(q);
            const gradingState = getQuestionGradingState(q);
            const scoreLabel =
              gradingState === "queued" || gradingState === "processing" || gradingState === "waiting_result"
                ? "Sedang diproses..."
                : q.revised_score ?? q.skor_ai ?? "-";
            return (
            <div key={q.id} className="sage-card p-3.5 md:p-4">
              <div
                role="button"
                tabIndex={0}
                className="flex cursor-pointer items-start justify-between gap-3 rounded-lg"
                onClick={() =>
                  setOpenQuestionDetails((prev) => ({
                    ...prev,
                    [q.id]: !detailOpen,
                  }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpenQuestionDetails((prev) => ({
                      ...prev,
                      [q.id]: !detailOpen,
                    }));
                  }
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ink-500)]">Soal {index + 1}</p>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        q.submission_id ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                      }`}
                    >
                      {isReattempting ? "Mode Coba Ulang" : q.submission_id ? "Sudah Submit" : "Belum Submit"}
                    </span>
                    {q.submission_id && (
                      <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
                        Nilai: {scoreLabel}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm font-medium leading-relaxed text-[color:var(--ink-800)] md:text-[15px]">
                    {q.teks_soal}
                  </p>
                </div>
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white/80 text-sm text-slate-600 dark:border-white/15 dark:bg-slate-900/70 dark:text-slate-200">
                  {detailOpen ? "▴" : "▾"}
                </span>
              </div>

              {detailOpen && sectionQuizSettings.show_rubric_in_question && Array.isArray(q.rubrics) && q.rubrics.length > 0 && (
                <details className="group mt-3 overflow-hidden rounded-xl border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ink-600)]">Rubrik Penilaian</p>
                      <p className="text-[11px] text-[color:var(--ink-500)]">
                        {q.rubrics.length} aspek • klik untuk buka/tutup
                      </p>
                    </div>
                    <span className="inline-flex rounded-full border border-black/10 bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-[color:var(--ink-700)] group-open:hidden dark:border-white/15 dark:bg-slate-900/70 dark:text-slate-200">
                      Buka
                    </span>
                    <span className="hidden rounded-full border border-black/10 bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-[color:var(--ink-700)] group-open:inline-flex dark:border-white/15 dark:bg-slate-900/70 dark:text-slate-200">
                      Tutup
                    </span>
                  </summary>
                  <div className="border-t border-black/10 px-3 pb-3 pt-2 space-y-2 dark:border-white/10">
                    {q.rubrics.map((rubric, rubricIndex) => {
                      const descriptors = normalizeRubricDescriptors(rubric);
                      return (
                        <div key={`${q.id}-rubric-${rubricIndex}`} className="rounded-lg border border-black/10 bg-white/80 p-2.5 dark:border-white/10 dark:bg-slate-900/60">
                          <p className="text-sm font-semibold text-[color:var(--ink-800)]">{rubric.nama_aspek || `Aspek ${rubricIndex + 1}`}</p>
                          {descriptors.length > 0 ? (
                            <ul className="mt-1 space-y-0.5 text-xs text-[color:var(--ink-600)]">
                              {descriptors.map((row) => (
                                <li key={`${q.id}-${rubricIndex}-${row.score}`}>
                                  <span className="font-semibold">{row.score}</span>: {row.description}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-xs text-[color:var(--ink-500)]">Deskriptor rubrik belum tersedia.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}
              {detailOpen && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/10 pt-3 dark:border-white/10">
                <span className="sage-pill">Bobot: {typeof q.weight === "number" && q.weight > 0 ? q.weight : 1}</span>
                {q.submission_id && (
                  <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
                    Percobaan: {attemptCount} / {attemptLimitLabel}
                  </span>
                )}
                {q.submission_id && (
                  <span className="sage-pill">
                    Nilai: {scoreLabel}
                  </span>
                )}
                {q.submission_id && (() => {
                  if (gradingState === "queued" || gradingState === "processing" || gradingState === "waiting_result") {
                    return <span className="sage-pill bg-amber-100 text-amber-800">AI {gradingState === "queued" ? "Queued" : "Processing"}</span>;
                  }
                  if (gradingState === "failed") {
                    return <span className="sage-pill bg-red-100 text-red-700">AI Failed</span>;
                  }
                  return null;
                })()}
                {q.submission_id && canOpenResultsTab ? (
                  <button
                    onClick={() => {
                      setSelectedResultQuestionId(q.id);
                      setActiveSection("results");
                    }}
                    className="sage-button-outline"
                  >
                    Lihat Hasil
                  </button>
                ) : !q.submission_id ? (
                  <button type="button" className="sage-button">
                    Siap Dikerjakan
                  </button>
                ) : (
                  <span className="sage-pill bg-slate-100 text-slate-700">Hasil disembunyikan</span>
                )}
              </div>
              )}
              {detailOpen && (!q.submission_id || isReattempting) && (
                <div className="mt-3 space-y-3">
                  <textarea
                    className="sage-input min-h-32"
                    placeholder="Tulis jawaban kamu di sini..."
                    value={answerInputs[q.id] ?? ""}
                    readOnly={!canSubmitInCurrentState || !!lockedQuestionIds[q.id]}
                    onChange={(e) => setAnswerInputs((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  />
                  <div className="flex items-center gap-3">
                    {!isBulkSubmitMode && (
                      <button
                        type="button"
                        className="sage-button"
                        disabled={!!submitLoading[q.id] || !canSubmitInCurrentState || !!lockedQuestionIds[q.id]}
                        onClick={() => handleSubmitAnswer(q.id)}
                      >
                      {submitLoading[q.id] ? "Mengirim..." : isReattempting ? "Kirim Ulang Jawaban" : "Submit Jawaban"}
                    </button>
                    )}
                    {q.submission_id && isReattempting && (
                      <button
                        type="button"
                        className="sage-button-outline"
                        onClick={() => setReattemptQuestionIds((prev) => ({ ...prev, [q.id]: false }))}
                      >
                        Batal Coba Ulang
                      </button>
                    )}
                    {submitMessage[q.id] && (
                      <span
                        className={`text-sm ${
                          submitMessage[q.id].toLowerCase().includes("berhasil")
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-red-500"
                        }`}
                      >
                        {submitMessage[q.id]}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {detailOpen && q.submission_id && !isReattempting && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/10 pt-3 dark:border-white/10">
                  <button
                    type="button"
                    className="sage-button-outline"
                    disabled={!canSubmitInCurrentState || !canReattemptNow}
                    onClick={() => requestReattempt(q)}
                  >
                    {cooldownSeconds > 0
                      ? `Cooldown ${formatCooldown(cooldownSeconds)}`
                      : isAttemptLimitReached
                        ? "Limit Attempt Habis"
                        : "Coba Ulang"}
                  </button>
                </div>
              )}
              {detailOpen && q.submission_id && q.student_essay_text && !isReattempting && (
                <div className="mt-3 rounded-xl border border-black/10 bg-white/80 p-3.5 dark:border-white/10 dark:bg-slate-900/60">
                  <button
                    type="button"
                    onClick={() => setOpenStudentAnswers((prev) => ({ ...prev, [q.id]: !prev[q.id] }))}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <p className="text-xs uppercase tracking-wide text-[color:var(--ink-500)]">Jawaban Anda</p>
                    <span className="text-xs text-[color:var(--sage-700)] dark:text-sky-300">
                      {openStudentAnswers[q.id] ? "Tutup" : "Buka"}
                    </span>
                  </button>
                  {openStudentAnswers[q.id] && (
                    <p className="mt-2 text-[color:var(--ink-800)] whitespace-pre-line">{q.student_essay_text}</p>
                  )}
                </div>
              )}
            </div>
            );
          })}
          {!isTugasContext && isCardAnswerMode && cardModeQuestions.length > 0 && currentCardQuestion && (
            <div className="sage-card p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-wide text-[color:var(--ink-500)]">
                  Soal {quizQuestionIndex + 1} dari {cardModeQuestions.length}
                </p>
                <div className="flex items-center gap-2">
                  {currentCardQuestion.submission_id && (
                    <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
                      Percobaan: {getAttemptCount(currentCardQuestion)} / {sectionQuizSettings.attempt_limit > 0 ? sectionQuizSettings.attempt_limit : "tak terbatas"}
                    </span>
                  )}
                  <span className="sage-pill">
                    Bobot: {typeof currentCardQuestion.weight === "number" && currentCardQuestion.weight > 0 ? currentCardQuestion.weight : 1}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                      currentCardQuestion.submission_id ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {reattemptQuestionIds[currentCardQuestion.id] ? "Mode Coba Ulang" : currentCardQuestion.submission_id ? "Sudah Submit" : "Belum Submit"}
                  </span>
                </div>
              </div>
              <p className="text-lg text-[color:var(--ink-900)]">{currentCardQuestion.teks_soal}</p>
              {sectionQuizSettings.show_rubric_in_question && Array.isArray(currentCardQuestion.rubrics) && currentCardQuestion.rubrics.length > 0 && (
                <details className="group overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Rubrik Penilaian</p>
                      <p className="text-[11px] text-slate-500">
                        {currentCardQuestion.rubrics.length} aspek • klik untuk buka/tutup
                      </p>
                    </div>
                    <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 group-open:hidden">
                      Buka
                    </span>
                    <span className="hidden rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 group-open:inline-flex">
                      Tutup
                    </span>
                  </summary>
                  <div className="border-t border-slate-200 px-3 pb-3 pt-2 space-y-2">
                    {currentCardQuestion.rubrics.map((rubric, rubricIndex) => {
                      const descriptors = normalizeRubricDescriptors(rubric);
                      return (
                        <div key={`${currentCardQuestion.id}-card-rubric-${rubricIndex}`} className="rounded-lg border border-slate-200 bg-white p-2.5">
                          <p className="text-sm font-semibold text-slate-800">{rubric.nama_aspek || `Aspek ${rubricIndex + 1}`}</p>
                          {descriptors.length > 0 ? (
                            <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                              {descriptors.map((row) => (
                                <li key={`${currentCardQuestion.id}-${rubricIndex}-${row.score}`}>
                                  <span className="font-semibold">{row.score}</span>: {row.description}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-xs text-slate-500">Deskriptor rubrik belum tersedia.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}

              {!currentCardQuestion.submission_id || !!reattemptQuestionIds[currentCardQuestion.id] ? (
                <div className="space-y-3">
                  {isActiveTimerExpired && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      Waktu soal ini sudah habis.
                    </div>
                  )}
                  <textarea
                    className="sage-input min-h-36"
                    placeholder="Tulis jawaban kamu di sini..."
                    value={answerInputs[currentCardQuestion.id] ?? ""}
                    readOnly={!canSubmitInCurrentState || !!lockedQuestionIds[currentCardQuestion.id]}
                    onChange={(e) => setAnswerInputs((prev) => ({ ...prev, [currentCardQuestion.id]: e.target.value }))}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="sage-button"
                      disabled={
                        !!submitLoading[currentCardQuestion.id] ||
                        isActiveTimerExpired ||
                        !canSubmitInCurrentState ||
                        !!lockedQuestionIds[currentCardQuestion.id]
                      }
                      onClick={() => handleSubmitAnswer(currentCardQuestion.id)}
                    >
                      {submitLoading[currentCardQuestion.id]
                        ? "Mengirim..."
                        : reattemptQuestionIds[currentCardQuestion.id]
                          ? "Kirim Ulang Jawaban"
                          : "Submit Jawaban"}
                    </button>
                    {currentCardQuestion.submission_id && reattemptQuestionIds[currentCardQuestion.id] && (
                      <button
                        type="button"
                        className="sage-button-outline"
                        onClick={() =>
                          setReattemptQuestionIds((prev) => ({ ...prev, [currentCardQuestion.id]: false }))
                        }
                      >
                        Batal Coba Ulang
                      </button>
                    )}
                    {submitMessage[currentCardQuestion.id] && (
                      <span
                        className={`text-sm ${
                          submitMessage[currentCardQuestion.id].toLowerCase().includes("berhasil")
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-red-500"
                        }`}
                      >
                        {submitMessage[currentCardQuestion.id]}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-white border border-black/5 rounded-xl p-4">
                    <p className="text-xs uppercase tracking-wide text-[color:var(--ink-500)]">Jawaban Anda</p>
                    <p className="mt-2 text-[color:var(--ink-800)] whitespace-pre-line">
                      {currentCardQuestion.student_essay_text || "-"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="sage-button-outline"
                      disabled={!canSubmitInCurrentState || !canStartReattempt(currentCardQuestion)}
                      onClick={() => requestReattempt(currentCardQuestion)}
                    >
                      {(() => {
                        const cooldown = getRemainingCooldownSeconds(currentCardQuestion);
                        const reachedLimit =
                          sectionQuizSettings.attempt_limit > 0 &&
                          getAttemptCount(currentCardQuestion) >= sectionQuizSettings.attempt_limit;
                        if (cooldown > 0) return `Cooldown ${formatCooldown(cooldown)}`;
                        if (reachedLimit) return "Limit Attempt Habis";
                        return "Coba Ulang";
                      })()}
                    </button>
                  </div>
                  {canOpenResultsTab ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedResultQuestionId(currentCardQuestion.id);
                          setActiveSection("results");
                        }}
                        className="sage-button-outline"
                      >
                        Lihat Hasil
                      </button>
                    </div>
                  ) : (
                    <span className="sage-pill bg-slate-100 text-slate-700">Hasil disembunyikan</span>
                  )}
                </div>
              )}

              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-black/5">
                <button
                  type="button"
                  className="sage-button-outline"
                  disabled={quizQuestionIndex <= 0 || !sectionQuizSettings.allow_back_navigation}
                  onClick={() => goToCardQuestionIndex(quizQuestionIndex - 1)}
                >
                  Soal Sebelumnya
                </button>
                <button
                  type="button"
                  className="sage-button-outline"
                  disabled={quizQuestionIndex >= cardModeQuestions.length - 1}
                  onClick={() => goToCardQuestionIndex(quizQuestionIndex + 1)}
                >
                  Soal Berikutnya
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {activeSection === "results" && canOpenResultsTab && (
        <section className="space-y-5">
          {(pendingEvaluationCount > 0 || backgroundSyncing) && (
            <div className="sage-panel p-4 border border-amber-300 bg-amber-50">
              <div className="flex items-center gap-3 text-sm text-amber-900">
                <span className="inline-flex h-3 w-3 rounded-full bg-amber-500 animate-pulse" />
                <span>
                  {pendingEvaluationCount > 0
                    ? `Sedang menunggu hasil AI untuk ${pendingEvaluationCount} jawaban.`
                    : "Memperbarui hasil terbaru..."}
                </span>
              </div>
            </div>
          )}
          <div className="sage-panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[color:var(--ink-500)]">Nilai Akhir Materi</p>
                <p className="mt-1 text-3xl font-semibold text-[color:var(--ink-900)]">
                  {finalMaterialScore.score == null ? "-" : finalMaterialScore.score.toFixed(2)}
                  {finalMaterialScore.score != null && <span className="text-base font-medium text-[color:var(--ink-500)]"> / 100</span>}
                </p>
                {(pendingEvaluationCount > 0 || backgroundSyncing) && (
                  <p className="mt-1 text-xs text-amber-700 animate-pulse">Nilai sedang disinkronkan otomatis...</p>
                )}
                <p className="mt-1 text-sm text-[color:var(--ink-500)]">
                  Rumus: (Σ(nilai soal × bobot) / Σ(bobot)) × (jumlah soal dijawab / total soal) = (rata-rata berbobot × {finalMaterialScore.counted}) / {finalMaterialScore.totalQuestions || 1}.
                </p>
              </div>
              <div className="min-w-64">
                <label className="text-xs uppercase tracking-wide text-[color:var(--ink-500)]">Urutkan Hasil</label>
                <select
                  value={resultSort}
                  onChange={(e) => setResultSort(e.target.value as ResultSort)}
                  className="sage-input mt-1"
                >
                  <option value="default">Default (Nomor Soal)</option>
                  <option value="score_high">Nilai Tertinggi</option>
                  <option value="score_low">Nilai Terendah</option>
                  <option value="latest_score">Nilai Terbaru</option>
                  <option value="newly_reviewed">Baru Direview</option>
                </select>
              </div>
            </div>
          </div>

          {resultItems.length === 0 && (
            <div className="sage-panel p-6 text-[color:var(--ink-500)]">Belum ada hasil. Kerjakan soal dulu.</div>
          )}

          {resultItems.map(({ question, rubricEntries, hasTeacherPane, hasAIPane, radarData, originalOrder }) => {
            const isOpen = !!openResults[question.id];
            const gradingState = getQuestionGradingState(question);
            const isPendingResult = gradingState === "queued" || gradingState === "processing" || gradingState === "waiting_result";
            const aiFeedbackKey = `${question.id}-ai`;
            const teacherFeedbackKey = `${question.id}-teacher`;
            const isAIFeedbackExpanded = !!expandedFeedback[aiFeedbackKey];
            const isTeacherFeedbackExpanded = !!expandedFeedback[teacherFeedbackKey];
            const hasLongAIFeedback = (question.umpan_balik_ai ?? "").trim().length > 100;
            const hasLongTeacherFeedback = (question.teacher_feedback ?? "").trim().length > 100;
            return (
              <div
                key={question.id}
                id={`result-${question.id}`}
                className={`sage-card p-4 ${
                  selectedResultQuestionId === question.id ? "ring-2 ring-[color:var(--sage-500)]" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleResult(question.id)}
                  className="w-full flex items-start justify-between gap-3 text-left"
                >
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[color:var(--ink-500)]">Soal {originalOrder + 1}</p>
                    <p className="text-[color:var(--ink-900)] mt-1 font-semibold">{question.teks_soal}</p>
                  </div>
                  <span className="text-sm text-[color:var(--ink-500)]">{isOpen ? "Tutup" : "Buka"}</span>
                </button>

                {isOpen && (
                  <div className="mt-4 space-y-4">
                    <p className="text-sm text-[color:var(--ink-500)]">
                      Bobot: {typeof question.weight === "number" && question.weight > 0 ? question.weight : 1}
                    </p>
                    {sectionQuizSettings.show_ideal_answer && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Jawaban Ideal</p>
                        <p className="mt-1 text-sm text-slate-700 whitespace-pre-line">
                          {(question.ideal_answer || "").trim() || "Belum tersedia."}
                        </p>
                      </div>
                    )}

                    {isPendingResult && !hasAIPane && !hasTeacherPane && (
                      <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
                        <p className="text-sm font-medium text-amber-900 flex items-center gap-2">
                          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                          {gradingState === "queued"
                            ? "Jawaban ada di antrian AI."
                            : gradingState === "processing"
                              ? "AI sedang menilai jawaban."
                              : "Menunggu hasil penilaian muncul."}
                        </p>
                        <p className="mt-1 text-xs text-amber-700">Tab ini refresh otomatis, tidak perlu reload halaman.</p>
                      </div>
                    )}
                    {gradingState === "failed" && (
                      <div className="bg-red-50 rounded-2xl border border-red-200 p-4">
                        <p className="text-sm font-medium text-red-800">Penilaian AI gagal untuk jawaban ini.</p>
                        {(question.ai_grading_error ?? "").trim().length > 0 && (
                          <p className="mt-1 text-xs text-red-700">{question.ai_grading_error}</p>
                        )}
                      </div>
                    )}

                    <div className={`grid gap-4 ${hasTeacherPane ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
                      {hasAIPane && (
                        <div className="bg-white rounded-2xl border border-black/5 p-4 space-y-3">
                          <h4 className="font-semibold">Statistik AI</h4>
                          <p className="text-sm">AI Score: <b>{question.skor_ai ?? "-"}</b></p>
                          {question.umpan_balik_ai && (
                            <div className="text-sm">
                              <p className="font-medium mb-1">Feedback AI</p>
                              <p className="text-[color:var(--ink-700)] whitespace-pre-line">
                                {getFeedbackText(question.umpan_balik_ai, isAIFeedbackExpanded)}
                              </p>
                              {hasLongAIFeedback && (
                                <button
                                  type="button"
                                  onClick={() => toggleFeedback(aiFeedbackKey)}
                                  className="mt-1 text-xs font-medium text-[color:var(--sage-700)] hover:underline dark:text-sky-300 dark:hover:text-sky-200"
                                >
                                  {isAIFeedbackExpanded ? "Tutup" : "Baca selengkapnya"}
                                </button>
                              )}
                            </div>
                          )}
                          {sectionQuizSettings.show_rubric_breakdown && rubricEntries.length > 0 && (
                            <div>
                              <p className="font-medium text-sm mb-1">Skor Per Aspek</p>
                              <div className="space-y-1">
                                {rubricEntries.map((r) => (
                                  <div key={r.aspek} className="flex justify-between text-sm">
                                    <span>{r.aspek}</span>
                                    <span>{r.score} / {r.maxScore}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {hasTeacherPane && (
                        <div className="bg-white rounded-2xl border border-black/5 p-4 space-y-3">
                          <h4 className="font-semibold">Statistik Guru</h4>
                          <p className="text-sm">Nilai Revisi Guru: <b>{question.revised_score ?? "-"}</b></p>
                          {question.teacher_feedback && (
                            <div className="text-sm">
                              <p className="font-medium mb-1">Feedback Guru</p>
                              <p className="text-[color:var(--ink-700)] whitespace-pre-line">
                                {getFeedbackText(question.teacher_feedback, isTeacherFeedbackExpanded)}
                              </p>
                              {hasLongTeacherFeedback && (
                                <button
                                  type="button"
                                  onClick={() => toggleFeedback(teacherFeedbackKey)}
                                  className="mt-1 text-xs font-medium text-[color:var(--sage-700)] hover:underline dark:text-sky-300 dark:hover:text-sky-200"
                                >
                                  {isTeacherFeedbackExpanded ? "Tutup" : "Baca selengkapnya"}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {sectionQuizSettings.show_rubric_breakdown && radarData.length > 0 && (
                      <div className="h-72 bg-white rounded-2xl border border-black/5 p-4">
                        <ResponsiveContainer>
                          {radarData.length === 2 ? (
                            <BarChart
                              data={radarData}
                              layout="vertical"
                              margin={{ top: 10, right: 24, bottom: 10, left: 16 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis
                                type="number"
                                domain={[0, Math.max(...radarData.map((d) => d.full), 1)]}
                                tick={{ fontSize: 11 }}
                                angle={0}
                              />
                              <YAxis
                                type="category"
                                dataKey="subject"
                                width={120}
                                tick={{ fontSize: 11 }}
                                angle={0}
                              />
                              <Tooltip
                                formatter={(value, _name, item) => {
                                  const score = typeof value === "number" ? value : Number(value ?? 0);
                                  const full = typeof item?.payload?.full === "number" ? item.payload.full : "-";
                                  return [`${score} / ${full}`, "Skor"];
                                }}
                              />
                              <Bar dataKey="score" fill="#0f766e" radius={[0, 6, 6, 0]}>
                                <LabelList dataKey="score" position="right" style={{ fontSize: 11, fill: "#0f172a" }} />
                              </Bar>
                            </BarChart>
                          ) : (
                            <RadarChart data={radarData}>
                              <PolarGrid />
                              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                              <PolarRadiusAxis tick={{ fontSize: 10 }} />
                              <Radar dataKey="score" fill="#0f766e" fillOpacity={0.45} />
                            </RadarChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
