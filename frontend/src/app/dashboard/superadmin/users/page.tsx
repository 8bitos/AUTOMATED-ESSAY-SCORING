"use client";

import { useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiMail, FiRefreshCw, FiSearch, FiShield, FiTrash2, FiUser, FiX } from "react-icons/fi";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import LoadingDialog from "@/components/ui/LoadingDialog";
import NoticeDialog from "@/components/ui/NoticeDialog";

interface AdminUserItem {
  id: string;
  nama_lengkap: string;
  email: string;
  peran: string;
  is_teacher_verified: boolean;
  username?: string | null;
  nomor_identitas?: string | null;
  foto_profil_url?: string | null;
  kelas_tingkat?: string | null;
  mata_pelajaran?: string | null;
  institusi?: string | null;
  last_login_at?: string | null;
  created_at: string;
}

interface AdminUserDetail {
  user: AdminUserItem & {
    tanggal_lahir?: string | null;
    bio_singkat?: string | null;
    no_whatsapp?: string | null;
  };
  total_submissions: number;
  average_score?: number | null;
  reviewed_submissions: number;
  classes_count: number;
}

export default function SuperadminUsersPage() {
  const [items, setItems] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("newest");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (role) params.set("role", role);
      if (q.trim()) params.set("q", q.trim());
      if (sort) params.set("sort", sort);
      const res = await fetch(`/api/admin/users?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Gagal memuat data pengguna");
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || "Gagal memuat data pengguna");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [role, sort]);

  const filteredItems = useMemo(() => {
    if (!q.trim()) return items;
    const needle = q.trim().toLowerCase();
    return items.filter((u) => u.nama_lengkap.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle) || (u.username || "").toLowerCase().includes(needle));
  }, [items, q]);

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Manajemen Pengguna</h1>
        <p className="text-sm text-slate-500">Kelola akun siswa dan guru dari satu panel.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative flex-1 min-w-[220px]">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama, email, username..."
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-300"
            />
          </label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">Semua Role</option>
            <option value="teacher">Guru</option>
            <option value="student">Siswa</option>
            <option value="superadmin">Superadmin</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="newest">Terbaru</option>
            <option value="oldest">Terlama</option>
            <option value="name_asc">Nama A-Z</option>
            <option value="last_login">Login Terakhir</option>
          </select>
          <button className="sage-button-outline !px-3 !py-2 text-xs" onClick={loadUsers}>
            <FiRefreshCw /> Refresh
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-500">Memuat pengguna...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => setSelectedUserId(user.id)}
              className="text-left rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-center gap-3">
                {user.foto_profil_url ? (
                  <img src={user.foto_profil_url} alt={user.nama_lengkap} className="h-12 w-12 rounded-full object-cover border border-slate-200" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-semibold">
                    {(user.nama_lengkap || "U").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{user.nama_lengkap}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-500 truncate">{user.peran}</p>
                    {user.peran === "teacher" && !user.is_teacher_verified && (
                      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        Belum terverifikasi
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-600 flex items-center gap-1 truncate"><FiMail /> {user.email}</p>
              <p className="mt-1 text-[11px] text-slate-400 truncate">@{user.username || user.email.split("@")[0]}</p>
            </button>
          ))}
        </div>
      )}

      <UserDetailModal
        userId={selectedUserId}
        isOpen={!!selectedUserId}
        onClose={() => setSelectedUserId(null)}
        onChanged={loadUsers}
      />
    </div>
  );
}

function UserDetailModal({
  userId,
  isOpen,
  onClose,
  onChanged,
}: {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [notice, setNotice] = useState<{ open: boolean; tone: "success" | "error" | "info"; title: string; message: string }>({
    open: false,
    tone: "info",
    title: "Informasi",
    message: "",
  });
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [form, setForm] = useState({
    nama_lengkap: "",
    email: "",
    peran: "student",
    username: "",
    nomor_identitas: "",
    kelas_tingkat: "",
    mata_pelajaran: "",
    institusi: "",
    no_whatsapp: "",
    bio_singkat: "",
    tanggal_lahir: "",
    is_teacher_verified: true,
  });

  const loadDetail = async () => {
    if (!isOpen || !userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Gagal memuat detail user");
      const data = await res.json();
      setDetail(data);
      setForm({
        nama_lengkap: data?.user?.nama_lengkap || "",
        email: data?.user?.email || "",
        peran: data?.user?.peran || "student",
        username: data?.user?.username || "",
        nomor_identitas: data?.user?.nomor_identitas || "",
        kelas_tingkat: data?.user?.kelas_tingkat || "",
        mata_pelajaran: data?.user?.mata_pelajaran || "",
        institusi: data?.user?.institusi || "",
        no_whatsapp: data?.user?.no_whatsapp || "",
        bio_singkat: data?.user?.bio_singkat || "",
        tanggal_lahir: data?.user?.tanggal_lahir ? String(data.user.tanggal_lahir).slice(0, 10) : "",
        is_teacher_verified: Boolean(data?.user?.is_teacher_verified),
      });
    } catch (err: any) {
      setError(err?.message || "Gagal memuat detail user");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setNotice((prev) => ({ ...prev, open: false }));
    setNewPassword("");
    loadDetail();
  }, [isOpen, userId]);

  const handleResetPassword = async () => {
    if (!userId) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_password: newPassword }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Gagal reset password");
      setNotice({
        open: true,
        tone: "success",
        title: "Berhasil",
        message: "Password berhasil direset.",
      });
      setNewPassword("");
    } catch (err: any) {
      setError(err?.message || "Gagal reset password");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveUser = async () => {
    if (!userId) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Gagal menyimpan perubahan");
      await loadDetail();
      await onChanged();
      setNotice({
        open: true,
        tone: "success",
        title: "Berhasil",
        message: "Data pengguna berhasil diperbarui.",
      });
    } catch (err: any) {
      setError(err?.message || "Gagal menyimpan perubahan");
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyTeacher = async () => {
    if (!userId) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/verify-teacher`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Gagal memverifikasi guru");
      await loadDetail();
      await onChanged();
      setNotice({
        open: true,
        tone: "success",
        title: "Berhasil",
        message: "Akun guru sudah di-ACC dan sekarang terverifikasi.",
      });
    } catch (err: any) {
      setError(err?.message || "Gagal memverifikasi guru");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userId) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Gagal menghapus user");
      setConfirmDeleteOpen(false);
      await onChanged();
      onClose();
      setNotice({
        open: true,
        tone: "success",
        title: "Berhasil",
        message: "Akun pengguna berhasil dihapus.",
      });
    } catch (err: any) {
      setError(err?.message || "Gagal menghapus user");
      setSaving(false);
    }
  };

  if (!isOpen || !userId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/45 p-4 flex items-center justify-center">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto relative">
        <button type="button" onClick={onClose} className="absolute right-3 top-3 rounded-md p-1 text-slate-500 hover:bg-slate-100"><FiX /></button>
        <h3 className="text-lg font-semibold text-slate-900">Detail Pengguna</h3>

        {loading ? (
          <p className="text-sm text-slate-500 mt-4">Memuat detail...</p>
        ) : detail ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm">
              <DataRow label="Nama" value={form.nama_lengkap} />
              <DataRow label="Role" value={form.peran} />
              <DataRow label="Email" value={form.email} />
              <DataRow label="Username" value={form.username || form.email.split("@")[0]} />
              <DataRow label="NIS/NIP" value={form.nomor_identitas || "-"} />
              <DataRow label="Kelas" value={form.kelas_tingkat || "-"} />
              <DataRow label="Mapel" value={form.mata_pelajaran || "-"} />
              <DataRow label="Institusi" value={form.institusi || "-"} />
              {form.peran === "teacher" && (
                <DataRow label="Verifikasi Guru" value={form.is_teacher_verified ? "Terverifikasi" : "Belum terverifikasi"} />
              )}
              <DataRow label="Lahir" value={formatDate(detail.user.tanggal_lahir)} />
              <DataRow label="Login Terakhir" value={formatDateTime(detail.user.last_login_at)} />
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label={detail.user.peran === "teacher" ? "Total Materi" : "Total Submisi"} value={String(detail.total_submissions || 0)} />
                <MiniStat label={detail.user.peran === "teacher" ? "Kelas Diampu" : "Kelas Diikuti"} value={String(detail.classes_count || 0)} />
                <MiniStat label="Rata-rata Nilai" value={detail.average_score != null ? detail.average_score.toFixed(2) : "-"} />
                <MiniStat label="Direview Guru" value={String(detail.reviewed_submissions || 0)} />
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
                <p className="text-sm font-semibold text-slate-900">Edit Informasi User</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className="sage-input" placeholder="Nama lengkap" value={form.nama_lengkap} onChange={(e) => setForm((p) => ({ ...p, nama_lengkap: e.target.value }))} />
                  <input className="sage-input" placeholder="Email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                  <select className="sage-input" value={form.peran} onChange={(e) => setForm((p) => ({ ...p, peran: e.target.value }))}>
                    <option value="student">student</option>
                    <option value="teacher">teacher</option>
                    <option value="superadmin">superadmin</option>
                  </select>
                  <input className="sage-input" placeholder="Username" value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} />
                  <input className="sage-input" placeholder="Nomor identitas" value={form.nomor_identitas} onChange={(e) => setForm((p) => ({ ...p, nomor_identitas: e.target.value }))} />
                  <input className="sage-input" placeholder="Kelas tingkat" value={form.kelas_tingkat} onChange={(e) => setForm((p) => ({ ...p, kelas_tingkat: e.target.value }))} />
                  <input className="sage-input" placeholder="Mata pelajaran" value={form.mata_pelajaran} onChange={(e) => setForm((p) => ({ ...p, mata_pelajaran: e.target.value }))} />
                  <input className="sage-input" placeholder="Institusi" value={form.institusi} onChange={(e) => setForm((p) => ({ ...p, institusi: e.target.value }))} />
                  <input className="sage-input" placeholder="No WhatsApp" value={form.no_whatsapp} onChange={(e) => setForm((p) => ({ ...p, no_whatsapp: e.target.value }))} />
                  <input type="date" className="sage-input" value={form.tanggal_lahir} onChange={(e) => setForm((p) => ({ ...p, tanggal_lahir: e.target.value }))} />
                  <input className="sage-input sm:col-span-2" placeholder="Bio singkat" value={form.bio_singkat} onChange={(e) => setForm((p) => ({ ...p, bio_singkat: e.target.value }))} />
                </div>
                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={form.is_teacher_verified}
                      onChange={(e) => setForm((p) => ({ ...p, is_teacher_verified: e.target.checked }))}
                      disabled={form.peran !== "teacher"}
                    />
                    Guru terverifikasi
                  </label>
                  <button type="button" className="sage-button-outline" onClick={handleSaveUser}>
                    <FiShield /> Simpan Perubahan
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                <p className="text-sm font-semibold text-slate-900">Reset Password</p>
                <input
                  type="password"
                  className="sage-input"
                  placeholder="Password baru (min 6 karakter)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button type="button" className="sage-button" onClick={handleResetPassword}>Reset Password</button>
              </div>

              {detail.user.peran === "teacher" && !detail.user.is_teacher_verified && (
                <button type="button" className="sage-button w-full justify-center" onClick={handleVerifyTeacher}>
                  <FiCheckCircle /> ACC Guru (Verifikasi)
                </button>
              )}

              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                onClick={() => setConfirmDeleteOpen(true)}
              >
                <FiTrash2 /> Hapus Akun
              </button>

              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500 mt-4">Data tidak tersedia.</p>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        title="Hapus Akun"
        message="Yakin ingin menghapus akun ini? Tindakan ini permanen."
        confirmLabel="Ya, hapus akun"
        cancelLabel="Batal"
        danger
        loading={saving}
        onConfirm={handleDeleteUser}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
      <LoadingDialog isOpen={saving} message="Memproses perubahan pengguna..." />
      <NoticeDialog
        isOpen={notice.open}
        title={notice.title}
        message={notice.message}
        tone={notice.tone}
        onClose={() => setNotice((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <p className="text-slate-500">{label}</p>
      <p className="font-medium text-slate-900 break-words">{value}</p>
    </div>
  );
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(d);
}

function formatDateTime(value?: string | null): string {
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
}
