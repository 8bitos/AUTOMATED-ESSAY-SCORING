"use client";

import Link from "next/link";
import { FiBell, FiCheckCircle, FiUsers } from "react-icons/fi";

export default function TeacherNotifikasiPage() {
  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Notifikasi</h1>
        <p className="text-sm text-slate-500">Pusat notifikasi aktivitas kelas, submission, dan approval join siswa.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900 inline-flex items-center gap-2"><FiUsers /> Join Request</p>
          <p className="mt-2 text-sm text-slate-600">Lihat dan proses request join siswa dari halaman detail kelas.</p>
          <Link href="/dashboard/teacher/classes" className="mt-3 inline-flex text-sm text-[color:var(--sage-700)] hover:underline">
            Buka Manajemen Kelas
          </Link>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900 inline-flex items-center gap-2"><FiBell /> Submission Baru</p>
          <p className="mt-2 text-sm text-slate-600">Pantau submission terbaru siswa agar review tidak tertunda.</p>
          <Link href="/dashboard/teacher/penilaian" className="mt-3 inline-flex text-sm text-[color:var(--sage-700)] hover:underline">
            Buka Penilaian
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 inline-flex items-center gap-2">
        <FiCheckCircle /> Notifikasi real-time bisa ditambahkan berikutnya (badge + in-app feed).
      </div>
    </div>
  );
}

