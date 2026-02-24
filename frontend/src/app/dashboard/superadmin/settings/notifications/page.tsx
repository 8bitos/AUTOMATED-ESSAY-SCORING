"use client";

import { useEffect, useState } from "react";
import { FiBell } from "react-icons/fi";
import ToggleSwitch from "@/components/ToggleSwitch";

type SuperadminNotificationPrefs = {
  approvalRequests: boolean;
};

const STORAGE_KEY = "superadmin_notification_preferences";

export default function SuperadminNotificationSettingsPage() {
  const [prefs, setPrefs] = useState<SuperadminNotificationPrefs>({
    approvalRequests: true,
  });
  const [pollIntervalSeconds, setPollIntervalSeconds] = useState("30");
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<SuperadminNotificationPrefs>;
      setPrefs((prev) => ({ ...prev, ...parsed }));
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const loadConfig = async () => {
      setLoadingConfig(true);
      try {
        const res = await fetch("/api/admin/settings", { credentials: "include" });
        if (!res.ok) return;
        const payload = await res.json().catch(() => ({}));
        const list = Array.isArray(payload?.items) ? payload.items : [];
        const item = list.find((x: any) => x?.key === "notification_poll_interval_seconds");
        if (active && item?.value) setPollIntervalSeconds(String(item.value));
      } finally {
        if (active) setLoadingConfig(false);
      }
    };
    loadConfig();
    return () => {
      active = false;
    };
  }, []);

  const savePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    setMessage("Preferensi notifikasi berhasil disimpan.");
  };

  const saveRealtimeConfig = async () => {
    setSavingConfig(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/settings/notification_poll_interval_seconds", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ value: pollIntervalSeconds }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Gagal menyimpan interval realtime");
      setPollIntervalSeconds(String(body?.value || pollIntervalSeconds));
      setMessage("Interval realtime notifikasi berhasil disimpan.");
    } catch (err: any) {
      setMessage(err?.message || "Gagal menyimpan interval realtime");
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Preferensi Notifikasi</h1>
        <p className="text-sm text-slate-500">Atur notifikasi untuk kebutuhan approval superadmin.</p>
      </div>

      <form onSubmit={savePreferences} className="sage-panel p-6 space-y-5">
        <h2 className="text-lg font-semibold text-slate-900 inline-flex items-center gap-2">
          <FiBell />
          Notifikasi Superadmin
        </h2>

        <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
          <div>
            <p className="text-sm font-medium text-slate-900">Request Approval</p>
            <p className="text-xs text-slate-500">Notifikasi saat ada request approval baru (profile change / verifikasi guru).</p>
          </div>
          <ToggleSwitch
            label="Toggle notifikasi request approval superadmin"
            checked={prefs.approvalRequests}
            onChange={(value) => {
              setPrefs((prev) => ({ ...prev, approvalRequests: value }));
              setMessage(null);
            }}
          />
        </label>

        <div className="rounded-lg border border-slate-200 p-4 space-y-2">
          <p className="text-sm font-medium text-slate-900">Interval Realtime Notifikasi</p>
          <p className="text-xs text-slate-500">Dipakai oleh lonceng notifikasi dan halaman notifikasi semua role. Rentang 5-300 detik.</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={5}
              max={300}
              className="sage-input w-36"
              value={pollIntervalSeconds}
              disabled={loadingConfig || savingConfig}
              onChange={(e) => {
                setPollIntervalSeconds(e.target.value);
                setMessage(null);
              }}
            />
            <span className="text-sm text-slate-600">detik</span>
            <button
              type="button"
              className="sage-button-outline"
              onClick={saveRealtimeConfig}
              disabled={loadingConfig || savingConfig}
            >
              {savingConfig ? "Menyimpan..." : "Simpan Interval"}
            </button>
          </div>
        </div>

        {message && <p className="text-sm text-emerald-700">{message}</p>}

        <div className="flex justify-end">
          <button type="submit" className="sage-button">
            Simpan Preferensi
          </button>
        </div>
      </form>
    </div>
  );
}
