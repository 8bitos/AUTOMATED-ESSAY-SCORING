"use client";

import { useEffect, useState } from "react";
import { FiBell } from "react-icons/fi";
import ToggleSwitch from "@/components/ToggleSwitch";
import {
  hydrateTeacherNotificationPrefs,
  saveTeacherNotificationPrefs,
  TeacherNotificationPrefs,
} from "@/lib/teacherNotifications";

export default function TeacherNotificationSettingsPage() {
  const [prefs, setPrefs] = useState<TeacherNotificationPrefs>({
    classRequests: true,
    assessmentUpdates: true,
    appealRequests: true,
    profileApprovals: true,
    systemAnnouncements: true,
    classAnnouncements: true,
    sidebarIndicators: true,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const next = await hydrateTeacherNotificationPrefs();
      if (active) setPrefs(next);
    })();
    return () => {
      active = false;
    };
  }, []);

  const updatePref = (key: keyof TeacherNotificationPrefs, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setMessage(null);
  };

  const savePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const saved = await saveTeacherNotificationPrefs(prefs);
    setPrefs(saved);
    setSaving(false);
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
            <p className="text-sm font-medium text-slate-900">Approval profil guru</p>
            <p className="text-xs text-slate-500">Notifikasi saat permintaan verifikasi atau perubahan profilmu diproses admin.</p>
          </div>
          <ToggleSwitch
            label="Toggle notifikasi approval profil guru"
            checked={prefs.profileApprovals}
            onChange={(value) => updatePref("profileApprovals", value)}
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

        <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
          <div>
            <p className="text-sm font-medium text-slate-900">Banding nilai siswa</p>
            <p className="text-xs text-slate-500">Notifikasi saat ada siswa mengajukan banding nilai yang harus direview.</p>
          </div>
          <ToggleSwitch
            label="Toggle notifikasi banding nilai guru"
            checked={prefs.appealRequests}
            onChange={(value) => updatePref("appealRequests", value)}
          />
        </label>

        <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
          <div>
            <p className="text-sm font-medium text-slate-900">Pengumuman kelas aktif</p>
            <p className="text-xs text-slate-500">Tampilkan pengumuman aktif dari kelas yang kamu ampu di feed notifikasi.</p>
          </div>
          <ToggleSwitch
            label="Toggle notifikasi pengumuman kelas guru"
            checked={prefs.classAnnouncements}
            onChange={(value) => updatePref("classAnnouncements", value)}
          />
        </label>

        <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
          <div>
            <p className="text-sm font-medium text-slate-900">Indikator update di sidebar</p>
            <p className="text-xs text-slate-500">Tampilkan dot merah pada menu sidebar yang punya update penting.</p>
          </div>
          <ToggleSwitch
            label="Toggle indikator update sidebar guru"
            checked={prefs.sidebarIndicators}
            onChange={(value) => updatePref("sidebarIndicators", value)}
          />
        </label>

        {message && <p className="text-sm text-emerald-700">{message}</p>}

        <div className="flex justify-end">
          <button type="submit" className="sage-button" disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan Preferensi"}
          </button>
        </div>
      </form>
    </div>
  );
}
