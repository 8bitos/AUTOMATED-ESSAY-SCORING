"use client";

import { useEffect, useState } from "react";

type FlagItem = {
  key: string;
  description: string;
  value: boolean;
};

export default function SuperadminFeatureFlagsPage() {
  const [items, setItems] = useState<FlagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/feature-flags", { credentials: "include" });
      if (!res.ok) throw new Error("Gagal memuat feature flags");
      const body = await res.json();
      setItems(Array.isArray(body?.items) ? body.items : []);
    } catch (err: any) {
      setError(err?.message || "Gagal memuat feature flags");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleFlag = async (item: FlagItem) => {
    setSavingKey(item.key);
    setError(null);
    try {
      const res = await fetch(`/api/admin/feature-flags/${item.key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ value: !item.value }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Gagal update flag");
      setItems((prev) => prev.map((it) => (it.key === item.key ? { ...it, value: !it.value } : it)));
    } catch (err: any) {
      setError(err?.message || "Gagal update flag");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Feature Flags</h1>
        <p className="text-sm text-slate-500">Nyalakan/matikan fitur superadmin tanpa deploy ulang.</p>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="sage-panel p-4 space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Memuat feature flags...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada feature flag.</p>
        ) : (
          items.map((item) => (
            <div key={item.key} className="rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.key}</p>
                <p className="text-xs text-slate-500">{item.description}</p>
              </div>
              <button
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${item.value ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}
                onClick={() => toggleFlag(item)}
                disabled={savingKey === item.key}
              >
                {savingKey === item.key ? "Saving..." : item.value ? "ON" : "OFF"}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
