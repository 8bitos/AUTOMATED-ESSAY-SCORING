"use client";

import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";

interface ReviewSubmission {
  id: string;
}

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: ReviewSubmission | null;
  onFinished: () => void | Promise<void>;
  getErrorMessage: (err: unknown, fallback: string) => string;
}

function BaseModal({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
            <FiX />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function ReviewModal({ isOpen, onClose, submission, onFinished, getErrorMessage }: ReviewModalProps) {
  const [revisedScore, setRevisedScore] = useState<string | number>("");
  const [teacherFeedback, setTeacherFeedback] = useState("");
  const [error, setError] = useState("");
  const [reviewId, setReviewId] = useState<string | null>(null);

  useEffect(() => {
    const fetchReview = async () => {
      if (submission?.id) {
        try {
          const res = await fetch(`/api/teacher-reviews/submission/${submission.id}`, { credentials: "include" });
          if (res.ok) {
            const reviewData = await res.json();
            setReviewId(reviewData.id);
            setRevisedScore(reviewData.revised_score ?? "");
            setTeacherFeedback(reviewData.teacher_feedback ?? "");
          } else if (res.status === 404) {
            setReviewId(null);
            setRevisedScore("");
            setTeacherFeedback("");
          } else {
            throw new Error(`Failed to fetch existing review: ${res.statusText}`);
          }
        } catch (err: unknown) {
          setError(getErrorMessage(err, "Error fetching review"));
          setReviewId(null);
          setRevisedScore("");
          setTeacherFeedback("");
        }
      } else {
        setReviewId(null);
        setRevisedScore("");
        setTeacherFeedback("");
      }
    };

    if (isOpen) {
      void fetchReview();
    } else {
      setReviewId(null);
      setRevisedScore("");
      setTeacherFeedback("");
      setError("");
    }
  }, [isOpen, submission, getErrorMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submission) return;
    const url = reviewId ? `/api/teacher-reviews/${reviewId}` : "/api/teacher-reviews";
    const method = reviewId ? "PUT" : "POST";
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          submission_id: submission.id,
          revised_score: Number(revisedScore),
          teacher_feedback: teacherFeedback,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save review.");
      }
      await onFinished();
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to save review."));
    }
  };

  if (!isOpen) return null;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Review Submission">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div>
          <label className="block text-sm font-medium">Skor Revisi</label>
          <input type="number" value={revisedScore} onChange={(e) => setRevisedScore(e.target.value)} className="sage-input mt-1" required />
        </div>
        <div>
          <label className="block text-sm font-medium">Umpan Balik Guru</label>
          <textarea value={teacherFeedback} onChange={(e) => setTeacherFeedback(e.target.value)} className="sage-input mt-1" rows={4} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="sage-button-outline">Batal</button>
          <button type="submit" className="sage-button">Simpan Review</button>
        </div>
      </form>
    </BaseModal>
  );
}
