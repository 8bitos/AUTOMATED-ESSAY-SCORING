"use client";

import { useCallback, useEffect, useState } from "react";

type ErrorTypeItem = {
  error_type: string;
  count: number;
};

type APIHealth = {
  latency_p95_ms: number;
  error_rate_24h: number;
  top_error_types: ErrorTypeItem[];
};

type APIStatsSummary = {
  requests_today: number;
  success_rate_30d: number;
  avg_response_ms_30d: number;
  today_total_tokens: number;
  tokens_remaining: number;
  rpm_used: number;
  rpm_limit: number;
  tpm_used: number;
  tpm_limit: number;
  rpd_used: number;
  rpd_limit: number;
};

type APIStats = {
  summary: APIStatsSummary;
};

export default function SuperadminAIOpsPage() {
  const [stats, setStats] = useState<APIStats | null>(null);
  const [health, setHealth] = useState<APIHealth | null>(null);
  const [maskedKey, setMaskedKey] = useState("");
  const [revealedKey, setRevealedKey] = useState("");
  const [newKey, setNewKey] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [keyLoading, setKeyLoading] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keyMessage, setKeyMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, healthRes, keyRes] = await Promise.all([
        fetch("/api/admin/api-statistics?days=7", { credentials: "include" }),
        fetch("/api/admin/api-statistics/health", { credentials: "include" }),
        fetch("/api/admin/ai-config/gemini-key", { credentials: "include" }),
      ]);

      if (!statsRes.ok) throw new Error("Gagal memuat statistik AI");
      if (!healthRes.ok) throw new Error("Gagal memuat health AI");
      if (!keyRes.ok) throw new Error("Gagal memuat status GEMINI_API_KEY");

      setStats(await statsRes.json());
      setHealth(await healthRes.json());
      const keyPayload = await keyRes.json();
      setMaskedKey(keyPayload?.masked_key || "");
    } catch (err: any) {
      setError(err?.message || "Terjadi kesalahan saat memuat AI Ops");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const revealCurrentKey = async () => {
    setKeyLoading(true);
    setKeyError(null);
    setKeyMessage(null);
    try {
      const res = await fetch("/api/admin/ai-config/gemini-key/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: adminPassword }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Gagal menampilkan API key");
      }
      const payload = await res.json();
      setRevealedKey(payload?.api_key || "");
      setKeyMessage("API key berhasil ditampilkan.");
    } catch (err: any) {
      setKeyError(err?.message || "Gagal menampilkan API key");
    } finally {
      setKeyLoading(false);
    }
  };

  const saveNewKey = async () => {
    setSavingKey(true);
    setKeyError(null);
    setKeyMessage(null);
    try {
      const res = await fetch("/api/admin/ai-config/gemini-key", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: adminPassword, api_key: newKey }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Gagal memperbarui API key");
      }
      const payload = await res.json();
      setMaskedKey(payload?.masked_key || "");
      setRevealedKey("");
      setNewKey("");
      setKeyMessage(payload?.message || "API key berhasil diperbarui");
      await loadData();
    } catch (err: any) {
      setKeyError(err?.message || "Gagal memperbarui API key");
    } finally {
      setSavingKey(false);
    }
  };

  const s = stats?.summary;

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">AI Ops</h1>
            <p className="text-sm text-slate-500">Pantau kesehatan API AI, rate limit, dan error utama.</p>
          </div>
          <button type="button" onClick={loadData} className="sage-button-outline" disabled={loading}>
            {loading ? "Memuat..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="sage-panel p-4"><p className="text-xs text-slate-500">Requests Today</p><p className="text-2xl font-semibold">{s?.requests_today ?? 0}</p></div>
        <div className="sage-panel p-4"><p className="text-xs text-slate-500">P95 Latency (24h)</p><p className="text-2xl font-semibold">{Math.round(health?.latency_p95_ms ?? 0)} ms</p></div>
        <div className="sage-panel p-4"><p className="text-xs text-slate-500">Error Rate (24h)</p><p className="text-2xl font-semibold">{(health?.error_rate_24h ?? 0).toFixed(2)}%</p></div>
        <div className="sage-panel p-4"><p className="text-xs text-slate-500">Success Rate (30d)</p><p className="text-2xl font-semibold">{(s?.success_rate_30d ?? 0).toFixed(2)}%</p></div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="sage-panel p-5 space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">Rate Limit Usage</h2>
          <p className="text-sm text-slate-600">RPM: {(s?.rpm_used ?? 0)} / {(s?.rpm_limit ?? 0)}</p>
          <p className="text-sm text-slate-600">TPM: {(s?.tpm_used ?? 0)} / {(s?.tpm_limit ?? 0)}</p>
          <p className="text-sm text-slate-600">RPD: {(s?.rpd_used ?? 0)} / {(s?.rpd_limit ?? 0)}</p>
        </div>

        <div className="sage-panel p-5 space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">Token</h2>
          <p className="text-sm text-slate-600">Today: {(s?.today_total_tokens ?? 0).toLocaleString("id-ID")}</p>
          <p className="text-sm text-slate-600">Remaining: {(s?.tokens_remaining ?? 0).toLocaleString("id-ID")}</p>
          <p className="text-sm text-slate-600">Avg Response (30d): {(s?.avg_response_ms_30d ?? 0).toFixed(0)} ms</p>
        </div>
      </div>

      <div className="sage-panel p-5">
        <h2 className="text-lg font-semibold text-slate-900">Top Error Types (24h)</h2>
        {health?.top_error_types?.length ? (
          <div className="mt-3 space-y-2">
            {health.top_error_types.map((item) => (
              <div key={item.error_type} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <p className="text-sm text-slate-700">{item.error_type}</p>
                <p className="text-sm font-semibold text-slate-900">{item.count}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Tidak ada error pada 24 jam terakhir.</p>
        )}
      </div>

      <div className="sage-panel p-5 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Manajemen GEMINI_API_KEY</h2>
        <p className="text-sm text-slate-500">
          Key disembunyikan secara default. Untuk lihat dan ganti key wajib masukkan password superadmin.
        </p>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Password Superadmin</label>
          <input
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            className="sage-input"
            placeholder="Masukkan password admin"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Current Key (Masked)</label>
          <input type="text" readOnly className="sage-input" value={maskedKey || "(kosong)"} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="sage-button-outline"
            onClick={revealCurrentKey}
            disabled={keyLoading || !adminPassword}
          >
            {keyLoading ? "Memeriksa..." : "Lihat Key"}
          </button>
        </div>

        {revealedKey && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Current Key (Revealed)</label>
            <input type="text" readOnly className="sage-input" value={revealedKey} />
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Ganti Dengan Key Baru</label>
          <input
            type="password"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="sage-input"
            placeholder="Masukkan GEMINI_API_KEY baru"
          />
        </div>

        <button
          type="button"
          className="sage-button"
          onClick={saveNewKey}
          disabled={savingKey || !adminPassword || !newKey}
        >
          {savingKey ? "Menyimpan..." : "Simpan API Key Baru"}
        </button>

        {keyError && <p className="text-sm text-rose-600">{keyError}</p>}
        {keyMessage && !keyError && <p className="text-sm text-emerald-600">{keyMessage}</p>}
      </div>
    </div>
  );
}
