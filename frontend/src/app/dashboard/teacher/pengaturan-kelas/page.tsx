"use client";

import Link from "next/link";
import { FiSettings, FiShield, FiUsers } from "react-icons/fi";

export default function TeacherPengaturanKelasPage() {
  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Pengaturan Kelas</h1>
        <p className="text-sm text-slate-500">Atur kebijakan kelas, alur join siswa, dan preferensi pengelolaan kelas.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SettingCard title="Akses Kelas" desc="Kontrol mekanisme join lewat kode kelas." icon={<FiShield />} />
        <SettingCard title="Keanggotaan" desc="Kelola siswa aktif dan penanganan request." icon={<FiUsers />} />
        <SettingCard title="Preferensi" desc="Atur alur kerja standar pengelolaan kelas." icon={<FiSettings />} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-600">Pengaturan kelas operasional saat ini ada di halaman Manajemen Kelas dan detail tiap kelas.</p>
        <Link href="/dashboard/teacher/classes" className="mt-3 inline-flex text-sm text-[color:var(--sage-700)] hover:underline">
          Buka Manajemen Kelas
        </Link>
      </div>
    </div>
  );
}

function SettingCard({ title, desc, icon }: { title: string; desc: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-900 inline-flex items-center gap-2">{icon} {title}</p>
      <p className="mt-2 text-sm text-slate-600">{desc}</p>
    </div>
  );
}

