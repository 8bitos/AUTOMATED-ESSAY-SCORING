"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiCheckCircle, FiMail, FiRefreshCw, FiSearch, FiShield, FiTrash2, FiX } from "react-icons/fi";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import LoadingDialog from "@/components/ui/LoadingDialog";
import NoticeDialog from "@/components/ui/NoticeDialog";
import UserDetailModal from "./UserDetailModal";

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
  tanggal_lahir?: string | null;
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

type UserViewMode = "cards" | "spreadsheet";

type SpreadsheetDraft = {
  nama_lengkap: string;
  email: string;
  peran: string;
  username: string;
  nomor_identitas: string;
  kelas_tingkat: string;
  mata_pelajaran: string;
  institusi: string;
  tanggal_lahir: string;
  is_teacher_verified: boolean;
};

type SpreadsheetColKey =
  | "nama_lengkap"
  | "email"
  | "peran"
  | "username"
  | "nomor_identitas"
  | "kelas_tingkat"
  | "mata_pelajaran"
  | "institusi"
  | "tanggal_lahir"
  | "is_teacher_verified";

type SheetSortKey =
  | "created_at"
  | "last_login_at"
  | "nama_lengkap"
  | "email"
  | "peran"
  | "username"
  | "nomor_identitas"
  | "kelas_tingkat"
  | "mata_pelajaran"
  | "institusi";

const SPREADSHEET_COL_ORDER: SpreadsheetColKey[] = [
  "nama_lengkap",
  "email",
  "peran",
  "username",
  "nomor_identitas",
  "kelas_tingkat",
  "mata_pelajaran",
  "institusi",
  "tanggal_lahir",
  "is_teacher_verified",
];

export default function SuperadminUsersPage() {
  const [items, setItems] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("newest");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<UserViewMode>("cards");
  const [sheetById, setSheetById] = useState<Record<string, SpreadsheetDraft>>({});
  const [dirtyById, setDirtyById] = useState<Record<string, boolean>>({});
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [showSuperadmin, setShowSuperadmin] = useState(false);
  const [sheetSortKey, setSheetSortKey] = useState<SheetSortKey>("created_at");
  const [sheetSortDir, setSheetSortDir] = useState<"asc" | "desc">("desc");
  const spreadsheetCellRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});

  const toDraft = (user: AdminUserItem): SpreadsheetDraft => ({
    nama_lengkap: user.nama_lengkap || "",
    email: user.email || "",
    peran: user.peran || "student",
    username: user.username || "",
    nomor_identitas: user.nomor_identitas || "",
    kelas_tingkat: user.kelas_tingkat || "",
    mata_pelajaran: user.mata_pelajaran || "",
    institusi: user.institusi || "",
    tanggal_lahir: user.tanggal_lahir ? String(user.tanggal_lahir).slice(0, 10) : "",
    is_teacher_verified: Boolean(user.is_teacher_verified),
  });

  const loadUsers = useCallback(async () => {
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
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Gagal memuat data pengguna"));
    } finally {
      setLoading(false);
    }
  }, [role, q, sort]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredItems = useMemo(() => {
    if (!q.trim()) return items;
    const needle = q.trim().toLowerCase();
    return items.filter((u) => u.nama_lengkap.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle) || (u.username || "").toLowerCase().includes(needle));
  }, [items, q]);

  const visibleItems = useMemo(
    () => (showSuperadmin ? filteredItems : filteredItems.filter((u) => u.peran !== "superadmin")),
    [filteredItems, showSuperadmin]
  );

  const spreadsheetItems = useMemo(() => {
    const rows = [...visibleItems];
    const direction = sheetSortDir === "asc" ? 1 : -1;
    const readText = (value?: string | null) => (value || "").toLowerCase();
    const readDate = (value?: string | null) => {
      if (!value) return 0;
      const stamp = new Date(value).getTime();
      return Number.isNaN(stamp) ? 0 : stamp;
    };

    rows.sort((a, b) => {
      switch (sheetSortKey) {
        case "created_at":
          return (readDate(a.created_at) - readDate(b.created_at)) * direction;
        case "last_login_at":
          return (readDate(a.last_login_at) - readDate(b.last_login_at)) * direction;
        case "nama_lengkap":
          return readText(a.nama_lengkap).localeCompare(readText(b.nama_lengkap)) * direction;
        case "email":
          return readText(a.email).localeCompare(readText(b.email)) * direction;
        case "peran":
          return readText(a.peran).localeCompare(readText(b.peran)) * direction;
        case "username":
          return readText(a.username).localeCompare(readText(b.username)) * direction;
        case "nomor_identitas":
          return readText(a.nomor_identitas).localeCompare(readText(b.nomor_identitas)) * direction;
        case "kelas_tingkat":
          return readText(a.kelas_tingkat).localeCompare(readText(b.kelas_tingkat)) * direction;
        case "mata_pelajaran":
          return readText(a.mata_pelajaran).localeCompare(readText(b.mata_pelajaran)) * direction;
        case "institusi":
          return readText(a.institusi).localeCompare(readText(b.institusi)) * direction;
        default:
          return 0;
      }
    });

    return rows;
  }, [visibleItems, sheetSortDir, sheetSortKey]);

  useEffect(() => {
    const next: Record<string, SpreadsheetDraft> = {};
    items.forEach((user) => {
      next[user.id] = toDraft(user);
    });
    setSheetById(next);
    setDirtyById({});
  }, [items]);

  const updateDraft = (userId: string, key: keyof SpreadsheetDraft, value: string | boolean) => {
    setSheetById((prev) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || ({} as SpreadsheetDraft)),
        [key]: value,
      },
    }));
    setDirtyById((prev) => ({ ...prev, [userId]: true }));
  };

  const saveRow = async (userId: string) => {
    const draft = sheetById[userId];
    if (!draft) return;
    setError(null);
    setSavingRowId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Gagal menyimpan baris pengguna");
      setItems((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                nama_lengkap: draft.nama_lengkap,
                email: draft.email,
                peran: draft.peran,
                username: draft.username || null,
                nomor_identitas: draft.nomor_identitas || null,
                kelas_tingkat: draft.kelas_tingkat || null,
                mata_pelajaran: draft.mata_pelajaran || null,
                institusi: draft.institusi || null,
                tanggal_lahir: draft.tanggal_lahir || null,
                is_teacher_verified: draft.is_teacher_verified,
              }
            : u
        )
      );
      setDirtyById((prev) => ({ ...prev, [userId]: false }));
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Gagal menyimpan baris pengguna"));
    } finally {
      setSavingRowId(null);
    }
  };

  const saveAllRows = async () => {
    const dirtyIds = Object.keys(dirtyById).filter((id) => dirtyById[id]);
    if (dirtyIds.length === 0) return;
    setError(null);
    setSavingAll(true);
    for (const id of dirtyIds) {
      // eslint-disable-next-line no-await-in-loop
      await saveRow(id);
    }
    setSavingAll(false);
  };

  const isCellLocked = (draft: SpreadsheetDraft, key: SpreadsheetColKey): boolean => {
    if (key === "is_teacher_verified") return draft.peran !== "teacher";
    if (draft.peran === "teacher") return key === "kelas_tingkat";
    if (draft.peran === "student") return key === "mata_pelajaran";
    if (draft.peran === "superadmin") return key === "kelas_tingkat" || key === "mata_pelajaran";
    return false;
  };

  const focusSheetCell = (userId: string, col: SpreadsheetColKey) => {
    const key = `${userId}:${col}`;
    const node = spreadsheetCellRefs.current[key];
    if (node) node.focus();
  };

  const handleSpreadsheetKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    userId: string,
    col: SpreadsheetColKey
  ) => {
    const rowIdx = spreadsheetItems.findIndex((item) => item.id === userId);
    const colIdx = SPREADSHEET_COL_ORDER.indexOf(col);
    if (rowIdx < 0 || colIdx < 0) return;

    const move = (nextRow: number, nextCol: number) => {
      const boundedRow = Math.max(0, Math.min(spreadsheetItems.length - 1, nextRow));
      let cursorCol = Math.max(0, Math.min(SPREADSHEET_COL_ORDER.length - 1, nextCol));
      const direction = nextCol >= colIdx ? 1 : -1;
      const targetUser = spreadsheetItems[boundedRow];
      if (!targetUser) return;

      let guard = 0;
      while (guard < SPREADSHEET_COL_ORDER.length) {
        const targetCol = SPREADSHEET_COL_ORDER[cursorCol];
        const targetDraft = sheetById[targetUser.id] || toDraft(targetUser);
        if (targetCol && !isCellLocked(targetDraft, targetCol)) {
          focusSheetCell(targetUser.id, targetCol);
          return;
        }
        const nextCursor = cursorCol + direction;
        if (nextCursor < 0 || nextCursor >= SPREADSHEET_COL_ORDER.length) return;
        cursorCol = nextCursor;
        guard += 1;
      }
    };

    if (e.key === "Enter") {
      e.preventDefault();
      void saveRow(userId);
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      move(rowIdx, colIdx + 1);
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      move(rowIdx, colIdx - 1);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(rowIdx + 1, colIdx);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      move(rowIdx - 1, colIdx);
    }
  };

  const toggleSheetSort = (key: SheetSortKey) => {
    if (sheetSortKey === key) {
      setSheetSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSheetSortKey(key);
    setSheetSortDir("asc");
  };

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
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={showSuperadmin}
              onChange={(e) => setShowSuperadmin(e.target.checked)}
            />
            Tampilkan superadmin
          </label>
          <div className="ml-auto inline-flex rounded-lg border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${viewMode === "cards" ? "bg-slate-900 text-white" : "text-slate-700"}`}
            >
              Card
            </button>
            <button
              type="button"
              onClick={() => setViewMode("spreadsheet")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${viewMode === "spreadsheet" ? "bg-slate-900 text-white" : "text-slate-700"}`}
            >
              Spreadsheet
            </button>
          </div>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-500">Memuat pengguna...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && viewMode === "cards" && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((user) => (
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

      {!loading && viewMode === "spreadsheet" && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">Mode edit cepat pengguna (mirip spreadsheet).</p>
            <button
              type="button"
              className="sage-button-outline !px-3 !py-2 text-xs disabled:opacity-60"
              onClick={saveAllRows}
              disabled={savingAll || Object.values(dirtyById).every((v) => !v)}
            >
              {savingAll ? "Menyimpan..." : "Simpan Semua Perubahan"}
            </button>
          </div>
          <div className="overflow-auto rounded-lg border border-slate-200">
            <table className="min-w-[1760px] w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-2 py-2 text-left w-[108px]">
                    <button type="button" className="font-semibold hover:text-slate-900" onClick={() => toggleSheetSort("created_at")}>Dibuat</button>
                  </th>
                  <th className="px-2 py-2 text-left w-[128px]">
                    <button type="button" className="font-semibold hover:text-slate-900" onClick={() => toggleSheetSort("last_login_at")}>Login Terakhir</button>
                  </th>
                  <th className="px-2 py-2 text-left w-[190px]">
                    <button type="button" className="font-semibold hover:text-slate-900" onClick={() => toggleSheetSort("nama_lengkap")}>Nama</button>
                  </th>
                  <th className="px-2 py-2 text-left w-[230px]">
                    <button type="button" className="font-semibold hover:text-slate-900" onClick={() => toggleSheetSort("email")}>Email</button>
                  </th>
                  <th className="px-2 py-2 text-left w-[160px]">
                    <button type="button" className="font-semibold hover:text-slate-900" onClick={() => toggleSheetSort("peran")}>Role</button>
                  </th>
                  <th className="px-2 py-2 text-left w-[170px]">
                    <button type="button" className="font-semibold hover:text-slate-900" onClick={() => toggleSheetSort("username")}>Username</button>
                  </th>
                  <th className="px-2 py-2 text-left w-[160px]">
                    <button type="button" className="font-semibold hover:text-slate-900" onClick={() => toggleSheetSort("nomor_identitas")}>NIS/NIP</button>
                  </th>
                  <th className="px-2 py-2 text-left w-[128px]">
                    <button type="button" className="font-semibold hover:text-slate-900" onClick={() => toggleSheetSort("kelas_tingkat")}>Kelas</button>
                  </th>
                  <th className="px-2 py-2 text-left w-[172px]">
                    <button type="button" className="font-semibold hover:text-slate-900" onClick={() => toggleSheetSort("mata_pelajaran")}>Mapel</button>
                  </th>
                  <th className="px-2 py-2 text-left w-[172px]">
                    <button type="button" className="font-semibold hover:text-slate-900" onClick={() => toggleSheetSort("institusi")}>Institusi</button>
                  </th>
                  <th className="px-2 py-2 text-left w-[136px]">Tanggal Lahir</th>
                  <th className="px-2 py-2 text-left w-[124px]">Verif Guru</th>
                  <th className="px-2 py-2 text-right w-[150px]">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {spreadsheetItems.map((user) => {
                  const draft = sheetById[user.id] || toDraft(user);
                  const isTeacher = draft.peran === "teacher";
                  const isStudent = draft.peran === "student";
                  const isDirty = !!dirtyById[user.id];
                  const isSaving = savingRowId === user.id;
                  const setCellRef = (col: SpreadsheetColKey) => (node: HTMLInputElement | HTMLSelectElement | null) => {
                    spreadsheetCellRefs.current[`${user.id}:${col}`] = node;
                  };
                  return (
                    <tr key={user.id} className="border-t border-slate-200 align-top">
                      <td className="p-2 align-middle text-[11px] text-slate-500">{formatDate(user.created_at)}</td>
                      <td className="p-2 align-middle text-[11px] text-slate-500">{formatDateTime(user.last_login_at)}</td>
                      <td className="p-2">
                        <input
                          ref={setCellRef("nama_lengkap")}
                          className="sage-input !py-1.5 w-full min-w-[180px]"
                          value={draft.nama_lengkap}
                          onChange={(e) => updateDraft(user.id, "nama_lengkap", e.target.value)}
                          onKeyDown={(e) => handleSpreadsheetKeyDown(e, user.id, "nama_lengkap")}
                          disabled={isCellLocked(draft, "nama_lengkap")}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          ref={setCellRef("email")}
                          className="sage-input !py-1.5 w-full min-w-[220px]"
                          value={draft.email}
                          onChange={(e) => updateDraft(user.id, "email", e.target.value)}
                          onKeyDown={(e) => handleSpreadsheetKeyDown(e, user.id, "email")}
                          disabled={isCellLocked(draft, "email")}
                        />
                      </td>
                      <td className="p-2">
                        <select
                          ref={setCellRef("peran")}
                          className="sage-input !py-1.5 w-full min-w-[150px]"
                          value={draft.peran}
                          onChange={(e) => updateDraft(user.id, "peran", e.target.value)}
                          onKeyDown={(e) => handleSpreadsheetKeyDown(e, user.id, "peran")}
                          disabled={isCellLocked(draft, "peran")}
                        >
                          <option value="student">student</option>
                          <option value="teacher">teacher</option>
                          <option value="superadmin">superadmin</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          ref={setCellRef("username")}
                          className="sage-input !py-1.5 w-full min-w-[160px]"
                          value={draft.username}
                          onChange={(e) => updateDraft(user.id, "username", e.target.value)}
                          onKeyDown={(e) => handleSpreadsheetKeyDown(e, user.id, "username")}
                          disabled={isCellLocked(draft, "username")}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          ref={setCellRef("nomor_identitas")}
                          className="sage-input !py-1.5 w-full min-w-[150px]"
                          value={draft.nomor_identitas}
                          onChange={(e) => updateDraft(user.id, "nomor_identitas", e.target.value)}
                          onKeyDown={(e) => handleSpreadsheetKeyDown(e, user.id, "nomor_identitas")}
                          disabled={isCellLocked(draft, "nomor_identitas")}
                        />
                      </td>
                      <td className="p-2">
                        {isTeacher ? (
                          <span className="inline-flex h-9 items-center text-slate-400">-</span>
                        ) : (
                          <input
                            ref={setCellRef("kelas_tingkat")}
                            className="sage-input !py-1.5 w-full min-w-[118px] disabled:opacity-60"
                            value={draft.kelas_tingkat}
                            onChange={(e) => updateDraft(user.id, "kelas_tingkat", e.target.value)}
                            onKeyDown={(e) => handleSpreadsheetKeyDown(e, user.id, "kelas_tingkat")}
                            disabled={isCellLocked(draft, "kelas_tingkat")}
                          />
                        )}
                      </td>
                      <td className="p-2">
                        {isStudent ? (
                          <span className="inline-flex h-9 items-center text-slate-400">-</span>
                        ) : (
                          <input
                            ref={setCellRef("mata_pelajaran")}
                            className="sage-input !py-1.5 w-full min-w-[160px] disabled:opacity-60"
                            value={draft.mata_pelajaran}
                            onChange={(e) => updateDraft(user.id, "mata_pelajaran", e.target.value)}
                            onKeyDown={(e) => handleSpreadsheetKeyDown(e, user.id, "mata_pelajaran")}
                            disabled={isCellLocked(draft, "mata_pelajaran")}
                          />
                        )}
                      </td>
                      <td className="p-2">
                        <input
                          ref={setCellRef("institusi")}
                          className="sage-input !py-1.5 w-full min-w-[160px]"
                          value={draft.institusi}
                          onChange={(e) => updateDraft(user.id, "institusi", e.target.value)}
                          onKeyDown={(e) => handleSpreadsheetKeyDown(e, user.id, "institusi")}
                          disabled={isCellLocked(draft, "institusi")}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          ref={setCellRef("tanggal_lahir")}
                          type="date"
                          className="sage-input !py-1.5 w-full min-w-[126px]"
                          value={draft.tanggal_lahir}
                          onChange={(e) => updateDraft(user.id, "tanggal_lahir", e.target.value)}
                          onKeyDown={(e) => handleSpreadsheetKeyDown(e, user.id, "tanggal_lahir")}
                          disabled={isCellLocked(draft, "tanggal_lahir")}
                        />
                      </td>
                      <td className="p-2">
                        {isTeacher ? (
                          <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                            <input
                              ref={setCellRef("is_teacher_verified")}
                              type="checkbox"
                              checked={draft.is_teacher_verified}
                              disabled={draft.peran !== "teacher"}
                              onChange={(e) => updateDraft(user.id, "is_teacher_verified", e.target.checked)}
                              onKeyDown={(e) => handleSpreadsheetKeyDown(e, user.id, "is_teacher_verified")}
                            />
                            verified
                          </label>
                        ) : (
                          <span className="inline-flex h-9 items-center text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className="sage-button-outline !px-2.5 !py-1.5 text-xs"
                            onClick={() => setSelectedUserId(user.id)}
                          >
                            Detail
                          </button>
                          <button
                            type="button"
                            className="sage-button !px-2.5 !py-1.5 text-xs disabled:opacity-60"
                            disabled={!isDirty || isSaving}
                            onClick={() => void saveRow(user.id)}
                          >
                            {isSaving ? "Simpan..." : "Simpan"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
