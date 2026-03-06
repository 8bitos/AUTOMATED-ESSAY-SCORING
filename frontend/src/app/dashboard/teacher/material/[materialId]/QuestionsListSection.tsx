"use client";

import { DragEvent, JSX, useCallback, useMemo, useState } from "react";
import { FiAward, FiChevronDown, FiChevronUp, FiEdit, FiHelpCircle, FiPlus, FiTag, FiTrash2 } from "react-icons/fi";

export interface QuestionRubric {
  nama_aspek: string;
  descriptors?: Record<string, unknown> | Array<{ score?: string | number; description?: string; deskripsi?: string }>;
}

export interface QuestionItem {
  id: string;
  material_id: string;
  teks_soal: string;
  level_kognitif?: string;
  ideal_answer?: string;
  keywords?: string;
  rubrics?: QuestionRubric[];
}

interface QuestionsListSectionProps {
  questions: QuestionItem[];
  handleOpenAddQuestionModal: () => void;
  handleOpenEditQuestionModal: (question: QuestionItem) => void;
  handleDeleteQuestion: (questionId: string) => void;
  handleMoveQuestion: (questionId: string, direction: "up" | "down") => void;
  handleDropReorderQuestion: (sourceQuestionId: string, targetQuestionId: string) => void;
  canReorderQuestions: boolean;
  movingQuestionId: string | null;
  renderDoubleAsteriskBold: (text?: string) => JSX.Element[];
  formatDescriptor: (value: unknown) => string;
}

type PreparedQuestionItem = {
  question: QuestionItem;
  normalizedKeywords: string[];
  rubrics: QuestionRubric[];
};

function QuestionListCard({
  item,
  index,
  total,
  isOpen,
  isDragging,
  isShifted,
  onToggle,
  onEdit,
  onDelete,
  onMove,
  onDragStart,
  onDragEnd,
  onDropOnCard,
  onDragOverCard,
  canReorder,
  reorderBusy,
  moving,
  renderDoubleAsteriskBold,
  formatDescriptor,
}: {
  item: PreparedQuestionItem;
  index: number;
  total: number;
  isOpen: boolean;
  isDragging: boolean;
  isShifted: boolean;
  onToggle: () => void;
  onEdit: (question: QuestionItem) => void;
  onDelete: (questionId: string) => void;
  onMove: (questionId: string, direction: "up" | "down") => void;
  onDragStart: (questionId: string) => void;
  onDragEnd: () => void;
  onDropOnCard: (targetQuestionId: string) => void;
  onDragOverCard: (e: DragEvent<HTMLDivElement>) => void;
  canReorder: boolean;
  reorderBusy: boolean;
  moving: boolean;
  renderDoubleAsteriskBold: (text?: string) => JSX.Element[];
  formatDescriptor: (value: unknown) => string;
}) {
  const q = item.question;
  const canMoveUp = canReorder && index > 0 && !moving && !reorderBusy;
  const canMoveDown = canReorder && index < total - 1 && !moving && !reorderBusy;

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${isDragging ? "opacity-60" : ""} ${isShifted ? "ring-2 ring-sky-300 ring-offset-1" : ""}`}
      onDragOver={canReorder && !reorderBusy ? onDragOverCard : undefined}
      onDrop={canReorder && !reorderBusy ? () => onDropOnCard(q.id) : undefined}
    >
      <div
        className="grid cursor-pointer gap-4 bg-gradient-to-r from-indigo-50/70 via-sky-50/60 to-cyan-50/50 p-5 sm:grid-cols-[auto_1fr_auto]"
        onClick={onToggle}
      >
        <div className="flex items-start gap-1">
          {canReorder && (
            <div className="flex items-stretch gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                draggable
                disabled={reorderBusy}
                onDragStart={(e) => {
                  e.stopPropagation();
                  onDragStart(q.id);
                }}
                onDragEnd={(e) => {
                  e.stopPropagation();
                  onDragEnd();
                }}
                onClick={(e) => e.stopPropagation()}
                className="h-[62px] rounded-lg border border-slate-200 bg-white px-2 text-sm font-bold tracking-wider text-slate-500 cursor-grab active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
                title="Drag untuk pindah urutan"
              >
                ::
              </button>
              <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMove(q.id, "up");
                  }}
                  disabled={!canMoveUp}
                  className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Naikkan urutan soal"
                >
                  <FiChevronUp />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMove(q.id, "down");
                  }}
                  disabled={!canMoveDown}
                  className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Turunkan urutan soal"
                >
                  <FiChevronDown />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3 min-w-0">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-indigo-600 px-2 text-xs font-bold text-white">
              {index + 1}
            </span>
            <p className="font-semibold leading-6 text-slate-900 text-justify">{q.teks_soal}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {q.level_kognitif && <span className="rounded-full bg-indigo-100 px-2.5 py-1 font-semibold text-indigo-700">{q.level_kognitif}</span>}
            {item.normalizedKeywords.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-700">
                <FiTag className="h-3 w-3" />
                {item.normalizedKeywords.length} keyword
              </span>
            )}
            {item.rubrics.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700">
                <FiAward className="h-3 w-3" />
                {item.rubrics.length} rubrik
              </span>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2 sm:justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            {isOpen ? <FiChevronUp /> : <FiChevronDown />}
            Detail
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(q);
            }}
            className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-slate-800"
            title="Edit soal"
          >
            <FiEdit />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(q.id);
            }}
            className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-red-600"
            title="Hapus soal"
          >
            <FiTrash2 />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="space-y-4 border-t border-slate-200 bg-slate-50 px-6 py-5 text-sm">
          {q.ideal_answer && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Jawaban Ideal</p>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-[color:var(--ink-500)]">{renderDoubleAsteriskBold(q.ideal_answer)}</p>
              </div>
            </div>
          )}

          {item.normalizedKeywords.length > 0 && (
            <div>
              <p className="mb-1 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <FiTag className="h-3.5 w-3.5" />
                Kata Kunci
              </p>
              <div className="flex flex-wrap gap-2">
                {item.normalizedKeywords.map((k, i) => (
                  <span key={i} className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 question-keyword-chip">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}

          {item.rubrics.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Rubrik Penilaian</p>
              <div className="space-y-3">
                {item.rubrics.map((r, ri) => (
                  <div key={ri} className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="mb-1 font-semibold text-[color:var(--ink-900)]">{r.nama_aspek}</p>
                    <ul className="space-y-1 text-xs text-[color:var(--ink-500)]">
                      {r.descriptors &&
                        Object.entries(r.descriptors).map(([score, desc]) => (
                          <li key={score}>
                            <strong>{score}</strong>: {formatDescriptor(desc)}
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function QuestionsListSection({
  questions,
  handleOpenAddQuestionModal,
  handleOpenEditQuestionModal,
  handleDeleteQuestion,
  handleMoveQuestion,
  handleDropReorderQuestion,
  canReorderQuestions,
  movingQuestionId,
  renderDoubleAsteriskBold,
  formatDescriptor,
}: QuestionsListSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draggingQuestionId, setDraggingQuestionId] = useState<string | null>(null);
  const [shiftedQuestionId, setShiftedQuestionId] = useState<string | null>(null);
  const preparedQuestions = useMemo(
    () =>
      questions.map((q) => ({
        question: q,
        normalizedKeywords: typeof q.keywords === "string" ? q.keywords.split(",").map((k) => k.trim()) : [],
        rubrics: Array.isArray(q.rubrics) ? q.rubrics : [],
      })),
    [questions]
  );

  const handleDragOverCard = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleDropOnCard = useCallback(
    (targetQuestionId: string) => {
      if (movingQuestionId) return;
      if (!draggingQuestionId) return;
      if (draggingQuestionId === targetQuestionId) {
        setDraggingQuestionId(null);
        return;
      }
      handleDropReorderQuestion(draggingQuestionId, targetQuestionId);
      setShiftedQuestionId(draggingQuestionId);
      window.setTimeout(() => setShiftedQuestionId((prev) => (prev === draggingQuestionId ? null : prev)), 450);
      setDraggingQuestionId(null);
    },
    [draggingQuestionId, handleDropReorderQuestion, movingQuestionId]
  );

  const handleMoveWithFeedback = useCallback(
    (questionId: string, direction: "up" | "down") => {
      if (movingQuestionId) return;
      handleMoveQuestion(questionId, direction);
      setShiftedQuestionId(questionId);
      window.setTimeout(() => setShiftedQuestionId((prev) => (prev === questionId ? null : prev)), 450);
    },
    [handleMoveQuestion, movingQuestionId]
  );
  const reorderBusy = Boolean(movingQuestionId);

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <FiHelpCircle />
            Daftar Soal
          </h2>
          <p className="text-sm text-slate-500">
            Kelola pertanyaan dan rubrik penilaian.
            {canReorderQuestions ? " Gunakan tombol atas/bawah untuk ubah urutan soal." : ""}
          </p>
        </div>
        <button onClick={handleOpenAddQuestionModal} className="sage-button">
          <FiPlus />
          Tambah Soal
        </button>
      </div>

      {questions.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-2xl text-[color:var(--ink-500)]">
          Belum ada soal untuk materi ini.
        </div>
      ) : (
        <div className="space-y-4">
          {preparedQuestions.map(({ question: q, normalizedKeywords, rubrics }, index) => {
            const isOpen = expandedId === q.id;
            const item: PreparedQuestionItem = { question: q, normalizedKeywords, rubrics };
            return (
              <QuestionListCard
                key={q.id}
                item={item}
                index={index}
                total={preparedQuestions.length}
                isOpen={isOpen}
                isDragging={draggingQuestionId === q.id}
                isShifted={shiftedQuestionId === q.id}
                onToggle={() => setExpandedId(isOpen ? null : q.id)}
                onEdit={handleOpenEditQuestionModal}
                onDelete={handleDeleteQuestion}
                onMove={handleMoveWithFeedback}
                onDragStart={(questionId) => {
                  setDraggingQuestionId(questionId);
                  setExpandedId(null);
                }}
                onDragEnd={() => setDraggingQuestionId(null)}
                onDropOnCard={handleDropOnCard}
                onDragOverCard={handleDragOverCard}
                canReorder={canReorderQuestions}
                reorderBusy={reorderBusy}
                moving={movingQuestionId === q.id}
                renderDoubleAsteriskBold={renderDoubleAsteriskBold}
                formatDescriptor={formatDescriptor}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
