"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiCalendar, FiChevronLeft, FiChevronRight } from "react-icons/fi";

interface PendingClass {
  class_id: string;
  class_name: string;
  requested_at: string;
}

interface EssayQuestion {
  id: string;
  submission_id?: string;
  revised_score?: number;
  teacher_feedback?: string;
}

interface Material {
  id: string;
  judul: string;
  created_at?: string;
  updated_at?: string;
  essay_questions?: EssayQuestion[];
}

interface ClassItem {
  id: string;
  class_name: string;
  materials?: Material[];
}

interface ProfileRequest {
  id: string;
  status?: string;
  request_type?: string;
  created_at?: string;
  reviewed_at?: string;
}

interface CalendarEventItem {
  id: string;
  date: string; // YYYY-MM-DD
  datetime: string;
  title: string;
  description: string;
  href?: string;
  type: "approval" | "material" | "feedback" | "pending";
}

const toDateKey = (iso?: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

const formatDateLabel = (value?: string) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

const getMonthDays = (monthDate: Date) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  const startOffset = (firstDay.getDay() + 6) % 7; // monday based
  const cells: Array<{ date: Date; inCurrentMonth: boolean }> = [];

  for (let i = 0; i < startOffset; i += 1) {
    const d = new Date(year, month, 1 - (startOffset - i));
    cells.push({ date: d, inCurrentMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: new Date(year, month, day), inCurrentMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const prev = cells[cells.length - 1];
    const d = new Date(prev.date);
    d.setDate(prev.date.getDate() + 1);
    cells.push({ date: d, inCurrentMonth: false });
  }
  return cells;
};

export default function StudentCalendarPage() {
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date().toISOString()));

  useEffect(() => {
    const loadEvents = async () => {
      setLoading(true);
      setError(null);
      try {
        const [classesRes, pendingRes, profileRes] = await Promise.all([
          fetch("/api/student/my-classes", { credentials: "include" }),
          fetch("/api/student/pending-classes", { credentials: "include" }),
          fetch("/api/profile-change-requests", { credentials: "include" }),
        ]);

        if (!classesRes.ok) throw new Error("Gagal memuat data kelas untuk kalender.");
        const classesData = (await classesRes.json()) as ClassItem[];
        const pendingData = pendingRes.ok ? ((await pendingRes.json()) as PendingClass[]) : [];
        const profileData = profileRes.ok ? ((await profileRes.json()) as ProfileRequest[]) : [];

        const items: CalendarEventItem[] = [];

        (Array.isArray(classesData) ? classesData : []).forEach((cls) => {
          const materials = Array.isArray(cls.materials) ? cls.materials : [];
          materials.forEach((mat) => {
            const materialDate = mat.updated_at || mat.created_at;
            const materialDateKey = toDateKey(materialDate);
            if (materialDateKey) {
              items.push({
                id: `mat-${mat.id}-${materialDate}`,
                date: materialDateKey,
                datetime: materialDate || "",
                title: "Update Materi",
                description: `${mat.judul} (${cls.class_name}) diperbarui.`,
                href: `/dashboard/student/classes/${cls.id}/materials/${mat.id}`,
                type: "material",
              });
            }

            const questions = Array.isArray(mat.essay_questions) ? mat.essay_questions : [];
            const hasReviewed = questions.some(
              (q) => q.revised_score != null || String(q.teacher_feedback || "").trim().length > 0,
            );
            if (hasReviewed && materialDateKey) {
              items.push({
                id: `fb-${mat.id}-${materialDate}`,
                date: materialDateKey,
                datetime: materialDate || "",
                title: "Feedback Guru",
                description: `Ada review/feedback terbaru untuk ${mat.judul}.`,
                href: `/dashboard/student/classes/${cls.id}/materials/${mat.id}`,
                type: "feedback",
              });
            }
          });
        });

        (Array.isArray(pendingData) ? pendingData : []).forEach((pending) => {
          const dateKey = toDateKey(pending.requested_at);
          if (!dateKey) return;
          items.push({
            id: `pending-${pending.class_id}-${pending.requested_at}`,
            date: dateKey,
            datetime: pending.requested_at,
            title: "Request Join Kelas",
            description: `Permintaan gabung ke ${pending.class_name} sedang menunggu ACC guru.`,
            href: "/dashboard/student/my-classes",
            type: "pending",
          });
        });

        (Array.isArray(profileData) ? profileData : []).forEach((req) => {
          const timestamp = req.reviewed_at || req.created_at;
          const dateKey = toDateKey(timestamp);
          if (!dateKey) return;
          const label =
            req.status === "approved"
              ? "Approval Disetujui"
              : req.status === "rejected"
                ? "Approval Ditolak"
                : "Approval Diproses";
          items.push({
            id: `approval-${req.id}-${timestamp}`,
            date: dateKey,
            datetime: timestamp || "",
            title: label,
            description: `Status approval ${req.request_type || "perubahan profil"}: ${req.status || "-"}.`,
            href: "/dashboard/student/notifikasi",
            type: "approval",
          });
        });

        items.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
        setEvents(items);
      } catch (err: any) {
        setError(err?.message || "Terjadi kesalahan saat memuat kalender.");
      } finally {
        setLoading(false);
      }
    };
    loadEvents();
  }, []);

  const dayCells = useMemo(() => getMonthDays(monthCursor), [monthCursor]);
  const eventCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    events.forEach((item) => {
      map[item.date] = (map[item.date] || 0) + 1;
    });
    return map;
  }, [events]);

  const selectedEvents = useMemo(() => {
    return events
      .filter((item) => item.date === selectedDate)
      .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  }, [events, selectedDate]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return events
      .filter((item) => new Date(item.datetime).getTime() >= now.getTime())
      .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
      .slice(0, 8);
  }, [events]);

  const monthLabel = new Intl.DateTimeFormat("id-ID", { month: "2-digit", year: "2-digit" }).format(monthCursor);
  const typeBadgeClass = (type: CalendarEventItem["type"]) => {
    if (type === "approval") return "bg-indigo-100 text-indigo-700";
    if (type === "material") return "bg-sky-100 text-sky-700";
    if (type === "feedback") return "bg-emerald-100 text-emerald-700";
    return "bg-amber-100 text-amber-700";
  };

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Kalender Akademik</h1>
        <p className="text-sm text-slate-500">Ringkasan jadwal belajar, deadline tugas, dan aktivitas kelas.</p>
      </div>

      {loading ? (
        <div className="sage-panel p-6 text-slate-500">Memuat kalender...</div>
      ) : error ? (
        <div className="sage-panel p-6 text-red-600">{error}</div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr] items-start">
          <section className="sage-panel p-4">
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
                aria-label="Bulan sebelumnya"
              >
                <FiChevronLeft />
              </button>
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                <FiCalendar />
                {monthLabel}
              </p>
              <button
                type="button"
                onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
                aria-label="Bulan berikutnya"
              >
                <FiChevronRight />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-2 text-center text-xs text-slate-500">
              {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
                <div key={d} className="py-1 font-medium">
                  {d}
                </div>
              ))}
              {dayCells.map((cell) => {
                const dateKey = toDateKey(cell.date.toISOString());
                const count = eventCountMap[dateKey] || 0;
                const isSelected = dateKey === selectedDate;
                return (
                  <button
                    key={`${dateKey}-${cell.inCurrentMonth ? "in" : "out"}`}
                    type="button"
                    onClick={() => setSelectedDate(dateKey)}
                    className={`relative rounded-lg border px-1 py-2 text-sm transition ${
                      isSelected
                        ? "border-slate-900 bg-slate-900 text-white"
                        : cell.inCurrentMonth
                          ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          : "border-slate-100 bg-slate-50 text-slate-400"
                    }`}
                  >
                    {cell.date.getDate()}
                    {count > 0 && (
                      <span
                        className={`absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] ${
                          isSelected ? "bg-red-500 text-white" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="sage-panel p-4">
              <h2 className="text-sm font-semibold text-slate-900">Agenda Tanggal Terpilih</h2>
              <p className="mt-1 text-xs text-slate-500">{selectedDate}</p>
              <div className="mt-3 space-y-3">
                {selectedEvents.length === 0 ? (
                  <p className="text-sm text-slate-500">Tidak ada agenda pada tanggal ini.</p>
                ) : (
                  selectedEvents.map((event) => (
                    <div key={event.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-slate-900">{event.title}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${typeBadgeClass(event.type)}`}>
                          {event.type}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">{event.description}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{formatDateLabel(event.datetime)}</p>
                      {event.href && (
                        <Link href={event.href} className="mt-2 inline-flex text-xs text-[color:var(--sage-700)] hover:underline">
                          Buka detail
                        </Link>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="sage-panel p-4">
              <h2 className="text-sm font-semibold text-slate-900">Agenda Mendatang</h2>
              <div className="mt-3 space-y-2">
                {upcomingEvents.length === 0 ? (
                  <p className="text-sm text-slate-500">Belum ada agenda mendatang.</p>
                ) : (
                  upcomingEvents.map((event) => (
                    <div key={`upcoming-${event.id}`} className="rounded-lg border border-slate-200 p-2">
                      <p className="text-xs font-medium text-slate-900">{event.title}</p>
                      <p className="text-[11px] text-slate-500">{formatDateLabel(event.datetime)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
