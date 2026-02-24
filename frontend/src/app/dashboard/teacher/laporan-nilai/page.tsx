"use client";

import Link from "next/link";
import { FiBarChart2, FiCheckCircle, FiClock } from "react-icons/fi";

export default function TeacherLaporanNilaiPage() {
  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Laporan Nilai</h1>
        <p className="text-sm text-slate-500">Ringkasan progres penilaian siswa dan akses cepat ke proses review.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Status Review" desc="Pantau submission pending vs reviewed." icon={<FiClock />} />
        <Card title="Distribusi Nilai" desc="Analisis nilai AI dan revisi guru per kelas." icon={<FiBarChart2 />} />
        <Card title="Aksi Lanjutan" desc="Lanjutkan review dari antrian penilaian." icon={<FiCheckCircle />} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-600">Untuk saat ini, laporan operasional tersedia lewat halaman Penilaian.</p>
        <Link href="/dashboard/teacher/penilaian" className="mt-3 inline-flex text-sm text-[color:var(--sage-700)] hover:underline">
          Buka Penilaian
        </Link>
      </div>
    </div>
  );
}

function Card({ title, desc, icon }: { title: string; desc: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-900 inline-flex items-center gap-2">{icon} {title}</p>
      <p className="mt-2 text-sm text-slate-600">{desc}</p>
    </div>
  );
}

