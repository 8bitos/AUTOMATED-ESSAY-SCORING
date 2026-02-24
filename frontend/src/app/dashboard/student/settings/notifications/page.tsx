"use client";

import { useEffect, useState } from "react";
import { FiBell } from "react-icons/fi";
import { STUDENT_NOTIFICATION_PREFS_KEY, StudentNotificationPrefs } from "@/lib/studentNotifications";
import ToggleSwitch from "@/components/ToggleSwitch";

export default function StudentNotificationSettingsPage() {
  const [prefs, setPrefs] = useState<StudentNotificationPrefs>({
    profileApprovals: true,
    classApproved: true,
    classInvited: true,
    newMaterials: true,
    reviewedScores: true,
    newQuestions: true,
  });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(STUDENT_NOTIFICATION_PREFS_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<StudentNotificationPrefs>;
      setPrefs((prev) => ({
        profileApprovals: parsed.profileApprovals ?? prev.profileApprovals,
        classApproved: parsed.classApproved ?? prev.classApproved,
        classInvited: parsed.classInvited ?? prev.classInvited,
        newMaterials: parsed.newMaterials ?? prev.newMaterials,
        reviewedScores: parsed.reviewedScores ?? prev.reviewedScores,
        newQuestions: parsed.newQuestions ?? prev.newQuestions,
      }));
    } catch {
      window.localStorage.removeItem(STUDENT_NOTIFICATION_PREFS_KEY);
    }
  }, []);

  const updatePref = (key: keyof StudentNotificationPrefs, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setMessage(null);
  };

  const savePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    window.localStorage.setItem(STUDENT_NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
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
            <p className="text-sm font-medium text-slate-900">Nilai direview guru</p>
            <p className="text-xs text-slate-500">Notifikasi saat jawaban sudah direview dan diberi umpan balik guru.</p>
          </div>
          <ToggleSwitch
            label="Toggle notifikasi nilai direview guru"
            checked={prefs.reviewedScores}
            onChange={(value) => updatePref("reviewedScores", value)}
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
