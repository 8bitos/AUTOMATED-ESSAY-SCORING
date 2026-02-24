"use client";

import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { FiBook, FiClipboard, FiAward, FiUser } from 'react-icons/fi';

export default function StudentDashboardOverviewPage() {
  const { user } = useAuth();

  const menuItems = [
    {
      title: "My Classes",
      description: "Lihat kelas yang sedang kamu ikuti",
      icon: <FiBook size={24} />,
      href: "/dashboard/student/my-classes",
    },
    {
      title: "Assignments",
      description: "Cek dan kerjakan tugas yang tersedia",
      icon: <FiClipboard size={24} />,
      href: "/dashboard/student/assignments",
    },
    {
      title: "Grades",
      description: "Lihat nilai dan hasil review tugasmu",
      icon: <FiAward size={24} />,
      href: "/dashboard/student/grades",
    },
    {
      title: "Profile",
      description: "Update profil dan informasi pribadimu",
      icon: <FiUser size={24} />,
      href: "/dashboard/student/settings/profile",
    },
  ];

  return (
    <div className="space-y-8">
      <header className="sage-panel p-6">
        <p className="sage-pill">Dashboard Siswa</p>
        <h1 className="mt-3 text-3xl text-[color:var(--ink-900)]">Selamat datang, {user?.nama_lengkap}</h1>
        <p className="mt-2 text-[color:var(--ink-500)]">
          Pantau kelas, tugas, dan hasil penilaian Anda secara terstruktur.
        </p>
      </header>

      <main className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {menuItems.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="sage-card flex flex-col items-start p-6 transition hover:-translate-y-1"
          >
            <div className="mb-4 text-[color:var(--sage-700)]">{item.icon}</div>
            <h2 className="text-lg font-semibold text-[color:var(--ink-900)] mb-1">{item.title}</h2>
            <p className="text-sm text-[color:var(--ink-500)]">{item.description}</p>
          </Link>
        ))}
      </main>
    </div>
  );
}
