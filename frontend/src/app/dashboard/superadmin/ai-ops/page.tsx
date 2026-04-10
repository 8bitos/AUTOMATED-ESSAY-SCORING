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

/* ─── tiny SVG icons (inline to avoid extra deps) ─── */
const IconActivity = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
);
const IconClock = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
);
const IconAlertTriangle = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
);
const IconCheckCircle = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
);
const IconRefresh = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
);
const IconKey = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>
);
const IconEye = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
);
const IconEyeOff = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
);
const IconZap = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
);
const IconInfinity = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z" /></svg>
);

/* ─── Progress bar component ─── */
function RateLimitBar({ label, used, limit, isUnlimited }: { label: string; used: number; limit: number; isUnlimited: boolean }) {
  if (isUnlimited) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <IconInfinity /> Unlimited
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/50">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-500" style={{ width: "100%" }} />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">Terpakai: {used.toLocaleString("id-ID")}</p>
      </div>
    );
  }

  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const color = pct >= 85 ? "from-rose-400 to-red-500" : pct >= 60 ? "from-amber-400 to-orange-400" : "from-emerald-400 to-teal-400";
  const textColor = pct >= 85 ? "text-rose-600 dark:text-rose-400" : pct >= 60 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
        <span className={`text-xs font-semibold ${textColor}`}>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/50">
        <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {used.toLocaleString("id-ID")} / {limit.toLocaleString("id-ID")}
      </p>
    </div>
  );
}

/* ─── Stat card component ─── */
function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="sage-panel p-4 flex items-start gap-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">{value}</p>
      </div>
    </div>
  );
}




export default function SuperadminAIOpsPage() {
  const [activeTab, setActiveTab] = useState<"monitoring" | "config">("monitoring");
  const [stats, setStats] = useState<APIStats | null>(null);
  const [health, setHealth] = useState<APIHealth | null>(null);
  const [maskedKey, setMaskedKey] = useState("");
  const [revealedKey, setRevealedKey] = useState("");
  const [newKey, setNewKey] = useState("");
  const [passwordHint, setPasswordHint] = useState<string | null>(null);
  const [passwordShake, setPasswordShake] = useState(false);
  const [provider, setProvider] = useState("gemini");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [modelMode, setModelMode] = useState<"preset" | "custom">("preset");
  const [customModel, setCustomModel] = useState("");
  const [providerSaving, setProviderSaving] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [providerMessage, setProviderMessage] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [liteLLMBaseURL, setLiteLLMBaseURL] = useState("");
  const [liteLLMMaskedKey, setLiteLLMMaskedKey] = useState("");
  const [liteLLMRevealedKey, setLiteLLMRevealedKey] = useState("");
  const [liteLLMNewKey, setLiteLLMNewKey] = useState("");
  const [liteLLMKeyLoading, setLiteLLMKeyLoading] = useState(false);
  const [liteLLMSaving, setLiteLLMSaving] = useState(false);
  const [liteLLMError, setLiteLLMError] = useState<string | null>(null);
  const [liteLLMMessage, setLiteLLMMessage] = useState<string | null>(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [keyLoading, setKeyLoading] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keyMessage, setKeyMessage] = useState<string | null>(null);

  const shakePasswordBar = useCallback((msg: string) => {
    setPasswordHint(msg);
    setPasswordShake(true);
    setTimeout(() => setPasswordShake(false), 500);
    setTimeout(() => setPasswordHint(null), 4000);
  }, []);

  const liteLLMModelOptions = [
    { name: "Gemini 3.1 Pro (gemini)", id: "gemini/gemini-3.1-pro-preview", inCost: "$2.00", outCost: "$12.00" },
    { name: "Gemini 3.1 Flash Image (gemini)", id: "gemini/gemini-3.1-flash-image-preview", inCost: "$0.50", outCost: "$3.00" },
    { name: "Gemini 3.1 Flash Lite (gemini)", id: "gemini/gemini-3.1-flash-lite-preview", inCost: "$0.25", outCost: "$1.50" },
    { name: "Gemini 3 Pro (gemini)", id: "gemini/gemini-3-pro-preview", inCost: "$2.00", outCost: "$12.00" },
    { name: "Gemini 3 Pro Image (gemini)", id: "gemini/gemini-3-pro-image-preview", inCost: "$2.00", outCost: "$12.00" },
    { name: "Gemini 3 Flash (gemini)", id: "gemini/gemini-3-flash-preview", inCost: "$0.50", outCost: "$3.00" },
    { name: "Gemini 2.5 Pro (gemini)", id: "gemini/gemini-2.5-pro", inCost: "$1.25", outCost: "$10.00" },
    { name: "Gemini 2.5 Flash (gemini)", id: "gemini/gemini-2.5-flash", inCost: "$0.30", outCost: "$2.50" },
    { name: "Gemini 2.5 Flash Image (gemini)", id: "gemini/gemini-2.5-flash-image", inCost: "$0.30", outCost: "$2.50" },
    { name: "Gemini 2.5 Flash Lite (gemini)", id: "gemini/gemini-2.5-flash-lite", inCost: "$0.10", outCost: "$0.40" },
    { name: "Gemini 2.0 Flash (gemini)", id: "gemini/gemini-2.0-flash", inCost: "$0.15", outCost: "$0.60" },
    { name: "Gemini 2.0 Flash Lite (gemini)", id: "gemini/gemini-2.0-flash-lite", inCost: "$0.07", outCost: "$0.30" },
    { name: "Gemini Embedding (gemini)", id: "gemini/gemini-embedding-001", inCost: "$0.15", outCost: "$0.00" },
    { name: "Gemini Live 2.5 Flash Audio (gemini)", id: "gemini/gemini-live-2.5-flash-preview-native-audio-09-2025", inCost: "$0.30", outCost: "$2.50" },
    { name: "Gemini 3.1 Pro", id: "vertex_ai/gemini-3.1-pro-preview", inCost: "$2.00", outCost: "$12.00" },
    { name: "Gemini 3.1 Flash Image", id: "vertex_ai/gemini-3.1-flash-image-preview", inCost: "$0.50", outCost: "$3.00" },
    { name: "Gemini 3.1 Flash Lite", id: "vertex_ai/gemini-3.1-flash-lite-preview", inCost: "$0.25", outCost: "$1.50" },
    { name: "Gemini 3 Pro", id: "vertex_ai/gemini-3-pro-preview", inCost: "$2.00", outCost: "$12.00" },
    { name: "Gemini 3 Pro Image", id: "vertex_ai/gemini-3-pro-image-preview", inCost: "$2.00", outCost: "$12.00" },
    { name: "Gemini 3 Flash", id: "vertex_ai/gemini-3-flash-preview", inCost: "$0.50", outCost: "$3.00" },
    { name: "Gemini 2.5 Pro", id: "vertex_ai/gemini-2.5-pro", inCost: "$1.25", outCost: "$10.00" },
    { name: "Gemini 2.5 Flash", id: "vertex_ai/gemini-2.5-flash", inCost: "$0.30", outCost: "$2.50" },
    { name: "Gemini 2.5 Flash Image", id: "vertex_ai/gemini-2.5-flash-image", inCost: "$0.30", outCost: "$2.50" },
    { name: "Gemini 2.5 Flash Lite", id: "vertex_ai/gemini-2.5-flash-lite", inCost: "$0.10", outCost: "$0.40" },
    { name: "Gemini 2.0 Flash", id: "vertex_ai/gemini-2.0-flash", inCost: "$0.15", outCost: "$0.60" },
    { name: "Gemini 2.0 Flash Lite", id: "vertex_ai/gemini-2.0-flash-lite", inCost: "$0.07", outCost: "$0.30" },
    { name: "Gemini Embedding", id: "vertex_ai/gemini-embedding-001", inCost: "$0.15", outCost: "$0.00" },
  ];

  /* group models by provider prefix for a nicer dropdown */
  const geminiDirect = liteLLMModelOptions.filter((m) => m.id.startsWith("gemini/"));
  const vertexAI = liteLLMModelOptions.filter((m) => m.id.startsWith("vertex_ai/"));

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, healthRes, keyRes, providerRes, liteLLMRes] = await Promise.all([
        fetch("/api/admin/api-statistics?days=7", { credentials: "include" }),
        fetch("/api/admin/api-statistics/health", { credentials: "include" }),
        fetch("/api/admin/ai-config/gemini-key", { credentials: "include" }),
        fetch("/api/admin/ai-config/provider", { credentials: "include" }),
        fetch("/api/admin/ai-config/litellm", { credentials: "include" }),
      ]);

      if (!statsRes.ok) throw new Error("Gagal memuat statistik AI");
      if (!healthRes.ok) throw new Error("Gagal memuat health AI");
      if (!keyRes.ok) throw new Error("Gagal memuat status GEMINI_API_KEY");
      if (!providerRes.ok) throw new Error("Gagal memuat konfigurasi AI");
      if (!liteLLMRes.ok) throw new Error("Gagal memuat konfigurasi LiteLLM");

      setStats(await statsRes.json());
      setHealth(await healthRes.json());
      const keyPayload = await keyRes.json();
      setMaskedKey(keyPayload?.masked_key || "");
      const providerPayload = await providerRes.json();
      setProvider(providerPayload?.provider || "gemini");
      const nextModel = providerPayload?.model || "gemini-2.5-flash";
      setModel(nextModel);
      if (providerPayload?.provider === "litellm") {
        const hasPreset = liteLLMModelOptions.some((item) => item.id === nextModel);
        setModelMode(hasPreset ? "preset" : "custom");
        setCustomModel(hasPreset ? "" : nextModel);
      } else {
        setModelMode("custom");
        setCustomModel(nextModel);
      }
      const litePayload = await liteLLMRes.json();
      setLiteLLMMaskedKey(litePayload?.masked_key || "");
      setLiteLLMBaseURL(litePayload?.base_url || "");
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

  const saveProviderConfig = async () => {
    setProviderSaving(true);
    setProviderError(null);
    setProviderMessage(null);
    try {
      const resolvedModel = provider === "litellm"
        ? (modelMode === "custom" ? customModel : model)
        : (customModel || model);
      const res = await fetch("/api/admin/ai-config/provider", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ provider, model: resolvedModel }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Gagal memperbarui konfigurasi AI");
      }
      const payload = await res.json();
      setProvider(payload?.provider || provider);
      const updatedModel = payload?.model || resolvedModel;
      setModel(updatedModel);
      if (provider === "litellm") {
        const hasPreset = liteLLMModelOptions.some((item) => item.id === updatedModel);
        setModelMode(hasPreset ? "preset" : "custom");
        setCustomModel(hasPreset ? "" : updatedModel);
      } else {
        setModelMode("custom");
        setCustomModel(updatedModel);
      }
      setProviderMessage(payload?.message || "Konfigurasi AI berhasil diperbarui");
      await loadData();
    } catch (err: any) {
      setProviderError(err?.message || "Gagal memperbarui konfigurasi AI");
    } finally {
      setProviderSaving(false);
    }
  };

  const testConnection = async () => {
    setTestLoading(true);
    setTestError(null);
    setTestMessage(null);
    try {
      const res = await fetch("/api/admin/ai-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Tes koneksi gagal");
      }
      const payload = await res.json();
      const latency = Math.round(payload?.latency_ms ?? 0);
      setTestMessage(`Koneksi OK • ${latency} ms`);
    } catch (err: any) {
      setTestError(err?.message || "Tes koneksi gagal");
    } finally {
      setTestLoading(false);
    }
  };

  const revealLiteLLMKey = async () => {
    setLiteLLMKeyLoading(true);
    setLiteLLMError(null);
    setLiteLLMMessage(null);
    try {
      const res = await fetch("/api/admin/ai-config/litellm/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: adminPassword }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Gagal menampilkan API key LiteLLM");
      }
      const payload = await res.json();
      setLiteLLMRevealedKey(payload?.api_key || "");
      setLiteLLMMessage("API key LiteLLM berhasil ditampilkan.");
    } catch (err: any) {
      setLiteLLMError(err?.message || "Gagal menampilkan API key LiteLLM");
    } finally {
      setLiteLLMKeyLoading(false);
    }
  };

  const saveLiteLLMConfig = async () => {
    setLiteLLMSaving(true);
    setLiteLLMError(null);
    setLiteLLMMessage(null);
    try {
      const res = await fetch("/api/admin/ai-config/litellm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          password: adminPassword,
          api_key: liteLLMNewKey,
          base_url: liteLLMBaseURL,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Gagal memperbarui konfigurasi LiteLLM");
      }
      const payload = await res.json();
      setLiteLLMMaskedKey(payload?.masked_key || "");
      setLiteLLMRevealedKey("");
      setLiteLLMNewKey("");
      setLiteLLMMessage(payload?.message || "Konfigurasi LiteLLM berhasil diperbarui");
      await loadData();
    } catch (err: any) {
      setLiteLLMError(err?.message || "Gagal memperbarui konfigurasi LiteLLM");
    } finally {
      setLiteLLMSaving(false);
    }
  };

  const s = stats?.summary;
  const isLiteLLM = provider === "litellm";

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="sage-panel p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">AI Ops</h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Pantau kesehatan dan kelola konfigurasi AI system.
            </p>
          </div>
          <button type="button" onClick={loadData} className="sage-button-outline gap-2" disabled={loading}>
            <IconRefresh />
            {loading ? "Memuat..." : "Refresh"}
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="mt-4 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/60">
          <button
            type="button"
            onClick={() => setActiveTab("monitoring")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === "monitoring"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            }`}
          >
            📊 Monitoring
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("config")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === "config"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            }`}
          >
            ⚙️ Konfigurasi
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
          <IconAlertTriangle />
          {error}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          TAB: MONITORING
         ════════════════════════════════════════════════════════ */}
      {activeTab === "monitoring" && (
        <div className="space-y-5 animate-fade-in">
          {/* ── Stat cards ── */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={<IconActivity />}
              label="Permintaan Hari Ini"
              value={String(s?.requests_today ?? 0)}
              accent="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
            />
            <StatCard
              icon={<IconClock />}
              label="Latensi P95 (24 jam)"
              value={`${Math.round(health?.latency_p95_ms ?? 0)} ms`}
              accent="bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
            />
            <StatCard
              icon={<IconAlertTriangle />}
              label="Tingkat Error (24 jam)"
              value={`${(health?.error_rate_24h ?? 0).toFixed(2)}%`}
              accent="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
            />
            <StatCard
              icon={<IconCheckCircle />}
              label="Tingkat Sukses (30 hari)"
              value={`${(s?.success_rate_30d ?? 0).toFixed(2)}%`}
              accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
            />
          </div>

          {/* ── Rate Limit & Token ── */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="sage-panel p-5 space-y-4">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                <IconZap /> Penggunaan Rate Limit
              </h2>
              <RateLimitBar label="RPM (Request/Menit)" used={s?.rpm_used ?? 0} limit={s?.rpm_limit ?? 0} isUnlimited={isLiteLLM} />
              <RateLimitBar label="TPM (Token/Menit)" used={s?.tpm_used ?? 0} limit={s?.tpm_limit ?? 0} isUnlimited={isLiteLLM} />
              <RateLimitBar label="RPD (Request/Hari)" used={s?.rpd_used ?? 0} limit={s?.rpd_limit ?? 0} isUnlimited={isLiteLLM} />
            </div>

            <div className="sage-panel p-5 space-y-4">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                <IconActivity /> Penggunaan Token
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700/60">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Token Hari Ini</p>
                  <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                    {(s?.today_total_tokens ?? 0).toLocaleString("id-ID")}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700/60">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Sisa Token</p>
                  <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                    {isLiteLLM ? (
                      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <IconInfinity /> Unlimited
                      </span>
                    ) : (
                      (s?.tokens_remaining ?? 0).toLocaleString("id-ID")
                    )}
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700/60">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Rata-rata Respons (30 hari)</p>
                <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                  {(s?.avg_response_ms_30d ?? 0).toFixed(0)} ms
                </p>
              </div>
            </div>
          </div>

          {/* ── Top Error Types ── */}
          <div className="sage-panel p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
              <IconAlertTriangle /> Error Teratas (24 jam)
            </h2>
            {health?.top_error_types?.length ? (
              <div className="mt-3 space-y-2">
                {health.top_error_types.map((item) => (
                  <div key={item.error_type} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-2.5 dark:border-slate-700/60">
                    <p className="text-sm text-slate-700 dark:text-slate-300">{item.error_type}</p>
                    <span className="rounded-lg bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                ✅ Tidak ada error pada 24 jam terakhir.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          TAB: KONFIGURASI
         ════════════════════════════════════════════════════════ */}
      {activeTab === "config" && (
        <div className="space-y-4 animate-fade-in">
          {/* ── Compact password bar ── */}
          <div className={`sage-panel px-4 py-3 transition-all ${passwordShake ? "animate-[shake_0.4s_ease-in-out]" : ""} ${passwordHint ? "ring-2 ring-amber-400/60" : ""}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 shrink-0">
                <IconKey />
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Password Admin</span>
              </div>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => { setAdminPassword(e.target.value); setPasswordHint(null); }}
                className={`sage-input !py-2 sm:max-w-xs ${passwordHint ? "!border-amber-400 !ring-amber-400/40" : ""}`}
                placeholder="Masukkan password untuk kelola key"
              />
              {passwordHint ? (
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  ⚠ {passwordHint}
                </span>
              ) : (
                <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">
                  Diperlukan untuk melihat/mengubah API key
                </span>
              )}
            </div>
          </div>

          {/* ── 2-column grid: Provider & Model | API Keys ── */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* ─── LEFT: Provider & Model ─── */}
            <div className="sage-panel p-5 space-y-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Provider & Model</h3>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="sage-input"
                >
                  <option value="gemini">Gemini (Google)</option>
                  <option value="litellm">LiteLLM (OpenAI-compatible)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Model</label>
                {provider === "litellm" ? (
                  <select
                    value={modelMode === "preset" ? model : "custom"}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "custom") {
                        setModelMode("custom");
                        setCustomModel(customModel || model);
                      } else {
                        setModelMode("preset");
                        setModel(value);
                        setCustomModel("");
                      }
                    }}
                    className="sage-input"
                  >
                    <optgroup label="Gemini Direct">
                      {geminiDirect.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} — {item.inCost} / {item.outCost}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Vertex AI">
                      {vertexAI.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} — {item.inCost} / {item.outCost}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Lainnya">
                      <option value="custom">Custom...</option>
                    </optgroup>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={customModel}
                    onChange={(e) => {
                      setCustomModel(e.target.value);
                      setModel(e.target.value);
                    }}
                    className="sage-input"
                    placeholder="gemini-2.5-flash"
                  />
                )}
              </div>

              {provider === "litellm" && modelMode === "custom" && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Custom Model ID</label>
                  <input
                    type="text"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    className="sage-input"
                    placeholder="vertex_ai/gemini-2.5-flash"
                  />
                </div>
              )}

              {provider === "litellm" && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Format biaya: input per 1M token (kiri) — output per 1M token (kanan).
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="sage-button"
                  onClick={saveProviderConfig}
                  disabled={providerSaving || (provider === "litellm" ? (modelMode === "custom" ? !customModel : !model) : !customModel)}
                >
                  {providerSaving ? "Menyimpan..." : "Simpan"}
                </button>
                <button
                  type="button"
                  className="sage-button-outline"
                  onClick={testConnection}
                  disabled={testLoading}
                >
                  {testLoading ? "Menguji..." : "Tes Koneksi"}
                </button>
              </div>

              {providerError && <p className="text-sm text-rose-600 dark:text-rose-400">{providerError}</p>}
              {providerMessage && !providerError && <p className="text-sm text-emerald-600 dark:text-emerald-400">{providerMessage}</p>}
              {testError && <p className="text-sm text-rose-600 dark:text-rose-400">{testError}</p>}
              {testMessage && !testError && <p className="text-sm text-emerald-600 dark:text-emerald-400">{testMessage}</p>}
            </div>

            {/* ─── RIGHT: API Keys ─── */}
            <div className="sage-panel p-5 space-y-5">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">🔑 API Keys</h3>

              {/* Gemini Key */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Gemini API Key</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    className="sage-input flex-1 font-mono text-xs"
                    value={revealedKey || maskedKey || "(kosong)"}
                  />
                  <button
                    type="button"
                    className="sage-button-outline shrink-0 gap-1.5"
                    onClick={() => {
                      if (revealedKey) { setRevealedKey(""); return; }
                      if (!adminPassword) { shakePasswordBar("Untuk melihat key, masukkan password admin terlebih dahulu"); return; }
                      revealCurrentKey();
                    }}
                    disabled={keyLoading}
                  >
                    {revealedKey ? <IconEyeOff /> : <IconEye />}
                    {keyLoading ? "..." : revealedKey ? "Sembunyikan" : "Lihat"}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    className="sage-input flex-1"
                    placeholder="Key baru..."
                  />
                  <button
                    type="button"
                    className="sage-button shrink-0"
                    onClick={() => { if (!adminPassword) { shakePasswordBar("Untuk menyimpan key, masukkan password admin terlebih dahulu"); return; } saveNewKey(); }}
                    disabled={savingKey || !newKey}
                  >
                    {savingKey ? "..." : "Simpan"}
                  </button>
                </div>
                {keyError && <p className="text-sm text-rose-600 dark:text-rose-400">{keyError}</p>}
                {keyMessage && !keyError && <p className="text-sm text-emerald-600 dark:text-emerald-400">{keyMessage}</p>}
              </div>

              {/* LiteLLM section (conditional) */}
              {isLiteLLM ? (
                <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700/60">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">LiteLLM</p>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Base URL</label>
                    <input
                      type="text"
                      value={liteLLMBaseURL}
                      onChange={(e) => setLiteLLMBaseURL(e.target.value)}
                      className="sage-input"
                      placeholder="https://api.koboillm.com/v1"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      className="sage-input flex-1 font-mono text-xs"
                      value={liteLLMRevealedKey || liteLLMMaskedKey || "(kosong)"}
                    />
                    <button
                      type="button"
                      className="sage-button-outline shrink-0 gap-1.5"
                      onClick={() => {
                        if (liteLLMRevealedKey) { setLiteLLMRevealedKey(""); return; }
                        if (!adminPassword) { shakePasswordBar("Untuk melihat key, masukkan password admin terlebih dahulu"); return; }
                        revealLiteLLMKey();
                      }}
                      disabled={liteLLMKeyLoading}
                    >
                      {liteLLMRevealedKey ? <IconEyeOff /> : <IconEye />}
                      {liteLLMKeyLoading ? "..." : liteLLMRevealedKey ? "Sembunyikan" : "Lihat"}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={liteLLMNewKey}
                      onChange={(e) => setLiteLLMNewKey(e.target.value)}
                      className="sage-input flex-1"
                      placeholder="Key baru..."
                    />
                    <button
                      type="button"
                      className="sage-button shrink-0"
                      onClick={() => { if (!adminPassword) { shakePasswordBar("Untuk menyimpan, masukkan password admin terlebih dahulu"); return; } saveLiteLLMConfig(); }}
                      disabled={liteLLMSaving || (!liteLLMNewKey && !liteLLMBaseURL)}
                    >
                      {liteLLMSaving ? "..." : "Simpan"}
                    </button>
                  </div>
                  {liteLLMError && <p className="text-sm text-rose-600 dark:text-rose-400">{liteLLMError}</p>}
                  {liteLLMMessage && !liteLLMError && <p className="text-sm text-emerald-600 dark:text-emerald-400">{liteLLMMessage}</p>}
                </div>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200 pt-3 dark:border-slate-700/60">
                  LiteLLM key muncul jika provider diubah ke LiteLLM.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
