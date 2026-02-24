"use client";

import { useEffect, useMemo, useState } from "react";

type UserItem = {
  id: string;
  nama_lengkap: string;
  email: string;
  peran: "student" | "teacher" | "superadmin";
};

export default function SuperadminImpersonatePage() {
  const [items, setItems] = useState<UserItem[]>([]);
  const [role, setRole] = useState<"teacher" | "student">("teacher");
  const [q, setQ] = useState("");
  const [password, setPassword] = useState("");
  const [selectedUserID, setSelectedUserID] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("role", role);
      const res = await fetch(`/api/admin/users?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Gagal memuat user");
      const data = await res.json();
      const list = (Array.isArray(data) ? data : []).filter((u: any) => u?.peran !== "superadmin");
      setItems(list);
    } catch (err: any) {
      setError(err?.message || "Gagal memuat user");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [role]);

  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const needle = q.trim().toLowerCase();
    return items.filter((u) => u.nama_lengkap.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle));
  }, [items, q]);

  const handleStart = async () => {
    if (!selectedUserID) {
      setError("Pilih user dulu.");
      return;
    }
    if (!password.trim()) {
      setError("Masukkan password superadmin.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/impersonation/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ user_id: selectedUserID, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Gagal mulai impersonation");
      setMessage("Impersonation aktif. Mengalihkan dashboard...");
      const targetRole = body?.target?.peran;
      if (targetRole === "teacher") {
        window.location.href = "/dashboard/teacher";
      } else {
        window.location.href = "/dashboard/student";
      }
    } catch (err: any) {
      setError(err?.message || "Gagal mulai impersonation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Impersonate User</h1>
        <p className="text-sm text-slate-500">Masuk sebagai teacher/student untuk debug pengalaman user secara langsung.</p>
      </div>

      <div className="sage-panel p-4 grid gap-3 md:grid-cols-3">
        <select className="sage-input" value={role} onChange={(e) => setRole(e.target.value as "teacher" | "student")}>
          <option value="teacher">Teacher</option>
          <option value="student">Student</option>
        </select>
        <input className="sage-input" placeholder="Cari nama/email..." value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="sage-button-outline !py-2" onClick={loadUsers} disabled={loading}>
          Refresh List
        </button>
      </div>

      <div className="sage-panel p-4 space-y-3">
        <p className="text-sm font-medium text-slate-700">Pilih user target</p>
        {loading ? (
          <p className="text-sm text-slate-500">Memuat user...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-500">Tidak ada user.</p>
        ) : (
          <div className="max-h-[360px] overflow-auto rounded-lg border border-slate-200">
            {filtered.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelectedUserID(u.id)}
                className={`w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50 ${selectedUserID === u.id ? "bg-slate-100" : ""}`}
              >
                <p className="text-sm font-medium text-slate-900">{u.nama_lengkap}</p>
                <p className="text-xs text-slate-500">{u.email} · {u.peran}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="sage-panel p-4 grid gap-3 md:grid-cols-[1fr_auto]">
        <input
          type="password"
          className="sage-input"
          placeholder="Konfirmasi password superadmin"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="sage-button !py-2" onClick={handleStart} disabled={submitting || loading}>
          {submitting ? "Memproses..." : "Start Impersonation"}
        </button>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}
    </div>
  );
}
