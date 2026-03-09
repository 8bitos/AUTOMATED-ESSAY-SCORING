"use client";

import { useEffect, useState } from "react";
import { FiBell } from "react-icons/fi";
import {
  hydrateStudentNotificationPrefs,
  saveStudentNotificationPrefs,
  StudentNotificationPrefs,
} from "@/lib/studentNotifications";
import ToggleSwitch from "@/components/ToggleSwitch";

export default function StudentNotificationSettingsPage() {
  const [prefs, setPrefs] = useState<StudentNotificationPrefs>({
    profileApprovals: true,
    classApproved: true,
    classInvited: true,
    classAnnouncements: true,
    systemAnnouncements: true,
    newMaterials: true,
    deadlineReminders: true,
    aiGradingComplete: true,
    reviewedScores: true,
    newQuestions: true,
    appealUpdates: true,
    sidebarIndicators: true,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const next = await hydrateStudentNotificationPrefs();
      if (active) setPrefs(next);
    })();
    return () => {
      active = false;
    };
  }, []);

  const updatePref = (key: keyof StudentNotificationPrefs, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setMessage(null);
  };

  const savePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const saved = await saveStudentNotificationPrefs(prefs);
    setPrefs(saved);
    setSaving(false);
    setMessage("Preferensi notifikasi berhasil disimpan.");
  };

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Preferensi Notifikasi</h1>
        <p className="text-sm text-slate-500">Pilih notifikasi penting yang ingin ditampilkan untuk akun siswa.</p>
      </div>

      <form onSubmit={savePreferences} className="sage-panel p-6 space-y-5">
        <h2 className="text-lg font-semibold text-slate-900 inline-flex items-center gap-2">
          <FiBell />
          Pengaturan Notifikasi
        </h2>

        <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
          <div>
            <p className="text-sm font-medium text-slate-900">Status approval profil</p>
            <p className="text-xs text-slate-500">Notifikasi saat permintaan approval disetujui, ditolak, atau masih diproses.</p>
          </div>
          <ToggleSwitch
            label="Toggle notifikasi status approval profil"
            checked={prefs.profileApprovals}
            onChange={(value) => updatePref("profileApprovals", value)}
          />
        </label>

        <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
          <div>
            <p className="text-sm font-medium text-slate-900">ACC masuk kelas</p>
            <p className="text-xs text-slate-500">Notifikasi saat permintaan join kelas kamu disetujui guru.</p>
          </div>
          <ToggleSwitch
            label="Toggle notifikasi ACC masuk kelas"
            checked={prefs.classApproved}
            onChange={(value) => updatePref("classApproved", value)}
          />
        </label>

        <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
          <div>
            <p className="text-sm font-medium text-slate-900">Diinvite ke kelas</p>
            <p className="text-xs text-slate-500">Notifikasi saat guru langsung mengundang kamu ke kelas.</p>
          </div>
          <ToggleSwitch
            label="Toggle notifikasi diinvite ke kelas"
            checked={prefs.classInvited}
            onChange={(value) => updatePref("classInvited", value)}
          />
        </label>

        <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
          <div>
            <p className="text-sm font-medium text-slate-900">Materi baru/diperbarui</p>
            <p className="text-xs text-slate-500">Notifikasi jika ada materi baru atau update materi di kelas.</p>
          </div>
          <ToggleSwitch
            label="Toggle notifikasi materi baru atau diperbarui"
            checked={prefs.newMaterials}
            onChange={(value) => updatePref("newMaterials", value)}
          />
        </label>

        <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
          <div>
            <p className="text-sm font-medium text-slate-900">Pengumuman kelas</p>
            <p className="text-xs text-slate-500">Notifikasi saat guru menampilkan pengumuman aktif di kelas.</p>
          </div>
          <ToggleSwitch
            label="Toggle notifikasi pengumuman kelas"
            checked={prefs.classAnnouncements}
            onChange={(value) => updatePref("classAnnouncements", value)}
          />
        </label>

        <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
          <div>
            <p className="text-sm font-medium text-slate-900">Pengumuman sistem</p>
            <p className="text-xs text-slate-500">Notifikasi untuk update sistem atau info umum dari admin.</p>
          </div>
          <ToggleSwitch
            label="Toggle notifikasi pengumuman sistem siswa"
            checked={prefs.systemAnnouncements}
            onChange={(value) => updatePref("systemAnnouncements", value)}
          />
        </label>

        <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
          <div>
            <p className="text-sm font-medium text-slate-900">Soal baru</p>
            <p className="text-xs text-slate-500">Notifikasi saat guru menambahkan soal baru dalam materi.</p>
          </div>
          <ToggleSwitch
            label="Toggle notifikasi soal baru"
            checked={prefs.newQuestions}
            onChange={(value) => updatePref("newQuestions", value)}
          />
        </label>

        <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
          <div>
            <p className="text-sm font-medium text-slate-900">Pengingat deadline tugas</p>
            <p className="text-xs text-slate-500">Notifikasi saat deadline tugas mendekat atau sudah terlewat.</p>
          </div>
          <ToggleSwitch
            label="Toggle pengingat deadline tugas"
            checked={prefs.deadlineReminders}
            onChange={(value) => updatePref("deadlineReminders", value)}
          />
        </label>

        <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
          <div>
            <p className="text-sm font-medium text-slate-900">Penilaian AI selesai</p>
            <p className="text-xs text-slate-500">Notifikasi saat AI selesai memeriksa jawabanmu.</p>
          </div>
          <ToggleSwitch
            label="Toggle notifikasi penilaian AI selesai"
            checked={prefs.aiGradingComplete}
            onChange={(value) => updatePref("aiGradingComplete", value)}
          />
        </label>

        <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
          <div>
            <p className="text-sm font-medium text-slate-900">Nilai direview guru</p>
            <p className="text-xs text-slate-500">Notifikasi saat jawaban sudah direview dan diberi umpan balik guru.</p>
          </div>
          <ToggleSwitch
            label="Toggle notifikasi nilai direview guru"
            checked={prefs.reviewedScores}
            onChange={(value) => updatePref("reviewedScores", value)}
          />
        </label>

        <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
          <div>
            <p className="text-sm font-medium text-slate-900">Update banding nilai</p>
            <p className="text-xs text-slate-500">Notifikasi saat banding nilai masuk review, diterima, atau ditolak.</p>
          </div>
          <ToggleSwitch
            label="Toggle notifikasi update banding nilai"
            checked={prefs.appealUpdates}
            onChange={(value) => updatePref("appealUpdates", value)}
          />
        </label>

        <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
          <div>
            <p className="text-sm font-medium text-slate-900">Indikator update di sidebar</p>
            <p className="text-xs text-slate-500">Tampilkan dot merah pada menu sidebar yang punya update penting.</p>
          </div>
          <ToggleSwitch
            label="Toggle indikator update sidebar siswa"
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
