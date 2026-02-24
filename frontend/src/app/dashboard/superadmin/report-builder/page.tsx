"use client";

import { useMemo, useState } from "react";

type ReportResponse = {
  type: string;
  columns: string[];
  rows: Record<string, any>[];
  total: number;
};

const reportTypes = [
  { key: "submission_status", label: "Submission Status Summary" },
  { key: "top_students", label: "Top Students" },
  { key: "teacher_workload", label: "Teacher Workload" },
];

export default function SuperadminReportBuilderPage() {
  const [type, setType] = useState(reportTypes[0].key);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [classId, setClassId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);

  const buildReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reports/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type,
          date_from: dateFrom || "",
          date_to: dateTo || "",
          class_id: classId || "",
          teacher_id: teacherId || "",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Gagal membangun report");
      setReport(body);
    } catch (err: any) {
      setError(err?.message || "Gagal membangun report");
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const csvContent = useMemo(() => {
    if (!report || !report.columns.length) return "";
    const escapeCell = (value: any) => {
      const str = String(value ?? "");
      if (str.includes('"') || str.includes(",") || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const lines = [report.columns.join(",")];
    for (const row of report.rows) {
      lines.push(report.columns.map((c) => escapeCell(row[c])).join(","));
    }
    return lines.join("\n");
  }, [report]);

  const downloadCSV = () => {
    if (!csvContent) return;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Report Builder</h1>
        <p className="text-sm text-slate-500">Bangun laporan dinamis dari data submission dan aktivitas akademik.</p>
      </div>

      <div className="sage-panel p-4 grid gap-3 md:grid-cols-5">
        <select className="sage-input" value={type} onChange={(e) => setType(e.target.value)}>
          {reportTypes.map((item) => (
            <option key={item.key} value={item.key}>{item.label}</option>
          ))}
        </select>
        <input type="date" className="sage-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <input type="date" className="sage-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <input className="sage-input" placeholder="Class ID (opsional)" value={classId} onChange={(e) => setClassId(e.target.value)} />
        <input className="sage-input" placeholder="Teacher ID (opsional)" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} />
      </div>

      <div className="flex items-center gap-2">
        <button className="sage-button !py-2" onClick={buildReport} disabled={loading}>{loading ? "Building..." : "Build Report"}</button>
        <button className="sage-button-outline !py-2" onClick={downloadCSV} disabled={!csvContent}>Download CSV</button>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="sage-panel p-4">
        {!report ? (
          <p className="text-sm text-slate-500">Belum ada report. Jalankan build report dulu.</p>
        ) : report.rows.length === 0 ? (
          <p className="text-sm text-slate-500">Report kosong untuk filter saat ini.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Total row: {report.total}</p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    {report.columns.map((col) => (
                      <th key={col} className="px-2 py-2 text-left text-xs uppercase text-slate-500">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-100">
                      {report.columns.map((col) => (
                        <td key={`${idx}-${col}`} className="px-2 py-2 text-slate-700">{String(row[col] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
