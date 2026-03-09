"use client";

import { useEffect, useState } from "react";
import { FiBell } from "react-icons/fi";
import ToggleSwitch from "@/components/ToggleSwitch";
import {
  hydrateSuperadminNotificationPrefs,
  saveSuperadminNotificationPrefs,
  SuperadminNotificationPrefs,
} from "@/lib/superadminNotifications";

type AdminSettingItem = {
  key?: string;
  value?: string | number | boolean | null;
};

export default function SuperadminNotificationSettingsPage() {
  const [prefs, setPrefs] = useState<SuperadminNotificationPrefs>({
    approvalRequests: true,
    anomalyAlerts: true,
    sidebarIndicators: true,
  });
  const [pollIntervalSeconds, setPollIntervalSeconds] = useState("30");
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const next = await hydrateSuperadminNotificationPrefs();
      if (active) setPrefs(next);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadConfig = async () => {
      setLoadingConfig(true);
      try {
        const res = await fetch("/api/admin/settings", { credentials: "include" });
        if (!res.ok) return;
        const payload = await res.json().catch(() => ({}));
        const list = Array.isArray(payload?.items) ? (payload.items as AdminSettingItem[]) : [];
        const item = list.find((x) => x?.key === "notification_poll_interval_seconds");
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

  const savePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPrefs(true);
    setMessage(null);
    const saved = await saveSuperadminNotificationPrefs(prefs);
    setPrefs(saved);
    setSavingPrefs(false);
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
    } catch (err: unknown) {
      setMessage(err instanceof Error && err.message ? err.message : "Gagal menyimpan interval realtime");
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

        <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
          <div>
            <p className="text-sm font-medium text-slate-900">Indikator update di sidebar</p>
            <p className="text-xs text-slate-500">Tampilkan dot merah pada menu sidebar yang punya update penting.</p>
          </div>
          <ToggleSwitch
            label="Toggle indikator update sidebar superadmin"
            checked={prefs.sidebarIndicators}
            onChange={(value) => {
              setPrefs((prev) => ({ ...prev, sidebarIndicators: value }));
              setMessage(null);
            }}
          />
        </label>

        <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
          <div>
            <p className="text-sm font-medium text-slate-900">Alert anomali</p>
            <p className="text-xs text-slate-500">Notifikasi saat sistem mendeteksi anomali seperti fail rate AI atau queue bermasalah.</p>
          </div>
          <ToggleSwitch
            label="Toggle notifikasi alert anomali superadmin"
            checked={prefs.anomalyAlerts}
            onChange={(value) => {
              setPrefs((prev) => ({ ...prev, anomalyAlerts: value }));
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
          <button type="submit" className="sage-button" disabled={savingPrefs}>
            {savingPrefs ? "Menyimpan..." : "Simpan Preferensi"}
          </button>
        </div>
      </form>
    </div>
  );
}
