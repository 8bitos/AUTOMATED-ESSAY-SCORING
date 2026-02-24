"use client";

import { useEffect, useMemo, useState } from "react";

type AnnouncementType = "banner" | "running_text";
type TargetRole = "all" | "student" | "teacher";

type AnnouncementItem = {
  id: string;
  type: AnnouncementType;
  icon: "info" | "warning" | "danger" | "bell";
  title: string;
  content: string;
  target_role: TargetRole;
  is_active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  created_name?: string;
  created_at: string;
  updated_at: string;
};

type EditorState = {
  id?: string;
  type: AnnouncementType;
  icon: "info" | "warning" | "danger" | "bell";
  title: string;
  content: string;
  target_role: TargetRole;
  is_active: boolean;
  starts_at: string;
  ends_at: string;
};

const emptyEditor: EditorState = {
  type: "banner",
  icon: "info",
  title: "",
  content: "",
  target_role: "all",
  is_active: true,
  starts_at: "",
  ends_at: "",
};

const toDatetimeLocalInput = (value?: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${y}-${m}-${dd}T${hh}:${mm}`;
};

const formatDateDMY = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${yy} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const datetimeLocalToDMY = (value?: string) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${yy} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function SuperadminPengumumanPage() {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(emptyEditor);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (typeFilter) params.set("type", typeFilter);
      const res = await fetch(`/api/admin/announcements?${params.toString()}`, { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Gagal memuat pengumuman");
      setItems(Array.isArray(body?.items) ? body.items : []);
    } catch (err: any) {
      setError(err?.message || "Gagal memuat pengumuman");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [q, typeFilter]);

  const totalActive = useMemo(() => items.filter((x) => x.is_active).length, [items]);

  const submit = async () => {
    if (!editor.content.trim()) {
      setError("Isi konten pengumuman terlebih dahulu.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        type: editor.type,
        icon: editor.icon,
        title: editor.title.trim(),
        content: editor.content.trim(),
        target_role: editor.target_role,
        is_active: editor.is_active,
        starts_at: datetimeLocalToDMY(editor.starts_at),
        ends_at: datetimeLocalToDMY(editor.ends_at),
      };
      const isEdit = Boolean(editor.id);
      const url = isEdit ? `/api/admin/announcements/${editor.id}` : "/api/admin/announcements";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Gagal menyimpan pengumuman");
      setEditor(emptyEditor);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Gagal menyimpan pengumuman");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Hapus pengumuman ini?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/announcements/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Gagal menghapus pengumuman");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Gagal menghapus pengumuman");
    }
  };

  const edit = (item: AnnouncementItem) => {
    setEditor({
      id: item.id,
      type: item.type,
      icon: item.icon || "info",
      title: item.title || "",
      content: item.content || "",
      target_role: item.target_role,
      is_active: item.is_active,
      starts_at: toDatetimeLocalInput(item.starts_at),
      ends_at: toDatetimeLocalInput(item.ends_at),
    });
  };

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Pengumuman</h1>
        <p className="text-sm text-slate-500">Buat pengumuman dalam format banner atau running text untuk teacher/student.</p>
      </div>

      <div className="sage-panel p-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Total Pengumuman</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{items.length}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs text-emerald-700">Aktif</p>
          <p className="mt-1 text-xl font-semibold text-emerald-800">{totalActive}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <button className="sage-button-outline !py-2" onClick={() => setEditor(emptyEditor)}>Form Baru</button>
        </div>
      </div>

      <div className="sage-panel p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <select className="sage-input" value={editor.type} onChange={(e) => setEditor((p) => ({ ...p, type: e.target.value as AnnouncementType }))}>
            <option value="banner">Banner</option>
            <option value="running_text">Running Text</option>
          </select>
          <select className="sage-input" value={editor.icon} onChange={(e) => setEditor((p) => ({ ...p, icon: e.target.value as "info" | "warning" | "danger" | "bell" }))}>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="danger">Danger</option>
            <option value="bell">Bell</option>
          </select>
          <select className="sage-input" value={editor.target_role} onChange={(e) => setEditor((p) => ({ ...p, target_role: e.target.value as TargetRole }))}>
            <option value="all">All</option>
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 md:col-span-3">
            <input type="checkbox" checked={editor.is_active} onChange={(e) => setEditor((p) => ({ ...p, is_active: e.target.checked }))} />
            Aktif
          </label>
        </div>
        <input className="sage-input" placeholder="Judul (opsional untuk running text)" value={editor.title} onChange={(e) => setEditor((p) => ({ ...p, title: e.target.value }))} />
        <textarea className="sage-input" rows={4} placeholder="Isi pengumuman" value={editor.content} onChange={(e) => setEditor((p) => ({ ...p, content: e.target.value }))} />
        <div className="grid gap-3 md:grid-cols-2">
          <input type="datetime-local" className="sage-input" value={editor.starts_at} onChange={(e) => setEditor((p) => ({ ...p, starts_at: e.target.value }))} />
          <input type="datetime-local" className="sage-input" value={editor.ends_at} onChange={(e) => setEditor((p) => ({ ...p, ends_at: e.target.value }))} />
        </div>
        <div className="flex items-center gap-2">
          <button className="sage-button !py-2" onClick={submit} disabled={saving}>{saving ? "Menyimpan..." : editor.id ? "Update" : "Publikasikan"}</button>
          {editor.id && (
            <button className="sage-button-outline !py-2" onClick={() => setEditor(emptyEditor)}>
              Batal Edit
            </button>
          )}
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>

      <div className="sage-panel p-4 space-y-3">
        <div className="flex flex-col gap-2 md:flex-row">
          <input className="sage-input flex-1" placeholder="Cari judul/isi..." value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="sage-input md:w-52" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">Semua Tipe</option>
            <option value="banner">Banner</option>
            <option value="running_text">Running Text</option>
          </select>
        </div>
        {loading ? (
          <p className="text-sm text-slate-500">Memuat daftar pengumuman...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada pengumuman.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{item.title || "(Tanpa Judul)"}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                    {item.is_active ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{item.content}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {item.type} · icon: {item.icon} · target: {item.target_role} · by {item.created_name || "-"} · {formatDateDMY(item.created_at)}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  aktif: {item.starts_at ? formatDateDMY(item.starts_at) : "sekarang"} - {item.ends_at ? formatDateDMY(item.ends_at) : "tanpa batas"}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <button className="sage-button-outline !px-3 !py-1.5 text-xs" onClick={() => edit(item)}>Edit</button>
                  <button className="sage-button-outline !px-3 !py-1.5 text-xs text-rose-700 border-rose-200" onClick={() => remove(item.id)}>Hapus</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
