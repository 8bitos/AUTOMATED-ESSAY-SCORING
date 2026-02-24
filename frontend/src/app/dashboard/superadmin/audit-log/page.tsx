"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AuditItem = {
  id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  target_type: string;
  target_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
};

type AuditResponse = {
  items: AuditItem[];
  total: number;
  page: number;
  size: number;
};

export default function SuperadminAuditLogPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState("");
  const [query, setQuery] = useState("");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: "1", size: "30" });
      if (action.trim()) params.set("action", action.trim());
      if (query.trim()) params.set("q", query.trim());

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Gagal memuat audit log");
      setData(await res.json());
    } catch (err: any) {
      setError(err?.message || "Terjadi kesalahan saat memuat audit log");
    } finally {
      setLoading(false);
    }
  }, [action, query]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const items = useMemo(() => data?.items ?? [], [data]);

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Audit Log</h1>
            <p className="text-sm text-slate-500">Riwayat aksi admin untuk kebutuhan tracking dan investigasi.</p>
          </div>
          <button type="button" onClick={loadLogs} className="sage-button-outline" disabled={loading}>
            {loading ? "Memuat..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="sage-panel p-4 grid gap-3 md:grid-cols-3">
        <div>
          <label className="text-xs text-slate-500">Filter Action</label>
          <input
            type="text"
            className="sage-input"
            placeholder="contoh: update_user"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Cari Target/Actor</label>
          <input
            type="text"
            className="sage-input"
            placeholder="nama / id target"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <button type="button" className="sage-button w-full" onClick={loadLogs} disabled={loading}>
            Terapkan Filter
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="sage-panel p-5">
        <p className="text-sm text-slate-500 mb-3">Total log: {data?.total ?? 0}</p>
        <div className="space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada data audit.</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{item.action}</p>
                  <p className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Actor: <span className="font-medium">{item.actor_name}</span> ({item.actor_id})
                </p>
                <p className="text-xs text-slate-600">
                  Target: <span className="font-medium">{item.target_type}</span> {item.target_id ? `(${item.target_id})` : ""}
                </p>
                {item.metadata && (
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-2 text-[11px] text-slate-700">
                    {JSON.stringify(item.metadata, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
