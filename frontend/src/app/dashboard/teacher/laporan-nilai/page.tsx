"use client";

import Link from "next/link";
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

interface MaterialItem {
  id: string;
  judul: string;
  material_type?: "materi" | "soal" | "tugas";
  isi_materi?: string | null;
}

interface StudentItem {
  id: string;
  student_name: string;
  student_email?: string;
}

interface SectionCardItem {
  id: string;
  type: string;
  title: string;
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

const parseSectionCards = (raw?: string | null): SectionCardItem[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { format?: string; items?: unknown[] };
    if (parsed?.format !== "sage_section_cards_v1" || !Array.isArray(parsed?.items)) return [];
    return parsed.items
      .map((x: unknown) => {
        if (typeof x !== "object" || x === null) return null;
        const row = x as Record<string, unknown>;
        const id = typeof row.id === "string" ? row.id : "";
        if (!id) return null;
        return {
          id,
          type: typeof row.type === "string" ? row.type : "materi",
          title: typeof row.title === "string" ? row.title : "",
        } as SectionCardItem;
      })
      .filter((x): x is SectionCardItem => x !== null);
  } catch {
    return [];
  }
};

export default function TeacherLaporanNilaiPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedSectionCardId, setSelectedSectionCardId] = useState("");
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exportScope, setExportScope] = useState<"all" | "page">("all");
  const [exportMode, setExportMode] = useState<"summary" | "qwk" | "question">("summary");
  const [aiStatus, setAiStatus] = useState("");
  const [reviewStatus, setReviewStatus] = useState("");
  const [includeRubricScores, setIncludeRubricScores] = useState(false);

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [distribution, setDistribution] = useState<DistributionResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingDistribution, setLoadingDistribution] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const selectedMaterial = useMemo(
    () => materials.find((m) => m.id === selectedMaterialId) || null,
    [materials, selectedMaterialId]
  );

  const sectionCards = useMemo(() => {
    if (!selectedMaterial?.isi_materi) return [];
    return parseSectionCards(selectedMaterial.isi_materi).filter((card) => card.type === "soal");
  }, [selectedMaterial]);

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

  const fetchMaterials = useCallback(async () => {
    if (!selectedClassId) {
      setMaterials([]);
      return;
    }
    setLoadingMaterials(true);
    try {
      const res = await fetch(`${API_URL}/classes/${selectedClassId}/materials`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Gagal memuat konten kelas.");
      setMaterials(Array.isArray(data) ? data : []);
    } catch {
      setMaterials([]);
    } finally {
      setLoadingMaterials(false);
    }
  }, [selectedClassId]);

  const fetchStudents = useCallback(async () => {
    if (!selectedClassId) {
      setStudents([]);
      return;
    }
    setLoadingStudents(true);
    try {
      const res = await fetch(`${API_URL}/classes/${selectedClassId}/students`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Gagal memuat siswa.");
      setStudents(Array.isArray(data) ? data : []);
    } catch {
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }, [selectedClassId]);

  const fetchSummary = useCallback(async () => {
    if (!selectedClassId) return;
    setLoadingSummary(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (selectedMaterialId) params.set("materialId", selectedMaterialId);
      if (selectedStudentId) params.set("studentId", selectedStudentId);
      if (selectedSectionCardId) params.set("sectionCardId", selectedSectionCardId);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (sortBy) params.set("sort", sortBy);
      if (aiStatus) params.set("aiStatus", aiStatus);
      if (reviewStatus) params.set("reviewStatus", reviewStatus);
      if (exportMode === "qwk" && includeRubricScores) params.set("includeRubricScores", "1");
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
  }, [
    aiStatus,
    dateFrom,
    dateTo,
    limit,
    page,
    query,
    reviewStatus,
    selectedClassId,
    selectedMaterialId,
    selectedSectionCardId,
    selectedStudentId,
    sortBy,
  ]);

  const fetchDistribution = useCallback(async () => {
    if (!selectedClassId) return;
    setLoadingDistribution(true);
    try {
      const params = new URLSearchParams();
      if (selectedMaterialId) params.set("materialId", selectedMaterialId);
      if (selectedStudentId) params.set("studentId", selectedStudentId);
      if (selectedSectionCardId) params.set("sectionCardId", selectedSectionCardId);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (aiStatus) params.set("aiStatus", aiStatus);
      if (reviewStatus) params.set("reviewStatus", reviewStatus);
      const url = `${API_URL}/reports/classes/${selectedClassId}/distribution?${params.toString()}`;
      const res = await fetch(url, {
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
  }, [
    aiStatus,
    dateFrom,
    dateTo,
    reviewStatus,
    selectedClassId,
    selectedMaterialId,
    selectedSectionCardId,
    selectedStudentId,
  ]);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  };

  const buildCsvContent = (rows: StudentSummary[]) => {
    const header = [
      "student_id",
      "student_name",
      "student_email",
      "total_submissions",
      "reviewed_submissions",
      "pending_submissions",
      "average_final_score",
      "latest_submitted_at",
    ];
    const escapeCsv = (value: string) => {
      const needsQuote = /[",\n]/.test(value);
      const escaped = value.replace(/"/g, "\"\"");
      return needsQuote ? `"${escaped}"` : escaped;
    };
    const lines = [header.join(",")];
    rows.forEach((item) => {
      const avg = item.average_final_score == null ? "" : String(Math.round(item.average_final_score * 100) / 100);
      const latest = item.latest_submitted_at ? item.latest_submitted_at : "";
      const row = [
        item.student_id,
        item.student_name,
        item.student_email,
        String(item.total_submissions),
        String(item.reviewed_submissions),
        String(item.pending_submissions),
        avg,
        latest,
      ];
      lines.push(row.map((v) => escapeCsv(v ?? "")).join(","));
    });
    return lines.join("\n");
  };

  const buildExcelXml = (rows: StudentSummary[]) => {
    const header = [
      "student_id",
      "student_name",
      "student_email",
      "total_submissions",
      "reviewed_submissions",
      "pending_submissions",
      "average_final_score",
      "latest_submitted_at",
    ];
    const escapeXml = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

    const buildRow = (cells: string[]) =>
      `<Row>${cells
        .map((cell) => `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`)
        .join("")}</Row>`;

    const rowsXml = [buildRow(header)];
    rows.forEach((item) => {
      const avg = item.average_final_score == null ? "" : String(Math.round(item.average_final_score * 100) / 100);
      const latest = item.latest_submitted_at ? item.latest_submitted_at : "";
      rowsXml.push(
        buildRow([
          item.student_id,
          item.student_name,
          item.student_email,
          String(item.total_submissions),
          String(item.reviewed_submissions),
          String(item.pending_submissions),
          avg,
          latest,
        ])
      );
    });

    return `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:x="urn:schemas-microsoft-com:office:excel"
xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Laporan">
<Table>
${rowsXml.join("")}
</Table>
</Worksheet>
</Workbook>`;
  };

  const handleExport = useCallback(async (format: "csv" | "xlsx") => {
    if (!selectedClassId) return;
    setExporting(true);
    try {
      if (exportMode === "summary" && exportScope === "page") {
        const rows = summary?.items || [];
        if (format === "csv") {
          const csv = buildCsvContent(rows);
          const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
          downloadBlob(blob, `laporan-nilai-${selectedClassId}-page.csv`);
        } else {
          const xml = buildExcelXml(rows);
          const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" });
          downloadBlob(blob, `laporan-nilai-${selectedClassId}-page.xls`);
        }
        return;
      }
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (selectedMaterialId) params.set("materialId", selectedMaterialId);
      if (selectedStudentId) params.set("studentId", selectedStudentId);
      if (selectedSectionCardId) params.set("sectionCardId", selectedSectionCardId);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (sortBy) params.set("sort", sortBy);
      if (aiStatus) params.set("aiStatus", aiStatus);
      if (reviewStatus) params.set("reviewStatus", reviewStatus);
      params.set("format", format);
      const endpoint =
        exportMode === "summary"
          ? `/reports/classes/${selectedClassId}/export`
          : exportMode === "qwk"
          ? `/reports/classes/${selectedClassId}/export-qwk`
          : `/reports/classes/${selectedClassId}/export-questions`;
      const res = await fetch(`${API_URL}${endpoint}?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Gagal export laporan.");
      }
      const blob = await res.blob();
      const filename =
        exportMode === "summary"
          ? `laporan-nilai-${selectedClassId}.${format}`
          : exportMode === "qwk"
          ? `qwk-export-${selectedClassId}.${format}`
          : `question-export-${selectedClassId}.${format}`;
      downloadBlob(blob, filename);
    } catch (err: any) {
      setError(err?.message || "Gagal export laporan.");
    } finally {
      setExporting(false);
    }
  }, [
    aiStatus,
    dateFrom,
    dateTo,
    exportMode,
    exportScope,
    includeRubricScores,
    query,
    reviewStatus,
    selectedClassId,
    selectedMaterialId,
    selectedSectionCardId,
    selectedStudentId,
    sortBy,
    summary?.items,
  ]);

  const handleExportTemplate = useCallback(
    async (format: "csv" | "xlsx") => {
      if (!selectedClassId) return;
      setExporting(true);
      try {
        const params = new URLSearchParams();
        if (selectedMaterialId) params.set("materialId", selectedMaterialId);
        if (selectedStudentId) params.set("studentId", selectedStudentId);
        if (selectedSectionCardId) params.set("sectionCardId", selectedSectionCardId);
        params.set("format", format);
        const endpoint = `/reports/classes/${selectedClassId}/export-rubric-template`;
        const res = await fetch(`${API_URL}${endpoint}?${params.toString()}`, {
          credentials: "include",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message || "Gagal export template penilaian.");
        }
        const blob = await res.blob();
        downloadBlob(blob, `template-penilaian-${selectedClassId}.${format}`);
      } catch (err: any) {
        setError(err?.message || "Gagal export template penilaian.");
      } finally {
        setExporting(false);
      }
    },
    [selectedClassId, selectedMaterialId, selectedSectionCardId, selectedStudentId]
  );

  const handleExportRubricScores = useCallback(
    async (format: "csv" | "xlsx") => {
      if (!selectedClassId) return;
      setExporting(true);
      try {
        const params = new URLSearchParams();
        if (selectedMaterialId) params.set("materialId", selectedMaterialId);
        if (selectedStudentId) params.set("studentId", selectedStudentId);
        if (selectedSectionCardId) params.set("sectionCardId", selectedSectionCardId);
        params.set("format", format);
        const endpoint = `/reports/classes/${selectedClassId}/export-rubric-scores`;
        const res = await fetch(`${API_URL}${endpoint}?${params.toString()}`, {
          credentials: "include",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message || "Gagal export penilaian.");
        }
        const blob = await res.blob();
        downloadBlob(blob, `penilaian-${selectedClassId}.${format}`);
      } catch (err: any) {
        setError(err?.message || "Gagal export penilaian.");
      } finally {
        setExporting(false);
      }
    },
    [selectedClassId, selectedMaterialId, selectedSectionCardId, selectedStudentId]
  );

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
    if (!selectedClassId) return;
    fetchMaterials();
    fetchStudents();
    setSelectedMaterialId("");
    setSelectedStudentId("");
    setSelectedSectionCardId("");
  }, [fetchMaterials, fetchStudents, selectedClassId]);

  useEffect(() => {
    setSelectedSectionCardId("");
  }, [selectedMaterialId]);

  useEffect(() => {
    setPage(1);
  }, [
    query,
    sortBy,
    selectedClassId,
    selectedMaterialId,
    selectedStudentId,
    selectedSectionCardId,
    aiStatus,
    reviewStatus,
    dateFrom,
    dateTo,
    limit,
  ]);

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
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
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
          <div className="min-w-[220px] flex-1">
            <label className="text-xs uppercase tracking-wide text-slate-500">Konten / Section</label>
            <select
              value={selectedMaterialId}
              onChange={(e) => setSelectedMaterialId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={!selectedClassId || loadingMaterials}
            >
              <option value="">Semua konten</option>
              {materials.map((mat) => (
                <option key={mat.id} value={mat.id}>
                  {mat.judul}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[220px] flex-1">
            <label className="text-xs uppercase tracking-wide text-slate-500">Bab / Section</label>
            <select
              value={selectedSectionCardId}
              onChange={(e) => setSelectedSectionCardId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={!selectedMaterialId || sectionCards.length === 0}
            >
              <option value="">Semua bab</option>
              {sectionCards.map((card, idx) => (
                <option key={card.id} value={card.id}>
                  {card.title?.trim() ? card.title : `Bab ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[160px]">
            <label className="text-xs uppercase tracking-wide text-slate-500">Dari</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            />
          </div>
          <div className="min-w-[160px]">
            <label className="text-xs uppercase tracking-wide text-slate-500">Sampai</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            />
          </div>
          <div className="min-w-[220px] flex-1">
            <label className="text-xs uppercase tracking-wide text-slate-500">Siswa</label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              disabled={!selectedClassId || loadingStudents}
            >
              <option value="">Semua siswa</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.student_name}
                  {student.student_email ? ` (${student.student_email})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[200px] flex-1">
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
          <div className="min-w-[180px]">
            <label className="text-xs uppercase tracking-wide text-slate-500">Status AI</label>
            <select
              value={aiStatus}
              onChange={(e) => setAiStatus(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            >
              <option value="">Semua</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="queued">Queued</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div className="min-w-[180px]">
            <label className="text-xs uppercase tracking-wide text-slate-500">Status Review</label>
            <select
              value={reviewStatus}
              onChange={(e) => setReviewStatus(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            >
              <option value="">Semua</option>
              <option value="reviewed">Reviewed</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <div className="min-w-[180px]">
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
          <div className="ml-auto flex flex-wrap items-end gap-2">
            <div className="min-w-[170px]">
              <label className="text-xs uppercase tracking-wide text-slate-500">Mode Export</label>
              <select
                value={exportMode}
                onChange={(e) => setExportMode(e.target.value as "summary" | "qwk" | "question")}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              >
                <option value="summary">Summary</option>
                <option value="qwk">QWK (Per Submission)</option>
                <option value="question">Per Soal</option>
              </select>
            </div>
            {exportMode === "qwk" && (
              <label className="min-w-[170px] flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={includeRubricScores}
                  onChange={(e) => setIncludeRubricScores(e.target.checked)}
                />
                Sertakan skor rubrik
              </label>
            )}
            {exportMode === "summary" && (
              <div className="min-w-[170px]">
                <label className="text-xs uppercase tracking-wide text-slate-500">Scope Export</label>
                <select
                  value={exportScope}
                  onChange={(e) => setExportScope(e.target.value as "all" | "page")}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                >
                  <option value="all">Semua data</option>
                  <option value="page">Halaman ini</option>
                </select>
              </div>
            )}
            <button
              type="button"
              onClick={() => handleExport("csv")}
              disabled={!selectedClassId || exporting}
              className="sage-button inline-flex items-center gap-2"
            >
              <FiDownload />
              {exporting ? "Exporting..." : "Export CSV"}
            </button>
            <button
              type="button"
              onClick={() => handleExport("xlsx")}
              disabled={!selectedClassId || exporting}
              className="sage-button-outline inline-flex items-center gap-2"
            >
              <FiDownload />
              {exporting ? "Exporting..." : "Export Excel"}
            </button>
            <div className="h-9 w-px bg-slate-200" />
            <button
              type="button"
              onClick={() => handleExportTemplate("csv")}
              disabled={!selectedClassId || exporting}
              className="sage-button-outline inline-flex items-center gap-2"
            >
              <FiDownload />
              {exporting ? "Exporting..." : "Template Penilaian CSV"}
            </button>
            <button
              type="button"
              onClick={() => handleExportTemplate("xlsx")}
              disabled={!selectedClassId || exporting}
              className="sage-button-outline inline-flex items-center gap-2"
            >
              <FiDownload />
              {exporting ? "Exporting..." : "Template Penilaian Excel"}
            </button>
            <button
              type="button"
              onClick={() => handleExportRubricScores("csv")}
              disabled={!selectedClassId || exporting}
              className="sage-button-outline inline-flex items-center gap-2"
            >
              <FiDownload />
              {exporting ? "Exporting..." : "Penilaian CSV"}
            </button>
            <button
              type="button"
              onClick={() => handleExportRubricScores("xlsx")}
              disabled={!selectedClassId || exporting}
              className="sage-button-outline inline-flex items-center gap-2"
            >
              <FiDownload />
              {exporting ? "Exporting..." : "Penilaian Excel"}
            </button>
          </div>
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
                <th className="px-3 py-2 text-left">Detail</th>
              </tr>
            </thead>
            <tbody>
              {loadingSummary ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
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
                    <td className="px-3 py-2">
                      <Link
                        href={`/dashboard/teacher/penilaian?classId=${selectedClassId}`}
                        className="text-xs text-[color:var(--sage-700)] hover:underline"
                      >
                        Buka
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
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

