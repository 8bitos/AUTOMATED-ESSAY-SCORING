"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiBell, FiFilter } from "react-icons/fi";

interface ProfileRequest {
  id: string;
  request_type?: string;
  status?: string;
  reason?: string | null;
  created_at?: string;
  reviewed_at?: string | null;
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
  teacher_name?: string;
  materials?: Material[];
}

type AnnouncementType = "all" | "system" | "approval" | "material" | "feedback";

interface AnnouncementItem {
  id: string;
  type: Exclude<AnnouncementType, "all">;
  title: string;
  message: string;
  createdAt: string;
  href?: string;
}

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
  }).format(d);
};

export default function StudentAnnouncementsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<AnnouncementType>("all");
  const [items, setItems] = useState<AnnouncementItem[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [profileRes, classesRes] = await Promise.all([
          fetch("/api/profile-change-requests", { credentials: "include" }),
          fetch("/api/student/my-classes", { credentials: "include" }),
        ]);

        const profileData = profileRes.ok ? ((await profileRes.json()) as ProfileRequest[]) : [];
        const classesData = classesRes.ok ? ((await classesRes.json()) as ClassItem[]) : [];

        const feed: AnnouncementItem[] = [
          {
            id: "sys-welcome",
            type: "system",
            title: "Panduan LMS Student",
            message: "Gunakan menu Materi & Tugas untuk melihat soal terbaru, dan menu Nilai untuk pantau hasil review guru.",
            createdAt: new Date().toISOString(),
            href: "/dashboard/student/help",
          },
          {
            id: "sys-notif",
            type: "system",
            title: "Atur Preferensi Notifikasi",
            message: "Kamu bisa menyalakan/mematikan notifikasi ACC kelas, invite kelas, materi baru, dan feedback guru di menu settings.",
            createdAt: new Date().toISOString(),
            href: "/dashboard/student/settings/notifications",
          },
        ];

        (Array.isArray(profileData) ? profileData : []).forEach((req) => {
          const ts = req.reviewed_at || req.created_at || new Date().toISOString();
          const title =
            req.status === "approved"
              ? "Approval Disetujui"
              : req.status === "rejected"
                ? "Approval Ditolak"
                : "Approval Diproses";
          feed.push({
            id: `appr-${req.id}-${ts}`,
            type: "approval",
            title,
            message:
              req.status === "rejected" && req.reason
                ? `Permintaan ${req.request_type || "approval"} ditolak: ${req.reason}`
                : `Status request ${req.request_type || "approval"}: ${req.status || "pending"}.`,
            createdAt: ts,
            href: "/dashboard/student/notifikasi",
          });
        });

        (Array.isArray(classesData) ? classesData : []).forEach((cls) => {
          const materials = Array.isArray(cls.materials) ? cls.materials : [];
          materials.forEach((material) => {
            const materialTS = material.updated_at || material.created_at;
            if (materialTS) {
              feed.push({
                id: `mat-${material.id}-${materialTS}`,
                type: "material",
                title: "Update Materi",
                message: `${material.judul} di kelas ${cls.class_name} memiliki pembaruan.`,
                createdAt: materialTS,
                href: `/dashboard/student/classes/${cls.id}/materials/${material.id}`,
              });
            }

            const questions = Array.isArray(material.essay_questions) ? material.essay_questions : [];
            const hasFeedback = questions.some(
              (q) => q.revised_score != null || String(q.teacher_feedback || "").trim().length > 0,
            );
            if (hasFeedback && materialTS) {
              feed.push({
                id: `fb-${material.id}-${materialTS}`,
                type: "feedback",
                title: "Feedback Guru Tersedia",
                message: `Jawaban pada materi ${material.judul} sudah direview guru.`,
                createdAt: materialTS,
                href: `/dashboard/student/classes/${cls.id}/materials/${material.id}`,
              });
            }
          });
        });

        feed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setItems(feed.slice(0, 100));
      } catch (err: any) {
        setError(err?.message || "Gagal memuat pengumuman.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredItems = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((item) => item.type === filter);
  }, [filter, items]);

  const badgeClass = (type: AnnouncementItem["type"]) => {
    if (type === "system") return "bg-slate-200 text-slate-700";
    if (type === "approval") return "bg-indigo-100 text-indigo-700";
    if (type === "material") return "bg-sky-100 text-sky-700";
    return "bg-emerald-100 text-emerald-700";
  };

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Pengumuman</h1>
        <p className="text-sm text-slate-500">Feed pengumuman sistem, update materi, approval, dan feedback terbaru.</p>
      </div>

      <section className="sage-panel p-4">
        <label className="relative block max-w-xs">
          <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-500)]" />
          <select value={filter} onChange={(e) => setFilter(e.target.value as AnnouncementType)} className="sage-input pl-10">
            <option value="all">Semua Tipe</option>
            <option value="system">Sistem</option>
            <option value="approval">Approval</option>
            <option value="material">Materi</option>
            <option value="feedback">Feedback</option>
          </select>
        </label>
      </section>

      <section className="space-y-3">
        {loading ? (
          <div className="sage-panel p-6 text-slate-500">Memuat pengumuman...</div>
        ) : error ? (
          <div className="sage-panel p-6 text-red-600">{error}</div>
        ) : filteredItems.length === 0 ? (
          <div className="sage-panel p-6 text-slate-500">Belum ada pengumuman untuk filter ini.</div>
        ) : (
          filteredItems.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-700">{item.message}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(item.type)}`}>{item.type}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-slate-500">{formatDate(item.createdAt)}</p>
                {item.href && (
                  <Link href={item.href} className="text-xs text-[color:var(--sage-700)] hover:underline">
                    Buka detail
                  </Link>
                )}
              </div>
            </article>
          ))
        )}
      </section>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
          <FiBell />
          Info
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Pengumuman ini otomatis diambil dari aktivitas akunmu. Untuk notifikasi real-time, gunakan ikon lonceng di topbar.
        </p>
      </div>
    </div>
  );
}
