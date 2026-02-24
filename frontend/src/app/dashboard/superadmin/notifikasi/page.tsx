"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface ProfileRequestItem {
  id: string;
  user_name?: string | null;
  user_role?: string | null;
  request_type?: string | null;
  created_at: string;
}

export default function SuperadminNotificationsPage() {
  const [items, setItems] = useState<ProfileRequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/profile-requests?status=pending", { credentials: "include" });
        const data = res.ok ? await res.json() : [];
        setItems(Array.isArray(data) ? data : []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Notifikasi Superadmin</h1>
        <p className="text-sm text-slate-500">Notifikasi prioritas approval umum pengguna.</p>
      </div>

      {loading ? (
        <div className="sage-panel p-6 text-slate-500">Memuat notifikasi...</div>
      ) : items.length === 0 ? (
        <div className="sage-panel p-6 text-slate-500">Tidak ada notifikasi pending.</div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Approval Pending</p>
              <p className="mt-1 text-sm text-slate-700">
                {item.user_name || "User"} ({item.user_role || "-"}) menunggu approval ({formatRequestType(item.request_type)}).
              </p>
              <p className="mt-1 text-xs text-slate-500">{new Date(item.created_at).toLocaleString("id-ID")}</p>
            </div>
          ))}
        </div>
      )}

      <Link href="/dashboard/superadmin/profile-requests" className="inline-flex text-sm text-[color:var(--sage-700)] hover:underline">
        Buka halaman approval
      </Link>
    </div>
  );
}

function formatRequestType(value?: string | null): string {
  if (!value) return "Profile Change";
  if (value === "teacher_verification") return "Teacher Verification";
  if (value === "profile_change") return "Profile Change";
  return value;
}
