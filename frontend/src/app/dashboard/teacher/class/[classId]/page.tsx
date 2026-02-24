"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import {
  FiArrowLeft,
  FiMail,
  FiBookOpen,
  FiFileText,
  FiAlertCircle,
  FiUsers,
  FiPlus,
  FiSearch,
  FiBarChart2,
  FiX,
  FiCheckCircle,
  FiCopy,
  FiClipboard,
  FiEdit2,
  FiTrash2,
  FiClock,
  FiActivity,
  FiAward,
  FiLayers,
  FiUploadCloud,
} from "react-icons/fi";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import LoadingDialog from "@/components/ui/LoadingDialog";

interface ClassDetail {
  id: string;
  class_name: string;
  class_code: string;
  deskripsi?: string;
}

interface ClassMember {
  id: string;
  member_id?: string;
  student_name: string;
  student_email: string;
  student_username?: string | null;
  foto_profil_url?: string | null;
  nomor_identitas?: string | null;
  kelas_tingkat?: string | null;
  institusi?: string | null;
  tanggal_lahir?: string | null;
  last_login_at?: string | null;
  joined_at: string;
  requested_at?: string;
}

interface Material {
  id: string;
  judul: string;
  material_type?: "materi" | "soal" | "tugas";
  isi_materi?: string;
  capaian_pembelajaran?: string;
  created_at?: string;
  updated_at?: string;
}

interface PendingJoinRequest {
  id: string; // student id
  member_id: string;
  student_name: string;
  student_email: string;
  requested_at?: string;
}

interface InvitableStudent {
  id: string;
  name: string;
  email: string;
}

interface StudentSubmission {
  id: string;
  question_id: string;
  submitted_at?: string;
  skor_ai?: number;
  revised_score?: number;
}

interface TeachingModule {
  id: string;
  class_id: string;
  nama_modul: string;
  file_url: string;
  created_at: string;
  updated_at: string;
}

type TabKey = "materials" | "modules" | "students" | "analytics";

const API_URL = "/api";

export default function ClassDetailsPage() {
  const { isAuthenticated } = useAuth();
  const params = useParams();
  const classId = params.classId as string;

  const [classDetail, setClassDetail] = useState<ClassDetail | null>(null);
  const [students, setStudents] = useState<ClassMember[]>([]);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<PendingJoinRequest[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [teachingModules, setTeachingModules] = useState<TeachingModule[]>([]);
  const [questionCountByMaterial, setQuestionCountByMaterial] = useState<Record<string, number>>({});
  const [questionMaterialMap, setQuestionMaterialMap] = useState<Record<string, { materialId: string; materialTitle: string }>>({});
  const [activeTab, setActiveTab] = useState<TabKey>("materials");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [materialQuery, setMaterialQuery] = useState("");
  const [materialSort, setMaterialSort] = useState<"newest" | "alpha">("newest");
  const [studentQuery, setStudentQuery] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  const [isAddMaterialModalOpen, setAddMaterialModalOpen] = useState(false);

  const fetchClassData = useCallback(async () => {
    if (!isAuthenticated || !classId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [classRes, studentRes, materialRes, moduleRes] = await Promise.all([
        fetch(`${API_URL}/classes/${classId}`, { credentials: "include" }),
        fetch(`${API_URL}/classes/${classId}/students`, { credentials: "include" }),
        fetch(`${API_URL}/classes/${classId}/materials`, { credentials: "include" }),
        fetch(`${API_URL}/classes/${classId}/teaching-modules`, { credentials: "include" }),
      ]);

      if (!classRes.ok) throw new Error("Gagal memuat detail kelas");

      const classData = await classRes.json();
      const studentsData = studentRes.ok ? await studentRes.json() : [];
      const materialsData: Material[] = materialRes.ok ? await materialRes.json() : [];
      const moduleData: TeachingModule[] = moduleRes.ok ? await moduleRes.json() : [];

      setClassDetail(classData);
      setStudents(studentsData);
      setMaterials(materialsData);
      setTeachingModules(Array.isArray(moduleData) ? moduleData : []);

      const pendingRes = await fetch(`${API_URL}/classes/${classId}/join-requests`, { credentials: "include" });
      if (pendingRes.ok) {
        const pendingData = await pendingRes.json();
        setPendingJoinRequests(Array.isArray(pendingData) ? pendingData : []);
      } else {
        setPendingJoinRequests([]);
      }

      const questionCountEntries = await Promise.all(
        materialsData.map(async (m) => {
          try {
            const qRes = await fetch(`${API_URL}/materials/${m.id}/essay-questions`, { credentials: "include" });
            if (!qRes.ok) return [m.id, 0] as const;
            const qData = await qRes.json();
            return [m.id, Array.isArray(qData) ? qData.length : 0] as const;
          } catch {
            return [m.id, 0] as const;
          }
        })
      );
      setQuestionCountByMaterial(Object.fromEntries(questionCountEntries));

      const questionMapEntries = await Promise.all(
        materialsData.map(async (m) => {
          try {
            const qRes = await fetch(`${API_URL}/materials/${m.id}/essay-questions`, { credentials: "include" });
            if (!qRes.ok) return [] as Array<[string, { materialId: string; materialTitle: string }]>;
            const qData = await qRes.json();
            if (!Array.isArray(qData)) return [] as Array<[string, { materialId: string; materialTitle: string }]>;
            return qData
              .filter((q: any) => q?.id)
              .map((q: any) => [q.id as string, { materialId: m.id, materialTitle: m.judul }] as [string, { materialId: string; materialTitle: string }]);
          } catch {
            return [] as Array<[string, { materialId: string; materialTitle: string }]>;
          }
        })
      );
      setQuestionMaterialMap(Object.fromEntries(questionMapEntries.flat()));
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat memuat kelas.");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, classId]);

  useEffect(() => {
    fetchClassData();
  }, [fetchClassData]);

  const filteredMaterials = useMemo(() => {
    const q = materialQuery.trim().toLowerCase();
    const base = !q ? materials : materials.filter((m) => (m.judul || "").toLowerCase().includes(q));
    return [...base].sort((a, b) => {
      if (materialSort === "alpha") {
        return (a.judul || "").localeCompare(b.judul || "", "id");
      }
      const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
      const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
      return bTime - aTime;
    });
  }, [materials, materialQuery, materialSort]);

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        (s.student_name || "").toLowerCase().includes(q) ||
        (s.student_email || "").toLowerCase().includes(q)
    );
  }, [students, studentQuery]);

  const summary = useMemo(() => {
    const studentsCount = students.length;
    const materialsCount = materials.length;
    const typedCounts = {
      materi: materials.filter((m) => (m.material_type || "materi") === "materi").length,
      soal: materials.filter((m) => (m.material_type || "materi") === "soal").length,
      tugas: materials.filter((m) => (m.material_type || "materi") === "tugas").length,
    };
    const latestMaterial =
      [...materials]
        .sort((a, b) => {
          const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
          const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
          return bTime - aTime;
        })
        .at(0)?.judul || "Belum ada materi";
    const materialsWithQuestion = materials.filter((m) => (questionCountByMaterial[m.id] || 0) > 0).length;
    const reviewProgress = materialsCount > 0 ? Math.round((materialsWithQuestion / materialsCount) * 100) : 0;

    return {
      studentsCount,
      materialsCount,
      typedCounts,
      latestMaterial,
      reviewProgress,
      teachingModulesCount: teachingModules.length,
    };
  }, [students, materials, teachingModules.length, questionCountByMaterial]);

  if (isLoading) {
    return <p className="text-center py-10 text-slate-600">Memuat data kelas...</p>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 flex items-center gap-2">
        <FiAlertCircle />
        {error}
      </div>
    );
  }

  if (!classDetail) {
    return <p className="text-center py-10 text-slate-600">Kelas tidak ditemukan.</p>;
  }

  const handleCopyClassCode = async () => {
    try {
      await navigator.clipboard.writeText(classDetail.class_code || "");
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1500);
    } catch {
      setError("Gagal menyalin kode kelas.");
    }
  };

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <Link
          href="/dashboard/teacher/classes"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800"
        >
          <FiArrowLeft /> Kembali ke Daftar Kelas
        </Link>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">{classDetail.class_name}</h1>
            {classDetail.deskripsi && (
              <p className="mt-2 text-sm text-slate-600 leading-relaxed text-justify">{classDetail.deskripsi}</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Kode Kelas</p>
            <div className="mt-2 flex items-center gap-2">
              <p className="inline-block rounded-lg bg-white border border-slate-200 px-3 py-2 font-mono text-sm text-slate-800">
                {classDetail.class_code}
              </p>
              <button type="button" onClick={handleCopyClassCode} className="sage-button-outline !px-3 !py-2 text-xs">
                <FiCopy /> {copiedCode ? "Tersalin" : "Copy"}
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500">Bagikan kode ini ke siswa untuk bergabung.</p>
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard title="Total Siswa" value={String(summary.studentsCount)} icon={<FiUsers />} />
        <SummaryCard
          title="Konten Kelas"
          value={`${summary.materialsCount} (${summary.typedCounts.materi} M · ${summary.typedCounts.soal} S · ${summary.typedCounts.tugas} T)`}
          icon={<FiBookOpen />}
          compact
        />
        <SummaryCard title="Modul Ajar" value={String(summary.teachingModulesCount)} icon={<FiFileText />} />
        <SummaryCard title="Review Progress" value={`${summary.reviewProgress}%`} icon={<FiBarChart2 />} />
        <SummaryCard title="Materi Terbaru" value={summary.latestMaterial} icon={<FiCheckCircle />} compact />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-2 py-3">
            <TabButton active={activeTab === "materials"} onClick={() => setActiveTab("materials")}>Materi ({materials.length})</TabButton>
            <TabButton active={activeTab === "modules"} onClick={() => setActiveTab("modules")}>Modul Ajar ({teachingModules.length})</TabButton>
            <TabButton active={activeTab === "students"} onClick={() => setActiveTab("students")}>Siswa ({students.length})</TabButton>
            <TabButton active={activeTab === "analytics"} onClick={() => setActiveTab("analytics")}>Analitik</TabButton>
          </div>
        </div>

        <div className="bg-slate-50 p-4 sm:p-6">
          {activeTab === "materials" && (
            <MaterialsPane
              items={filteredMaterials}
              query={materialQuery}
              sort={materialSort}
              onSortChange={setMaterialSort}
              onQueryChange={setMaterialQuery}
              onAdd={() => setAddMaterialModalOpen(true)}
              onUpdated={fetchClassData}
              onDelete={async (materialId: string) => {
                const res = await fetch(`/api/materials/${materialId}`, {
                  method: "DELETE",
                  credentials: "include",
                });
                if (!res.ok) {
                  const body = await res.json().catch(() => ({}));
                  throw new Error(body?.message || "Gagal menghapus materi.");
                }
                await fetchClassData();
              }}
            />
          )}

          {activeTab === "modules" && (
            <TeachingModulesPane
              classId={classId}
              items={teachingModules}
              onUpdated={fetchClassData}
            />
          )}

          {activeTab === "students" && (
            <StudentsPane
              items={filteredStudents}
              query={studentQuery}
              onQueryChange={setStudentQuery}
              questionMaterialMap={questionMaterialMap}
              pendingRequests={pendingJoinRequests}
              classId={classId}
              onUpdated={fetchClassData}
            />
          )}

          {activeTab === "analytics" && <AnalyticsPane students={students.length} materials={materials.length} />}
        </div>
      </section>

      <AddMaterialNameModal
        isOpen={isAddMaterialModalOpen}
        onClose={() => setAddMaterialModalOpen(false)}
        classId={classId}
        onFinished={fetchClassData}
      />
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  compact = false,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">{icon}</span>
      </div>
      <p className={`mt-3 ${compact ? "text-sm" : "text-2xl"} font-semibold text-slate-900 truncate`}>{value}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
        active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

function SearchInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="relative block w-full sm:max-w-sm">
      <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-300"
      />
    </label>
  );
}

function MaterialsPane({
  items,
  query,
  sort,
  onSortChange,
  onQueryChange,
  onAdd,
  onUpdated,
  onDelete,
}: {
  items: Material[];
  query: string;
  sort: "newest" | "alpha";
  onSortChange: (v: "newest" | "alpha") => void;
  onQueryChange: (v: string) => void;
  onAdd: () => void;
  onUpdated: () => void;
  onDelete: (materialId: string) => Promise<void>;
}) {
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteMaterial, setConfirmDeleteMaterial] = useState<Material | null>(null);
  const [deleteError, setDeleteError] = useState("");

  return (
    <div className="space-y-4">
      <div className="sticky top-2 z-10 rounded-xl border border-slate-200 bg-white/95 backdrop-blur p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SearchInput placeholder="Cari materi..." value={query} onChange={onQueryChange} />
          <div className="flex items-center gap-2">
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value as "newest" | "alpha")}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            >
              <option value="newest">Urutkan: Terbaru</option>
              <option value="alpha">Urutkan: Abjad</option>
            </select>
            <button onClick={onAdd} className="sage-button">
              <FiPlus /> Tambah Konten
            </button>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<FiBookOpen />}
          title="Belum Ada Konten"
          desc="Tambahkan konten baru (Materi/Soal/Tugas). Nama dan tipe saja dulu, detail bisa diatur setelah dibuat."
        />
      ) : (
        <div className="grid gap-3">
          {items.map((material) => (
            <MaterialCard
              key={material.id}
              material={material}
              onEdit={() => setEditingMaterial(material)}
              isDeleting={deletingId === material.id}
              onDelete={() => setConfirmDeleteMaterial(material)}
            />
          ))}
        </div>
      )}
      {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}

      <EditMaterialQuickModal
        material={editingMaterial}
        isOpen={!!editingMaterial}
        onClose={() => setEditingMaterial(null)}
        onFinished={async () => {
          await onUpdated();
          setEditingMaterial(null);
        }}
      />

      <ConfirmDialog
        isOpen={!!confirmDeleteMaterial}
        title="Hapus Materi"
        message={
          confirmDeleteMaterial
            ? `Hapus materi "${confirmDeleteMaterial.judul}"? Soal dan submisi terkait bisa ikut terhapus.`
            : ""
        }
        confirmLabel="Hapus"
        danger
        loading={!!(confirmDeleteMaterial && deletingId === confirmDeleteMaterial.id)}
        onCancel={() => setConfirmDeleteMaterial(null)}
        onConfirm={async () => {
          if (!confirmDeleteMaterial) return;
          try {
            setDeleteError("");
            setDeletingId(confirmDeleteMaterial.id);
            await onDelete(confirmDeleteMaterial.id);
            setConfirmDeleteMaterial(null);
          } catch (err: any) {
            setDeleteError(err?.message || "Gagal menghapus materi.");
          } finally {
            setDeletingId(null);
          }
        }}
      />

      <LoadingDialog isOpen={!!deletingId} message="Menghapus materi..." />
    </div>
  );
}

function TeachingModulesPane({
  classId,
  items,
  onUpdated,
}: {
  classId: string;
  items: TeachingModule[];
  onUpdated: () => Promise<void> | void;
}) {
  const [isUploadModalOpen, setUploadModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TeachingModule | null>(null);
  const [error, setError] = useState("");

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Modul Ajar Kelas</p>
            <p className="text-xs text-slate-500 mt-1">
              Upload PDF modul ajar sebagai acuan proses belajar di kelas ini.
            </p>
          </div>
          <button type="button" className="sage-button" onClick={() => setUploadModalOpen(true)}>
            <FiUploadCloud /> Upload Modul PDF
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<FiFileText />}
          title="Belum Ada Modul Ajar"
          desc="Tambahkan modul ajar dalam format PDF untuk jadi referensi kelas."
        />
      ) : (
        <div className="grid gap-3">
          {items.map((modul) => (
            <div key={modul.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{modul.nama_modul}</p>
                  <p className="mt-1 text-[11px] text-slate-400">Diunggah: {formatDateLabel(modul.created_at)}</p>
                  <p className="mt-2 text-xs text-slate-600 inline-flex items-center gap-1">
                    <FiFileText /> Format: PDF
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={modul.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="sage-button-outline !py-1.5 !px-3 text-xs"
                  >
                    Lihat File
                  </a>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(modul)}
                    disabled={deletingId === modul.id}
                    className="sage-button-outline !py-1.5 !px-3 text-xs text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <FiTrash2 /> {deletingId === modul.id ? "Menghapus..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <UploadTeachingModuleModal
        isOpen={isUploadModalOpen}
        classId={classId}
        onClose={() => setUploadModalOpen(false)}
        onFinished={async () => {
          setUploadModalOpen(false);
          await onUpdated();
        }}
      />

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Hapus Modul Ajar"
        message={confirmDelete ? `Hapus modul "${confirmDelete.nama_modul}" dari kelas ini?` : ""}
        confirmLabel="Hapus"
        danger
        loading={!!(confirmDelete && deletingId === confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          try {
            setError("");
            setDeletingId(confirmDelete.id);
            const res = await fetch(`/api/teaching-modules/${confirmDelete.id}`, {
              method: "DELETE",
              credentials: "include",
            });
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              throw new Error(body?.message || "Gagal menghapus modul ajar.");
            }
            setConfirmDelete(null);
            await onUpdated();
          } catch (err: any) {
            setError(err?.message || "Gagal menghapus modul ajar.");
          } finally {
            setDeletingId(null);
          }
        }}
      />

      <LoadingDialog isOpen={!!deletingId} message="Menghapus modul ajar..." />
    </div>
  );
}

function UploadTeachingModuleModal({
  isOpen,
  onClose,
  classId,
  onFinished,
}: {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  onFinished: () => Promise<void> | void;
}) {
  const [namaModul, setNamaModul] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setNamaModul("");
      setFile(null);
      setError("");
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedName = namaModul.trim();
    if (!trimmedName) {
      setError("Nama modul wajib diisi.");
      return;
    }
    if (!file) {
      setError("Silakan pilih file PDF.");
      return;
    }
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("File harus berformat PDF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran file maksimal 5MB.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const uploadBody = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) throw new Error(uploadBody?.message || "Gagal upload PDF.");
      if (!uploadBody?.filePath) throw new Error("Respons upload tidak valid.");

      const createRes = await fetch(`/api/classes/${classId}/teaching-modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nama_modul: trimmedName,
          file_url: uploadBody.filePath,
        }),
      });
      const createBody = await createRes.json().catch(() => ({}));
      if (!createRes.ok) throw new Error(createBody?.message || "Gagal menyimpan modul ajar.");

      await onFinished();
    } catch (err: any) {
      setError(err?.message || "Gagal menyimpan modul ajar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/45 p-4 flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Tutup"
        >
          <FiX />
        </button>

        <h3 className="text-lg font-semibold text-slate-900">Upload Modul Ajar</h3>
        <p className="mt-1 text-sm text-slate-500">Unggah file PDF untuk acuan pembelajaran kelas.</p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Nama Modul</label>
            <input
              value={namaModul}
              onChange={(e) => setNamaModul(e.target.value)}
              placeholder="Contoh: Modul Ajar Bab 1"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              maxLength={255}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">File PDF (maks. 5MB)</label>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => {
                const selected = e.target.files?.[0] || null;
                setFile(selected);
              }}
              className="mt-1 block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-slate-700 hover:file:bg-slate-200"
            />
            {file && <p className="mt-1 text-xs text-slate-500 truncate">{file.name}</p>}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="sage-button-outline" disabled={isSubmitting}>
              Batal
            </button>
            <button type="submit" className="sage-button" disabled={isSubmitting}>
              {isSubmitting ? "Menyimpan..." : "Simpan Modul"}
            </button>
          </div>
        </form>
      </div>
      <LoadingDialog isOpen={isSubmitting} message="Mengunggah modul ajar..." />
    </div>
  );
}

function extractDescription(raw?: string): string {
  if (!raw) return "";
  const text = raw.trim();
  if (!text) return "";

  try {
    const parsed = JSON.parse(text);
    if (parsed?.format === "sage_blocks" && Array.isArray(parsed?.blocks)) {
      const firstText = parsed.blocks
        .map((b: any) => (typeof b?.value === "string" ? b.value.trim() : ""))
        .find((v: string) => v.length > 0);
      return firstText || "";
    }
  } catch {
    // fallback to plain text
  }

  return text;
}

function truncate100(value: string): string {
  if (value.length <= 100) return value;
  return `${value.slice(0, 100)}...`;
}

function formatDateLabel(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(d);
}

function MaterialCard({
  material,
  onEdit,
  onDelete,
  isDeleting,
}: {
  material: Material;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const summaryText =
    (material.capaian_pembelajaran || "").trim() ||
    extractDescription(material.isi_materi || "");
  const description = truncate100(summaryText);
  const materialType = material.material_type || "materi";
  const materialTypeLabel =
    materialType === "soal" ? "Soal" : materialType === "tugas" ? "Tugas" : "Materi";
  const materialTypeClass =
    materialType === "soal"
      ? "bg-blue-100 text-blue-700"
      : materialType === "tugas"
        ? "bg-purple-100 text-purple-700"
        : "bg-emerald-100 text-emerald-700";
  const materialTypeIcon =
    materialType === "soal" ? <FiFileText size={16} className="text-blue-600" /> : materialType === "tugas" ? <FiClipboard size={16} className="text-purple-600" /> : <FiBookOpen size={16} className="text-emerald-600" />;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 font-semibold text-slate-900">
          {materialTypeIcon}
          <span>{material.judul}</span>
        </p>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${materialTypeClass}`}>{materialTypeLabel}</span>
      </div>
      <p className="mt-1 text-[11px] text-slate-400">Dibuat: {formatDateLabel(material.created_at)}</p>
      <p className="mt-1 text-xs text-slate-500 min-h-[34px]">
        {description || "Belum ada deskripsi materi."}
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onEdit} className="sage-button-outline !py-1.5 !px-3 text-xs">
          <FiEdit2 /> Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          className="sage-button-outline !py-1.5 !px-3 text-xs text-red-600 border-red-200 hover:bg-red-50"
        >
          <FiTrash2 /> {isDeleting ? "Menghapus..." : "Delete"}
        </button>
        <Link href={`/dashboard/teacher/material/${material.id}`} className="sage-button-outline !py-1.5 !px-3 text-xs">
          Masuk
        </Link>
      </div>
    </div>
  );
}

function StudentsPane({
  items,
  query,
  onQueryChange,
  questionMaterialMap,
  pendingRequests,
  classId,
  onUpdated,
}: {
  items: ClassMember[];
  query: string;
  onQueryChange: (v: string) => void;
  questionMaterialMap: Record<string, { materialId: string; materialTitle: string }>;
  pendingRequests: PendingJoinRequest[];
  classId: string;
  onUpdated: () => void;
}) {
  const [selectedStudent, setSelectedStudent] = useState<ClassMember | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null);
  const [confirmRemoveStudent, setConfirmRemoveStudent] = useState<ClassMember | null>(null);

  const handleInviteByStudentId = async (studentId: string) => {
    setInviteMessage("");
    try {
      const res = await fetch(`/api/classes/${classId}/invite-student`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ student_id: studentId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Gagal mengundang siswa.");
      setInviteMessage(body?.message || "Siswa berhasil diundang.");
      await onUpdated();
      return true;
    } catch (err: any) {
      setInviteMessage(err?.message || "Gagal mengundang siswa.");
      return false;
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    setRemovingStudentId(studentId);
    try {
      const res = await fetch(`/api/classes/${classId}/students/${studentId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Gagal menghapus siswa.");
      }
      await onUpdated();
    } catch (err: any) {
      setInviteMessage(err?.message || "Gagal menghapus siswa.");
    } finally {
      setRemovingStudentId(null);
    }
  };

  const handleReview = async (memberId: string, action: "approve" | "reject") => {
    setReviewingId(memberId);
    try {
      const res = await fetch(`/api/classes/${classId}/join-requests/${memberId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Gagal memproses request.");
      await onUpdated();
    } catch (err: any) {
      setInviteMessage(err?.message || "Gagal memproses request.");
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Invite Siswa</h3>
        <button type="button" className="sage-button" onClick={() => setInviteModalOpen(true)}>
          <FiPlus /> Pilih Siswa untuk Invite
        </button>
        {inviteMessage && <p className="text-xs text-slate-600">{inviteMessage}</p>}
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-amber-900">Permintaan Join Menunggu ACC ({pendingRequests.length})</h3>
        {pendingRequests.length === 0 ? (
          <p className="text-xs text-amber-800">Belum ada request join yang pending.</p>
        ) : (
          <div className="space-y-2">
            {pendingRequests.map((req) => (
              <div key={req.member_id} className="rounded-lg border border-amber-200 bg-white p-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{req.student_name}</p>
                  <p className="text-xs text-slate-500">{req.student_email}</p>
                  {req.requested_at && <p className="text-[11px] text-slate-400">Request: {formatDateTimeLabel(req.requested_at)}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleReview(req.member_id, "reject")}
                    className="sage-button-outline !px-3 !py-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50"
                    disabled={reviewingId === req.member_id}
                  >
                    Tolak
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReview(req.member_id, "approve")}
                    className="sage-button !px-3 !py-1.5 text-xs"
                    disabled={reviewingId === req.member_id}
                  >
                    {reviewingId === req.member_id ? "Memproses..." : "ACC"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SearchInput placeholder="Cari nama atau email siswa..." value={query} onChange={onQueryChange} />

      {items.length === 0 ? (
        <EmptyState
          icon={<FiUsers />}
          title="Belum Ada Siswa"
          desc="Bagikan kode kelas agar siswa dapat bergabung."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedStudent(s)}
              className="text-left rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-center gap-3">
                {s.foto_profil_url ? (
                  <img
                    src={s.foto_profil_url}
                    alt={`Foto ${s.student_name}`}
                    className="h-10 w-10 rounded-full object-cover border border-slate-200"
                  />
                ) : (
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white text-sm font-semibold">
                    {getInitial(s.student_name)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{s.student_name}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                    <FiMail /> {s.student_email}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 truncate">
                    {s.kelas_tingkat || "-"} · Bergabung {formatDateLabel(s.joined_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmRemoveStudent(s);
                  }}
                  className="ml-auto sage-button-outline !px-3 !py-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50"
                  disabled={removingStudentId === s.id}
                >
                  <FiTrash2 /> {removingStudentId === s.id ? "Menghapus..." : "Hapus"}
                </button>
              </div>
            </button>
          ))}
        </div>
      )}

      <StudentProfileModal
        student={selectedStudent}
        isOpen={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
        questionMaterialMap={questionMaterialMap}
      />
      <InviteStudentModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        classId={classId}
        onInvite={handleInviteByStudentId}
      />

      <ConfirmDialog
        isOpen={!!confirmRemoveStudent}
        title="Hapus Siswa"
        message={
          confirmRemoveStudent
            ? `Hapus ${confirmRemoveStudent.student_name} dari kelas ini?`
            : ""
        }
        confirmLabel="Hapus"
        danger
        loading={!!(confirmRemoveStudent && removingStudentId === confirmRemoveStudent.id)}
        onCancel={() => setConfirmRemoveStudent(null)}
        onConfirm={async () => {
          if (!confirmRemoveStudent) return;
          await handleRemoveStudent(confirmRemoveStudent.id);
          setConfirmRemoveStudent(null);
        }}
      />

      <LoadingDialog isOpen={!!removingStudentId} message="Menghapus siswa dari kelas..." />
    </div>
  );
}

function AnalyticsPane({ students, materials }: { students: number; materials: number }) {
  const studentMaterialRatio = students > 0 ? (materials / students).toFixed(2) : "0.00";

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <SummaryCard title="Siswa" value={String(students)} icon={<FiUsers />} />
      <SummaryCard title="Materi" value={String(materials)} icon={<FiBookOpen />} />
      <SummaryCard title="Rasio Materi/Siswa" value={studentMaterialRatio} icon={<FiBarChart2 />} />
    </div>
  );
}

function EmptyState({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
      <div className="text-3xl mb-3 opacity-70 flex justify-center">{icon}</div>
      <h3 className="font-semibold text-slate-700">{title}</h3>
      <p className="text-sm mt-1">{desc}</p>
    </div>
  );
}

function AddMaterialNameModal({
  isOpen,
  onClose,
  classId,
  onFinished,
}: {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  onFinished: () => void;
}) {
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [materialType, setMaterialType] = useState<"materi" | "soal" | "tugas">("materi");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setJudul("");
      setDeskripsi("");
      setMaterialType("materi");
      setError("");
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!judul.trim()) {
      setError("Nama materi wajib diisi.");
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          class_id: classId,
          judul: judul.trim(),
          material_type: materialType,
          capaian_pembelajaran: deskripsi.trim() ? deskripsi.trim() : undefined,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || "Gagal menambahkan materi.");
      }

      await onFinished();
      onClose();
    } catch (err: any) {
      setError(err.message || "Gagal menambahkan materi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/45 p-4 flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Tutup"
        >
          <FiX />
        </button>

        <h3 className="text-lg font-semibold text-slate-900">Tambah Konten</h3>
        <p className="mt-1 text-sm text-slate-500">Pilih tipe konten: Materi, Soal, atau Tugas. Detail konten bisa diatur setelah dibuat.</p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Tipe Konten</label>
            <select
              value={materialType}
              onChange={(e) => setMaterialType(e.target.value as "materi" | "soal" | "tugas")}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            >
              <option value="materi">Materi</option>
              <option value="soal">Soal</option>
              <option value="tugas">Tugas</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Nama Konten</label>
            <input
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              placeholder={materialType === "soal" ? "Contoh: Latihan Bab 1" : materialType === "tugas" ? "Contoh: Tugas Refleksi Minggu 1" : "Contoh: Peristiwa Rengasdengklok"}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Deskripsi (maks. 100 karakter)</label>
            <textarea
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value.slice(0, 100))}
              placeholder="Ringkasan singkat materi"
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            />
            <p className="mt-1 text-xs text-slate-500 text-right">{deskripsi.length}/100</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="sage-button-outline">
              Batal
            </button>
            <button type="submit" className="sage-button" disabled={isSubmitting}>
              {isSubmitting ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
      <LoadingDialog isOpen={isSubmitting} message="Menyimpan materi..." />
    </div>
  );
}

function EditMaterialQuickModal({
  isOpen,
  onClose,
  material,
  onFinished,
}: {
  isOpen: boolean;
  onClose: () => void;
  material: Material | null;
  onFinished: () => void;
}) {
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [materialType, setMaterialType] = useState<"materi" | "soal" | "tugas">("materi");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !material) return;
    setJudul(material.judul || "");
    setMaterialType((material.material_type || "materi") as "materi" | "soal" | "tugas");
    setDeskripsi(
      ((material.capaian_pembelajaran || "").trim() || extractDescription(material.isi_materi || "")).slice(0, 100)
    );
    setError("");
  }, [isOpen, material]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!material) return;
    if (!judul.trim()) {
      setError("Nama materi wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/materials/${material.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          judul: judul.trim(),
          material_type: materialType,
          capaian_pembelajaran: deskripsi.trim() ? deskripsi.trim() : "",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || "Gagal mengupdate materi.");
      }
      await onFinished();
    } catch (err: any) {
      setError(err.message || "Gagal mengupdate materi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !material) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/45 p-4 flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Tutup"
        >
          <FiX />
        </button>
        <h3 className="text-lg font-semibold text-slate-900">Edit Materi</h3>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Tipe Konten</label>
            <select
              value={materialType}
              onChange={(e) => setMaterialType(e.target.value as "materi" | "soal" | "tugas")}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            >
              <option value="materi">Materi</option>
              <option value="soal">Soal</option>
              <option value="tugas">Tugas</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Nama Materi</label>
            <input
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Deskripsi (maks. 100 karakter)</label>
            <textarea
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value.slice(0, 100))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            />
            <p className="mt-1 text-xs text-slate-500 text-right">{deskripsi.length}/100</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="sage-button-outline">
              Batal
            </button>
            <button type="submit" className="sage-button" disabled={isSubmitting}>
              {isSubmitting ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
      <LoadingDialog isOpen={isSubmitting} message="Menyimpan perubahan materi..." />
    </div>
  );
}

function formatDateTimeLabel(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function getInitial(name?: string): string {
  const safe = (name || "").trim();
  if (!safe) return "S";
  return safe.charAt(0).toUpperCase();
}

function deriveUsername(student: Pick<ClassMember, "student_username" | "student_email">): string {
  const fromProfile = (student.student_username || "").trim();
  if (fromProfile) return fromProfile;
  const email = (student.student_email || "").trim();
  if (!email || !email.includes("@")) return "-";
  return email.split("@")[0];
}

function StudentProfileModal({
  isOpen,
  onClose,
  student,
  questionMaterialMap,
}: {
  isOpen: boolean;
  onClose: () => void;
  student: ClassMember | null;
  questionMaterialMap: Record<string, { materialId: string; materialTitle: string }>;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [lastAccess, setLastAccess] = useState<{ materialTitle: string; when: string } | null>(null);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [lastSubmittedAt, setLastSubmittedAt] = useState<string | null>(null);
  const [materialsTouched, setMaterialsTouched] = useState(0);

  useEffect(() => {
    const load = async () => {
      if (!isOpen || !student) return;
      setIsLoading(true);
      setError("");
      setAvgScore(null);
      setLastAccess(null);
      setTotalSubmissions(0);
      setReviewedCount(0);
      setBestScore(null);
      setLastSubmittedAt(null);
      setMaterialsTouched(0);
      try {
        const res = await fetch(`/api/students/${student.id}/submissions`, { credentials: "include" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message || "Gagal memuat detail siswa.");
        }
        const data = (await res.json()) as StudentSubmission[];
        const submissions = Array.isArray(data) ? data : [];

        setTotalSubmissions(submissions.length);
        setReviewedCount(submissions.filter((s) => typeof s.revised_score === "number").length);

        const numericScores = submissions
          .map((s) => (typeof s.revised_score === "number" ? s.revised_score : s.skor_ai))
          .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
        if (numericScores.length > 0) {
          const avg = numericScores.reduce((a, b) => a + b, 0) / numericScores.length;
          setAvgScore(Math.round(avg * 100) / 100);
          setBestScore(Math.max(...numericScores));
        }

        const latestSubmission = [...submissions]
          .filter((s) => s.submitted_at)
          .sort((a, b) => new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime())[0];
        if (latestSubmission) {
          const mapped = questionMaterialMap[latestSubmission.question_id];
          setLastAccess({
            materialTitle: mapped?.materialTitle || "Materi tidak ditemukan",
            when: latestSubmission.submitted_at || "",
          });
          setLastSubmittedAt(latestSubmission.submitted_at || "");
        }

        const materialSet = new Set(
          submissions
            .map((s) => questionMaterialMap[s.question_id]?.materialId)
            .filter((v): v is string => Boolean(v))
        );
        setMaterialsTouched(materialSet.size);
      } catch (err: any) {
        setError(err.message || "Gagal memuat detail siswa.");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [isOpen, student, questionMaterialMap]);

  if (!isOpen || !student) return null;
  const reviewRate = totalSubmissions > 0 ? Math.round((reviewedCount / totalSubmissions) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/45 p-4 flex items-center justify-center">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Tutup"
        >
          <FiX />
        </button>

        <h3 className="text-lg font-semibold text-slate-900">Profil Siswa</h3>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              {student.foto_profil_url ? (
                <img
                  src={student.foto_profil_url}
                  alt={`Foto ${student.student_name}`}
                  className="h-16 w-16 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-slate-900 text-white text-xl font-semibold flex items-center justify-center">
                  {getInitial(student.student_name)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-lg font-semibold text-slate-900 truncate">{student.student_name}</p>
                <p className="text-sm text-slate-500 truncate">@{deriveUsername(student)}</p>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <ProfileLine label="Username" value={`@${deriveUsername(student)}`} />
              <ProfileLine label="Email" value={student.student_email} />
              <ProfileLine label="Kelas" value={student.kelas_tingkat || "-"} />
              <ProfileLine label="NIS/NISN" value={student.nomor_identitas || "-"} />
              <ProfileLine label="Institusi" value={student.institusi || "-"} />
              <ProfileLine label="Tanggal Lahir" value={formatDateLabel(student.tanggal_lahir ?? undefined)} />
              <ProfileLine label="Gabung Kelas" value={formatDateTimeLabel(student.joined_at)} />
              <ProfileLine label="Login Terakhir" value={formatDateTimeLabel(student.last_login_at ?? undefined)} />
            </div>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="text-sm text-slate-500">Memuat statistik siswa...</div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard icon={<FiAward />} label="Nilai Rata-rata" value={avgScore != null ? String(avgScore) : "-"} />
                  <StatCard icon={<FiBarChart2 />} label="Nilai Tertinggi" value={bestScore != null ? String(bestScore) : "-"} />
                  <StatCard icon={<FiBookOpen />} label="Total Submisi" value={String(totalSubmissions)} />
                  <StatCard icon={<FiCheckCircle />} label="Review Guru" value={`${reviewedCount}/${totalSubmissions}`} />
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-500">Progress Review</p>
                  <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-slate-900" style={{ width: `${reviewRate}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{reviewRate}% submisi sudah direview guru.</p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                  <p className="text-xs text-slate-500">Aktivitas Terbaru</p>
                  <div className="flex items-start gap-2 text-sm text-slate-700">
                    <FiActivity className="mt-0.5 text-slate-400" />
                    <div>
                      <p className="font-medium text-slate-900">{lastAccess?.materialTitle || "-"}</p>
                      <p className="text-xs text-slate-500">Materi terakhir diakses</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <FiClock /> {lastSubmittedAt ? formatDateTimeLabel(lastSubmittedAt) : "-"}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-500">Cakupan Materi</p>
                  <p className="mt-1 text-sm font-medium text-slate-900 inline-flex items-center gap-2">
                    <FiLayers className="text-slate-500" />
                    {materialsTouched} materi sudah pernah dikerjakan
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
      </div>
    </div>
  );
}

function ProfileLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <p className="text-slate-500">{label}</p>
      <p className="text-slate-900 font-medium break-words">{value || "-"}</p>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">{label}</p>
        <span className="text-slate-500">{icon}</span>
      </div>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function InviteStudentModal({
  isOpen,
  onClose,
  classId,
  onInvite,
}: {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  onInvite: (studentId: string) => Promise<boolean>;
}) {
  const [students, setStudents] = useState<InvitableStudent[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!isOpen) return;
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/classes/${classId}/invitable-students`, { credentials: "include" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message || "Gagal memuat daftar siswa.");
        }
        const data = await res.json();
        setStudents(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setError(err?.message || "Gagal memuat daftar siswa.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen, classId]);

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(query.trim().toLowerCase()) ||
      s.email.toLowerCase().includes(query.trim().toLowerCase())
  );

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/45 p-4 flex items-center justify-center">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Tutup"
        >
          <FiX />
        </button>
        <h3 className="text-lg font-semibold text-slate-900">Pilih Siswa untuk Invite</h3>
        <div className="mt-3">
          <SearchInput placeholder="Cari nama/email siswa..." value={query} onChange={setQuery} />
        </div>

        <div className="mt-4 max-h-[55vh] overflow-y-auto space-y-2 pr-1">
          {loading && <p className="text-sm text-slate-500">Memuat daftar siswa...</p>}
          {!loading && filtered.length === 0 && <p className="text-sm text-slate-500">Tidak ada siswa tersedia untuk invite.</p>}
          {!loading &&
            filtered.map((s) => (
              <div key={s.id} className="rounded-lg border border-slate-200 p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{s.name}</p>
                  <p className="text-xs text-slate-500">{s.email}</p>
                </div>
                <button
                  type="button"
                  className="sage-button !px-3 !py-1.5 text-xs"
                  disabled={invitingId === s.id}
                  onClick={async () => {
                    setInvitingId(s.id);
                    const ok = await onInvite(s.id);
                    setInvitingId(null);
                    if (ok) {
                      setStudents((prev) => prev.filter((item) => item.id !== s.id));
                    }
                  }}
                >
                  {invitingId === s.id ? "Mengundang..." : "Invite"}
                </button>
              </div>
            ))}
        </div>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </div>
    </div>
  );
}
