"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiBarChart2, FiDownload, FiSearch } from "react-icons/fi";

interface ClassItem {
  id: string;
  class_name: string;
  class_code?: string;
}

interface StudentSummary {
  student_id: string;
  student_name: string;
  student_email: string;
  total_submissions: number;
  reviewed_submissions: number;
  pending_submissions: number;
  average_final_score?: number | null;
  latest_submitted_at?: string | null;
}

interface SummaryResponse {
  items: StudentSummary[];
  total: number;
  page: number;
  size: number;
  total_submissions: number;
}

interface DistributionBucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

interface DistributionResponse {
  buckets: DistributionBucket[];
  total: number;
  average?: number | null;
  min?: number | null;
  max?: number | null;
  reviewed?: number;
  pending?: number;
  total_submissions?: number;
}

const API_URL = "/api";

const formatDate = (iso?: string | null) => {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatScore = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
};

export default function TeacherLaporanNilaiPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [distribution, setDistribution] = useState<DistributionResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingDistribution, setLoadingDistribution] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const totalPages = useMemo(() => {
    if (!summary) return 1;
    return Math.max(1, Math.ceil(summary.total / summary.size));
  }, [summary]);

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/classes`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Gagal memuat kelas.");
      const items = Array.isArray(data) ? data : [];
      setClasses(items);
      if (!selectedClassId && items.length > 0) {
        setSelectedClassId(items[0].id);
      }
    } catch (err: any) {
      setError(err?.message || "Gagal memuat kelas.");
    }
  }, [selectedClassId]);

  const fetchSummary = useCallback(async () => {
    if (!selectedClassId) return;
    setLoadingSummary(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (sortBy) params.set("sort", sortBy);
      params.set("page", String(page));
      params.set("limit", String(limit));
      const res = await fetch(`${API_URL}/reports/classes/${selectedClassId}/students?${params.toString()}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Gagal memuat laporan siswa.");
      setSummary(data);
    } catch (err: any) {
      setSummary(null);
      setError(err?.message || "Gagal memuat laporan siswa.");
    } finally {
      setLoadingSummary(false);
    }
  }, [limit, page, query, selectedClassId, sortBy]);

  const fetchDistribution = useCallback(async () => {
    if (!selectedClassId) return;
    setLoadingDistribution(true);
    try {
      const res = await fetch(`${API_URL}/reports/classes/${selectedClassId}/distribution`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Gagal memuat distribusi nilai.");
      setDistribution(data);
    } catch (err: any) {
      setDistribution(null);
    } finally {
      setLoadingDistribution(false);
    }
  }, [selectedClassId]);

  const handleExport = useCallback(async () => {
    if (!selectedClassId) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (sortBy) params.set("sort", sortBy);
      params.set("format", "csv");
      const res = await fetch(`${API_URL}/reports/classes/${selectedClassId}/export?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Gagal export laporan.");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `laporan-nilai-${selectedClassId}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || "Gagal export laporan.");
    } finally {
      setExporting(false);
    }
  }, [query, selectedClassId, sortBy]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    if (!selectedClassId) return;
    fetchSummary();
  }, [fetchSummary, selectedClassId]);

  useEffect(() => {
    if (!selectedClassId) return;
    fetchDistribution();
  }, [fetchDistribution, selectedClassId]);

  useEffect(() => {
    setPage(1);
  }, [query, sortBy, selectedClassId, limit]);

  const maxBucket = useMemo(() => {
    if (!distribution?.buckets?.length) return 0;
    return Math.max(...distribution.buckets.map((b) => b.count));
  }, [distribution]);

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6 space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Laporan Nilai</h1>
        <p className="text-sm text-slate-500">Rekap nilai siswa per kelas, distribusi skor, dan export CSV.</p>
      </div>

      <div className="sage-panel p-5 space-y-4">
        <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-end">
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500">Pilih Kelas</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            >
              <option value="">Pilih kelas...</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.class_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500">Cari Siswa</label>
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <FiSearch className="text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nama siswa..."
                className="w-full outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500">Urutkan</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            >
              <option value="">Terbaru</option>
              <option value="alpha">Nama A-Z</option>
              <option value="pending_desc">Pending Terbanyak</option>
              <option value="pending_asc">Pending Terendah</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={!selectedClassId || exporting}
            className="sage-button inline-flex items-center gap-2"
          >
            <FiDownload />
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900 inline-flex items-center gap-2">
                <FiBarChart2 /> Distribusi Nilai
              </p>
              <p className="text-xs text-slate-500 mt-1">Skor akhir menggunakan revisi guru bila ada.</p>
            </div>
            {distribution && (
              <div className="text-right text-xs text-slate-500">
                <p>Avg: {formatScore(distribution.average)}</p>
                <p>Min: {formatScore(distribution.min)} | Max: {formatScore(distribution.max)}</p>
              </div>
            )}
          </div>

          {loadingDistribution ? (
            <p className="mt-4 text-sm text-slate-500">Memuat distribusi...</p>
          ) : distribution?.buckets?.length ? (
            <div className="mt-4 space-y-3">
              {distribution.buckets.map((bucket) => {
                const percent = maxBucket > 0 ? Math.round((bucket.count / maxBucket) * 100) : 0;
                return (
                  <div key={bucket.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>{bucket.label}</span>
                      <span>{bucket.count} siswa</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-sky-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Belum ada data nilai untuk kelas ini.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <p className="text-sm font-semibold text-slate-900">Ringkasan Review</p>
          {distribution ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryStat label="Total Submission" value={distribution.total_submissions ?? 0} />
              <SummaryStat label="Reviewed" value={distribution.reviewed ?? 0} />
              <SummaryStat label="Pending" value={distribution.pending ?? 0} />
              <SummaryStat label="Total Nilai" value={distribution.total ?? 0} />
            </div>
          ) : (
            <p className="text-sm text-slate-500">Pilih kelas untuk melihat ringkasan.</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Nilai per Siswa</p>
            <p className="text-xs text-slate-500 mt-1">Rata-rata skor dari seluruh soal pada kelas.</p>
          </div>
          <div className="text-xs text-slate-500">
            {summary ? `Total: ${summary.total}` : "Total: 0"}
          </div>
        </div>

        <div className="mt-4 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">Siswa</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-right">Avg Nilai</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Reviewed</th>
                <th className="px-3 py-2 text-right">Pending</th>
                <th className="px-3 py-2 text-left">Terakhir Submit</th>
              </tr>
            </thead>
            <tbody>
              {loadingSummary ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                    Memuat data...
                  </td>
                </tr>
              ) : summary?.items?.length ? (
                summary.items.map((item) => (
                  <tr key={item.student_id} className="border-t border-slate-200">
                    <td className="px-3 py-2 font-semibold text-slate-900">{item.student_name}</td>
                    <td className="px-3 py-2 text-slate-600">{item.student_email}</td>
                    <td className="px-3 py-2 text-right">{formatScore(item.average_final_score)}</td>
                    <td className="px-3 py-2 text-right">{item.total_submissions}</td>
                    <td className="px-3 py-2 text-right">{item.reviewed_submissions}</td>
                    <td className="px-3 py-2 text-right">{item.pending_submissions}</td>
                    <td className="px-3 py-2 text-slate-600">{formatDate(item.latest_submitted_at)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                    Belum ada data siswa untuk kelas ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <span>Baris</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
            >
              {[10, 20, 30, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="sage-button-outline !py-1 !px-3 text-xs"
            >
              Prev
            </button>
            <span>
              Hal {summary?.page || page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="sage-button-outline !py-1 !px-3 text-xs"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

