"use client";

import Link from "next/link";
import { FiBell, FiZap } from "react-icons/fi";

export default function SuperadminSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Setting</h1>
        <p className="text-sm text-slate-500">Pengaturan superadmin.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/dashboard/superadmin/settings/notifications"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition"
        >
          <p className="text-sm font-semibold text-slate-900 inline-flex items-center gap-2">
            <FiBell />
            Preferensi Notifikasi
          </p>
          <p className="mt-2 text-sm text-slate-600">Atur notifikasi approval yang muncul di ikon lonceng.</p>
        </Link>
        <Link
          href="/dashboard/superadmin/settings/grading-mode"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition"
        >
          <p className="text-sm font-semibold text-slate-900 inline-flex items-center gap-2">
            <FiZap />
            Mode Penilaian AI
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Aktifkan perpindahan antara mode penilaian antrian (queued) dan instan.
          </p>
        </Link>
      </div>
    </div>
  );
}
