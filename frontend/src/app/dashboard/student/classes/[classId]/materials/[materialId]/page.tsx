"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";

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
  weight?: number;
  rubrics?: QuestionRubric[];
  submission_id?: string;
  student_essay_text?: string;
  skor_ai?: number;
  umpan_balik_ai?: string;
  revised_score?: number;
  teacher_feedback?: string;
  rubric_scores?: RubricScore[];
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

const parseMaterialBlocks = (raw?: string): MaterialContentBlock[] | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.format !== "sage_blocks" || !Array.isArray(parsed?.blocks)) return null;
    return parsed.blocks
      .map((b: any) => ({
        id: typeof b.id === "string" && b.id ? b.id : `blk_${Math.random().toString(36).slice(2, 9)}`,
        type: b.type as MaterialBlockType,
        value: typeof b.value === "string" ? b.value : "",
        align: ["left", "center", "right", "justify"].includes(b.align) ? b.align : "left",
        size: ["small", "medium", "large", "full"].includes(b.size) ? b.size : "medium",
      }))
      .filter((b: MaterialContentBlock) => ["heading", "paragraph", "video", "image", "link", "pdf", "ppt", "bullet_list", "number_list"].includes(b.type));
  } catch {
    return null;
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

const getRubricMaxScore = (rubric?: QuestionRubric): number => {
  if (!rubric?.descriptors) return 0;
  const entries = Array.isArray(rubric.descriptors)
    ? rubric.descriptors
    : Object.entries(rubric.descriptors).map(([score, description]) => ({ score, description }));
  return entries.reduce((max, item) => {
    const value = Number((item as RubricDescriptor).score);
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

export default function StudentMaterialDetailPage() {
  const params = useParams();
  const classId = params.classId as string;
  const materialId = params.materialId as string;

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
  const [openStudentAnswers, setOpenStudentAnswers] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async (showLoader = true) => {
    if (!classId || !materialId) return;

    if (showLoader) setLoading(true);
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
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [classId, materialId]);

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  const questions = material?.essay_questions ?? [];
  const materialType = (material?.material_type || "materi") as "materi" | "soal" | "tugas";
  const isSoalType = materialType === "soal";
  const isTugasType = materialType === "tugas";
  const taskSubmissionQuestion = isTugasType ? questions[0] : null;
  const submittedCount = questions.filter((q) => !!q.submission_id).length;

  useEffect(() => {
    if (!material) return;
    if (isSoalType && activeSection === "overview") {
      setActiveSection("questions");
      return;
    }
    if (isTugasType && activeSection === "results") {
      setActiveSection("questions");
    }
  }, [material, isSoalType, isTugasType, activeSection]);
  const sortedQuestions = useMemo(() => {
    const withIndex = questions.map((q, index) => ({ q, index }));
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
        return questions;
    }
  }, [questions, questionSort]);

  const resultItems = useMemo(() => {
    return questions
      .filter((q) => !!q.submission_id)
      .map((q) => {
        const rubricEntries = getRubricScoreEntries(q);
        const hasTeacherPane = q.revised_score !== undefined;
        const hasAIPane = q.skor_ai !== undefined || rubricEntries.length > 0;
        return {
          question: q,
          rubricEntries,
          hasTeacherPane,
          hasAIPane,
          radarData: rubricEntries.map((r) => ({
            subject: r.aspek,
            score: r.score,
            full: r.maxScore,
          })),
        };
      });
  }, [questions]);

  const finalMaterialScore = useMemo(() => {
    const totalQuestions = questions.length;
    if (totalQuestions === 0) {
      return { score: null as number | null, counted: 0, totalWeight: 0, totalQuestions: 0 };
    }

    const scoredQuestions = questions.filter((q) => {
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
  }, [questions]);

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

  const handleSubmitAnswer = async (questionId: string) => {
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
      setSubmitMessage((prev) => ({ ...prev, [questionId]: data?.grading_message || "Jawaban berhasil dikirim." }));
      await fetchData(false);
    } catch (err: any) {
      setSubmitMessage((prev) => ({ ...prev, [questionId]: err.message || "Terjadi kesalahan saat submit." }));
    } finally {
      setSubmitLoading((prev) => ({ ...prev, [questionId]: false }));
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-[color:var(--ink-500)]">Loading...</div>;
  }

  if (error) {
    return <div className="sage-panel p-6 text-red-500">{error}</div>;
  }

  if (!material || !cls) return null;

  return (
    <div className="space-y-6">
      <section className="sage-panel p-6">
        <Link href={`/dashboard/student/classes/${classId}`} className="text-sm text-[color:var(--sage-700)] hover:underline">
          ← Kembali ke daftar materi
        </Link>
        <p className="mt-2 text-xs uppercase tracking-wide text-[color:var(--ink-500)]">{cls.class_name}</p>
        <h1 className="mt-1 text-3xl text-[color:var(--ink-900)]">{material.judul}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-[color:var(--ink-600)]">
          <span
            className={`sage-pill ${
              isSoalType ? "bg-blue-100 text-blue-700" : isTugasType ? "bg-purple-100 text-purple-700" : ""
            }`}
          >
            Tipe: {isSoalType ? "Soal" : isTugasType ? "Tugas" : "Materi"}
          </span>
          <span className="sage-pill">{isTugasType ? "1 Form Submisi" : `${questions.length} Soal`}</span>
          <span className="sage-pill">{submittedCount} Sudah Submit</span>
        </div>
      </section>

      <section className="sage-panel p-3">
        <div className={`grid gap-2 ${isTugasType ? "grid-cols-2" : isSoalType ? "grid-cols-2" : "grid-cols-3"}`}>
          {!isSoalType && (
            <button
              onClick={() => setActiveSection("overview")}
              className={`rounded-xl px-4 py-2 text-sm ${
                activeSection === "overview" ? "bg-[color:var(--sage-700)] text-white" : "bg-[color:var(--sand-50)] text-[color:var(--ink-600)]"
              }`}
            >
              {isTugasType ? "Detail Tugas" : "Overview"}
            </button>
          )}
          <button
            onClick={() => setActiveSection("questions")}
            className={`rounded-xl px-4 py-2 text-sm ${
              activeSection === "questions" ? "bg-[color:var(--sage-700)] text-white" : "bg-[color:var(--sand-50)] text-[color:var(--ink-600)]"
            }`}
          >
            {isTugasType ? "Submisi" : "Soal"}
          </button>
          {!isTugasType && (
            <button
              onClick={() => setActiveSection("results")}
              className={`rounded-xl px-4 py-2 text-sm ${
                activeSection === "results" ? "bg-[color:var(--sage-700)] text-white" : "bg-[color:var(--sand-50)] text-[color:var(--ink-600)]"
              }`}
            >
              Hasil Saya
            </button>
          )}
        </div>
      </section>

      {activeSection === "overview" && !isSoalType && (
        <section className="sage-panel p-6 space-y-3">
          <h2 className="text-lg font-semibold text-[color:var(--ink-900)]">Isi Materi</h2>
          {(() => {
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
                            <img src={block.value} alt="Gambar Materi" className="w-full h-auto object-cover" />
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
                              <img src={block.value} alt="Gambar Materi" className="w-full h-auto object-cover" />
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
                          className="inline-flex items-center gap-2 text-[color:var(--sage-700)] hover:underline"
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
                          className="inline-flex items-center gap-2 text-[color:var(--sage-700)] hover:underline"
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
                return (
                  <div
                    className="prose prose-slate max-w-none text-[color:var(--ink-700)]"
                    dangerouslySetInnerHTML={{ __html: material.isi_materi }}
                  />
                );
              }
              return <p className="leading-relaxed text-[color:var(--ink-700)] whitespace-pre-line">{material.isi_materi}</p>;
            }
            return <p className="text-[color:var(--ink-500)]">Materi teks belum tersedia.</p>;
          })()}
          {material.file_url && (
            <a href={`/api/uploads/${material.file_url}`} target="_blank" className="inline-block text-[color:var(--sage-700)] hover:underline">
              Download File Materi
            </a>
          )}
        </section>
      )}

      {activeSection === "questions" && (
        <section className="space-y-4">
          {!isTugasType && (
            <div className="sage-panel p-4">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm text-[color:var(--ink-600)]">Urutkan Soal:</label>
                <select
                  value={questionSort}
                  onChange={(e) => setQuestionSort(e.target.value as QuestionSort)}
                  className="sage-input min-w-52"
                >
                  <option value="default">Urutan Default</option>
                  <option value="weight_desc">Bobot Paling Besar</option>
                  <option value="alphabet">Alphabet</option>
                  <option value="unanswered_first">Belum Dijawab Dulu</option>
                </select>
              </div>
            </div>
          )}

          {isTugasType && (
            <div className="sage-panel p-5 space-y-4">
              <p className="text-sm text-[color:var(--ink-600)]">
                Halaman ini khusus submisi tugas. Isi jawaban/kumpulan tugas pada form berikut.
              </p>
              {!taskSubmissionQuestion ? (
                <p className="text-sm text-[color:var(--ink-500)]">Form submisi tugas belum tersedia.</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                        taskSubmissionQuestion.submission_id ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {taskSubmissionQuestion.submission_id ? "Sudah Submit" : "Belum Submit"}
                    </span>
                    {taskSubmissionQuestion.submission_id && (
                      <span className="sage-pill">Nilai: {taskSubmissionQuestion.revised_score ?? taskSubmissionQuestion.skor_ai ?? "-"}</span>
                    )}
                  </div>
                  {!taskSubmissionQuestion.submission_id && (
                    <>
                      <textarea
                        className="sage-input min-h-40"
                        placeholder="Tulis jawaban/kumpulan tugas kamu di sini..."
                        value={answerInputs[taskSubmissionQuestion.id] ?? ""}
                        onChange={(e) => setAnswerInputs((prev) => ({ ...prev, [taskSubmissionQuestion.id]: e.target.value }))}
                      />
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="sage-button"
                          disabled={!!submitLoading[taskSubmissionQuestion.id]}
                          onClick={() => handleSubmitAnswer(taskSubmissionQuestion.id)}
                        >
                          {submitLoading[taskSubmissionQuestion.id] ? "Mengirim..." : "Submit Tugas"}
                        </button>
                        {submitMessage[taskSubmissionQuestion.id] && (
                          <span
                            className={`text-sm ${
                              submitMessage[taskSubmissionQuestion.id].toLowerCase().includes("berhasil")
                                ? "text-[color:var(--sage-700)]"
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

          {!isTugasType && questions.length === 0 && <div className="sage-panel p-6 text-[color:var(--ink-500)]">Belum ada soal.</div>}
          {!isTugasType && sortedQuestions.map((q, index) => (
            <div key={q.id} className="sage-card p-5">
              <p className="text-xs uppercase tracking-wide text-[color:var(--ink-500)]">Soal {index + 1}</p>
              <p className="mt-1 text-[color:var(--ink-800)]">{q.teks_soal}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="sage-pill">Bobot: {typeof q.weight === "number" && q.weight > 0 ? q.weight : 1}</span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                    q.submission_id ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"
                  }`}
                >
                  {q.submission_id ? "Sudah Submit" : "Belum Submit"}
                </span>
                {q.submission_id && (
                  <span className="sage-pill">
                    Nilai: {q.revised_score ?? q.skor_ai ?? "-"}
                  </span>
                )}
                {q.submission_id ? (
                  <button
                    onClick={() => {
                      setSelectedResultQuestionId(q.id);
                      setActiveSection("results");
                    }}
                    className="sage-button-outline"
                  >
                    Lihat Hasil
                  </button>
                ) : (
                  <button type="button" className="sage-button">
                    Siap Dikerjakan
                  </button>
                )}
              </div>
              {!q.submission_id && (
                <div className="mt-4 space-y-3">
                  <textarea
                    className="sage-input min-h-32"
                    placeholder="Tulis jawaban kamu di sini..."
                    value={answerInputs[q.id] ?? ""}
                    onChange={(e) => setAnswerInputs((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="sage-button"
                      disabled={!!submitLoading[q.id]}
                      onClick={() => handleSubmitAnswer(q.id)}
                    >
                      {submitLoading[q.id] ? "Mengirim..." : "Submit Jawaban"}
                    </button>
                    {submitMessage[q.id] && (
                      <span
                        className={`text-sm ${
                          submitMessage[q.id].toLowerCase().includes("berhasil")
                            ? "text-[color:var(--sage-700)]"
                            : "text-red-500"
                        }`}
                      >
                        {submitMessage[q.id]}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {q.submission_id && q.student_essay_text && (
                <div className="mt-4 bg-white border border-black/5 rounded-xl p-4">
                  <button
                    type="button"
                    onClick={() => setOpenStudentAnswers((prev) => ({ ...prev, [q.id]: !prev[q.id] }))}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <p className="text-xs uppercase tracking-wide text-[color:var(--ink-500)]">Jawaban Anda</p>
                    <span className="text-xs text-[color:var(--sage-700)]">
                      {openStudentAnswers[q.id] ? "Tutup" : "Buka"}
                    </span>
                  </button>
                  {openStudentAnswers[q.id] && (
                    <p className="mt-2 text-[color:var(--ink-800)] whitespace-pre-line">{q.student_essay_text}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {activeSection === "results" && !isTugasType && (
        <section className="space-y-5">
          <div className="sage-panel p-5">
            <p className="text-xs uppercase tracking-wide text-[color:var(--ink-500)]">Nilai Akhir Materi</p>
            <p className="mt-1 text-3xl font-semibold text-[color:var(--ink-900)]">
              {finalMaterialScore.score == null ? "-" : finalMaterialScore.score.toFixed(2)}
              {finalMaterialScore.score != null && <span className="text-base font-medium text-[color:var(--ink-500)]"> / 100</span>}
            </p>
            <p className="mt-1 text-sm text-[color:var(--ink-500)]">
              Rumus: (Σ(nilai soal × bobot) / Σ(bobot)) × (jumlah soal dijawab / total soal) = (rata-rata berbobot × {finalMaterialScore.counted}) / {finalMaterialScore.totalQuestions || 1}.
            </p>
          </div>

          {resultItems.length === 0 && (
            <div className="sage-panel p-6 text-[color:var(--ink-500)]">Belum ada hasil. Kerjakan soal dulu.</div>
          )}

          {resultItems.map(({ question, rubricEntries, hasTeacherPane, hasAIPane, radarData }, idx) => {
            const isOpen = !!openResults[question.id];
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
                    <p className="text-xs uppercase tracking-wide text-[color:var(--ink-500)]">Soal {idx + 1}</p>
                    <p className="text-[color:var(--ink-900)] mt-1 font-semibold">{question.teks_soal}</p>
                  </div>
                  <span className="text-sm text-[color:var(--ink-500)]">{isOpen ? "Tutup" : "Buka"}</span>
                </button>

                {isOpen && (
                  <div className="mt-4 space-y-4">
                    <p className="text-sm text-[color:var(--ink-500)]">
                      Bobot: {typeof question.weight === "number" && question.weight > 0 ? question.weight : 1}
                    </p>

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
                                  className="mt-1 text-xs font-medium text-[color:var(--sage-700)] hover:underline"
                                >
                                  {isAIFeedbackExpanded ? "Tutup" : "Baca selengkapnya"}
                                </button>
                              )}
                            </div>
                          )}
                          {rubricEntries.length > 0 && (
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
                                  className="mt-1 text-xs font-medium text-[color:var(--sage-700)] hover:underline"
                                >
                                  {isTeacherFeedbackExpanded ? "Tutup" : "Baca selengkapnya"}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {radarData.length > 0 && (
                      <div className="h-72 bg-white rounded-2xl border border-black/5 p-4">
                        <ResponsiveContainer>
                          <RadarChart data={radarData}>
                            <PolarGrid />
                            <PolarAngleAxis dataKey="subject" />
                            <PolarRadiusAxis />
                            <Radar dataKey="score" fill="#0f766e" fillOpacity={0.45} />
                          </RadarChart>
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
