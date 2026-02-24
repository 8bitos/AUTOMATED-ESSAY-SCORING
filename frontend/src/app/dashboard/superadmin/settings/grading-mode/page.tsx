"use client";

import { useCallback, useEffect, useState } from "react";
import { FiInfo } from "react-icons/fi";

type GradingMode = "instant" | "queued";

const modeDescriptions: Record<GradingMode, string> = {
  instant:
    "Penilaian AI langsung dijalankan di request siswa sehingga skor tampil segera, tapi operasi akan menunggu panggilan Gemini selesai.",
  queued:
    "Jawaban siswa masuk ke antrian tanpa menunggu API AI, risiko keterlambatan skor tetap ada namun respons lebih ringan.",
};

const modeTooltips: Record<GradingMode, string> = {
  instant:
    "Instant – AI langsung memproses jawaban dan menyimpan hasil sebelum response, cocok saat ingin skor langsung tampil.",
  queued:
    "Queued – Penilaian ditunda ke worker background untuk menghindari blocking di request siswa.",
};

export default function GradingModeSettingsPage() {
  const [mode, setMode] = useState<GradingMode>("queued");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMode = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/grading-mode", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Gagal memuat mode penilaian");
      }
      const data = await res.json();
      const current = data?.mode === "instant" ? "instant" : "queued";
      setMode(current);
    } catch (err: any) {
      setError(err?.message || "Tidak dapat membaca mode penilaian.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMode();
  }, [loadMode]);

  const toggleMode = async () => {
    const nextMode: GradingMode = mode === "instant" ? "queued" : "instant";
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/grading-mode", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mode: nextMode }),
      });
      if (!res.ok) {
        throw new Error("Gagal memperbarui mode");
      }
      const payload = await res.json();
      setMode(payload?.mode === "instant" ? "instant" : "queued");
      setMessage(`Mode penilaian berubah ke ${payload.mode === "instant" ? "Instant" : "Queued"}.`);
    } catch (err: any) {
      setError(err?.message || "Tidak dapat mengubah mode penilaian.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Mode Penilaian AI</h1>
            <p className="text-sm text-slate-500">
              Pilih apakah penilaian AI berjalan instan (langsung) atau tetap masuk antrian.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold uppercase text-slate-500 tracking-wide">
              {mode === "instant" ? "Instant" : "Queued"}
            </span>
            <button
              type="button"
              onClick={toggleMode}
              disabled={loading || saving}
              title={modeTooltips[mode]}
              className="sage-button !px-4 py-2"
            >
              {saving ? "Menyimpan..." : `Switch ke ${mode === "instant" ? "Queued" : "Instant"}`}
            </button>
            <span className="text-slate-400" title={modeTooltips[mode]}>
              <FiInfo />
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">{modeDescriptions[mode]}</p>
          <p className="mt-2 text-xs text-slate-500">{modeTooltips[mode]}</p>
        </div>
        {loading && <p className="text-sm text-slate-500">Memuat status mode...</p>}
        {error && <p className="text-sm text-rose-600">{error}</p>}
        {message && !error && <p className="text-sm text-emerald-600">{message}</p>}
      </div>
    </div>
  );
}
