"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FiBell, FiCheckCircle, FiClock, FiRefreshCw } from "react-icons/fi";
import { useAuth } from "@/context/AuthContext";
import { fetchStudentNotifications, loadStudentNotificationPrefs, StudentNotificationItem } from "@/lib/studentNotifications";
import { DEFAULT_NOTIFICATION_POLL_INTERVAL_MS, loadNotificationPollIntervalMs } from "@/lib/notificationRealtime";

const NOTIF_READ_STORAGE_PREFIX = "read_notifications_";

const formatDate = (value?: string) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
};

const resolveStudentNotifHref = (item: StudentNotificationItem): string => {
  const id = String(item.id || "").toLowerCase();
  if (id.startsWith("student-review-") || id.startsWith("student-ai-graded-")) {
    return "/dashboard/student/grades";
  }
  if (id.startsWith("student-material-") || id.startsWith("student-question-")) {
    return "/dashboard/student/assignments";
  }
  if (id.startsWith("student-class-")) {
    return "/dashboard/student/my-classes";
  }
  if (id.startsWith("student-approval-")) {
    return "/dashboard/student/settings/profile";
  }
  return "/dashboard/student";
};

export default function StudentNotificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<StudentNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [error, setError] = useState<string | null>(null);
  const [pollIntervalMs, setPollIntervalMs] = useState<number>(DEFAULT_NOTIFICATION_POLL_INTERVAL_MS);

  const readStorageKey = useMemo(() => {
    const userKey = user?.id || user?.nama_lengkap || "anon";
    return `${NOTIF_READ_STORAGE_PREFIX}${userKey}`;
  }, [user?.id, user?.nama_lengkap]);

  const loadReadIds = () => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(readStorageKey);
      if (!raw) {
        setReadIds([]);
        return;
      }
      const parsed = JSON.parse(raw);
      setReadIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setReadIds([]);
    }
  };

  const saveReadIds = (ids: string[]) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(readStorageKey, JSON.stringify(ids));
    setReadIds(ids);
  };

  const loadItems = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const prefs = loadStudentNotificationPrefs();
      const nextItems = await fetchStudentNotifications(prefs);
      setItems(nextItems);
    } catch (err: any) {
      setError(err?.message || "Gagal memuat notifikasi.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadReadIds();
    loadItems();
  }, [user?.id, readStorageKey]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const next = await loadNotificationPollIntervalMs();
      if (active) setPollIntervalMs(next);
    })();
    return () => {
      active = false;
    };
  }, [user?.id, user?.peran]);

  useEffect(() => {
    if (!user || user.peran !== "student") return;
    const timer = window.setInterval(() => {
      loadItems();
    }, pollIntervalMs);
    return () => window.clearInterval(timer);
  }, [user?.id, user?.peran, pollIntervalMs]);

  const markAllRead = () => {
    if (items.length === 0) return;
    const next = Array.from(new Set([...readIds, ...items.map((item) => item.id)]));
    saveReadIds(next);
  };

  const markAsRead = (id: string) => {
    if (readIds.includes(id)) return;
    saveReadIds([...readIds, id]);
  };

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === "unread" && readIds.includes(item.id)) return false;
      if (filter === "read" && !readIds.includes(item.id)) return false;
      if (!needle) return true;
      return item.title.toLowerCase().includes(needle) || item.message.toLowerCase().includes(needle);
    });
  }, [items, query, filter, readIds]);

  const unreadCount = items.filter((item) => !readIds.includes(item.id)).length;

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Notifikasi Siswa</h1>
        <p className="text-sm text-slate-500">Pusat notifikasi approval, materi baru, soal baru, dan hasil review.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Total Notifikasi</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{items.length}</p>
          </div>
          <div className="teacher-notif-stat-unread rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs text-amber-700">Belum Dibaca</p>
            <p className="mt-1 text-xl font-semibold text-amber-800">{unreadCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <button type="button" className="sage-button-outline inline-flex items-center gap-2" onClick={markAllRead}>
              <FiCheckCircle size={14} /> Tandai semua dibaca
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-col gap-2 md:flex-row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari judul/pesan notifikasi..."
            className="sage-input flex-1"
          />
          <select className="sage-input md:w-44 bg-white" value={filter} onChange={(e) => setFilter(e.target.value as "all" | "unread" | "read")}>
            <option value="all">Semua</option>
            <option value="unread">Belum dibaca</option>
            <option value="read">Sudah dibaca</option>
          </select>
          <button type="button" className="sage-button-outline inline-flex items-center gap-2" onClick={loadItems} disabled={loading}>
            <FiRefreshCw size={14} /> {loading ? "Memuat..." : "Refresh"}
          </button>
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        {loading && <p className="text-sm text-slate-500">Memuat notifikasi...</p>}

        {!loading && filteredItems.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            Belum ada notifikasi pada filter ini.
          </div>
        )}

        <div className="space-y-2">
          {filteredItems.map((item) => {
            const isRead = readIds.includes(item.id);
            return (
              <div
                key={item.id}
                className={`teacher-notif-item rounded-xl border p-3 ${isRead ? "border-slate-200 bg-white" : "teacher-notif-item-unread border-sky-200 bg-sky-50"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 inline-flex items-center gap-2">
                      <FiBell size={14} />
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">{item.message}</p>
                    <p className="mt-1 text-[11px] text-slate-500 inline-flex items-center gap-1">
                      <FiClock size={12} /> {formatDate(item.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!isRead && (
                      <button type="button" className="sage-button-outline !px-2.5 !py-1.5 text-xs" onClick={() => markAsRead(item.id)}>
                        Dibaca
                      </button>
                    )}
                    <Link href={resolveStudentNotifHref(item)} className="sage-button !px-2.5 !py-1.5 text-xs">
                      Buka
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
