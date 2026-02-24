"use client";

import { useCallback, useEffect, useState } from "react";

type SettingItem = {
  key: string;
  value: string;
  description: string;
  type: string;
};

export default function SuperadminConfigCenterPage() {
  const [items, setItems] = useState<SettingItem[]>([]);
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", { credentials: "include" });
      if (!res.ok) throw new Error("Gagal memuat setting");
      const payload = await res.json();
      const data = Array.isArray(payload?.items) ? payload.items : [];
      setItems(data);
      const initialValues: Record<string, string> = {};
      data.forEach((item: SettingItem) => {
        initialValues[item.key] = item.value ?? "";
      });
      setEditingValues(initialValues);
    } catch (err: any) {
      setError(err?.message || "Tidak dapat memuat setting");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSetting = async (key: string) => {
    setSavingKey(key);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/settings/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ value: editingValues[key] ?? "" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Gagal menyimpan setting");
      }
      setMessage(`Setting ${key} berhasil diperbarui.`);
      await loadSettings();
    } catch (err: any) {
      setError(err?.message || "Gagal menyimpan setting");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Config Center</h1>
        <p className="text-sm text-slate-500">Kelola setting operasional sistem yang sudah di-whitelist.</p>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {message && !error && <p className="text-sm text-emerald-600">{message}</p>}

      <div className="sage-panel p-6 space-y-4">
        {loading ? (
          <p className="text-sm text-slate-500">Memuat setting...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada setting yang tersedia.</p>
        ) : (
          items.map((item) => (
            <div key={item.key} className="rounded-xl border border-slate-200 p-4">
              <div className="mb-2">
                <p className="text-sm font-semibold text-slate-900">{item.key}</p>
                <p className="text-xs text-slate-500">{item.description}</p>
              </div>

              {item.type === "enum" && item.key === "grading_mode" ? (
                <select
                  className="sage-input"
                  value={editingValues[item.key] ?? ""}
                  onChange={(e) => setEditingValues((prev) => ({ ...prev, [item.key]: e.target.value }))}
                >
                  <option value="queued">queued</option>
                  <option value="instant">instant</option>
                </select>
              ) : item.type === "boolean" ? (
                <select
                  className="sage-input"
                  value={editingValues[item.key] ?? ""}
                  onChange={(e) => setEditingValues((prev) => ({ ...prev, [item.key]: e.target.value }))}
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : (
                <input
                  type="text"
                  className="sage-input"
                  value={editingValues[item.key] ?? ""}
                  onChange={(e) => setEditingValues((prev) => ({ ...prev, [item.key]: e.target.value }))}
                />
              )}

              <div className="mt-3">
                <button
                  type="button"
                  className="sage-button"
                  onClick={() => saveSetting(item.key)}
                  disabled={savingKey === item.key}
                >
                  {savingKey === item.key ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
