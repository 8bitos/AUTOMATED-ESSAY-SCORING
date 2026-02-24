"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  FiPlus,
  FiCopy,
  FiX,
  FiChevronsRight,
  FiSearch,
  FiLayers,
  FiBookOpen,
  FiCalendar,
  FiEdit2,
  FiArchive,
  FiTrash2,
} from "react-icons/fi";
import Link from "next/link";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import LoadingDialog from "@/components/ui/LoadingDialog";

interface Class {
  id: string;
  class_name: string;
  deskripsi?: string;
  class_code: string;
  created_at?: string;
  is_archived?: boolean;
}

type GradeTab = "10" | "11" | "12" | "other";
type SortKey = "newest" | "alpha";

const API_URL = "/api";

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
      <div className="sage-panel w-full max-w-xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[color:var(--ink-500)] hover:text-[color:var(--ink-900)]"
        >
          <FiX size={22} />
        </button>
        <h2 className="text-lg font-semibold text-[color:var(--ink-900)] mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
};

const getGradeFromClassName = (className: string): GradeTab => {
  const normalized = (className || "").trim().toUpperCase();
  if (normalized.startsWith("10")) return "10";
  if (normalized.startsWith("11")) return "11";
  if (normalized.startsWith("12")) return "12";
  return "other";
};

const getGradeAccent = (grade: GradeTab) => {
  if (grade === "10") return "border-t-sky-500 bg-sky-50 text-sky-700";
  if (grade === "11") return "border-t-emerald-500 bg-emerald-50 text-emerald-700";
  if (grade === "12") return "border-t-amber-500 bg-amber-50 text-amber-700";
  return "border-t-slate-400 bg-slate-100 text-slate-700";
};

const formatDate = (iso?: string) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(d);
};

function ClassCard({
  classData,
  onEdit,
  onToggleArchive,
  onDelete,
  archiving,
  deleting,
}: {
  classData: Class;
  onEdit: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
  archiving: boolean;
  deleting: boolean;
}) {
  const [isCopied, setIsCopied] = useState(false);
  const grade = getGradeFromClassName(classData.class_name);
  const accent = getGradeAccent(grade);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(classData.class_code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1200);
    } catch {
      setIsCopied(false);
    }
  };

  return (
    <div className={`rounded-2xl border border-slate-200 border-t-4 ${accent.split(" ")[0]} bg-white p-5 shadow-sm hover:shadow-md transition`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">{classData.class_name}</h3>
          <p className="mt-1 text-xs text-slate-500 inline-flex items-center gap-1">
            <FiCalendar size={12} /> Dibuat: {formatDate(classData.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs ${accent.split(" ").slice(1).join(" ")}`}>{grade}</span>
          <span className={`rounded-full px-2.5 py-1 text-xs ${classData.is_archived ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-700"}`}>
            {classData.is_archived ? "Arsip" : "Aktif"}
          </span>
        </div>
      </div>

      <p className="mt-3 text-sm text-slate-600 min-h-[42px] line-clamp-2">{classData.deskripsi || "Tidak ada deskripsi kelas."}</p>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 flex items-center gap-2">
        <span className="text-xs text-slate-500">Kode:</span>
        <span className="font-mono text-sm text-slate-700">{classData.class_code}</span>
        <button onClick={handleCopy} className="ml-auto text-slate-500 hover:text-slate-800">
          {isCopied ? <span className="text-xs">Tersalin</span> : <FiCopy />}
        </button>
      </div>

      <div className="mt-4 flex justify-end gap-2 flex-wrap">
        <button type="button" onClick={onEdit} className="sage-button-outline !px-3 !py-1.5 text-xs inline-flex items-center gap-1">
          <FiEdit2 size={14} /> Edit
        </button>
        <button
          type="button"
          onClick={onToggleArchive}
          disabled={archiving}
          className="sage-button-outline !px-3 !py-1.5 text-xs inline-flex items-center gap-1"
        >
          <FiArchive size={14} /> {archiving ? "Memproses..." : classData.is_archived ? "Unarsip" : "Arsipkan"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="sage-button-outline !px-3 !py-1.5 text-xs inline-flex items-center gap-1 text-red-600 border-red-200 hover:bg-red-50"
        >
          <FiTrash2 size={14} /> {deleting ? "Menghapus..." : "Hapus"}
        </button>
        <Link href={`/dashboard/teacher/class/${classData.id}`} className="sage-button-outline !px-3 !py-1.5 text-sm inline-flex items-center gap-2">
          Masuk <FiChevronsRight size={14} />
        </Link>
      </div>
    </div>
  );
}

export default function ClassManagementPage() {
  const { isAuthenticated } = useAuth();

  const [classes, setClasses] = useState<Class[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [activeGrade, setActiveGrade] = useState<GradeTab>("10");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("newest");

  const [tingkat, setTingkat] = useState<"10" | "11" | "12">("10");
  const [paralel, setParalel] = useState("A");
  const [customName, setCustomName] = useState("");
  const [newClassDesc, setNewClassDesc] = useState("");
  const [editClassName, setEditClassName] = useState("");
  const [editClassDesc, setEditClassDesc] = useState("");
  const [confirmDeleteClass, setConfirmDeleteClass] = useState<Class | null>(null);

  const fetchClasses = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/classes`, { credentials: "include" });
      if (!res.ok) throw new Error("Gagal memuat kelas");
      const data = await res.json();
      setClasses(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || "Gagal memuat kelas");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const groupedCount = useMemo(() => {
    const count = { "10": 0, "11": 0, "12": 0, other: 0 };
    for (const cls of classes) {
      count[getGradeFromClassName(cls.class_name)]++;
    }
    return count;
  }, [classes]);

  const activeClasses = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = classes.filter((cls) => {
      if (activeGrade !== "other" && getGradeFromClassName(cls.class_name) !== activeGrade) return false;
      if (activeGrade === "other" && getGradeFromClassName(cls.class_name) !== "other") return false;
      if (!q) return true;
      return (cls.class_name || "").toLowerCase().includes(q) || (cls.deskripsi || "").toLowerCase().includes(q);
    });

    return filtered.sort((a, b) => {
      if (sortKey === "alpha") return (a.class_name || "").localeCompare(b.class_name || "", "id");
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return bTime - aTime;
    });
  }, [classes, activeGrade, query, sortKey]);

  const generatedName = `${tingkat}${(paralel || "A").toUpperCase()}`;
  const finalClassName = customName.trim() || generatedName;

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const duplicate = classes.some((c) => c.class_name.toUpperCase() === finalClassName.toUpperCase());
      if (duplicate) {
        throw new Error("Nama kelas sudah ada. Gunakan paralel/nama lain.");
      }

      const res = await fetch(`${API_URL}/classes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nama_kelas: finalClassName,
          deskripsi: newClassDesc,
        }),
      });

      if (!res.ok) throw new Error("Gagal membuat kelas");

      setIsModalOpen(false);
      setTingkat("10");
      setParalel("A");
      setCustomName("");
      setNewClassDesc("");
      await fetchClasses();
      setActiveGrade(getGradeFromClassName(finalClassName));
    } catch (err: any) {
      setError(err.message || "Gagal membuat kelas");
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = (cls: Class) => {
    setEditingClass(cls);
    setEditClassName(cls.class_name || "");
    setEditClassDesc(cls.deskripsi || "");
    setIsEditModalOpen(true);
  };

  const handleUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;
    setIsUpdating(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/classes/${editingClass.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nama_kelas: editClassName.trim(),
          deskripsi: editClassDesc,
        }),
      });
      if (!res.ok) throw new Error("Gagal mengupdate kelas");
      setIsEditModalOpen(false);
      setEditingClass(null);
      await fetchClasses();
    } catch (err: any) {
      setError(err.message || "Gagal mengupdate kelas");
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleArchive = async (cls: Class) => {
    setActionLoadingId(cls.id);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/classes/${cls.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_archived: !cls.is_archived }),
      });
      if (!res.ok) throw new Error("Gagal mengubah status arsip");
      await fetchClasses();
    } catch (err: any) {
      setError(err.message || "Gagal mengubah status arsip");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteClass = async (cls: Class) => {
    setConfirmDeleteClass(cls);
  };

  const confirmDeleteClassAction = async () => {
    if (!confirmDeleteClass) return;
    setActionLoadingId(confirmDeleteClass.id);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/classes/${confirmDeleteClass.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Gagal menghapus kelas");
      await fetchClasses();
    } catch (err: any) {
      setError(err.message || "Gagal menghapus kelas");
    } finally {
      setActionLoadingId(null);
      setConfirmDeleteClass(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="sage-pill">Academic Structure</p>
          <h1 className="mt-3 text-3xl text-slate-900">Manajemen Kelas 10-12</h1>
          <p className="mt-2 text-slate-500">Kelola rombel per tingkat: kelas 10, 11, dan 12 (A/B/C dst).</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="sage-button">
          <FiPlus /> Tambah Kelas
        </button>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Total Kelas" value={String(classes.length)} icon={<FiLayers />} />
        <SummaryCard title="Kelas 10" value={String(groupedCount["10"])} icon={<FiBookOpen />} />
        <SummaryCard title="Kelas 11" value={String(groupedCount["11"])} icon={<FiBookOpen />} />
        <SummaryCard title="Kelas 12" value={String(groupedCount["12"])} icon={<FiBookOpen />} />
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <GradeTabButton active={activeGrade === "10"} onClick={() => setActiveGrade("10")} label={`Kelas 10 (${groupedCount["10"]})`} />
            <GradeTabButton active={activeGrade === "11"} onClick={() => setActiveGrade("11")} label={`Kelas 11 (${groupedCount["11"]})`} />
            <GradeTabButton active={activeGrade === "12"} onClick={() => setActiveGrade("12")} label={`Kelas 12 (${groupedCount["12"]})`} />
            <GradeTabButton active={activeGrade === "other"} onClick={() => setActiveGrade("other")} label={`Lainnya (${groupedCount.other})`} />
          </div>
          <div className="flex items-center gap-2">
            <label className="relative block">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari kelas..."
                className="rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-300"
              />
            </label>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            >
              <option value="newest">Terbaru</option>
              <option value="alpha">Abjad</option>
            </select>
          </div>
        </div>

        <div className="bg-slate-50 p-4 sm:p-6">
          {isLoading && <p className="text-[color:var(--ink-500)]">Memuat kelas...</p>}
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

          {!isLoading && activeClasses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              Belum ada kelas di kategori ini.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeClasses.map((c) => (
                <ClassCard
                  key={c.id}
                  classData={c}
                  onEdit={() => openEdit(c)}
                  onToggleArchive={() => toggleArchive(c)}
                  onDelete={() => handleDeleteClass(c)}
                  archiving={actionLoadingId === c.id}
                  deleting={actionLoadingId === c.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Tambah Kelas Baru">
        <form onSubmit={handleCreateClass} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Tingkat</label>
              <select
                value={tingkat}
                onChange={(e) => setTingkat(e.target.value as "10" | "11" | "12")}
                className="mt-1 sage-input"
              >
                <option value="10">Kelas 10</option>
                <option value="11">Kelas 11</option>
                <option value="12">Kelas 12</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Paralel</label>
              <input
                value={paralel}
                onChange={(e) => setParalel(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 2))}
                placeholder="A"
                className="mt-1 sage-input"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Nama Kelas (opsional override)</label>
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={`Default: ${generatedName}`}
              className="mt-1 sage-input"
            />
            <p className="mt-1 text-xs text-slate-500">Jika kosong, nama kelas otomatis: <span className="font-medium">{generatedName}</span></p>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Deskripsi (opsional)</label>
            <textarea
              value={newClassDesc}
              onChange={(e) => setNewClassDesc(e.target.value)}
              placeholder="Contoh: Sejarah Indonesia Kelas 10A"
              className="mt-1 sage-input"
              rows={3}
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Preview kelas: <span className="font-semibold text-slate-900">{finalClassName}</span>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsModalOpen(false)} className="sage-button-outline">
              Batal
            </button>
            <button type="submit" className="sage-button" disabled={isSaving}>
              {isSaving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Kelas">
        <form onSubmit={handleUpdateClass} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Nama Kelas</label>
            <input value={editClassName} onChange={(e) => setEditClassName(e.target.value)} className="mt-1 sage-input" required />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Deskripsi</label>
            <textarea value={editClassDesc} onChange={(e) => setEditClassDesc(e.target.value)} className="mt-1 sage-input" rows={3} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsEditModalOpen(false)} className="sage-button-outline">
              Batal
            </button>
            <button type="submit" className="sage-button" disabled={isUpdating}>
              {isUpdating ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmDeleteClass}
        title="Hapus Kelas"
        message={confirmDeleteClass ? `Hapus kelas ${confirmDeleteClass.class_name}? Tindakan ini permanen.` : ""}
        confirmLabel="Hapus"
        danger
        loading={!!(confirmDeleteClass && actionLoadingId === confirmDeleteClass.id)}
        onCancel={() => setConfirmDeleteClass(null)}
        onConfirm={confirmDeleteClassAction}
      />

      <LoadingDialog isOpen={isSaving || isUpdating || !!actionLoadingId} message="Sedang memproses perubahan kelas..." />
    </div>
  );
}

function GradeTabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
        active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );
}

function SummaryCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
