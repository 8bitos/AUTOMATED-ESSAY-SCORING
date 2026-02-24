"use client";

import { useEffect, useState } from "react";

type AlertItem = {
  id: string;
  level: "warning" | "critical" | string;
  title: string;
  detail: string;
  observed_at: string;
};

export default function SuperadminAnomalyAlertsPage() {
  const [days, setDays] = useState(7);
  const [items, setItems] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/anomaly-alerts?days=${days}`, { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Gagal memuat anomaly alerts");
      setItems(Array.isArray(body?.items) ? body.items : []);
    } catch (err: any) {
      setError(err?.message || "Gagal memuat anomaly alerts");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [days]);

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Anomaly Alerts</h1>
        <p className="text-sm text-slate-500">Deteksi dini pola aneh: failed rate, backlog queue, dan lonjakan aktivitas.</p>
      </div>

      <div className="sage-panel p-4 flex items-center gap-3">
        <label className="text-sm text-slate-600">Window (hari)</label>
        <input
          type="number"
          min={1}
          max={90}
          className="sage-input !w-28"
          value={days}
          onChange={(e) => setDays(Math.max(1, Math.min(90, Number(e.target.value) || 1)))}
        />
        <button className="sage-button-outline !py-2" onClick={load} disabled={loading}>Refresh</button>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="sage-panel p-4 space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Memuat alerts...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-emerald-700">Tidak ada anomali pada window ini.</p>
        ) : (
          items.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-xl border p-4 ${
                alert.level === "critical" ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{alert.title}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${alert.level === "critical" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                  {alert.level.toUpperCase()}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-700">{alert.detail}</p>
              <p className="mt-1 text-[11px] text-slate-500">{new Date(alert.observed_at).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
