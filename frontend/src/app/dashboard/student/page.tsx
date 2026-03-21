"use client";

import { useAuth } from "@/context/AuthContext";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiAward,
  FiBell,
  FiBook,
  FiBookOpen,
  FiCalendar,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiClipboard,
  FiInfo,
  FiRefreshCw,
  FiTrendingUp,
} from "react-icons/fi";
import { fetchStudentNotifications, loadStudentNotificationPrefs, type StudentNotificationItem } from "@/lib/studentNotifications";
import { loadNotificationPollIntervalMs } from "@/lib/notificationRealtime";

interface AnnouncementItem {
  id: string;
  type: "banner" | "running_text";
  icon?: "info" | "warning" | "danger" | "bell";
  title: string;
  content: string;
}

interface EssayQuestion {
  id: string;
  submission_id?: string;
  skor_ai?: number;
  revised_score?: number;
  teacher_feedback?: string;
}

interface Material {
  id: string;
  judul: string;
  material_type?: "materi" | "soal" | "tugas";
  updated_at?: string;
  created_at?: string;
  isi_materi?: string;
  essay_questions?: EssayQuestion[];
}

interface ClassItem {
  id: string;
  class_name: string;
  teacher_name?: string;
  materials?: Material[];
}

interface AssignmentRow {
  classId: string;
  className: string;
  materialId: string;
  materialTitle: string;
  materialType: "materi" | "soal" | "tugas";
  totalQuestions: number;
  submittedQuestions: number;
  pendingQuestions: number;
  progress: number;
  updatedAt?: string;
  dueAt?: string;
}

type CalendarEvent = {
  id: string;
  date: string;
  title: string;
  href: string;
  type: "deadline" | "activity";
};

const NOTIF_READ_STORAGE_PREFIX = "read_notifications_";

const announcementIcon = (icon?: string) => {
  if (icon === "warning") return <FiAlertTriangle size={14} />;
  if (icon === "danger") return <FiAlertCircle size={14} />;
  if (icon === "bell") return <FiBell size={14} />;
  return <FiInfo size={14} />;
};

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const startOfLast7Days = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 6);
  return d.getTime();
};

const toDateKey = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

const parseTaskDueAt = (raw?: string): string | undefined => {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as { format?: string; items?: Array<Record<string, unknown>> };
    if (parsed?.format !== "sage_section_cards_v1" || !Array.isArray(parsed.items)) return undefined;
    const dueDates = parsed.items
      .filter((item) => item?.type === "tugas")
      .map((item) => (typeof item?.meta === "object" && item.meta ? (item.meta as Record<string, unknown>).tugas_due_at : undefined))
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => new Date(v))
      .filter((v) => !Number.isNaN(v.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    if (dueDates.length === 0) return undefined;
    return dueDates[0].toISOString();
  } catch {
    return undefined;
  }
};

const getMonthDays = (monthDate: Date) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;

  const cells: Array<{ date: Date; inCurrentMonth: boolean }> = [];
  for (let i = 0; i < startOffset; i += 1) {
    cells.push({ date: new Date(year, month, 1 - (startOffset - i)), inCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push({ date: new Date(year, month, d), inCurrentMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const prev = cells[cells.length - 1];
    cells.push({ date: new Date(prev.date.getFullYear(), prev.date.getMonth(), prev.date.getDate() + 1), inCurrentMonth: false });
  }
  return cells;
};

export default function StudentDashboardOverviewPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [activities, setActivities] = useState<StudentNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date().toISOString()));
  const [showStudentAssignmentsMenu, setShowStudentAssignmentsMenu] = useState(true);
  const [showStudentAnnouncementsMenu, setShowStudentAnnouncementsMenu] = useState(true);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [classRes, announcementRes] = await Promise.all([
        fetch("/api/student/my-classes", { credentials: "include" }),
        fetch("/api/announcements/active", { credentials: "include" }),
      ]);

      const classBody = classRes.ok ? await classRes.json() : [];
      setClasses(Array.isArray(classBody) ? classBody : []);

      const announcementBody = announcementRes.ok ? await announcementRes.json().catch(() => ({})) : {};
      setAnnouncements(Array.isArray(announcementBody?.items) ? announcementBody.items : []);

      const notifPrefs = loadStudentNotificationPrefs();
      const notifItems = await fetchStudentNotifications(notifPrefs);
      notifItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setActivities(notifItems);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat dashboard student.");
      setClasses([]);
      setAnnouncements([]);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    void loadOverview();
    void loadNotificationPollIntervalMs().then((ms) => {
      timer = window.setInterval(() => void loadOverview(), ms);
    });
    return () => { if (timer) window.clearInterval(timer); };
  }, [loadOverview]);

  useEffect(() => {
    let active = true;
    const loadPublicFlags = async () => {
      try {
        const res = await fetch("/api/feature-flags/public", { credentials: "include" });
        if (!res.ok) return;
        const body = await res.json().catch(() => ({}));
        const items = Array.isArray(body?.items) ? body.items : [];
        const assignmentsFlag = items.find((item: { key: string }) => item.key === "feature_show_student_assignments_menu");
        const announcementsFlag = items.find((item: { key: string }) => item.key === "feature_show_student_announcements_menu");
        if (active && assignmentsFlag) {
          setShowStudentAssignmentsMenu(Boolean(assignmentsFlag.value));
        }
        if (active && announcementsFlag) {
          setShowStudentAnnouncementsMenu(Boolean(announcementsFlag.value));
        }
      } catch {
        // Keep default true.
      }
    };
    void loadPublicFlags();
    const onFocus = () => void loadPublicFlags();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const assignmentRows = useMemo<AssignmentRow[]>(() => {
    const rows: AssignmentRow[] = [];
    classes.forEach((cls) => {
      const materials = Array.isArray(cls.materials) ? cls.materials : [];
      materials.forEach((material) => {
        const questions = Array.isArray(material.essay_questions) ? material.essay_questions : [];
        const totalQuestions = questions.length;
        const submittedQuestions = questions.filter((q) => Boolean(q.submission_id)).length;
        const pendingQuestions = Math.max(0, totalQuestions - submittedQuestions);
        const progress = totalQuestions > 0 ? Math.round((submittedQuestions / totalQuestions) * 100) : 0;

        rows.push({
          classId: cls.id,
          className: cls.class_name,
          materialId: material.id,
          materialTitle: material.judul,
          materialType: (material.material_type || "materi") as "materi" | "soal" | "tugas",
          totalQuestions,
          submittedQuestions,
          pendingQuestions,
          progress,
          updatedAt: material.updated_at || material.created_at,
          dueAt: parseTaskDueAt(material.isi_materi),
        });
      });
    });
    return rows;
  }, [classes]);

  const unreadCount = useMemo(() => {
    if (typeof window === "undefined") return 0;
    const userKey = user?.id || user?.nama_lengkap || "anon";
    const key = `${NOTIF_READ_STORAGE_PREFIX}${userKey}`;
    let readIds = new Set<string>();
    try {
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      readIds = new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : []);
    } catch {
      readIds = new Set<string>();
    }
    return activities.filter((item) => !readIds.has(item.id)).length;
  }, [activities, user?.id, user?.nama_lengkap]);

  const liveStats = useMemo(() => {
    const pendingMaterials = assignmentRows.filter((row) => row.pendingQuestions > 0);
    const reviewedAnswers = classes.reduce((acc, cls) => {
      const materials = Array.isArray(cls.materials) ? cls.materials : [];
      return (
        acc +
        materials.reduce((materialAcc, material) => {
          const questions = Array.isArray(material.essay_questions) ? material.essay_questions : [];
          return (
            materialAcc +
            questions.filter((q) => q.revised_score != null || (q.teacher_feedback || "").trim().length > 0 || q.skor_ai != null).length
          );
        }, 0)
      );
    }, 0);

    const todayStart = startOfToday();
    const sevenDaysStart = startOfLast7Days();
    const todayUpdates = activities.filter((item) => {
      const ts = new Date(item.createdAt).getTime();
      return !Number.isNaN(ts) && ts >= todayStart;
    }).length;

    const weekRows = assignmentRows.filter((row) => {
      const ts = row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
      return ts >= sevenDaysStart;
    });
    const weekTotal = weekRows.reduce((acc, row) => acc + row.totalQuestions, 0);
    const weekDone = weekRows.reduce((acc, row) => acc + row.submittedQuestions, 0);
    const weekProgress = weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : 0;

    return {
      totalClasses: classes.length,
      pendingMaterials: pendingMaterials.length,
      reviewedAnswers,
      unreadCount,
      todayUpdates,
      weekProgress,
    };
  }, [activities, assignmentRows, classes, unreadCount]);

  const urgentTasks = useMemo(() => {
    return assignmentRows
      .filter((row) => row.pendingQuestions > 0)
      .sort((a, b) => {
        if (a.pendingQuestions !== b.pendingQuestions) return b.pendingQuestions - a.pendingQuestions;
        return a.progress - b.progress;
      })
      .slice(0, 3);
  }, [assignmentRows]);

  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    const events: CalendarEvent[] = [];
    assignmentRows.forEach((row) => {
      if (!row.dueAt) return;
      const key = toDateKey(row.dueAt);
      if (!key) return;
      events.push({
        id: `deadline-${row.classId}-${row.materialId}`,
        date: key,
        title: `Deadline: ${row.materialTitle}`,
        href: `/dashboard/student/classes/${row.classId}/materials/${row.materialId}`,
        type: "deadline",
      });
    });
    activities.forEach((item) => {
      const key = toDateKey(item.createdAt);
      if (!key) return;
      events.push({
        id: `activity-${item.id}`,
        date: key,
        title: item.title,
        href: "/dashboard/student/notifikasi",
        type: "activity",
      });
    });
    return events;
  }, [assignmentRows, activities]);

  const monthCells = useMemo(() => getMonthDays(monthCursor), [monthCursor]);
  const eventCountByDate = useMemo(() => {
    const map: Record<string, number> = {};
    calendarEvents.forEach((event) => {
      map[event.date] = (map[event.date] || 0) + 1;
    });
    return map;
  }, [calendarEvents]);
  const selectedDateEvents = useMemo(
    () => calendarEvents.filter((event) => event.date === selectedDate).slice(0, 4),
    [calendarEvents, selectedDate]
  );

  const runningTexts = announcements.filter((item) => item.type === "running_text");
  const banners = announcements.filter((item) => item.type === "banner");

  return (
    <div className="space-y-6">
      <header className="sage-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="sage-pill">Dashboard Siswa</p>
            <h1 className="mt-3 text-2xl text-[color:var(--ink-900)] sm:text-3xl">Halo, {user?.nama_lengkap}</h1>
            <p className="mt-2 text-sm text-[color:var(--ink-500)]">Pantau tugas, notifikasi, dan progres belajar secara live.</p>
          </div>
          <button type="button" className="sage-button-outline !px-3 !py-2 text-xs" onClick={() => void loadOverview()}>
            <FiRefreshCw /> Refresh
          </button>
        </div>
      </header>

      {runningTexts.length > 0 && (
        <div className="sage-panel overflow-hidden p-3">
          <div className="announcement-marquee-track">
            <div className="announcement-marquee-content announcement-marquee-content-right">
              {runningTexts.map((item) => (
                <span key={item.id} className="announcement-chip">
                  {announcementIcon(item.icon)} {item.content}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {banners.length > 0 && (
        <div className="space-y-3">
          {banners.map((item) => (
            <div key={item.id} className="announcement-banner rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-sky-900">
                {announcementIcon(item.icon)} {item.title || "Pengumuman"}
              </p>
              <p className="mt-0.5 text-sm text-sky-800">{item.content}</p>
            </div>
          ))}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="sage-panel p-4">
          <p className="text-xs text-slate-500">Perlu Dikerjakan</p>
          <p className="mt-1 text-2xl font-semibold text-amber-700">{liveStats.pendingMaterials}</p>
          <p className="mt-1 text-xs text-slate-500">Materi dengan soal pending</p>
        </div>
        <div className="sage-panel p-4">
          <p className="text-xs text-slate-500">Notifikasi Belum Dibaca</p>
          <p className="mt-1 text-2xl font-semibold text-red-600">{liveStats.unreadCount}</p>
          <p className="mt-1 text-xs text-slate-500">Update kelas, materi, nilai</p>
        </div>
        <div className="sage-panel p-4">
          <p className="text-xs text-slate-500">Progress 7 Hari</p>
          <p className="mt-1 inline-flex items-center gap-2 text-2xl font-semibold text-emerald-700">
            <FiTrendingUp className="text-lg" /> {liveStats.weekProgress}%
          </p>
          <p className="mt-1 text-xs text-slate-500">Pengerjaan soal minggu ini</p>
        </div>
        <div className="sage-panel p-4">
          <p className="text-xs text-slate-500">Jawaban Sudah Dinilai</p>
          <p className="mt-1 inline-flex items-center gap-2 text-2xl font-semibold text-sky-700">
            <FiCheckCircle className="text-lg" /> {liveStats.reviewedAnswers}
          </p>
          <p className="mt-1 text-xs text-slate-500">Total feedback/hasil grading</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        {showStudentAssignmentsMenu && (
          <article className="sage-panel p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Prioritas Sekarang</h2>
              <Link href="/dashboard/student/assignments" className="text-xs font-medium text-[color:var(--sage-700)] hover:underline">
                Lihat semua tugas
              </Link>
            </div>
            {loading ? (
              <p className="text-sm text-slate-500">Memuat prioritas...</p>
            ) : urgentTasks.length === 0 ? (
              <p className="text-sm text-slate-500">Tidak ada tugas urgent. Mantap, lanjutkan progresmu.</p>
            ) : (
              <div className="space-y-3">
                {urgentTasks.map((task) => (
                  <Link
                    key={`${task.classId}-${task.materialId}`}
                    href={`/dashboard/student/classes/${task.classId}/materials/${task.materialId}`}
                    className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">{task.className}</p>
                        <p className="truncate text-sm font-semibold text-slate-900">{task.materialTitle}</p>
                      </div>
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">
                        {task.pendingQuestions} pending
                      </span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-200">
                      <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${task.progress}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">Progress {task.progress}%</p>
                  </Link>
                ))}
              </div>
            )}
          </article>
        )}

        <article className="sage-panel p-5">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Quick Actions</h2>
          <div className="grid gap-2 text-sm">
            <Link href="/dashboard/student/my-classes" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 hover:bg-slate-50">
              <FiBook /> Kelas Saya ({liveStats.totalClasses})
            </Link>
            {showStudentAssignmentsMenu && (
              <Link href="/dashboard/student/assignments" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 hover:bg-slate-50">
                <FiClipboard /> Materi & Tugas
              </Link>
            )}
            <Link href="/dashboard/student/grades" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 hover:bg-slate-50">
              <FiAward /> Nilai & Feedback
            </Link>
            <Link href="/dashboard/student/notifikasi" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 hover:bg-slate-50">
              <FiBell /> Notifikasi ({liveStats.unreadCount})
            </Link>
            {showStudentAnnouncementsMenu && (
              <Link href="/dashboard/student/announcements" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 hover:bg-slate-50">
                <FiBookOpen /> Pengumuman
              </Link>
            )}
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700">
                <FiCalendar size={13} /> Mini Kalender
              </p>
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
                  onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                  aria-label="Bulan sebelumnya"
                >
                  <FiChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
                  onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                  aria-label="Bulan berikutnya"
                >
                  <FiChevronRight size={14} />
                </button>
              </div>
            </div>
            <p className="mb-2 text-[11px] text-slate-500">
              {new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(monthCursor)}
            </p>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-500">
              {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
                <span key={d}>{d[0]}</span>
              ))}
              {monthCells.map((cell) => {
                const key = toDateKey(cell.date.toISOString());
                const count = eventCountByDate[key] || 0;
                const selected = selectedDate === key;
                return (
                  <button
                    type="button"
                    key={`${key}-${cell.inCurrentMonth ? "in" : "out"}`}
                    onClick={() => setSelectedDate(key)}
                    className={`relative rounded-md border py-1 text-[11px] ${
                      selected
                        ? "border-slate-900 bg-slate-900 text-white"
                        : cell.inCurrentMonth
                          ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          : "border-slate-100 bg-slate-50 text-slate-400"
                    }`}
                  >
                    {cell.date.getDate()}
                    {count > 0 && (
                      <span
                        className={`absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${
                          selected ? "bg-white" : "bg-emerald-500"
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 space-y-1">
              {selectedDateEvents.length === 0 ? (
                <p className="text-[11px] text-slate-500">Tidak ada agenda di tanggal ini.</p>
              ) : (
                selectedDateEvents.map((event) => (
                  <Link key={event.id} href={event.href} className="block rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-700 hover:bg-slate-100">
                    <span
                      className={`mr-1 inline-flex rounded px-1 py-0.5 text-[10px] font-semibold ${
                        event.type === "deadline" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {event.type === "deadline" ? "DL" : "Live"}
                    </span>
                    {event.title}
                  </Link>
                ))
              )}
            </div>
          </div>
        </article>
      </section>

      <section className="sage-panel p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Feed Aktivitas Live</h2>
          <span className="text-xs text-slate-500">Update hari ini: {liveStats.todayUpdates}</span>
        </div>
        {loading ? (
          <p className="text-sm text-slate-500">Memuat feed aktivitas...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : activities.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada aktivitas terbaru.</p>
        ) : (
          <div className="space-y-2">
            {activities.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-600">{item.message}</p>
                <p className="mt-1 text-[11px] text-slate-500">{formatDateTime(item.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
