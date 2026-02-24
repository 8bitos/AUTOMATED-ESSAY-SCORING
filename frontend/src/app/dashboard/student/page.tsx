"use client";

import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FiBook, FiClipboard, FiAward, FiUser, FiInfo, FiAlertTriangle, FiAlertCircle, FiBell } from 'react-icons/fi';

interface AnnouncementItem {
  id: string;
  type: "banner" | "running_text";
  icon?: "info" | "warning" | "danger" | "bell";
  title: string;
  content: string;
}

const announcementIcon = (icon?: string) => {
  if (icon === "warning") return <FiAlertTriangle size={14} />;
  if (icon === "danger") return <FiAlertCircle size={14} />;
  if (icon === "bell") return <FiBell size={14} />;
  return <FiInfo size={14} />;
};

export default function StudentDashboardOverviewPage() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);

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

  useEffect(() => {
    const loadAnnouncements = async () => {
      try {
        const res = await fetch("/api/announcements/active", { credentials: "include" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) return;
        setAnnouncements(Array.isArray(body?.items) ? body.items : []);
      } catch {
        setAnnouncements([]);
      }
    };
    loadAnnouncements();
  }, []);

  const runningTexts = announcements.filter((item) => item.type === "running_text");
  const banners = announcements.filter((item) => item.type === "banner");

  return (
    <div className="space-y-8">
      <header className="sage-panel p-6">
        <p className="sage-pill">Dashboard Siswa</p>
        <h1 className="mt-3 text-3xl text-[color:var(--ink-900)]">Selamat datang, {user?.nama_lengkap}</h1>
        <p className="mt-2 text-[color:var(--ink-500)]">
          Pantau kelas, tugas, dan hasil penilaian Anda secara terstruktur.
        </p>
      </header>

      {runningTexts.length > 0 && (
        <div className="sage-panel p-3 overflow-hidden">
          <div className="announcement-marquee-track">
            <div className="announcement-marquee-content announcement-marquee-content-right">
              {runningTexts.map((item) => (
                <span key={item.id} className="announcement-chip">{announcementIcon(item.icon)} {item.content}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {banners.length > 0 && (
        <div className="space-y-3">
          {banners.map((item) => (
            <div key={item.id} className="announcement-banner rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
              <p className="text-sm font-semibold text-sky-900 inline-flex items-center gap-2">{announcementIcon(item.icon)} {item.title || "Pengumuman"}</p>
              <p className="text-sm text-sky-800 mt-0.5">{item.content}</p>
            </div>
          ))}
        </div>
      )}

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
