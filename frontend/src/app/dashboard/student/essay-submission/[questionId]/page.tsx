"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

interface EssayQuestion {
  id: string;
  material_id: string;
  teks_soal: string;
  keywords?: string;
  ideal_answer?: string;
  rubric?: any;
  created_at: string;
  updated_at: string;
}

export default function EssaySubmissionPage() {
  const { user } = useAuth();
  const params = useParams();
  const questionId = params.questionId as string;

  const [question, setQuestion] = useState<EssayQuestion | null>(null);
  const [essayText, setEssayText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(null);
  const [aiScore, setAiScore] = useState<number | null>(null);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!questionId) return;

    const fetchQuestionDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/essay-questions/${questionId}`, { // Assuming an API endpoint for a single question
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || 'Failed to fetch essay question details.');
        }

        const data: EssayQuestion = await res.json();
        setQuestion(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchQuestionDetails();
  }, [questionId]);

  const handleSubmitEssay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!essayText.trim()) {
      setSubmissionMessage('Essay cannot be empty.');
      return;
    }
    if (!questionId) {
      setSubmissionMessage('Question ID is missing.');
      return;
    }

    setSubmissionLoading(true);
    setSubmissionMessage(null);
    setError(null);
    setAiScore(null); // Clear previous AI score
    setAiFeedback(null); // Clear previous AI feedback

    try {
      const res = await fetch(`/api/submissions`, { // API endpoint for creating submissions
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ question_id: questionId, teks_jawaban: essayText }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit essay.');
      }

      setSubmissionMessage(data?.grading_message || 'Essay submitted successfully!');
      setEssayText(''); // Clear the textarea after successful submission
      
      // Extract AI results
      if (data.ai_result) {
        setAiScore(data.ai_result.skor_ai);
        setAiFeedback(data.ai_result.umpan_balik_ai);
      }
    } catch (err: any) {
      setError(`Submission Error: ${err.message}`);
    } finally {
      setSubmissionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl text-[color:var(--ink-500)]">Loading question details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl text-red-500">Error: {error}</p>
        <Link href="/dashboard/student/my-classes" className="ml-4 text-[color:var(--sage-700)] hover:underline">
          Back to My Classes
        </Link>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl text-[color:var(--ink-500)]">Question not found.</p>
        <Link href="/dashboard/student/my-classes" className="ml-4 text-[color:var(--sage-700)] hover:underline">
          Back to My Classes
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="sage-panel max-w-4xl mx-auto p-8">
        <Link href="/dashboard/student" className="text-[color:var(--sage-700)] hover:underline mb-4 block">
          &larr; Back to Dashboard
        </Link>
        <h1 className="text-3xl text-[color:var(--ink-900)] mb-4">Submit Essay</h1>
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-[color:var(--ink-700)] mb-2">Question:</h2>
          <p className="text-lg text-[color:var(--ink-900)]">{question.teks_soal}</p>
          {question.keywords && <p className="text-sm text-[color:var(--ink-500)] mt-1">Keywords: {question.keywords}</p>}
        </div>

        <form onSubmit={handleSubmitEssay} className="space-y-6">
          <div>
            <label htmlFor="essayText" className="block text-sm font-medium text-[color:var(--ink-700)] mb-2">
              Your Essay:
            </label>
            <textarea
              id="essayText"
              rows={10}
              value={essayText}
              onChange={(e) => setEssayText(e.target.value)}
              className="sage-input min-h-[220px]"
              placeholder="Write your essay here..."
              required
            ></textarea>
          </div>
          <button type="submit" disabled={submissionLoading} className="sage-button w-full">
            {submissionLoading ? "Submitting..." : "Submit Essay"}
          </button>
        </form>

        {submissionMessage && (
          <p className={`mt-4 text-center text-sm ${error ? 'text-red-500' : 'text-[color:var(--sage-700)]'}`}>
            {submissionMessage}
          </p>
        )}
        {aiScore !== null && (
          <div className="mt-4 p-4 border border-black/5 rounded-2xl bg-[color:var(--sand-50)]">
            <h3 className="text-lg font-semibold text-[color:var(--ink-900)]">AI Grading Result:</h3>
            <p className="text-xl font-bold text-[color:var(--sage-700)]">Score: {aiScore}</p>
            {aiFeedback && <p className="text-[color:var(--ink-500)] mt-2">Feedback: {aiFeedback}</p>}
          </div>
        )}
        {error && (
          <p className="mt-4 text-center text-sm text-red-500">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
