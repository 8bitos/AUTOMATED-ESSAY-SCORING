"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ResourceKey =
  | "submissions"
  | "grades"
  | "question-bank"
  | "classes"
  | "materials"
  | "interactions"
  | "users-activity";

type ListResponse = {
  items: Record<string, any>[];
  total: number;
  page: number;
  size: number;
  has_next: boolean;
};

const resourceOptions: { key: ResourceKey; label: string }[] = [
  { key: "submissions", label: "Submissions" },
  { key: "grades", label: "Grades" },
  { key: "question-bank", label: "Question Bank" },
  { key: "classes", label: "Classes" },
  { key: "materials", label: "Materials" },
  { key: "interactions", label: "Interactions" },
  { key: "users-activity", label: "Users Activity" },
];

export default function SuperadminMonitoringPage() {
  const [resource, setResource] = useState<ResourceKey>("submissions");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [classId, setClassId] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [jumpPage, setJumpPage] = useState("1");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        size: String(Math.min(size, 10)),
      });
      if (q.trim()) params.set("q", q.trim());
      if ((resource === "submissions" || resource === "grades") && status.trim()) params.set("status", status.trim());
      if ((resource === "submissions" || resource === "grades" || resource === "materials" || resource === "question-bank") && classId.trim()) {
        params.set("class_id", classId.trim());
      }
      if (resource === "users-activity" && role.trim()) params.set("role", role.trim());
      const res = await fetch(`/api/admin/monitoring/${resource}?${params.toString()}`, { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Gagal memuat monitoring data");
      }
      setData(await res.json());
    } catch (err: any) {
      setError(err?.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, [resource, q, status, classId, role, page, size]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [resource, q, status, classId, role, size]);

  useEffect(() => {
    setJumpPage(String(page));
  }, [page]);

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / Math.max(1, size)));

  const goToPage = () => {
    const next = Number(jumpPage);
    if (!Number.isFinite(next)) return;
    const clamped = Math.min(Math.max(1, Math.floor(next)), totalPages);
    setPage(clamped);
  };

  const columns = useMemo(() => {
    if (!data?.items?.length) return [] as string[];
    return Object.keys(data.items[0]).filter((k) => k !== "metadata");
  }, [data]);

  const handleDelete = async (type: "grade" | "question-bank" | "class" | "material", id: string) => {
    const reason = window.prompt("Alasan penghapusan (wajib):");
    if (reason === null || reason.trim() === "") return;
    setActionLoadingId(id);
    setError(null);
    try {
      let url = "";
      if (type === "grade") url = `/api/admin/override/grades/${id}`;
      if (type === "question-bank") url = `/api/admin/override/question-bank/${id}`;
      if (type === "class") url = `/api/admin/override/classes/${id}`;
      if (type === "material") url = `/api/admin/override/materials/${id}`;
      const res = await fetch(url, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Gagal menghapus data");
      }
      await fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal menghapus data");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleEditGrade = async (submissionId: string) => {
    const scoreRaw = window.prompt("Skor AI baru (kosongkan jika tidak ubah):");
    const feedbackRaw = window.prompt("Feedback AI baru (opsional):");
    const revisedRaw = window.prompt("Revised score guru (opsional):");
    const teacherFeedbackRaw = window.prompt("Teacher feedback (opsional):");
    const payload: Record<string, any> = {};
    if (scoreRaw !== null && scoreRaw.trim() !== "") payload.skor_ai = Number(scoreRaw);
    if (feedbackRaw !== null && feedbackRaw.trim() !== "") payload.umpan_balik_ai = feedbackRaw;
    if (revisedRaw !== null && revisedRaw.trim() !== "") payload.revised_score = Number(revisedRaw);
    if (teacherFeedbackRaw !== null && teacherFeedbackRaw.trim() !== "") payload.teacher_feedback = teacherFeedbackRaw;
    if (Object.keys(payload).length === 0) return;

    setActionLoadingId(submissionId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/override/grades/${submissionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Gagal edit nilai");
      }
      await fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal edit nilai");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleEditQuestionBank = async (entryId: string, existingText?: string) => {
    const nextText = window.prompt("Ubah teks soal:", existingText || "");
    if (nextText === null || nextText.trim() === "") return;

    setActionLoadingId(entryId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/override/question-bank/${entryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ teks_soal: nextText }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Gagal edit bank soal");
      }
      await fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal edit bank soal");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Monitoring Center</h1>
        <p className="text-sm text-slate-500">Superadmin bisa memantau semua resource dan melakukan override CRUD.</p>
      </div>

      <div className="sage-panel p-4 grid gap-3 md:grid-cols-5">
        <select className="sage-input" value={resource} onChange={(e) => setResource(e.target.value as ResourceKey)}>
          {resourceOptions.map((item) => (
            <option key={item.key} value={item.key}>{item.label}</option>
          ))}
        </select>
        <input className="sage-input" placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
        {(resource === "submissions" || resource === "grades") ? (
          <input className="sage-input" placeholder="Status (queued/failed/...)" value={status} onChange={(e) => setStatus(e.target.value)} />
        ) : <div />}
        {(resource === "submissions" || resource === "grades" || resource === "materials" || resource === "question-bank") ? (
          <input className="sage-input" placeholder="Class ID filter" value={classId} onChange={(e) => setClassId(e.target.value)} />
        ) : <div />}
        {resource === "users-activity" ? (
          <input className="sage-input" placeholder="Role (student/teacher/superadmin)" value={role} onChange={(e) => setRole(e.target.value)} />
        ) : null}
        <select className="sage-input" value={size} onChange={(e) => setSize(Number(e.target.value))}>
          <option value={5}>5</option>
          <option value={10}>10</option>
        </select>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="sage-panel p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Total: {data?.total ?? 0}</p>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button className="sage-button-outline !px-3 !py-1.5 text-xs" onClick={() => setPage(1)} disabled={page <= 1 || loading}>First</button>
            <button className="sage-button-outline !px-3 !py-1.5 text-xs" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}>Prev</button>
            <p className="text-xs text-slate-600">Page {page} / {totalPages}</p>
            <button className="sage-button-outline !px-3 !py-1.5 text-xs" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={!data?.has_next || loading}>Next</button>
            <button className="sage-button-outline !px-3 !py-1.5 text-xs" onClick={() => setPage(totalPages)} disabled={page >= totalPages || loading}>Last</button>
            <input
              className="sage-input !w-20 !py-1.5 text-xs"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Page"
              value={jumpPage}
              onChange={(e) => setJumpPage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") goToPage();
              }}
              disabled={loading}
            />
            <button className="sage-button-outline !px-3 !py-1.5 text-xs" onClick={goToPage} disabled={loading}>Go</button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Memuat data...</p>
        ) : !data?.items?.length ? (
          <p className="text-sm text-slate-500">Tidak ada data.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  {columns.map((col) => (
                    <th key={col} className="px-2 py-2 text-left text-xs uppercase text-slate-500">{col}</th>
                  ))}
                  <th className="sticky right-0 z-20 bg-white px-2 py-2 text-left text-xs uppercase text-slate-500 border-l border-slate-200 shadow-[-4px_0_8px_-6px_rgba(15,23,42,0.25)]">
                    actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row, idx) => {
                  const rowId = row.id || row.submission_id || `${idx}`;
                  return (
                    <tr key={rowId} className="border-b border-slate-100">
                      {columns.map((col) => (
                        <td key={`${rowId}-${col}`} className="px-2 py-2 text-slate-700 max-w-[320px] truncate">
                          {typeof row[col] === "object" ? JSON.stringify(row[col]) : String(row[col] ?? "")}
                        </td>
                      ))}
                      <td className="sticky right-0 z-10 bg-white px-2 py-2 border-l border-slate-200 shadow-[-4px_0_8px_-6px_rgba(15,23,42,0.2)]">
                        <div className="flex flex-wrap gap-2">
                          {resource === "grades" && (
                            <>
                              <button className="sage-button-outline !px-2 !py-1 text-xs" onClick={() => handleEditGrade(row.submission_id)} disabled={actionLoadingId === row.submission_id}>Edit Nilai</button>
                              <button className="sage-button-outline !px-2 !py-1 text-xs text-rose-700 border-rose-200" onClick={() => handleDelete("grade", row.submission_id)} disabled={actionLoadingId === row.submission_id}>Hapus Nilai</button>
                            </>
                          )}
                          {resource === "question-bank" && (
                            <>
                              <button className="sage-button-outline !px-2 !py-1 text-xs" onClick={() => handleEditQuestionBank(row.id, row.teks_soal)} disabled={actionLoadingId === row.id}>Edit Soal</button>
                              <button className="sage-button-outline !px-2 !py-1 text-xs text-rose-700 border-rose-200" onClick={() => handleDelete("question-bank", row.id)} disabled={actionLoadingId === row.id}>Hapus</button>
                            </>
                          )}
                          {resource === "classes" && (
                            <button className="sage-button-outline !px-2 !py-1 text-xs text-rose-700 border-rose-200" onClick={() => handleDelete("class", row.id)} disabled={actionLoadingId === row.id}>Hapus Kelas</button>
                          )}
                          {resource === "materials" && (
                            <button className="sage-button-outline !px-2 !py-1 text-xs text-rose-700 border-rose-200" onClick={() => handleDelete("material", row.id)} disabled={actionLoadingId === row.id}>Hapus Materi</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
