"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { FiUsers, FiBookOpen, FiClipboard, FiTrendingUp, FiChevronRight, FiInfo, FiAlertTriangle, FiAlertCircle, FiBell, FiPlus, FiCheckCircle, FiClock, FiBarChart2, FiFileText, FiSettings, FiEye, FiUserCheck } from "react-icons/fi";

interface DashboardStats {
  totalClasses: number;
  totalStudents: number;
  totalMaterials: number;
  weeklyMaterialGrowth: string;
}

interface GradingStats {
  submitted: number;
  graded: number;
  pending: number;
  avgGradingTime: string;
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
  const [gradingStats, setGradingStats] = useState<GradingStats>({
    submitted: 0,
    graded: 0,
    pending: 0,
    avgGradingTime: "-",
  });
  const [latestClass, setLatestClass] = useState<{ id: string; name: string; at?: string } | null>(null);
  const [latestMaterial, setLatestMaterial] = useState<{ id: string; name: string; at?: string } | null>(null);
  const [pendingJoinCount, setPendingJoinCount] = useState(0);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [analyticsModalOpen, setAnalyticsModalOpen] = useState(false);
  const [createClassModalOpen, setCreateClassModalOpen] = useState(false);
  const [gradeModalOpen, setGradeModalOpen] = useState(false);

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
      
      // Mock grading stats - replace with actual API call when available
      setGradingStats({
        submitted: 24,
        graded: 20,
        pending: 4,
        avgGradingTime: "3.2 min",
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="sage-pill">Dashboard Guru</p>
          <h1 className="mt-3 text-3xl text-[color:var(--ink-900)] md:text-4xl">Ringkasan akademik hari ini</h1>
          <p className="mt-2 text-[color:var(--ink-500)]">Kelola kelas, penilaian, dan materi dengan cepat dan tepat.</p>
        </div>
        <div className="sage-card px-5 py-3 text-sm text-[color:var(--ink-500)]">Update: {updateLabel}</div>
      </div>

      {/* Running Text Announcements */}
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

      {/* Alert Banners */}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

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

      {/* Main Stats - 4 Columns */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Kelas" value={isLoading ? "..." : String(stats.totalClasses)} icon={<FiBookOpen />} href="/dashboard/teacher/classes" color="emerald" />
        <StatCard title="Total Siswa" value={isLoading ? "..." : String(stats.totalStudents)} icon={<FiUsers />} href="/dashboard/teacher/classes" color="sky" />
        <StatCard title="Materi Aktif" value={isLoading ? "..." : String(stats.totalMaterials)} icon={<FiClipboard />} href="/dashboard/teacher/classes" color="violet" />
        <StatCard title="Aktivitas Minggu" value={isLoading ? "..." : stats.weeklyMaterialGrowth} icon={<FiTrendingUp />} href="/dashboard/teacher/classes" color="amber" />
      </div>

      {/* Grading Section - HIGH PRIORITY */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <GradingCard 
          submitted={gradingStats.submitted}
          graded={gradingStats.graded}
          pending={gradingStats.pending}
          avgTime={gradingStats.avgGradingTime}
          isLoading={isLoading}
        />

        <QuickActionsCard 
          onApprovalClick={() => setApprovalModalOpen(true)}
          onAnalyticsClick={() => setAnalyticsModalOpen(true)}
          onCreateClassClick={() => setCreateClassModalOpen(true)}
          onGradeClick={() => setGradeModalOpen(true)}
          pendingCount={pendingJoinCount}
        />

        <PerformanceCard 
          accuracy="99.2%"
          consistency="Tinggi"
          avgTime={gradingStats.avgGradingTime}
        />
      </div>

      {/* Modals */}
      {approvalModalOpen && (
        <ApprovalJoinModal 
          isOpen={approvalModalOpen}
          onClose={() => setApprovalModalOpen(false)}
          pendingCount={pendingJoinCount}
        />
      )}

      {gradeModalOpen && (
        <PendingGradingModal 
          isOpen={gradeModalOpen}
          onClose={() => setGradeModalOpen(false)}
        />
      )}

      {analyticsModalOpen && (
        <AnalyticsModal 
          isOpen={analyticsModalOpen}
          onClose={() => setAnalyticsModalOpen(false)}
          totalClasses={stats.totalClasses}
          totalStudents={stats.totalStudents}
          totalMaterials={stats.totalMaterials}
        />
      )}

      {createClassModalOpen && (
        <CreateClassModal 
          isOpen={createClassModalOpen}
          onClose={() => setCreateClassModalOpen(false)}
        />
      )}
    </div>
  );
};

const StatCard = ({
  title,
  value,
  icon,
  href,
  color = "emerald",
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  href: string;
  color?: "emerald" | "sky" | "violet" | "amber";
}) => {
  const colorMap = {
    emerald: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 dark:border-emerald-900/30",
    sky: "bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 dark:border-sky-900/30",
    violet: "bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 dark:border-violet-900/30",
    amber: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 dark:border-amber-900/30",
  };
  
  return (
    <Link href={href} className="sage-card p-5 flex items-center gap-4 hover:shadow-md hover:scale-105 transition-all duration-300 rounded-2xl bg-white dark:bg-slate-800/60 dark:border-slate-700">
      <div className={`stat-icon p-3 rounded-2xl ${colorMap[color]} text-lg border dark:border-current/20`}>{icon}</div>
      <div className="flex-1">
        <p className="text-xs font-medium text-[color:var(--ink-500)] dark:text-slate-400 uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-[color:var(--ink-900)] dark:text-white mt-1">{value}</p>
      </div>
    </Link>
  )
};

const ActivityItem = ({
  title,
  desc,
  time,
  href,
  icon,
  highlight,
}: {
  title: string;
  desc: string;
  time: string;
  href: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) => (
  <li>
    <Link href={href} className={`activity-link flex justify-between items-start rounded-lg px-3 py-3 transition-all ${highlight ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50" : "hover:bg-slate-50 dark:hover:bg-slate-700/50"}`}>
      <div className="flex gap-3 flex-1">
        {icon && <div className="shrink-0 mt-0.5 text-lg">{icon}</div>}
        <div className="flex-1 min-w-0">
          <p className="activity-title font-semibold text-[color:var(--ink-800)] dark:text-white text-sm">{title}</p>
          <p className="activity-desc text-xs text-[color:var(--ink-500)] dark:text-slate-400 mt-1 truncate">{desc}</p>
        </div>
      </div>
      <span className="activity-time text-xs text-[color:var(--ink-500)] dark:text-slate-400 whitespace-nowrap ml-2 font-medium">{time}</span>
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

const GradingCard = ({
  submitted,
  graded,
  pending,
  avgTime,
  isLoading,
}: {
  submitted: number;
  graded: number;
  pending: number;
  avgTime: string;
  isLoading: boolean;
}) => (
  <Link href="/dashboard/teacher/penilaian" className="sage-panel p-6 rounded-2xl block hover:shadow-lg hover:scale-105 transition-all duration-300 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 dark:border-emerald-900/30">
    <div className="flex items-start justify-between mb-5">
      <h2 className="text-lg font-semibold text-[color:var(--ink-900)] dark:text-emerald-100 flex items-center gap-2">
        <FiCheckCircle className="text-emerald-500 dark:text-emerald-400" /> Penilaian
      </h2>
      <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{pending}</span>
    </div>
    <p className="text-xs text-[color:var(--ink-500)] dark:text-slate-400 uppercase tracking-wider mb-4">Status Penilaian</p>
    
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[color:var(--ink-600)] dark:text-slate-300">Masuk</span>
        <span className="font-bold text-[color:var(--ink-900)] dark:text-white">{isLoading ? "-" : submitted}</span>
      </div>
      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
        <div className="bg-gradient-to-r from-emerald-400 to-teal-500 h-2 rounded-full" style={{ width: `${isLoading ? 0 : (graded / submitted) * 100}%` }}></div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-[color:var(--ink-500)] dark:text-slate-400">Dinilai: <strong className="dark:text-white">{isLoading ? "-" : graded}</strong></span>
        <span className={`font-semibold ${pending > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>Pending: {isLoading ? "-" : pending}</span>
      </div>
    </div>
    
    <div className="mt-5 pt-5 border-t border-emerald-200 dark:border-emerald-900/50">
      <p className="text-xs text-[color:var(--ink-500)] dark:text-slate-400 mb-2">Rata-rata waktu koreksi</p>
      <p className="text-2xl font-bold text-[color:var(--ink-900)] dark:text-emerald-100">{avgTime}</p>
    </div>
    
    <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200">
      Lihat detail penilaian <FiChevronRight className="text-lg" />
    </div>
  </Link>
);

const QuickActionsCard = ({
  onApprovalClick,
  onAnalyticsClick,
  onCreateClassClick,
  onGradeClick,
  pendingCount,
}: {
  onApprovalClick: () => void;
  onAnalyticsClick: () => void;
  onCreateClassClick: () => void;
  onGradeClick: () => void;
  pendingCount: number;
}) => (
  <div className="sage-panel p-6 rounded-2xl space-y-3 bg-white dark:bg-slate-800/60 dark:border-slate-700">
    <h2 className="text-lg font-semibold text-[color:var(--ink-900)] dark:text-white mb-4 flex items-center gap-2">
      <FiPlus className="text-sky-500 dark:text-sky-400" /> Aksi Cepat
    </h2>
    
    <button onClick={onCreateClassClick} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-950/40 dark:to-blue-950/40 hover:from-sky-100 hover:to-blue-100 dark:hover:from-sky-900/50 dark:hover:to-blue-900/50 transition-all group dark:border dark:border-sky-900/30">
      <FiCheckCircle className="text-lg text-sky-600 dark:text-sky-400 group-hover:scale-110 transition shrink-0" />
      <div className="flex-1 text-left min-w-0">
        <p className="font-medium text-[color:var(--ink-800)] dark:text-sky-100 text-sm">Buat Kelas</p>
        <p className="text-xs text-[color:var(--ink-500)] dark:text-sky-300 truncate">Setup kelas baru</p>
      </div>
      <FiChevronRight className="text-sky-600 dark:text-sky-400 shrink-0" />
    </button>

    <button onClick={onApprovalClick} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 hover:from-emerald-100 hover:to-teal-100 dark:hover:from-emerald-900/50 dark:hover:to-teal-900/50 transition-all group dark:border dark:border-emerald-900/30">
      <div className="relative shrink-0">
        <FiUserCheck className="text-lg text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition" />
        {pendingCount > 0 && (
          <span className="absolute -top-2 -right-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {pendingCount}
          </span>
        )}
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="font-medium text-[color:var(--ink-800)] dark:text-emerald-100 text-sm">Persetujuan Bergabung</p>
        <p className="text-xs text-[color:var(--ink-500)] dark:text-emerald-300 truncate">{pendingCount} siswa menunggu</p>
      </div>
      <FiChevronRight className="text-emerald-600 dark:text-emerald-400 shrink-0" />
    </button>

    <button onClick={onGradeClick} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/40 dark:to-purple-950/40 hover:from-violet-100 hover:to-purple-100 dark:hover:from-violet-900/50 dark:hover:to-purple-900/50 transition-all group dark:border dark:border-violet-900/30">
      <FiFileText className="text-lg text-violet-600 dark:text-violet-400 group-hover:scale-110 transition shrink-0" />
      <div className="flex-1 text-left min-w-0">
        <p className="font-medium text-[color:var(--ink-800)] dark:text-violet-100 text-sm">Penilaian Pending</p>
        <p className="text-xs text-[color:var(--ink-500)] dark:text-violet-300 truncate">Esai yg belum dinilai</p>
      </div>
      <FiChevronRight className="text-violet-600 dark:text-violet-400 shrink-0" />
    </button>

    <button onClick={onAnalyticsClick} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 hover:from-amber-100 hover:to-orange-100 dark:hover:from-amber-900/50 dark:hover:to-orange-900/50 transition-all group dark:border dark:border-amber-900/30">
      <FiBarChart2 className="text-lg text-amber-600 dark:text-amber-400 group-hover:scale-110 transition shrink-0" />
      <div className="flex-1 text-left min-w-0">
        <p className="font-medium text-[color:var(--ink-800)] dark:text-amber-100 text-sm">Class Analytics</p>
        <p className="text-xs text-[color:var(--ink-500)] dark:text-amber-300 truncate">Performance per kelas</p>
      </div>
      <FiChevronRight className="text-amber-600 dark:text-amber-400 shrink-0" />
    </button>
  </div>
);

const PerformanceCard = ({
  accuracy,
  consistency,
  avgTime,
}: {
  accuracy: string;
  consistency: string;
  avgTime: string;
}) => (
  <div className="sage-panel p-6 rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/40 dark:to-indigo-950/40 dark:border-violet-900/30">
    <h2 className="text-lg font-semibold text-[color:var(--ink-900)] dark:text-violet-100 mb-5 flex items-center gap-2">
      <FiBarChart2 className="text-violet-500 dark:text-violet-400" /> Performa AI
    </h2>
    
    <div className="space-y-5">
      <div className="flex items-center justify-between pb-4 border-b border-violet-200 dark:border-violet-900/50">
        <div>
          <p className="text-xs font-medium text-[color:var(--ink-500)] dark:text-slate-400 uppercase tracking-wide mb-1">Tingkat Ketepatan</p>
          <p className="text-sm text-[color:var(--ink-600)] dark:text-slate-300">Akurasi penilaian AI</p>
        </div>
        <p className="text-3xl font-bold text-violet-600 dark:text-violet-400">{accuracy}</p>
      </div>

      <div className="flex items-center justify-between pb-4 border-b border-violet-200 dark:border-violet-900/50">
        <div>
          <p className="text-xs font-medium text-[color:var(--ink-500)] dark:text-slate-400 uppercase tracking-wide mb-1">Konsistensi</p>
          <p className="text-sm text-[color:var(--ink-600)] dark:text-slate-300">Stabilitas hasil penilaian</p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-semibold text-sm dark:border dark:border-emerald-900/50">
          <FiCheckCircle /> {consistency}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-[color:var(--ink-500)] dark:text-slate-400 uppercase tracking-wide mb-1">Waktu Proses</p>
          <p className="text-sm text-[color:var(--ink-600)] dark:text-slate-300">Rata-rata per esai</p>
        </div>
        <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{avgTime}</p>
      </div>
    </div>

    <div className="mt-5 p-3 rounded-lg bg-white/60 dark:bg-slate-900/40 border border-violet-200 dark:border-violet-900/50">
      <p className="text-xs text-[color:var(--ink-600)] dark:text-slate-300 text-center">
        ✨ Sistem AI stabil dan siap digunakan
      </p>
    </div>
  </div>
);

// ─── MODALS ───

const ApprovalJoinModal = ({
  isOpen,
  onClose,
  pendingCount,
}: {
  isOpen: boolean;
  onClose: () => void;
  pendingCount: number;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="sage-panel w-full max-w-md mx-4 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[color:var(--ink-900)] dark:text-white flex items-center gap-2">
            <FiBell className="text-emerald-500" /> Persetujuan Bergabung
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">✕</button>
        </div>

        {pendingCount > 0 ? (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {/* Mock data - replace with actual API data */}
            {Array.from({ length: Math.min(pendingCount, 5) }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[color:var(--ink-800)] dark:text-emerald-100">Siswa {i + 1}</p>
                  <p className="text-xs text-[color:var(--ink-500)] dark:text-emerald-300 truncate">Kelas X-A</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium transition">
                    ✓ Acc
                  </button>
                  <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white text-xs font-medium transition">
                    ✕ Tolak
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-[color:var(--ink-500)] dark:text-slate-400">Tidak ada permintaan bergabung saat ini</p>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Link href="/dashboard/teacher/classes" className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-[color:var(--ink-700)] dark:text-slate-200 font-medium transition">
            Kelola di Dashboard <FiChevronRight />
          </Link>
        </div>
      </div>
    </div>
  );
};

const AnalyticsModal = ({
  isOpen,
  onClose,
  totalClasses,
  totalStudents,
  totalMaterials,
}: {
  isOpen: boolean;
  onClose: () => void;
  totalClasses: number;
  totalStudents: number;
  totalMaterials: number;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="sage-panel w-full max-w-lg mx-4 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[color:var(--ink-900)] dark:text-white flex items-center gap-2">
            <FiBarChart2 className="text-violet-500" /> Class Analytics
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">✕</button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-lg p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalClasses}</p>
            <p className="text-xs text-[color:var(--ink-500)] dark:text-emerald-300 mt-1">Total Kelas</p>
          </div>
          <div className="rounded-lg p-4 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/50">
            <p className="text-2xl font-bold text-sky-600 dark:text-sky-400">{totalStudents}</p>
            <p className="text-xs text-[color:var(--ink-500)] dark:text-sky-300 mt-1">Total Siswa</p>
          </div>
          <div className="rounded-lg p-4 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900/50">
            <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{totalMaterials}</p>
            <p className="text-xs text-[color:var(--ink-500)] dark:text-violet-300 mt-1">Total Materi</p>
          </div>
        </div>

        <div className="space-y-4 max-h-64 overflow-y-auto">
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
            <p className="font-semibold text-sm text-[color:var(--ink-800)] dark:text-white mb-2">Performa Per Kelas</p>
            <div className="space-y-2">
              {["X-A", "X-B", "X-C"].map((cls, i) => (
                <div key={cls} className="flex items-center justify-between text-sm">
                  <span className="text-[color:var(--ink-600)] dark:text-slate-400">Kelas {cls}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                      <div className="bg-gradient-to-r from-emerald-400 to-teal-500 h-2 rounded-full" style={{ width: `${75 + i * 5}%` }}></div>
                    </div>
                    <span className="font-semibold text-[color:var(--ink-700)] dark:text-slate-300">{75 + i * 5}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Link href="/dashboard/teacher/laporan-nilai" className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-[color:var(--ink-700)] dark:text-slate-200 font-medium transition">
            Lihat Detail <FiChevronRight />
          </Link>
        </div>
      </div>
    </div>
  );
};

const CreateClassModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="sage-panel w-full max-w-md mx-4 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[color:var(--ink-900)] dark:text-white flex items-center gap-2">
            ✅ Buat Kelas Baru
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">✕</button>
        </div>

        <form className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[color:var(--ink-700)] dark:text-slate-300 block mb-2">
              Nama Kelas
            </label>
            <input type="text" placeholder="Contoh: X-A" className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white text-[color:var(--ink-900)]" />
          </div>

          <div>
            <label className="text-sm font-medium text-[color:var(--ink-700)] dark:text-slate-300 block mb-2">
              Deskripsi (Opsional)
            </label>
            <textarea placeholder="Deskripsi kelas..." rows={3} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white text-[color:var(--ink-900)] resize-none" />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-[color:var(--ink-700)] dark:text-slate-200 font-medium transition">
              Batal
            </button>
            <button type="submit" className="flex-1 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-medium transition">
              Buat Kelas
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PendingGradingModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  if (!isOpen) return null;

  const pendingItems = [
    { id: "1", class: "X-A", material: "Analisis Unsur Intrinsik Cerpen", pending: 5 },
    { id: "2", class: "X-A", material: "Menulis Esai Argumentasi", pending: 3 },
    { id: "3", class: "X-B", material: "Teks Prosedur Kompleks", pending: 8 },
    { id: "4", class: "X-C", material: "Laporan Observasi", pending: 2 },
  ];

  const handleSelectClass = (id: string) => {
    onClose();
    // In production, this would navigate with filter params
    // router.push(`/dashboard/teacher/penilaian?material=${id}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="sage-panel w-full max-w-lg mx-4 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[color:var(--ink-900)] dark:text-white flex items-center gap-2">
            <FiClipboard className="text-violet-500" /> Penilaian Pending
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">✕</button>
        </div>

        <p className="text-sm text-[color:var(--ink-500)] dark:text-slate-400 mb-4">Pilih materi yang ingin dinilai:</p>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {pendingItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSelectClass(item.id)}
              className="w-full text-left flex items-center justify-between p-4 rounded-lg border border-violet-200 dark:border-violet-900/50 bg-violet-50 dark:bg-violet-950/30 hover:bg-violet-100 dark:hover:bg-violet-950/50 transition-all group"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-[color:var(--ink-800)] dark:text-violet-100">{item.material}</p>
                <p className="text-xs text-[color:var(--ink-500)] dark:text-violet-300 mt-1">Kelas {item.class}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-semibold text-sm">
                  <span className="inline-block h-2 w-2 rounded-full bg-red-500"></span>
                  {item.pending} siswa
                </div>
                <FiChevronRight className="text-violet-600 dark:text-violet-400 group-hover:translate-x-1 transition" />
              </div>
            </button>
          ))}
        </div>

        {pendingItems.length === 0 && (
          <div className="text-center py-8">
            <p className="text-[color:var(--ink-500)] dark:text-slate-400">Tidak ada penilaian pending</p>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="w-full px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-[color:var(--ink-700)] dark:text-slate-200 font-medium transition">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
