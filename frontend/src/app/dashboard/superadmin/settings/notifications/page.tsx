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

  const savePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    setMessage("Preferensi notifikasi berhasil disimpan.");
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
