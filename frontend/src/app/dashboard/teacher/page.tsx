"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { FiUsers, FiBookOpen, FiClipboard, FiTrendingUp, FiChevronRight, FiInfo, FiAlertTriangle, FiAlertCircle, FiBell } from "react-icons/fi";

interface DashboardStats {
  totalClasses: number;
  totalStudents: number;
  totalMaterials: number;
  weeklyMaterialGrowth: string;
}

interface DashboardSummaryResponse {
  total_classes: number;
  total_students: number;
  total_materials: number;
  materials_this_week: number;
  pending_join_count: number;
  latest_class_id?: string;
  latest_class_name?: string;
  latest_class_at?: string;
  latest_material_id?: string;
  latest_material_name?: string;
  latest_material_at?: string;
}

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

const DashboardPage = () => {
  const { isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalClasses: 0,
    totalStudents: 0,
    totalMaterials: 0,
    weeklyMaterialGrowth: "0%",
  });
  const [latestClass, setLatestClass] = useState<{ id: string; name: string; at?: string } | null>(null);
  const [latestMaterial, setLatestMaterial] = useState<{ id: string; name: string; at?: string } | null>(null);
  const [pendingJoinCount, setPendingJoinCount] = useState(0);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);

  const fetchDashboardData = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setError(null);

    try {
      const summaryRes = await fetch("/api/dashboard-summary", { credentials: "include" });
      if (!summaryRes.ok) throw new Error("Gagal memuat ringkasan dashboard");
      const summary: DashboardSummaryResponse = await summaryRes.json();

      const growth =
        summary.total_materials > 0
          ? Math.round((summary.materials_this_week / summary.total_materials) * 100)
          : 0;

      setStats({
        totalClasses: summary.total_classes || 0,
        totalStudents: summary.total_students || 0,
        totalMaterials: summary.total_materials || 0,
        weeklyMaterialGrowth: `+${growth}%`,
      });
      setPendingJoinCount(summary.pending_join_count || 0);
      setLatestClass(
        summary.latest_class_id && summary.latest_class_name
          ? { id: summary.latest_class_id, name: summary.latest_class_name, at: summary.latest_class_at }
          : null
      );
      setLatestMaterial(
        summary.latest_material_id && summary.latest_material_name
          ? { id: summary.latest_material_id, name: summary.latest_material_name, at: summary.latest_material_at }
          : null
      );

      try {
        const annRes = await fetch("/api/announcements/active", { credentials: "include" });
        const annBody = await annRes.json().catch(() => ({}));
        if (annRes.ok) {
          setAnnouncements(Array.isArray(annBody?.items) ? annBody.items : []);
        } else {
          setAnnouncements([]);
        }
      } catch {
        setAnnouncements([]);
      }
    } catch (err: any) {
      setError(err.message || "Gagal memuat dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const updateLabel = useMemo(() => {
    const now = new Date();
    return now.toLocaleString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const runningTexts = announcements.filter((item) => item.type === "running_text");
  const banners = announcements.filter((item) => item.type === "banner");

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="sage-pill">Dashboard Guru</p>
          <h1 className="mt-3 text-3xl text-[color:var(--ink-900)] md:text-4xl">Ringkasan akademik hari ini</h1>
          <p className="mt-2 text-[color:var(--ink-500)]">Pantau aktivitas kelas, materi, dan penilaian secara ringkas.</p>
        </div>
        <div className="sage-card px-5 py-3 text-sm text-[color:var(--ink-500)]">Update terakhir: {updateLabel}</div>
      </div>

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

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Kelas" value={isLoading ? "..." : String(stats.totalClasses)} icon={<FiBookOpen />} href="/dashboard/teacher/classes" />
        <StatCard title="Total Siswa" value={isLoading ? "..." : String(stats.totalStudents)} icon={<FiUsers />} href="/dashboard/teacher/classes" />
        <StatCard title="Materi Aktif" value={isLoading ? "..." : String(stats.totalMaterials)} icon={<FiClipboard />} href="/dashboard/teacher/classes" />
        <StatCard title="Aktivitas Mingguan" value={isLoading ? "..." : stats.weeklyMaterialGrowth} icon={<FiTrendingUp />} href="/dashboard/teacher/classes" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 sage-panel p-6">
          <h2 className="text-lg font-semibold text-[color:var(--ink-900)] mb-4">Aktivitas Terbaru</h2>
          <ul className="space-y-4">
            <ActivityItem
              title="Materi terbaru"
              desc={latestMaterial ? latestMaterial.name : "Belum ada materi"}
              time={latestMaterial?.at ? formatDate(latestMaterial.at) : "-"}
              href={latestMaterial ? `/dashboard/teacher/material/${latestMaterial.id}` : "/dashboard/teacher/classes"}
            />
            <ActivityItem
              title="Kelas terbaru"
              desc={latestClass ? latestClass.name : "Belum ada kelas"}
              time={latestClass?.at ? formatDate(latestClass.at) : "-"}
              href={latestClass ? `/dashboard/teacher/class/${latestClass.id}` : "/dashboard/teacher/classes"}
            />
            <ActivityItem
              title="Permintaan join pending"
              desc={`${pendingJoinCount} siswa menunggu ACC`}
              time="Saat ini"
              href="/dashboard/teacher/classes"
            />
          </ul>
        </div>

        <Link href="/dashboard/teacher/classes" className="sage-panel p-6 block hover:shadow-md transition">
          <h2 className="text-lg font-semibold text-[color:var(--ink-900)]">Pusat Kendali Kelas</h2>
          <p className="mt-3 text-sm text-[color:var(--ink-500)]">
            Kelola struktur kelas 10-12, rombel, materi, invite siswa, dan approval join dalam satu tempat.
          </p>
          <div className="mt-6 rounded-lg bg-[color:var(--sand-50)] p-4 text-sm text-[color:var(--ink-500)] inline-flex items-center gap-2">
            Buka manajemen kelas <FiChevronRight />
          </div>
        </Link>
      </div>
    </div>
  );
};

const StatCard = ({
  title,
  value,
  icon,
  href,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  href: string;
}) => (
  <Link href={href} className="sage-card p-5 flex items-center gap-4 hover:shadow-md transition">
    <div className="stat-icon p-3 rounded-2xl bg-[color:var(--sand-100)] text-[color:var(--sage-700)] text-xl">{icon}</div>
    <div>
      <p className="text-sm text-[color:var(--ink-500)]">{title}</p>
      <p className="text-2xl font-semibold text-[color:var(--ink-900)]">{value}</p>
    </div>
  </Link>
);

const ActivityItem = ({
  title,
  desc,
  time,
  href,
}: {
  title: string;
  desc: string;
  time: string;
  href: string;
}) => (
  <li>
    <Link href={href} className="activity-link flex justify-between items-start rounded-lg px-2 py-2 hover:bg-slate-50 transition">
      <div>
        <p className="activity-title font-medium text-[color:var(--ink-700)]">{title}</p>
        <p className="activity-desc text-sm text-[color:var(--ink-500)]">{desc}</p>
      </div>
      <span className="activity-time text-xs text-[color:var(--ink-500)] whitespace-nowrap">{time}</span>
    </Link>
  </li>
);

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(d);
}

export default DashboardPage;
