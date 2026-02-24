"use client";

import Link from "next/link";
import { FiBell, FiLock, FiUser } from "react-icons/fi";

export default function StudentSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Setting</h1>
        <p className="text-sm text-slate-500">Pusat pengaturan akun siswa: Profil, Keamanan, dan Preferensi Notifikasi.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/dashboard/student/settings/profile" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
          <p className="text-sm font-semibold text-slate-900 inline-flex items-center gap-2">
            <FiUser />
            Profil
          </p>
          <p className="mt-2 text-sm text-slate-600">Ubah data profil pribadi dan identitas akademik.</p>
        </Link>

        <Link href="/dashboard/student/settings/security" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
          <p className="text-sm font-semibold text-slate-900 inline-flex items-center gap-2">
            <FiLock />
            Keamanan
          </p>
          <p className="mt-2 text-sm text-slate-600">Ganti password akun untuk menjaga keamanan akses.</p>
        </Link>

        <Link href="/dashboard/student/settings/notifications" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
          <p className="text-sm font-semibold text-slate-900 inline-flex items-center gap-2">
            <FiBell />
            Preferensi Notifikasi
          </p>
          <p className="mt-2 text-sm text-slate-600">Pilih jenis notifikasi penting yang ingin ditampilkan.</p>
        </Link>
      </div>
    </div>
  );
}
