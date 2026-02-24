"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { fetchStudentNotifications, loadStudentNotificationPrefs, StudentNotificationItem } from "@/lib/studentNotifications";

const NOTIF_READ_STORAGE_PREFIX = "read_notifications_";

const formatDate = (value?: string) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
};

export default function StudentNotificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<StudentNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [readIds, setReadIds] = useState<string[]>([]);

  const readStorageKey = useMemo(() => {
    const userKey = user?.id || user?.nama_lengkap || "anon";
    return `${NOTIF_READ_STORAGE_PREFIX}${userKey}`;
  }, [user?.id, user?.nama_lengkap]);

  useEffect(() => {
    if (!user) return;
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
  }, [readStorageKey, user]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      try {
        const prefs = loadStudentNotificationPrefs();
        const nextItems = await fetchStudentNotifications(prefs);
        setItems(nextItems);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const markAllRead = () => {
    if (items.length === 0) return;
    const next = Array.from(new Set([...readIds, ...items.map((item) => item.id)]));
    window.localStorage.setItem(readStorageKey, JSON.stringify(next));
    setReadIds(next);
  };

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Notifikasi Siswa</h1>
        <p className="text-sm text-slate-500">Pusat notifikasi approval, materi, soal, dan hasil review guru.</p>
      </div>

      {items.length > 0 && (
        <div className="flex justify-end">
          <button type="button" className="text-sm text-[color:var(--sage-700)] hover:underline" onClick={markAllRead}>
            Tandai semua sudah dibaca
          </button>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-sm text-slate-600">
          Memuat notifikasi...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-sm text-slate-600">
          Belum ada notifikasi baru.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isRead = readIds.includes(item.id);
            return (
              <div key={item.id} className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${isRead ? "opacity-70" : ""}`}>
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-sm text-slate-700">{item.message}</p>
                <p className="mt-1 text-xs text-slate-500">{formatDate(item.createdAt)}</p>
              </div>
            );
          })}
        </div>
      )}

      <Link href="/dashboard/student/my-classes" className="inline-flex text-sm text-[color:var(--sage-700)] hover:underline">
        Kembali ke kelas saya
      </Link>
    </div>
  );
}
