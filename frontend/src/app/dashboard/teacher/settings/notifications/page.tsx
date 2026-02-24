"use client";

import { useEffect, useState } from "react";
import { FiBell } from "react-icons/fi";
import ToggleSwitch from "@/components/ToggleSwitch";

type NotificationPrefs = {
  classRequests: boolean;
  assessmentUpdates: boolean;
  systemAnnouncements: boolean;
};

const STORAGE_KEY = "teacher_notification_preferences";

export default function TeacherNotificationSettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    classRequests: true,
    assessmentUpdates: true,
    systemAnnouncements: true,
  });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
      setPrefs((prev) => ({
        ...prev,
        ...parsed,
      }));
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const updatePref = (key: keyof NotificationPrefs, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setMessage(null);
  };

  const savePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    setMessage("Preferensi notifikasi berhasil disimpan.");
  };

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Preferensi Notifikasi</h1>
        <p className="text-sm text-slate-500">Pilih notifikasi yang ingin kamu tampilkan di akun.</p>
      </div>

      <form onSubmit={savePreferences} className="sage-panel p-6 space-y-5">
        <h2 className="text-lg font-semibold text-slate-900 inline-flex items-center gap-2">
          <FiBell />
          Pengaturan Notifikasi
        </h2>

        <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
          <div>
            <p className="text-sm font-medium text-slate-900">Permintaan gabung kelas</p>
            <p className="text-xs text-slate-500">Notifikasi saat ada siswa meminta bergabung ke kelasmu.</p>
          </div>
          <ToggleSwitch
            label="Toggle notifikasi permintaan gabung kelas"
            checked={prefs.classRequests}
            onChange={(value) => updatePref("classRequests", value)}
          />
        </label>

        <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
          <div>
            <p className="text-sm font-medium text-slate-900">Update penilaian</p>
            <p className="text-xs text-slate-500">Notifikasi saat ada jawaban baru yang perlu direview.</p>
          </div>
          <ToggleSwitch
            label="Toggle notifikasi update penilaian"
            checked={prefs.assessmentUpdates}
            onChange={(value) => updatePref("assessmentUpdates", value)}
          />
        </label>

        <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
          <div>
            <p className="text-sm font-medium text-slate-900">Pengumuman sistem</p>
            <p className="text-xs text-slate-500">Notifikasi terkait update fitur dan informasi penting dari sistem.</p>
          </div>
          <ToggleSwitch
            label="Toggle notifikasi pengumuman sistem"
            checked={prefs.systemAnnouncements}
            onChange={(value) => updatePref("systemAnnouncements", value)}
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
