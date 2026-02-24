"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type QueueSummary = {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
};

type QueueItem = {
  submission_id: string;
  student_name: string;
  class_name: string;
  material_title: string;
  question_text: string;
  status: string;
  grading_error?: string;
  submitted_at: string;
};

type QueueList = {
  items: QueueItem[];
  total: number;
  page: number;
  size: number;
};

export default function SuperadminQueueMonitorPage() {
  const [summary, setSummary] = useState<QueueSummary | null>(null);
  const [list, setList] = useState<QueueList | null>(null);
  const [status, setStatus] = useState("failed");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, jobsRes] = await Promise.all([
        fetch("/api/admin/grading-queue/summary", { credentials: "include" }),
        fetch(`/api/admin/grading-queue/jobs?status=${encodeURIComponent(status)}&page=1&size=20`, {
          credentials: "include",
        }),
      ]);
      if (!summaryRes.ok) throw new Error("Gagal memuat ringkasan queue");
      if (!jobsRes.ok) throw new Error("Gagal memuat daftar queue");

      setSummary(await summaryRes.json());
      setList(await jobsRes.json());
    } catch (err: any) {
      setError(err?.message || "Terjadi kesalahan saat memuat queue monitor");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const retryOne = async (submissionId: string) => {
    setRetryingId(submissionId);
    setError(null);
    try {
      const res = await fetch("/api/admin/grading-queue/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ submission_ids: [submissionId] }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Gagal retry queue");
      }
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Gagal retry queue");
    } finally {
      setRetryingId(null);
    }
  };

  const metrics = useMemo(() => {
    return [
      { label: "Queued", value: summary?.queued ?? 0 },
      { label: "Processing", value: summary?.processing ?? 0 },
      { label: "Completed", value: summary?.completed ?? 0 },
      { label: "Failed", value: summary?.failed ?? 0 },
      { label: "Total", value: summary?.total ?? 0 },
    ];
  }, [summary]);

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Queue Monitor</h1>
            <p className="text-sm text-slate-500">Pantau status grading queue dan retry job gagal.</p>
          </div>
          <button type="button" onClick={loadData} className="sage-button-outline" disabled={loading}>
            {loading ? "Memuat..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="grid gap-3 md:grid-cols-5">
        {metrics.map((item) => (
          <div key={item.label} className="sage-panel p-4">
            <p className="text-xs text-slate-500">{item.label}</p>
            <p className="text-2xl font-semibold text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-slate-600">Filter status:</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="failed">failed</option>
          <option value="queued">queued</option>
          <option value="processing">processing</option>
          <option value="completed">completed</option>
        </select>
      </div>

      <div className="sage-panel p-5">
        <h2 className="text-lg font-semibold text-slate-900">Daftar Job ({list?.total ?? 0})</h2>
        <div className="mt-4 space-y-3">
          {list?.items?.length ? (
            list.items.map((item) => (
              <div key={item.submission_id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.student_name}</p>
                    <p className="text-xs text-slate-500">
                      {item.class_name} • {item.material_title}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase text-slate-700">
                    {item.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-700 line-clamp-2">{item.question_text}</p>
                {item.grading_error && <p className="mt-2 text-sm text-rose-600">{item.grading_error}</p>}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">
                    Submit: {new Date(item.submitted_at).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <button
                    type="button"
                    className="sage-button-outline !px-3 !py-1.5 text-xs"
                    onClick={() => retryOne(item.submission_id)}
                    disabled={retryingId === item.submission_id}
                  >
                    {retryingId === item.submission_id ? "Retry..." : "Retry"}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">Belum ada data queue untuk filter ini.</p>
          )}
        </div>
      </div>
    </div>
  );
}
