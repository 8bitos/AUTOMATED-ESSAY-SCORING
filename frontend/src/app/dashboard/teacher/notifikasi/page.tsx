"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FiBell, FiCheckCircle, FiClock, FiRefreshCw } from "react-icons/fi";
import { useAuth } from "@/context/AuthContext";
import { DEFAULT_NOTIFICATION_POLL_INTERVAL_MS, loadNotificationPollIntervalMs } from "@/lib/notificationRealtime";

type TeacherNotificationPrefs = {
  classRequests: boolean;
  assessmentUpdates: boolean;
  systemAnnouncements: boolean;
};

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  href: string;
};

const TEACHER_NOTIFICATION_PREFS_KEY = "teacher_notification_preferences";
const NOTIF_READ_STORAGE_PREFIX = "read_notifications_";
const TEACHER_NOTIFICATION_HISTORY_PREFIX = "teacher_notifications_history_";

function sortByCreatedAtDesc(items: NotificationItem[]) {
  return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function toLocalDate(value?: string) {
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
}

export default function TeacherNotifikasiPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [pollIntervalMs, setPollIntervalMs] = useState<number>(DEFAULT_NOTIFICATION_POLL_INTERVAL_MS);

  const readStorageKey = useMemo(() => {
    const userKey = user?.id || user?.nama_lengkap || "anon";
    return `${NOTIF_READ_STORAGE_PREFIX}${userKey}`;
  }, [user?.id, user?.nama_lengkap]);

  const historyStorageKey = useMemo(() => {
    const userKey = user?.id || user?.nama_lengkap || "anon";
    return `${TEACHER_NOTIFICATION_HISTORY_PREFIX}${userKey}`;
  }, [user?.id, user?.nama_lengkap]);

  const loadPrefs = (): TeacherNotificationPrefs => {
    if (typeof window === "undefined") {
      return { classRequests: true, assessmentUpdates: true, systemAnnouncements: true };
    }
    const raw = window.localStorage.getItem(TEACHER_NOTIFICATION_PREFS_KEY);
    if (!raw) {
      return { classRequests: true, assessmentUpdates: true, systemAnnouncements: true };
    }
    try {
      const parsed = JSON.parse(raw) as Partial<TeacherNotificationPrefs>;
      return {
        classRequests: parsed.classRequests ?? true,
        assessmentUpdates: parsed.assessmentUpdates ?? true,
        systemAnnouncements: parsed.systemAnnouncements ?? true,
      };
    } catch {
      return { classRequests: true, assessmentUpdates: true, systemAnnouncements: true };
    }
  };

  const loadReadIds = () => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(readStorageKey);
    if (!raw) {
      setReadIds([]);
      return;
    }
    try {
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

  const loadHistory = (): NotificationItem[] => {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(historyStorageKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : [];
      return list
        .map((x: any) => ({
          id: String(x?.id || ""),
          title: String(x?.title || ""),
          message: String(x?.message || ""),
          createdAt: String(x?.createdAt || ""),
          href: String(x?.href || "/dashboard/teacher"),
        }))
        .filter((x: NotificationItem) => x.id && x.title);
    } catch {
      return [];
    }
  };

  const saveHistory = (incoming: NotificationItem[]) => {
    if (typeof window === "undefined") return;
    const existing = loadHistory();
    const mergedMap = new Map<string, NotificationItem>();
    for (const item of [...existing, ...incoming]) {
      const prev = mergedMap.get(item.id);
      if (!prev) {
        mergedMap.set(item.id, item);
      } else {
        const prevT = new Date(prev.createdAt).getTime();
        const nextT = new Date(item.createdAt).getTime();
        mergedMap.set(item.id, Number.isFinite(nextT) && nextT > prevT ? item : prev);
      }
    }
    const merged = sortByCreatedAtDesc(Array.from(mergedMap.values())).slice(0, 500);
    window.localStorage.setItem(historyStorageKey, JSON.stringify(merged));
    setItems(merged);
  };

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const prefs = loadPrefs();
      const allItems: NotificationItem[] = [];

      const classRes = await fetch("/api/classes", { credentials: "include" });
      if (!classRes.ok) throw new Error("Gagal memuat kelas");
      const classes = await classRes.json();

      if (prefs.classRequests) {
        for (const cls of Array.isArray(classes) ? classes : []) {
          const pendingRes = await fetch(`/api/classes/${cls.id}/join-requests`, { credentials: "include" });
          if (!pendingRes.ok) continue;
          const pendingItems = await pendingRes.json();
          for (const req of Array.isArray(pendingItems) ? pendingItems : []) {
            allItems.push({
              id: `join-${req.member_id || req.id}`,
              title: "Join Request Baru",
              message: `${req.student_name || "Siswa"} meminta bergabung ke ${cls.class_name || "kelas Anda"}.`,
              createdAt: req.requested_at || new Date().toISOString(),
              href: "/dashboard/teacher/classes",
            });
          }
        }
      }

      if (prefs.assessmentUpdates) {
        for (const cls of Array.isArray(classes) ? classes : []) {
          const materialsRes = await fetch(`/api/classes/${cls.id}/materials`, { credentials: "include" });
          const materials = materialsRes.ok ? await materialsRes.json() : [];

          for (const material of Array.isArray(materials) ? materials : []) {
            const questionRes = await fetch(`/api/materials/${material.id}/essay-questions`, { credentials: "include" });
            const questions = questionRes.ok ? await questionRes.json() : [];

            for (const question of Array.isArray(questions) ? questions : []) {
              const submissionRes = await fetch(`/api/essay-questions/${question.id}/submissions`, { credentials: "include" });
              const submissions = submissionRes.ok ? await submissionRes.json() : [];

              for (const submission of Array.isArray(submissions) ? submissions : []) {
                const reviewed =
                  submission?.revised_score != null ||
                  String(submission?.teacher_feedback || "").trim().length > 0;
                if (reviewed) continue;

                allItems.push({
                  id: `assessment-${submission.id}`,
                  title: "Submission Perlu Review",
                  message: `${submission.student_name || "Siswa"} mengirim jawaban di ${material.judul || "materi"} (${cls.class_name || "kelas"}).`,
                  createdAt: submission.submitted_at || new Date().toISOString(),
                  href: "/dashboard/teacher/penilaian",
                });
              }
            }
          }
        }
      }

      saveHistory(sortByCreatedAtDesc(allItems));
      loadReadIds();
    } catch (err: any) {
      setError(err?.message || "Gagal memuat notifikasi.");
      setItems(loadHistory());
      loadReadIds();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.peran !== "teacher") return;
    setItems(loadHistory());
    loadReadIds();
    fetchNotifications();
  }, [user?.id, user?.peran]);

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
    if (!user || user.peran !== "teacher") return;
    const timer = window.setInterval(() => {
      fetchNotifications();
    }, pollIntervalMs);
    return () => window.clearInterval(timer);
  }, [user?.id, user?.peran, pollIntervalMs]);

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

  const markAsRead = (id: string) => {
    if (readIds.includes(id)) return;
    saveReadIds([...readIds, id]);
  };

  const markAllAsRead = () => {
    const all = Array.from(new Set([...readIds, ...items.map((i) => i.id)]));
    saveReadIds(all);
  };

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Notifikasi</h1>
        <p className="text-sm text-slate-500">Riwayat notifikasi join request dan submission review tersimpan otomatis.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Total Riwayat</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{items.length}</p>
          </div>
          <div className="teacher-notif-stat-unread rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs text-amber-700">Belum Dibaca</p>
            <p className="mt-1 text-xl font-semibold text-amber-800">{unreadCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <button type="button" className="sage-button-outline inline-flex items-center gap-2" onClick={markAllAsRead}>
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
          <button type="button" className="sage-button-outline inline-flex items-center gap-2" onClick={fetchNotifications} disabled={loading}>
            <FiRefreshCw size={14} /> {loading ? "Memuat..." : "Refresh"}
          </button>
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        {loading && <p className="text-sm text-slate-500">Sinkronisasi notifikasi...</p>}

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
                      <FiClock size={12} /> {toLocalDate(item.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!isRead && (
                      <button type="button" className="sage-button-outline !px-2.5 !py-1.5 text-xs" onClick={() => markAsRead(item.id)}>
                        Dibaca
                      </button>
                    )}
                    <Link href={item.href} className="sage-button !px-2.5 !py-1.5 text-xs">
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
