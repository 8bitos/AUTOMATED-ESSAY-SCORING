"use client";

import Link from "next/link";
import { FiBell, FiLock, FiUser } from "react-icons/fi";

export default function TeacherSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Setting</h1>
        <p className="text-sm text-slate-500">Pusat pengaturan akun: Profil, Keamanan, dan Preferensi Notifikasi.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/dashboard/teacher/settings/profile" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
          <p className="text-sm font-semibold text-slate-900 inline-flex items-center gap-2">
            <FiUser />
            Profil
          </p>
          <p className="mt-2 text-sm text-slate-600">Ubah data akun, foto profil, dan informasi profesional.</p>
        </Link>

        <Link href="/dashboard/teacher/settings/security" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
          <p className="text-sm font-semibold text-slate-900 inline-flex items-center gap-2">
            <FiLock />
            Keamanan
          </p>
          <p className="mt-2 text-sm text-slate-600">Ganti password akun dan kelola keamanan akses.</p>
        </Link>

        <Link href="/dashboard/teacher/settings/notifications" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
          <p className="text-sm font-semibold text-slate-900 inline-flex items-center gap-2">
            <FiBell />
            Preferensi Notifikasi
          </p>
          <p className="mt-2 text-sm text-slate-600">Atur notifikasi penting yang ingin ditampilkan di akunmu.</p>
        </Link>
      </div>
    </div>
  );
}
