"use client";

import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { TeacherPenilaianView } from "@/app/dashboard/teacher/penilaian/TeacherPenilaianView";
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
  FiChevronDown,
  FiChevronUp,
} from "react-icons/fi";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import LoadingDialog from "@/components/ui/LoadingDialog";
import {
  AddMaterialNameModal,
  EditMaterialQuickModal,
  InviteStudentModal,
  StudentProfileModal,
} from "./ClassDetailModals";
import WorkspaceSidebar, { type WorkspaceTab } from "./WorkspaceSidebar";

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
  display_order?: number;
  material_type?: "materi" | "soal" | "tugas";
  isi_materi?: string;
  file_url?: string;
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

interface TeachingModule {
  id: string;
  class_id: string;
  nama_modul: string;
  file_url: string;
  created_at: string;
  updated_at: string;
}

interface MaterialQuestionPreview {
  id: string;
  teks_soal?: string;
  level_kognitif?: string;
  weight?: number;
}

type MaterialBlockType = "heading" | "paragraph" | "video" | "image" | "link" | "pdf" | "ppt" | "bullet_list" | "number_list";
type BlockAlign = "left" | "center" | "right" | "justify";
type MediaSize = "small" | "medium" | "large" | "full";

interface MaterialContentBlock {
  id: string;
  type: MaterialBlockType;
  value: string;
  align?: BlockAlign;
  size?: MediaSize;
}

type SectionContentType = "materi" | "soal" | "tugas" | "penilaian" | "gambar" | "video" | "upload";
type TaskSubmissionType = "teks" | "file" | "keduanya";

interface SectionContentCardData {
  id: string;
  type: SectionContentType;
  title: string;
  body: string;
  created_at: string;
  meta?: {
    materi_mode?: "singkat" | "lengkap";
    materi_description?: string;
    description?: string;
    tugas_instruction?: string;
    tugas_due_at?: string;
    tugas_max_score?: number;
    tugas_submission_type?: TaskSubmissionType;
    tugas_allowed_formats?: string[];
    tugas_max_file_mb?: number;
    tugas_attachment_url?: string;
    tugas_attachment_name?: string;
    question_ids?: string[];
    teks_soal?: string;
    level_kognitif?: string;
    keywords?: string[];
    ideal_answer?: string;
    weight?: number;
    round_score_to_5?: boolean;
  };
}

const TASK_FORMAT_GROUPS: Array<{ label: string; items: string[] }> = [
  { label: "Dokumen", items: ["pdf", "doc", "docx", "ppt", "pptx", "txt"] },
  { label: "Gambar", items: ["png", "jpg", "jpeg", "webp"] },
];

const API_URL = "/api";

export default function ClassDetailsPage() {
  const { isAuthenticated, user } = useAuth();
  const params = useParams();
  const classId = params.classId as string;

  const [classDetail, setClassDetail] = useState<ClassDetail | null>(null);
  const [students, setStudents] = useState<ClassMember[]>([]);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<PendingJoinRequest[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [teachingModules, setTeachingModules] = useState<TeachingModule[]>([]);
  const [questionCountByMaterial, setQuestionCountByMaterial] = useState<Record<string, number>>({});
  const [questionMaterialMap, setQuestionMaterialMap] = useState<Record<string, { materialId: string; materialTitle: string }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [materialQuery, setMaterialQuery] = useState("");
  const [materialSort, setMaterialSort] = useState<"newest" | "alpha">("newest");
  const [studentQuery, setStudentQuery] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<"materials" | "modules" | "students" | "assessment" | "analytics">("materials");
  const [isWorkspaceSidebarCollapsed, setIsWorkspaceSidebarCollapsed] = useState(false);
  const [showClassDescription, setShowClassDescription] = useState(false);

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
    const materialsCount = materials.length;
    const materialsWithQuestion = materials.filter((m) => (questionCountByMaterial[m.id] || 0) > 0).length;
    const sectionsWithoutQuestion = Math.max(0, materialsCount - materialsWithQuestion);
    return {
      pendingAssessmentCount: sectionsWithoutQuestion,
    };
  }, [materials, questionCountByMaterial]);
  const workspaceTabs: WorkspaceTab[] = [
    { id: "materials", label: "Materi", badge: String(materials.length) },
    { id: "modules", label: "Modul Ajar", badge: String(teachingModules.length) },
    { id: "students", label: "Siswa", badge: String(students.length) },
    { id: "assessment", label: "Penilaian", badge: String(summary.pendingAssessmentCount) },
    { id: "analytics", label: "Analitik" },
  ];
  const activeWorkspace = workspaceTabs.find((tab) => tab.id === activeWorkspaceTab) || workspaceTabs[0];

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
    <div className="teacher-class-view space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <Link
          href="/dashboard/teacher/classes"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-100"
        >
          <FiArrowLeft /> Kembali ke Daftar Kelas
        </Link>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">{classDetail.class_name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setAddMaterialModalOpen(true)}
                className="sage-button !px-3 !py-2 text-xs"
              >
                <FiPlus />
                Tambah Section
              </button>
              <button
                type="button"
                onClick={() => setActiveWorkspaceTab("assessment")}
                className="sage-button-outline !px-3 !py-2 text-xs"
              >
                <FiClipboard />
                Buka Penilaian
              </button>
            </div>
            {classDetail.deskripsi && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Deskripsi Kelas</p>
                  <button
                    type="button"
                    onClick={() => setShowClassDescription((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
                  >
                    {showClassDescription ? "Sembunyikan" : "Tampilkan"}
                    {showClassDescription ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />}
                  </button>
                </div>
                <p className={`text-sm text-slate-600 leading-relaxed ${showClassDescription ? "mt-2" : "mt-1 line-clamp-2"}`}>
                  {classDetail.deskripsi}
                </p>
              </div>
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

      <section
        className={`grid gap-4 lg:items-start ${
          isWorkspaceSidebarCollapsed ? "lg:grid-cols-[52px_1fr]" : "lg:grid-cols-[220px_1fr]"
        }`}
      >
        <WorkspaceSidebar
          collapsed={isWorkspaceSidebarCollapsed}
          tabs={workspaceTabs}
          activeTab={activeWorkspaceTab}
          onToggleCollapsed={setIsWorkspaceSidebarCollapsed}
          onSelectTab={setActiveWorkspaceTab}
        />

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Workspace Aktif</p>
                <p className="text-sm font-semibold text-slate-900">{activeWorkspace.label}</p>
              </div>
              <div className="text-xs text-slate-500">
                {activeWorkspaceTab === "materials" && `${filteredMaterials.length} konten ditampilkan`}
                {activeWorkspaceTab === "students" && `${filteredStudents.length} siswa ditampilkan`}
                {activeWorkspaceTab === "modules" && `${teachingModules.length} modul ajar`}
                {activeWorkspaceTab === "assessment" && "Mode penilaian kelas aktif"}
                {activeWorkspaceTab === "analytics" && "Ringkasan performa kelas"}
              </div>
            </div>
          </div>
          {activeWorkspaceTab === "materials" && (
            <div className="bg-slate-50 p-4 sm:p-6">
            <MaterialsPane
              classId={classId}
              userId={user?.id || ""}
              items={filteredMaterials}
              query={materialQuery}
              sort={materialSort}
              onSortChange={setMaterialSort}
              onQueryChange={setMaterialQuery}
              onAdd={() => setAddMaterialModalOpen(true)}
              onUpdated={fetchClassData}
            />
            </div>
          )}

          {activeWorkspaceTab === "modules" && (
            <div className="bg-slate-50 p-4 sm:p-6">
            <TeachingModulesPane
              classId={classId}
              items={teachingModules}
              onUpdated={fetchClassData}
            />
            </div>
          )}

          {activeWorkspaceTab === "students" && (
            <div className="bg-slate-50 p-4 sm:p-6">
            <StudentsPane
              items={filteredStudents}
              query={studentQuery}
              onQueryChange={setStudentQuery}
              questionMaterialMap={questionMaterialMap}
              pendingRequests={pendingJoinRequests}
              classId={classId}
              onUpdated={fetchClassData}
            />
            </div>
          )}

          {activeWorkspaceTab === "assessment" && (
            <div className="bg-slate-50 p-4 sm:p-6">
              <TeacherPenilaianView scopedClassIdOverride={classId} />
            </div>
          )}

          {activeWorkspaceTab === "analytics" && (
            <div className="bg-slate-50 p-4 sm:p-6">
            <AnalyticsPane students={students.length} materials={materials.length} />
            </div>
          )}
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
  classId,
  userId,
  items,
  query,
  sort,
  onSortChange,
  onQueryChange,
  onAdd,
  onUpdated,
}: {
  classId: string;
  userId: string;
  items: Material[];
  query: string;
  sort: "newest" | "alpha";
  onSortChange: (v: "newest" | "alpha") => void;
  onQueryChange: (v: string) => void;
  onAdd: () => void;
  onUpdated: () => void;
}) {
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteSection, setConfirmDeleteSection] = useState<Material | null>(null);
  const [localMaterials, setLocalMaterials] = useState<Material[]>(items);
  const [questionByMaterial, setQuestionByMaterial] = useState<Record<string, MaterialQuestionPreview[]>>({});
  const [loadingQuestionByMaterial, setLoadingQuestionByMaterial] = useState<Record<string, boolean>>({});
  const [questionErrorByMaterial, setQuestionErrorByMaterial] = useState<Record<string, string>>({});
  const [expandedMaterials, setExpandedMaterials] = useState<Record<string, boolean>>({});
  const [sectionOrderIds, setSectionOrderIds] = useState<string[]>([]);
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [dropTargetSectionId, setDropTargetSectionId] = useState<string | null>(null);
  const [draggingContentCardKey, setDraggingContentCardKey] = useState<string | null>(null);
  const [dropTargetContentCardKey, setDropTargetContentCardKey] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState("");
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [quickAddTarget, setQuickAddTarget] = useState<Material | null>(null);
  const [quickAddLockedType, setQuickAddLockedType] = useState<SectionContentType | null>(null);
  const [editingSection, setEditingSection] = useState<Material | null>(null);
  const [quickAddError, setQuickAddError] = useState("");
  const [contentActionError, setContentActionError] = useState("");
  const [sectionCrudError, setSectionCrudError] = useState("");
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [showSectionOrdinalBadge, setShowSectionOrdinalBadge] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"all" | "materi" | "soal" | "tugas">("all");
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState<"" | "duplicate" | "delete">("");
  const [editingContentCard, setEditingContentCard] = useState<{ material: Material; card: SectionContentCardData } | null>(null);
  const [collapsedContentCards, setCollapsedContentCards] = useState<Record<string, boolean>>({});
  const [materialContentById, setMaterialContentById] = useState<Record<string, string>>({});
  const dragPreviewRef = useRef<HTMLDivElement | null>(null);
  const contentDragPreviewRef = useRef<HTMLDivElement | null>(null);
  const sectionItemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const sectionPrevRectsRef = useRef<Record<string, DOMRect>>({});
  const sectionReorderSourceRef = useRef<"button" | "drag" | null>(null);
  const contentCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const contentCardPrevRectsRef = useRef<Record<string, DOMRect>>({});
  const contentReorderSourceRef = useRef<"button" | "drag" | null>(null);
  const questionByMaterialRef = useRef<Record<string, MaterialQuestionPreview[]>>({});
  const loadingQuestionByMaterialRef = useRef<Record<string, boolean>>({});
  const hasInitializedOrderRef = useRef(false);

  useEffect(() => {
    setLocalMaterials(items);
  }, [items]);

  useEffect(() => {
    if (!userId) return;
    try {
      const stored = window.localStorage.getItem(`teacher-class:show-section-ordinal:${userId}`);
      setShowSectionOrdinalBadge(stored !== "0");
    } catch {
      setShowSectionOrdinalBadge(true);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    try {
      window.localStorage.setItem(`teacher-class:show-section-ordinal:${userId}`, showSectionOrdinalBadge ? "1" : "0");
    } catch {
      // ignore
    }
  }, [showSectionOrdinalBadge, userId]);

  useEffect(() => {
    if (localMaterials.length === 0) {
      hasInitializedOrderRef.current = false;
      setSectionOrderIds([]);
      return;
    }

    setSectionOrderIds((prev) => {
      const itemIdsByDisplayOrder = [...localMaterials]
        .sort((a, b) => {
          const aOrder = typeof a.display_order === "number" ? a.display_order : Number.MAX_SAFE_INTEGER;
          const bOrder = typeof b.display_order === "number" ? b.display_order : Number.MAX_SAFE_INTEGER;
          if (aOrder !== bOrder) return aOrder - bOrder;
          const aTime = new Date(a.created_at || 0).getTime();
          const bTime = new Date(b.created_at || 0).getTime();
          return aTime - bTime;
        })
        .map((item) => item.id);

      if (!hasInitializedOrderRef.current) {
        hasInitializedOrderRef.current = true;
        return itemIdsByDisplayOrder;
      }

      const preserved = prev.filter((id) => itemIdsByDisplayOrder.includes(id));
      const appended = itemIdsByDisplayOrder.filter((id) => !preserved.includes(id));
      return [...preserved, ...appended];
    });
  }, [localMaterials]);

  const orderedItems = useMemo(() => {
    if (sectionOrderIds.length === 0) return localMaterials;
    const map = new Map(localMaterials.map((item) => [item.id, item]));
    return sectionOrderIds
      .map((id) => map.get(id))
      .filter((item): item is Material => Boolean(item));
  }, [localMaterials, sectionOrderIds]);

  const filteredByTypeItems = useMemo(
    () =>
      typeFilter === "all"
        ? orderedItems
        : orderedItems.filter((material) => (material.material_type || "materi") === typeFilter),
    [orderedItems, typeFilter]
  );

  useLayoutEffect(() => {
    const reorderSource = sectionReorderSourceRef.current;
    const transition =
      reorderSource === "button"
        ? "transform 360ms cubic-bezier(0.16, 1, 0.3, 1)"
        : reorderSource === "drag"
          ? "transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)"
          : "transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1)";
    const nextRects: Record<string, DOMRect> = {};
    orderedItems.forEach((material) => {
      const node = sectionItemRefs.current[material.id];
      if (node) {
        nextRects[material.id] = node.getBoundingClientRect();
      }
    });

    Object.entries(nextRects).forEach(([id, nextRect]) => {
      const prevRect = sectionPrevRectsRef.current[id];
      if (!prevRect) return;
      const dx = prevRect.left - nextRect.left;
      const dy = prevRect.top - nextRect.top;
      if (dx === 0 && dy === 0) return;
      const node = sectionItemRefs.current[id];
      if (!node) return;
      node.style.transition = "none";
      node.style.transform = `translate(${dx}px, ${dy}px)`;
      node.style.willChange = "transform";
      requestAnimationFrame(() => {
        node.style.transition = transition;
        node.style.transform = "translate(0, 0)";
        const clearStyles = () => {
          node.style.transition = "";
          node.style.transform = "";
          node.style.willChange = "";
        };
        node.addEventListener("transitionend", clearStyles, { once: true });
      });
    });

    sectionPrevRectsRef.current = nextRects;
    sectionReorderSourceRef.current = null;
  }, [orderedItems]);

  useLayoutEffect(() => {
    const reorderSource = contentReorderSourceRef.current;
    const transition =
      reorderSource === "button"
        ? "transform 340ms cubic-bezier(0.16, 1, 0.3, 1)"
        : reorderSource === "drag"
          ? "transform 170ms cubic-bezier(0.2, 0.8, 0.2, 1)"
          : "transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)";
    const nextRects: Record<string, DOMRect> = {};
    Object.entries(contentCardRefs.current).forEach(([key, node]) => {
      if (!node) return;
      nextRects[key] = node.getBoundingClientRect();
    });

    Object.entries(nextRects).forEach(([key, nextRect]) => {
      const prevRect = contentCardPrevRectsRef.current[key];
      if (!prevRect) return;
      const dx = prevRect.left - nextRect.left;
      const dy = prevRect.top - nextRect.top;
      if (dx === 0 && dy === 0) return;
      const node = contentCardRefs.current[key];
      if (!node) return;
      node.style.transition = "none";
      node.style.transform = `translate(${dx}px, ${dy}px)`;
      node.style.willChange = "transform";
      requestAnimationFrame(() => {
        node.style.transition = transition;
        node.style.transform = "translate(0, 0)";
        const clearStyles = () => {
          node.style.transition = "";
          node.style.transform = "";
          node.style.willChange = "";
        };
        node.addEventListener("transitionend", clearStyles, { once: true });
      });
    });

    contentCardPrevRectsRef.current = nextRects;
    contentReorderSourceRef.current = null;
  }, [materialContentById, orderedItems]);

  useEffect(() => {
    setMaterialContentById((prev) => {
      const next: Record<string, string> = {};
      orderedItems.forEach((material) => {
        if (typeof prev[material.id] === "string") {
          next[material.id] = prev[material.id];
        } else {
          next[material.id] = material.isi_materi || "";
        }
      });
      return next;
    });
  }, [orderedItems]);

  const getMaterialContent = useCallback(
    (material: Material) => {
      if (typeof materialContentById[material.id] === "string") return materialContentById[material.id];
      return material.isi_materi || "";
    },
    [materialContentById]
  );

  const persistSectionOrder = useCallback(async (nextOrderIds: string[], prevOrderIds: string[]) => {
    setIsSavingOrder(true);
    setReorderError("");
    try {
      const res = await fetch(`/api/classes/${classId}/materials/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ordered_material_ids: nextOrderIds }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Gagal menyimpan urutan section.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal menyimpan urutan section.";
      setReorderError(message);
      setSectionOrderIds(prevOrderIds);
    } finally {
      setIsSavingOrder(false);
    }
  }, [classId]);

  const moveSection = useCallback((materialId: string, direction: "up" | "down") => {
    sectionReorderSourceRef.current = "button";
    setSectionOrderIds((prev) => {
      const idx = prev.indexOf(materialId);
      if (idx === -1) return prev;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      void persistSectionOrder(next, prev);
      return next;
    });
  }, [persistSectionOrder]);

  const moveSectionByDrop = useCallback((dragId: string, dropId: string) => {
    if (!dragId || !dropId || dragId === dropId) return;
    sectionReorderSourceRef.current = "drag";
    setSectionOrderIds((prev) => {
      const fromIdx = prev.indexOf(dragId);
      const toIdx = prev.indexOf(dropId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      void persistSectionOrder(next, prev);
      return next;
    });
  }, [persistSectionOrder]);

  const clearDragPreview = useCallback(() => {
    if (dragPreviewRef.current) {
      dragPreviewRef.current.remove();
      dragPreviewRef.current = null;
    }
  }, []);

  const clearContentDragPreview = useCallback(() => {
    if (contentDragPreviewRef.current) {
      contentDragPreviewRef.current.remove();
      contentDragPreviewRef.current = null;
    }
  }, []);

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLElement>, materialId: string, sectionNumber: number, title: string) => {
      clearDragPreview();
      const preview = document.createElement("div");
      preview.style.position = "fixed";
      preview.style.top = "-9999px";
      preview.style.left = "-9999px";
      preview.style.padding = "8px 10px";
      preview.style.border = "1px solid #94a3b8";
      preview.style.borderRadius = "10px";
      preview.style.background = "#f8fafc";
      preview.style.boxShadow = "0 8px 20px rgba(15, 23, 42, 0.18)";
      preview.style.fontSize = "13px";
      preview.style.fontWeight = "600";
      preview.style.color = "#0f172a";
      preview.style.maxWidth = "420px";
      preview.style.whiteSpace = "nowrap";
      preview.style.overflow = "hidden";
      preview.style.textOverflow = "ellipsis";
      preview.textContent = `Section ${sectionNumber} - ${title}`;
      document.body.appendChild(preview);
      dragPreviewRef.current = preview;

      e.dataTransfer.setDragImage(preview, 18, 14);
      setDraggingSectionId(materialId);
      setDropTargetSectionId(materialId);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", materialId);
    },
    [clearDragPreview]
  );

  const handleDragEnd = useCallback(() => {
    setDraggingSectionId(null);
    setDropTargetSectionId(null);
    clearDragPreview();
  }, [clearDragPreview]);

  const persistSectionCards = useCallback(
    async (material: Material, cards: SectionContentCardData[]) => {
      const serialized = serializeSectionContentCards(cards);
      const res = await fetch(`/api/materials/${material.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          isi_materi: serialized,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Gagal menyimpan perubahan konten.");
      setMaterialContentById((prev) => ({
        ...prev,
        [material.id]: serialized,
      }));
    },
    []
  );

  const moveContentCard = useCallback(
    async (material: Material, cardId: string, direction: "up" | "down") => {
      if (!cardId) return;
      contentReorderSourceRef.current = "button";
      setContentActionError("");
      const currentCards = parseSectionContentCards(getMaterialContent(material));
      const idx = currentCards.findIndex((card) => card.id === cardId);
      if (idx === -1) return;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= currentCards.length) return;
      const nextCards = [...currentCards];
      [nextCards[idx], nextCards[targetIdx]] = [nextCards[targetIdx], nextCards[idx]];
      const currentSerialized = serializeSectionContentCards(currentCards);
      const nextSerialized = serializeSectionContentCards(nextCards);
      setMaterialContentById((prev) => ({
        ...prev,
        [material.id]: nextSerialized,
      }));
      try {
        await persistSectionCards(material, nextCards);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Gagal mengatur urutan konten.";
        setContentActionError(message);
        setMaterialContentById((prev) => ({
          ...prev,
          [material.id]: currentSerialized,
        }));
      }
    },
    [getMaterialContent, persistSectionCards]
  );

  const moveContentCardByDrop = useCallback(
    async (material: Material, dragCardId: string, dropCardId: string) => {
      if (!dragCardId || !dropCardId || dragCardId === dropCardId) return;
      contentReorderSourceRef.current = "drag";
      setContentActionError("");
      const currentCards = parseSectionContentCards(getMaterialContent(material));
      const fromIdx = currentCards.findIndex((card) => card.id === dragCardId);
      const toIdx = currentCards.findIndex((card) => card.id === dropCardId);
      if (fromIdx === -1 || toIdx === -1) return;

      const nextCards = [...currentCards];
      const [movedCard] = nextCards.splice(fromIdx, 1);
      nextCards.splice(toIdx, 0, movedCard);
      const currentSerialized = serializeSectionContentCards(currentCards);
      const nextSerialized = serializeSectionContentCards(nextCards);

      setMaterialContentById((prev) => ({
        ...prev,
        [material.id]: nextSerialized,
      }));
      try {
        await persistSectionCards(material, nextCards);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Gagal menyimpan urutan konten.";
        setContentActionError(message);
        setMaterialContentById((prev) => ({
          ...prev,
          [material.id]: currentSerialized,
        }));
      }
    },
    [getMaterialContent, persistSectionCards]
  );

  const handleContentCardDragStart = useCallback(
    (
      e: React.DragEvent<HTMLElement>,
      materialId: string,
      cardId: string,
      cardNumber: number,
      title: string,
      sectionCardIds: string[]
    ) => {
      clearContentDragPreview();
      const preview = document.createElement("div");
      preview.style.position = "fixed";
      preview.style.top = "-9999px";
      preview.style.left = "-9999px";
      preview.style.padding = "8px 10px";
      preview.style.border = "1px solid #94a3b8";
      preview.style.borderRadius = "10px";
      preview.style.background = "#f8fafc";
      preview.style.boxShadow = "0 8px 20px rgba(15, 23, 42, 0.18)";
      preview.style.fontSize = "13px";
      preview.style.fontWeight = "600";
      preview.style.color = "#0f172a";
      preview.style.maxWidth = "420px";
      preview.style.whiteSpace = "nowrap";
      preview.style.overflow = "hidden";
      preview.style.textOverflow = "ellipsis";
      preview.textContent = `Card ${cardNumber} - ${title}`;
      document.body.appendChild(preview);
      contentDragPreviewRef.current = preview;

      e.dataTransfer.setDragImage(preview, 18, 14);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("application/x-sage-content-card", JSON.stringify({ materialId, cardId }));
      setDraggingContentCardKey(`${materialId}:${cardId}`);
      setDropTargetContentCardKey(`${materialId}:${cardId}`);
      setCollapsedContentCards((prev) => ({
        ...prev,
        ...Object.fromEntries(sectionCardIds.map((id) => [`${materialId}:${id}`, true])),
      }));
      e.stopPropagation();
    },
    [clearContentDragPreview]
  );

  const handleContentCardDragEnd = useCallback(() => {
    setDraggingContentCardKey(null);
    setDropTargetContentCardKey(null);
    clearContentDragPreview();
  }, [clearContentDragPreview]);

  const openQuickAdd = useCallback((material: Material, lockedType: SectionContentType | null = null) => {
    setQuickAddTarget(material);
    setQuickAddLockedType(lockedType);
  }, []);

  const closeQuickAdd = useCallback(() => {
    setQuickAddTarget(null);
    setQuickAddLockedType(null);
  }, []);

  const handleQuickAddContent = useCallback(
    async (payload: {
      type: SectionContentType;
      title: string;
      body: string;
      materi_mode?: "singkat" | "lengkap";
      materi_description?: string;
      description?: string;
      tugas?: {
        instruction: string;
        due_at?: string;
        submission_type: TaskSubmissionType;
        allowed_formats: string[];
        max_file_mb?: number;
      };
    }) => {
      if (!quickAddTarget) return;
      setQuickAddError("");
      const currentContent = getMaterialContent(quickAddTarget);
      const existingCards = parseSectionContentCards(currentContent);
      const nextCards = [...existingCards];

      // Preserve legacy material content as first card when migrating to card mode.
      if (nextCards.length === 0) {
        const legacy = (currentContent || "").trim();
        if (legacy) {
          nextCards.push({
            id: createSectionContentCardId(),
            type: toSectionContentType(quickAddTarget.material_type),
            title: "Konten Utama",
            body: legacy,
            created_at: quickAddTarget.created_at || new Date().toISOString(),
          });
        }
      }
      let linkedTaskQuestionId: string | null = null;
      if (payload.type === "tugas") {
        const promptText = (payload.tugas?.instruction || payload.body || "").trim() || "Kumpulkan tugas Anda pada form jawaban di bawah ini.";
        const createQuestionRes = await fetch("/api/essay-questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            material_id: quickAddTarget.id,
            teks_soal: promptText,
            keywords: ["tugas_submission"],
            ideal_answer: "",
            weight: 1,
            round_score_to_5: false,
            rubrics: [],
          }),
        });
        const createQuestionBody = await createQuestionRes.json().catch(() => ({}));
        if (!createQuestionRes.ok) {
          throw new Error(createQuestionBody?.message || "Gagal membuat soal tugas.");
        }
        if (typeof createQuestionBody?.id === "string" && createQuestionBody.id.trim().length > 0) {
          linkedTaskQuestionId = createQuestionBody.id;
        }
      }

      const newCard: SectionContentCardData = {
        id: createSectionContentCardId(),
        type: payload.type,
        title: payload.title.trim(),
        body:
          payload.type === "materi" && payload.materi_mode === "lengkap"
            ? ""
            : payload.body.trim(),
        created_at: new Date().toISOString(),
        meta:
          payload.type === "materi"
            ? {
                materi_mode: payload.materi_mode || "singkat",
                materi_description:
                  payload.materi_mode === "lengkap" ? (payload.materi_description || "").trim() : undefined,
              }
            : payload.type === "tugas"
              ? {
                  tugas_instruction: payload.tugas?.instruction || payload.body.trim(),
                  tugas_due_at: payload.tugas?.due_at || undefined,
                  tugas_submission_type: payload.tugas?.submission_type || "teks",
                  tugas_allowed_formats: payload.tugas?.allowed_formats || [],
                  tugas_max_file_mb: payload.tugas?.max_file_mb,
                  question_ids: linkedTaskQuestionId ? [linkedTaskQuestionId] : [],
                }
            : payload.type === "soal"
              ? undefined
            : ((payload.description || "").trim() ? { description: (payload.description || "").trim() } : undefined),
      };
      nextCards.unshift(newCard);

      const res = await fetch(`/api/materials/${quickAddTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          isi_materi: serializeSectionContentCards(nextCards),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Gagal menambah konten.");
      setMaterialContentById((prev) => ({
        ...prev,
        [quickAddTarget.id]: serializeSectionContentCards(nextCards),
      }));
      setCollapsedContentCards((prev) => ({
        ...prev,
        [`${quickAddTarget.id}:${newCard.id}`]: false,
      }));
      setExpandedMaterials((prev) => ({
        ...prev,
        [quickAddTarget.id]: true,
      }));
      if (linkedTaskQuestionId) {
        setQuestionByMaterial((prev) => {
          const current = Array.isArray(prev[quickAddTarget.id]) ? prev[quickAddTarget.id] : [];
          if (current.some((q) => q.id === linkedTaskQuestionId)) return prev;
          return {
            ...prev,
            [quickAddTarget.id]: [
              ...current,
              {
                id: linkedTaskQuestionId,
                teks_soal: payload.tugas?.instruction || payload.body.trim(),
                level_kognitif: "",
                weight: 1,
              },
            ],
          };
        });
      }
      closeQuickAdd();
    },
    [closeQuickAdd, getMaterialContent, quickAddTarget]
  );

  const handleDeleteContentCard = useCallback(
    async (material: Material, card: SectionContentCardData) => {
      setContentActionError("");
      try {
        const linkedQuestionIds = (
          Array.isArray(card.meta?.question_ids)
            ? card.meta.question_ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
            : []
        ).filter((id, idx, arr) => arr.indexOf(id) === idx);
        if ((card.type === "soal" || card.type === "tugas") && linkedQuestionIds.length > 0) {
          for (const questionId of linkedQuestionIds) {
            const delQ = await fetch(`/api/essay-questions/${questionId}`, {
              method: "DELETE",
              credentials: "include",
            });
            if (!delQ.ok && delQ.status !== 404) {
              const qBody = await delQ.json().catch(() => ({}));
              throw new Error(qBody?.message || "Gagal menghapus soal terkait.");
            }
          }
        }
        const cards = parseSectionContentCards(getMaterialContent(material)).filter((x) => x.id !== card.id);
        await persistSectionCards(material, cards);
        if ((card.type === "soal" || card.type === "tugas") && linkedQuestionIds.length > 0) {
          setQuestionByMaterial((prev) => ({
            ...prev,
            [material.id]: (prev[material.id] || []).filter((q) => !linkedQuestionIds.includes(q.id)),
          }));
        }
      } catch (err: any) {
        setContentActionError(err?.message || "Gagal menghapus konten.");
      }
    },
    [getMaterialContent, persistSectionCards]
  );

  const handleSaveEditContentCard = useCallback(
    async (payload: {
      title: string;
      body: string;
      materi_mode?: "singkat" | "lengkap";
      materi_description?: string;
      description?: string;
      tugas?: {
        instruction: string;
        due_at?: string;
        submission_type: TaskSubmissionType;
        allowed_formats: string[];
        max_file_mb?: number;
      };
      question?: {
        teks_soal: string;
        level_kognitif?: string;
        keywords: string[];
        ideal_answer?: string;
        weight?: number;
        round_score_to_5?: boolean;
      };
    }) => {
      if (!editingContentCard) return;
      setContentActionError("");
      try {
        const { material, card } = editingContentCard;
        const resolvedQuestionIds = Array.isArray(card.meta?.question_ids)
          ? card.meta.question_ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
          : [];

        const cards = parseSectionContentCards(getMaterialContent(material)).map((x) =>
          x.id === card.id
            ? {
                ...x,
                title: payload.title,
                body:
                  card.type === "materi"
                    ? (payload.materi_mode === "singkat" ? payload.body : x.body)
                    : payload.body,
                meta:
                  card.type === "soal"
                    ? {
                        ...(x.meta || {}),
                        question_ids: resolvedQuestionIds,
                      }
                    : card.type === "materi"
                      ? {
                          ...(x.meta || {}),
                          materi_mode: payload.materi_mode || x.meta?.materi_mode || "singkat",
                          materi_description:
                            payload.materi_mode === "lengkap"
                              ? (payload.materi_description || "").trim()
                              : undefined,
                        }
                      : card.type === "tugas"
                        ? {
                            ...(x.meta || {}),
                            tugas_instruction: payload.tugas?.instruction || payload.body,
                            tugas_due_at: payload.tugas?.due_at || undefined,
                            tugas_submission_type: payload.tugas?.submission_type || "teks",
                            tugas_allowed_formats: payload.tugas?.allowed_formats || [],
                            tugas_max_file_mb: payload.tugas?.max_file_mb,
                          }
                      : {
                          ...(x.meta || {}),
                          description: (payload.description || "").trim() || undefined,
                        },
              }
            : x
        );
        await persistSectionCards(material, cards);
        setEditingContentCard(null);
      } catch (err: any) {
        const message = err?.message || "Gagal mengubah konten.";
        setContentActionError(message);
        throw err;
      }
    },
    [editingContentCard, getMaterialContent, persistSectionCards]
  );

  const handleRenameSection = useCallback(
    async (materialId: string, title: string) => {
      setSectionCrudError("");
      const res = await fetch(`/api/materials/${materialId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ judul: title.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Gagal mengubah nama section.");
      setLocalMaterials((prev) =>
        prev.map((m) =>
          m.id === materialId
            ? {
                ...m,
                judul: title.trim(),
                updated_at: new Date().toISOString(),
              }
            : m
        )
      );
    },
    []
  );

  const handleDeleteSection = useCallback(async (material: Material) => {
    setSectionCrudError("");
    const res = await fetch(`/api/materials/${material.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.message || "Gagal menghapus section.");

    setLocalMaterials((prev) => prev.filter((m) => m.id !== material.id));
    setSectionOrderIds((prev) => prev.filter((id) => id !== material.id));
    setExpandedMaterials((prev) => {
      const next = { ...prev };
      delete next[material.id];
      return next;
    });
    setMaterialContentById((prev) => {
      const next = { ...prev };
      delete next[material.id];
      return next;
    });
    setQuestionByMaterial((prev) => {
      const next = { ...prev };
      delete next[material.id];
      return next;
    });
    setQuestionErrorByMaterial((prev) => {
      const next = { ...prev };
      delete next[material.id];
      return next;
    });
    setLoadingQuestionByMaterial((prev) => {
      const next = { ...prev };
      delete next[material.id];
      return next;
    });
  }, []);

  useEffect(() => {
    setExpandedMaterials((prev) => {
      const next: Record<string, boolean> = {};
      orderedItems.forEach((material, idx) => {
        if (typeof prev[material.id] === "boolean") {
          next[material.id] = prev[material.id];
        } else {
          next[material.id] = idx === 0;
        }
      });
      return next;
    });
  }, [orderedItems]);

  useEffect(() => {
    questionByMaterialRef.current = questionByMaterial;
  }, [questionByMaterial]);

  useEffect(() => {
    loadingQuestionByMaterialRef.current = loadingQuestionByMaterial;
  }, [loadingQuestionByMaterial]);

  useEffect(() => {
    const missingIds = orderedItems
      .map((material) => material.id)
      .filter((id) => questionByMaterialRef.current[id] === undefined && !loadingQuestionByMaterialRef.current[id]);
    if (missingIds.length === 0) return;

    setLoadingQuestionByMaterial((prev) => ({
      ...prev,
      ...Object.fromEntries(missingIds.map((id) => [id, true])),
    }));
    loadingQuestionByMaterialRef.current = {
      ...loadingQuestionByMaterialRef.current,
      ...Object.fromEntries(missingIds.map((id) => [id, true])),
    };

    Promise.all(
      missingIds.map(async (materialId) => {
        try {
          const res = await fetch(`/api/materials/${materialId}/essay-questions`, { credentials: "include" });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.message || "Gagal memuat daftar soal.");
          }
          const data = await res.json();
          const normalized = Array.isArray(data)
            ? data
                .map((q) => ({
                  id: String(q?.id || ""),
                  teks_soal: typeof q?.teks_soal === "string" ? q.teks_soal : "",
                  level_kognitif: typeof q?.level_kognitif === "string" ? q.level_kognitif : "",
                  weight: typeof q?.weight === "number" ? q.weight : undefined,
                }))
                .filter((q) => q.id)
            : [];
          return { materialId, questions: normalized, error: "" };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Gagal memuat daftar soal.";
          return { materialId, questions: [] as MaterialQuestionPreview[], error: message };
        }
      })
    ).then((results) => {
      setQuestionByMaterial((prev) => {
        const next = { ...prev };
        results.forEach((result) => {
          next[result.materialId] = result.questions;
        });
        questionByMaterialRef.current = next;
        return next;
      });
      setQuestionErrorByMaterial((prev) => {
        const next = { ...prev };
        results.forEach((result) => {
          next[result.materialId] = result.error;
        });
        return next;
      });
      setLoadingQuestionByMaterial((prev) => {
        const next = { ...prev };
        results.forEach((result) => {
          next[result.materialId] = false;
        });
        loadingQuestionByMaterialRef.current = next;
        return next;
      });
    });
  }, [orderedItems]);

  useEffect(() => {
    setSelectedSectionIds((prev) => prev.filter((id) => filteredByTypeItems.some((m) => m.id === id)));
  }, [filteredByTypeItems]);

  const toggleSelectSection = useCallback((id: string) => {
    setSelectedSectionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedSectionIds((prev) =>
      prev.length === filteredByTypeItems.length ? [] : filteredByTypeItems.map((m) => m.id)
    );
  }, [filteredByTypeItems]);

  const duplicateSelectedSections = useCallback(async () => {
    if (selectedSectionIds.length === 0) return;
    setBulkActionLoading("duplicate");
    setSectionCrudError("");
    try {
      for (const sectionId of selectedSectionIds) {
        const material = orderedItems.find((m) => m.id === sectionId);
        if (!material) continue;
        const createRes = await fetch("/api/materials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            class_id: classId,
            judul: `${material.judul} (Copy)`,
            material_type: material.material_type || "materi",
          }),
        });
        const createBody = await createRes.json().catch(() => ({}));
        if (!createRes.ok || !createBody?.id) {
          throw new Error(createBody?.message || `Gagal menduplikasi section "${material.judul}".`);
        }
        const clonedContent = getMaterialContent(material);
        if (clonedContent || material.capaian_pembelajaran) {
          const updateRes = await fetch(`/api/materials/${createBody.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              isi_materi: clonedContent || undefined,
              capaian_pembelajaran: material.capaian_pembelajaran || undefined,
            }),
          });
          if (!updateRes.ok) {
            const updateBody = await updateRes.json().catch(() => ({}));
            throw new Error(updateBody?.message || `Gagal melengkapi duplikat "${material.judul}".`);
          }
        }
      }
      setSelectedSectionIds([]);
      await onUpdated();
    } catch (err: unknown) {
      setSectionCrudError(err instanceof Error ? err.message : "Gagal menduplikasi section terpilih.");
    } finally {
      setBulkActionLoading("");
    }
  }, [selectedSectionIds, orderedItems, classId, getMaterialContent, onUpdated]);

  const deleteSelectedSections = useCallback(async () => {
    if (selectedSectionIds.length === 0) return;
    const ok = window.confirm(`Hapus ${selectedSectionIds.length} section terpilih?`);
    if (!ok) return;
    setBulkActionLoading("delete");
    setSectionCrudError("");
    try {
      for (const sectionId of selectedSectionIds) {
        const material = orderedItems.find((m) => m.id === sectionId);
        if (!material) continue;
        const res = await fetch(`/api/materials/${material.id}`, {
          method: "DELETE",
          credentials: "include",
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.message || `Gagal menghapus section "${material.judul}".`);
      }
      setSelectedSectionIds([]);
      await onUpdated();
    } catch (err: unknown) {
      setSectionCrudError(err instanceof Error ? err.message : "Gagal menghapus section terpilih.");
    } finally {
      setBulkActionLoading("");
    }
  }, [selectedSectionIds, orderedItems, onUpdated]);

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
              <FiPlus /> Tambah Section
            </button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: "all", label: "Semua" },
              { key: "materi", label: "Materi" },
              { key: "soal", label: "Soal" },
              { key: "tugas", label: "Tugas" },
            ].map((filterItem) => (
              <button
                key={filterItem.key}
                type="button"
                onClick={() => setTypeFilter(filterItem.key as "all" | "materi" | "soal" | "tugas")}
                className={`rounded-full px-3 py-1 text-xs transition ${
                  typeFilter === filterItem.key
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {filterItem.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode("card")}
              className={`rounded-md px-2.5 py-1 text-xs ${
                viewMode === "card" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700"
              }`}
            >
              Card
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`rounded-md px-2.5 py-1 text-xs ${
                viewMode === "table" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700"
              }`}
            >
              Table
            </button>
            <button
              type="button"
              onClick={() => setShowSectionOrdinalBadge((prev) => !prev)}
              className={`rounded-md px-2.5 py-1 text-xs ${
                showSectionOrdinalBadge ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700"
              }`}
              title={showSectionOrdinalBadge ? "Sembunyikan label Section 1/2/..." : "Tampilkan label Section 1/2/..."}
              aria-label={showSectionOrdinalBadge ? "Sembunyikan label section" : "Tampilkan label section"}
            >
              {showSectionOrdinalBadge ? "Hide Section #" : "Show Section #"}
            </button>
          </div>
        </div>
        {selectedSectionIds.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-700">{selectedSectionIds.length} section dipilih</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void duplicateSelectedSections()}
                disabled={bulkActionLoading !== ""}
                className="sage-button-outline !py-1.5 !px-3 text-xs"
              >
                {bulkActionLoading === "duplicate" ? "Menduplikasi..." : "Duplikat"}
              </button>
              <button
                type="button"
                onClick={() => void deleteSelectedSections()}
                disabled={bulkActionLoading !== ""}
                className="sage-button-outline !py-1.5 !px-3 text-xs text-red-700 border-red-200 hover:bg-red-50"
              >
                {bulkActionLoading === "delete" ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">Viewer Konten Per Section</p>
            <p className="text-xs text-slate-500 mt-1">
              {viewMode === "card" ? "Semua section ditampilkan dalam kartu detail." : "Mode tabel untuk review cepat section."}
            </p>
            {isSavingOrder && <p className="mt-1 text-xs text-slate-500">Menyimpan urutan section...</p>}
            {reorderError && <p className="mt-1 text-xs text-red-600">{reorderError}</p>}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Total Section</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{filteredByTypeItems.length}</p>
          </div>
        </div>

        {filteredByTypeItems.length > 0 ? (
          viewMode === "table" ? (
            <div className="overflow-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="w-8 px-3 py-2 text-left">
                      <input
                        type="checkbox"
                        checked={selectedSectionIds.length > 0 && selectedSectionIds.length === filteredByTypeItems.length}
                        onChange={toggleSelectAllVisible}
                      />
                    </th>
                    <th className="px-3 py-2 text-left">Section</th>
                    <th className="px-3 py-2 text-left">Tipe</th>
                    <th className="px-3 py-2 text-left">Konten</th>
                    <th className="px-3 py-2 text-left">Update</th>
                    <th className="px-3 py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredByTypeItems.map((material) => {
                    const sectionContentCards = parseSectionContentCards(getMaterialContent(material));
                    const dominantType = material.material_type || sectionContentCards[0]?.type || "materi";
                    return (
                      <tr key={`tbl-${material.id}`} className="border-t border-slate-200">
                        <td className="px-3 py-2 align-top">
                          <input
                            type="checkbox"
                            checked={selectedSectionIds.includes(material.id)}
                            onChange={() => toggleSelectSection(material.id)}
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <p className="font-semibold text-slate-900">{material.judul}</p>
                          <p className="text-xs text-slate-500">{material.id.slice(0, 8)}</p>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] ${getSectionContentTypeTone(toSectionContentType(dominantType)).badge}`}>
                            {getSectionContentTypeLabel(toSectionContentType(dominantType))}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top text-slate-700">{sectionContentCards.length} card</td>
                        <td className="px-3 py-2 align-top text-slate-600">{formatDateLabel(material.updated_at || material.created_at)}</td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setViewMode("card");
                                setExpandedMaterials((prev) => ({ ...prev, [material.id]: true }));
                              }}
                              className="sage-button-outline !py-1.5 !px-2.5 text-xs"
                            >
                              Buka
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingSection(material)}
                              className="sage-button-outline !py-1.5 !px-2.5 text-xs"
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
          <div className="space-y-3">
            {filteredByTypeItems.map((material, index) => {
              const sectionQuestions = questionByMaterial[material.id] || [];
              const effectiveMaterialContent = getMaterialContent(material);
              const sectionContentCards = parseSectionContentCards(effectiveMaterialContent);
              const soalCards = sectionContentCards.filter((x) => x.type === "soal");
              const questionById = new Map(sectionQuestions.map((q) => [q.id, q]));
              const resolvedQuestionByCardId = new Map<string, MaterialQuestionPreview[]>();
              const usedQuestionIds = new Set<string>();

              // card soal bisa punya banyak soal via question_ids.
              soalCards.forEach((card) => {
                const explicitIds = Array.isArray(card.meta?.question_ids)
                  ? card.meta.question_ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
                  : [];
                const linked = explicitIds
                  .map((id) => questionById.get(id) || null)
                  .filter((q): q is MaterialQuestionPreview => q !== null);
                if (linked.length === 0) return;
                resolvedQuestionByCardId.set(card.id, linked);
                linked.forEach((q) => usedQuestionIds.add(q.id));
              });

              // Fallback untuk data lama tanpa relasi: pasangkan 1 soal sisa berdasarkan urutan card.
              const fallbackQuestions = sectionQuestions.filter((q) => !usedQuestionIds.has(q.id));
              soalCards.forEach((card) => {
                if (resolvedQuestionByCardId.has(card.id)) return;
                const candidate = fallbackQuestions.shift();
                if (!candidate) return;
                resolvedQuestionByCardId.set(card.id, [candidate]);
                usedQuestionIds.add(candidate.id);
              });
              const isExpanded = expandedMaterials[material.id] ?? index === 0;
              const compactDragMode = draggingSectionId !== null;
              const collapsedSummaryMode = !compactDragMode && !isExpanded;
              const showExpandedContent = !compactDragMode && isExpanded;
              const isDropTarget = dropTargetSectionId === material.id && draggingSectionId !== material.id;
              return (
                <div
                  key={material.id}
                  ref={(node) => {
                    sectionItemRefs.current[material.id] = node;
                  }}
                  onDragOver={(e) => {
                    if (draggingContentCardKey) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dropTargetSectionId !== material.id) {
                      setDropTargetSectionId(material.id);
                    }
                  }}
                  onDrop={(e) => {
                    if (draggingContentCardKey) return;
                    e.preventDefault();
                    const draggedId = e.dataTransfer.getData("text/plain") || draggingSectionId || "";
                    moveSectionByDrop(draggedId, material.id);
                    handleDragEnd();
                  }}
                  className={`rounded-lg border bg-slate-50 ${compactDragMode ? "p-3" : "p-4"} space-y-4 transition ${
                    isDropTarget ? "border-slate-400 ring-2 ring-slate-200" : "border-slate-200"
                  }`}
                >
                  {collapsedSummaryMode ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1 py-0.5">
                        <span
                          draggable
                          onDragStart={(e) => handleDragStart(e, material.id, index + 1, material.judul)}
                          onDragEnd={handleDragEnd}
                          className="cursor-grab rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 active:cursor-grabbing"
                          title="Geser untuk ubah urutan"
                          aria-label="Geser untuk ubah urutan"
                        >
                          ⠿
                        </span>
                        <button
                          type="button"
                          onClick={() => moveSection(material.id, "up")}
                          disabled={index === 0}
                          className="rounded px-1.5 py-0.5 text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Naikkan section"
                          title="Naikkan section"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSection(material.id, "down")}
                          disabled={index === filteredByTypeItems.length - 1}
                          className="rounded px-1.5 py-0.5 text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Turunkan section"
                          title="Turunkan section"
                        >
                          ↓
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedMaterials((prev) => ({
                            ...prev,
                            [material.id]: true,
                          }))
                        }
                        className="flex min-w-0 items-center gap-2 text-left"
                      >
                        {showSectionOrdinalBadge && (
                          <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white">Section {index + 1}</span>
                        )}
                        <span className="truncate text-base font-semibold text-slate-900">{material.judul}</span>
                      </button>
                      <label className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={selectedSectionIds.includes(material.id)}
                          onChange={() => toggleSelectSection(material.id)}
                        />
                        Pilih
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedMaterials((prev) => ({
                            ...prev,
                            [material.id]: true,
                          }))
                        }
                        className="ml-auto shrink-0 sage-button-outline !py-1.5 !px-3 text-xs"
                        aria-label="Expand section"
                        title="Expand section"
                      >
                        <FiChevronDown />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1 py-0.5">
                        <span
                          draggable
                          onDragStart={(e) => handleDragStart(e, material.id, index + 1, material.judul)}
                          onDragEnd={handleDragEnd}
                          className="cursor-grab rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 active:cursor-grabbing"
                          title="Geser untuk ubah urutan"
                          aria-label="Geser untuk ubah urutan"
                        >
                          ⠿
                        </span>
                        <button
                          type="button"
                          onClick={() => moveSection(material.id, "up")}
                          disabled={index === 0}
                          className="rounded px-1.5 py-0.5 text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Naikkan section"
                          title="Naikkan section"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSection(material.id, "down")}
                          disabled={index === filteredByTypeItems.length - 1}
                          className="rounded px-1.5 py-0.5 text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Turunkan section"
                          title="Turunkan section"
                        >
                          ↓
                        </button>
                      </div>
                      {showSectionOrdinalBadge && (
                        <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white">Section {index + 1}</span>
                      )}
                      <span className="min-w-0 truncate text-base font-semibold text-slate-900">{material.judul}</span>
                      <label className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={selectedSectionIds.includes(material.id)}
                          onChange={() => toggleSelectSection(material.id)}
                        />
                        Pilih
                      </label>
                      {!compactDragMode && (
                        <>
                          <div className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => openQuickAdd(material)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-100"
                              aria-label="Tambah konten"
                              title="Tambah konten"
                            >
                              <FiPlus />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingSection(material)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-100"
                              aria-label="Edit section"
                              title="Edit section"
                            >
                              <FiEdit2 />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteSection(material)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-600 transition hover:bg-red-50"
                              aria-label="Hapus section"
                              title="Hapus section"
                            >
                              <FiTrash2 />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedMaterials((prev) => ({
                                  ...prev,
                                  [material.id]: !isExpanded,
                                }))
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-100"
                              aria-label={isExpanded ? "Collapse section" : "Expand section"}
                              title={isExpanded ? "Collapse section" : "Expand section"}
                            >
                              {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {showExpandedContent && (
                    <p className="text-xs text-slate-500">
                      Terakhir update: {formatDateLabel(material.updated_at || material.created_at)}
                    </p>
                  )}

                  {showExpandedContent ? (
                    <>
                      {sectionContentCards.length > 0 && (
                        <div>
                          <div className="space-y-2">
                            {sectionContentCards.map((card, cardIdx) => {
                              const collapseKey = `${material.id}:${card.id}`;
                              const contentCardKey = `${material.id}:${card.id}`;
                              const contentTone = getSectionContentTypeTone(card.type);
                              const isCollapsed = collapsedContentCards[collapseKey] ?? false;
                              const isContentDropTarget =
                                dropTargetContentCardKey === contentCardKey && draggingContentCardKey !== contentCardKey;
                              return (
                                <div
                                  key={card.id}
                                  ref={(node) => {
                                    contentCardRefs.current[contentCardKey] = node;
                                  }}
                                  onDragOver={(e) => {
                                    if (!draggingContentCardKey) return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    e.dataTransfer.dropEffect = "move";
                                    if (dropTargetContentCardKey !== contentCardKey) {
                                      setDropTargetContentCardKey(contentCardKey);
                                    }
                                  }}
                                  onDrop={(e) => {
                                    if (!draggingContentCardKey) return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    let draggedMaterialId = "";
                                    let draggedCardId = "";
                                    try {
                                      const raw = e.dataTransfer.getData("application/x-sage-content-card");
                                      const parsed = raw ? (JSON.parse(raw) as { materialId?: string; cardId?: string }) : null;
                                      draggedMaterialId = parsed?.materialId || "";
                                      draggedCardId = parsed?.cardId || "";
                                    } catch {
                                      draggedMaterialId = "";
                                      draggedCardId = "";
                                    }
                                    if (draggedMaterialId !== material.id || !draggedCardId) {
                                      handleContentCardDragEnd();
                                      return;
                                    }
                                    void moveContentCardByDrop(material, draggedCardId, card.id);
                                    handleContentCardDragEnd();
                                  }}
                                  className={`rounded-lg border bg-white overflow-hidden transition ${
                                    isContentDropTarget ? "border-slate-400 ring-2 ring-slate-200" : contentTone.accent
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCollapsedContentCards((prev) => ({
                                        ...prev,
                                        [collapseKey]: !isCollapsed,
                                      }))
                                    }
                                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50"
                                  >
                                    <div className="flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-1 py-0.5">
                                      <span
                                        draggable
                                        onDragStart={(e) =>
                                          handleContentCardDragStart(
                                            e,
                                            material.id,
                                            card.id,
                                            cardIdx + 1,
                                            card.title,
                                            sectionContentCards.map((x) => x.id)
                                          )
                                        }
                                        onDragEnd={handleContentCardDragEnd}
                                        onClick={(e) => e.stopPropagation()}
                                        className="cursor-grab rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 active:cursor-grabbing"
                                        title="Geser untuk ubah urutan konten"
                                        aria-label="Geser untuk ubah urutan konten"
                                      >
                                        ⠿
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void moveContentCard(material, card.id, "up");
                                        }}
                                        disabled={cardIdx === 0}
                                        className="rounded px-1.5 py-0.5 text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                                        aria-label="Naikkan konten"
                                        title="Naikkan konten"
                                      >
                                        ↑
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void moveContentCard(material, card.id, "down");
                                        }}
                                        disabled={cardIdx === sectionContentCards.length - 1}
                                        className="rounded px-1.5 py-0.5 text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                                        aria-label="Turunkan konten"
                                        title="Turunkan konten"
                                      >
                                        ↓
                                      </button>
                                    </div>
                                    <div className="flex min-w-0 items-center gap-2">
                                      <span className={`inline-flex h-6 w-20 shrink-0 items-center justify-center rounded-full px-2 text-[11px] font-medium ${contentTone.badge}`}>
                                        {getSectionContentTypeLabel(card.type)}
                                      </span>
                                      <span className="truncate text-sm font-semibold text-slate-900">
                                        {cardIdx + 1}. {card.title}
                                      </span>
                                    </div>
                                    <div className="ml-auto flex items-center gap-1">
                                      {(card.type === "materi" || card.type === "soal" || card.type === "tugas" || card.type === "gambar" || card.type === "video" || card.type === "upload") && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingContentCard({ material, card });
                                            }}
                                            className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                                            title="Edit konten"
                                            aria-label="Edit konten"
                                          >
                                            <FiEdit2 size={14} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              void handleDeleteContentCard(material, card);
                                            }}
                                            className="rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700"
                                            title="Hapus konten"
                                            aria-label="Hapus konten"
                                          >
                                            <FiTrash2 size={14} />
                                          </button>
                                        </>
                                      )}
                                      <span className="text-slate-500">{isCollapsed ? <FiChevronDown /> : <FiChevronUp />}</span>
                                    </div>
                                  </button>
                                  {!isCollapsed && (
                                    <div className="border-t border-slate-200 px-3 py-3">
                                      {card.type !== "materi" && card.type !== "tugas" && card.type !== "soal" && (card.meta?.description || "").trim() && (
                                        <div className="mb-2 rounded-md border border-slate-200 bg-white px-3 py-2">
                                          <p className="whitespace-pre-wrap text-sm text-slate-700">{card.meta?.description}</p>
                                        </div>
                                      )}
                                      {card.type === "materi" && card.meta?.materi_mode === "lengkap" ? (
                                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
                                          {((card.meta?.materi_description || "").trim() || ((card.body || "") && !containsHtmlTag(card.body) ? card.body.trim() : "")) ? (
                                            <p className="whitespace-pre-wrap text-sm text-slate-700">
                                              {(card.meta?.materi_description || "").trim() || ((card.body || "") && !containsHtmlTag(card.body) ? card.body.trim() : "")}
                                            </p>
                                          ) : (
                                            <p className="text-sm text-slate-600">Konten materi ini dikelola di editor materi lengkap.</p>
                                          )}
                                          <Link href={`/dashboard/teacher/materi/${material.id}?sectionCardId=${card.id}`} className="sage-button-outline !py-1.5 !px-3 text-xs inline-flex">
                                            Buka Editor Materi
                                          </Link>
                                        </div>
                                      ) : card.type === "soal" ? (
                                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
                                          {(() => {
                                            const descText = (card.meta?.description || card.body || "").trim();
                                            const linkedQuestions = resolvedQuestionByCardId.get(card.id) || [];
                                            const items = linkedQuestions
                                              .map((q) => (q.teks_soal || "").trim())
                                              .filter(Boolean);
                                            return (
                                              <>
                                                {descText && (
                                                  <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                                                    <p className="whitespace-pre-wrap text-sm text-slate-700">{descText}</p>
                                                  </div>
                                                )}
                                                <p className="text-xs font-medium text-slate-500">List Soal</p>
                                                {items.length > 0 ? (
                                                  <div className="space-y-1">
                                                    {items.map((item, idx) => (
                                                      <p key={`${card.id}-soal-list-${idx}`} className="text-sm text-slate-700">
                                                        {idx + 1}. {item}
                                                      </p>
                                                    ))}
                                                  </div>
                                                ) : (
                                                  <p className="text-sm text-slate-500">Soal belum terhubung ke data menu Soal.</p>
                                                )}
                                              </>
                                            );
                                          })()}
                                        </div>
                                      ) : card.type === "tugas" ? (
                                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
                                          <p className="whitespace-pre-wrap text-sm text-slate-700">
                                            {card.meta?.tugas_instruction || card.body || "Instruksi tugas belum diisi."}
                                          </p>
                                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                                            {card.meta?.tugas_due_at && (
                                              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">
                                                Tenggat: {card.meta.tugas_due_at}
                                              </span>
                                            )}
                                            {card.meta?.tugas_submission_type && (
                                              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">
                                                Pengumpulan: {card.meta.tugas_submission_type}
                                              </span>
                                            )}
                                            {typeof card.meta?.tugas_max_file_mb === "number" && (
                                              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">
                                                Maks File: {card.meta.tugas_max_file_mb} MB
                                              </span>
                                            )}
                                          </div>
                                          {Array.isArray(card.meta?.tugas_allowed_formats) && card.meta?.tugas_allowed_formats.length > 0 && (
                                            <p className="text-xs text-slate-600">Format: {card.meta.tugas_allowed_formats.join(", ")}</p>
                                          )}
                                        </div>
                                      ) : card.type === "gambar" ? (
                                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                                          {card.body ? (
                                            <div className="space-y-2">
                                              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                                                <img src={card.body} alt={card.title} className="h-auto w-full object-cover" />
                                              </div>
                                              <a href={card.body} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-slate-700 underline">
                                                Buka gambar
                                              </a>
                                            </div>
                                          ) : (
                                            <p className="text-sm text-slate-500">Gambar belum diisi.</p>
                                          )}
                                        </div>
                                      ) : card.type === "video" ? (
                                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                                          {card.body ? (
                                            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                                              <iframe
                                                src={normalizeEmbedUrl(card.body)}
                                                title={card.title}
                                                className="h-64 w-full"
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                referrerPolicy="strict-origin-when-cross-origin"
                                                allowFullScreen
                                              />
                                            </div>
                                          ) : (
                                            <p className="text-sm text-slate-500">Link video belum diisi.</p>
                                          )}
                                        </div>
                                      ) : card.type === "upload" ? (
                                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                                          {card.body ? (
                                            <div className="space-y-1">
                                              {card.body
                                                .split("\n")
                                                .map((x) => x.trim())
                                                .filter(Boolean)
                                                .map((url, idx) => (
                                                  <a
                                                    key={`${url}-${idx}`}
                                                    href={url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-800 underline"
                                                  >
                                                    <FiFileText size={14} /> Buka Dokumen {idx + 1}
                                                  </a>
                                                ))}
                                            </div>
                                          ) : (
                                            <p className="text-sm text-slate-500">Dokumen belum diupload.</p>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                                          <SectionMaterialContentRenderer isiMateri={card.body} />
                                        </div>
                                      )}
                                      {card.type === "soal" && (
                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                                          {card.meta?.level_kognitif && (
                                            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">
                                              Level: {card.meta.level_kognitif}
                                            </span>
                                          )}
                                          {typeof card.meta?.weight === "number" && (
                                            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">
                                              Bobot: {card.meta.weight}
                                            </span>
                                          )}
                                          {(() => {
                                            const ids = Array.isArray(card.meta?.question_ids)
                                              ? card.meta.question_ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
                                              : [];
                                            if (ids.length === 0) return null;
                                            return (
                                            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">
                                              Soal Terhubung: {ids.length}
                                            </span>
                                            );
                                          })()}
                                          <Link href={`/dashboard/teacher/soal/${material.id}?sectionCardId=${card.id}`} className="sage-button-outline !py-1 !px-2 text-[11px]">
                                            Kelola Soal
                                          </Link>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {extractDescription(material.capaian_pembelajaran) && (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">Ringkasan</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                            {extractDescription(material.capaian_pembelajaran)}
                          </p>
                        </div>
                      )}

                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        )) : null}
      </div>

      <EditMaterialQuickModal
        material={editingMaterial}
        isOpen={!!editingMaterial}
        onClose={() => setEditingMaterial(null)}
        onFinished={async () => {
          await onUpdated();
          setEditingMaterial(null);
        }}
      />
      <QuickAddSectionContentModal
        isOpen={!!quickAddTarget}
        materialTitle={quickAddTarget?.judul || ""}
        initialType={quickAddLockedType || "materi"}
        lockType={quickAddLockedType === "materi"}
        onClose={closeQuickAdd}
        onSubmit={handleQuickAddContent}
        onError={(message) => setQuickAddError(message)}
      />
      <QuickEditSectionContentModal
        isOpen={!!editingContentCard}
        materialId={editingContentCard?.material.id || ""}
        card={editingContentCard?.card || null}
        onClose={() => setEditingContentCard(null)}
        onSubmit={handleSaveEditContentCard}
        onRefresh={onUpdated}
      />
      <RenameSectionModal
        isOpen={!!editingSection}
        section={editingSection}
        onClose={() => setEditingSection(null)}
        onSubmit={async (title) => {
          if (!editingSection) return;
          try {
            await handleRenameSection(editingSection.id, title);
            setEditingSection(null);
          } catch (err: any) {
            setSectionCrudError(err?.message || "Gagal mengubah nama section.");
            throw err;
          }
        }}
      />
      {quickAddError && <p className="text-sm text-red-600">{quickAddError}</p>}
      {contentActionError && <p className="text-sm text-red-600">{contentActionError}</p>}
      {sectionCrudError && <p className="text-sm text-red-600">{sectionCrudError}</p>}

      <ConfirmDialog
        isOpen={!!confirmDeleteSection}
        title="Hapus Section"
        message={confirmDeleteSection ? `Hapus section "${confirmDeleteSection.judul}"?` : ""}
        confirmLabel="Hapus"
        danger
        loading={!!(confirmDeleteSection && deletingId === confirmDeleteSection.id)}
        onCancel={() => setConfirmDeleteSection(null)}
        onConfirm={async () => {
          if (!confirmDeleteSection) return;
          try {
            setSectionCrudError("");
            setDeletingId(confirmDeleteSection.id);
            await handleDeleteSection(confirmDeleteSection);
            setConfirmDeleteSection(null);
          } catch (err: any) {
            setSectionCrudError(err?.message || "Gagal menghapus section.");
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

function createMaterialBlockId(): string {
  return `blk_${Math.random().toString(36).slice(2, 9)}`;
}

function createSectionContentCardId(): string {
  return `cnt_${Math.random().toString(36).slice(2, 10)}`;
}

function parseSectionContentCards(raw?: string): SectionContentCardData[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as {
      format?: string;
      items?: Array<{
        id?: unknown;
        type?: unknown;
        title?: unknown;
        body?: unknown;
        created_at?: unknown;
        meta?: unknown;
      }>;
    };
    if (parsed?.format !== "sage_section_cards_v1" || !Array.isArray(parsed.items)) return [];

    return parsed.items
      .map((item) => {
        const type = typeof item?.type === "string" ? item.type : "materi";
        if (!["materi", "soal", "tugas", "penilaian", "gambar", "video", "upload"].includes(type)) return null;
        const title = typeof item?.title === "string" ? item.title.trim() : "";
        if (!title) return null;
        return {
          id: typeof item?.id === "string" && item.id ? item.id : createSectionContentCardId(),
          type: type as SectionContentType,
          title,
          body: typeof item?.body === "string" ? item.body : "",
          created_at:
            typeof item?.created_at === "string" && item.created_at
              ? item.created_at
              : new Date().toISOString(),
          meta: typeof item?.meta === "object" && item.meta !== null ? (item.meta as SectionContentCardData["meta"]) : undefined,
        } as SectionContentCardData;
      })
      .filter((item): item is SectionContentCardData => item !== null);
  } catch {
    return [];
  }
}

function serializeSectionContentCards(cards: SectionContentCardData[]): string {
  return JSON.stringify({
    format: "sage_section_cards_v1",
    items: cards,
  });
}

function toSectionContentType(value?: string): SectionContentType {
  if (value === "soal") return "soal";
  if (value === "tugas") return "tugas";
  if (value === "penilaian") return "penilaian";
  return "materi";
}

function getSectionContentTypeLabel(type: SectionContentType): string {
  if (type === "soal") return "Soal";
  if (type === "tugas") return "Tugas";
  if (type === "penilaian") return "Penilaian";
  if (type === "gambar") return "Gambar";
  if (type === "video") return "Video";
  if (type === "upload") return "Upload";
  return "Materi";
}

function getSectionContentTypeTone(type: SectionContentType): { badge: string; accent: string } {
  if (type === "materi") return { badge: "bg-emerald-100 text-emerald-700", accent: "border-emerald-200" };
  if (type === "soal") return { badge: "bg-blue-100 text-blue-700", accent: "border-blue-200" };
  if (type === "tugas") return { badge: "bg-amber-100 text-amber-700", accent: "border-amber-200" };
  if (type === "penilaian") return { badge: "bg-violet-100 text-violet-700", accent: "border-violet-200" };
  if (type === "gambar") return { badge: "bg-fuchsia-100 text-fuchsia-700", accent: "border-fuchsia-200" };
  if (type === "video") return { badge: "bg-rose-100 text-rose-700", accent: "border-rose-200" };
  return { badge: "bg-slate-100 text-slate-700", accent: "border-slate-200" };
}

function getMateriModeLabel(mode?: "singkat" | "lengkap"): string {
  if (mode === "lengkap") return "Materi Lengkap";
  return "Materi Singkat";
}

function parseSectionMaterialBlocks(raw?: string): MaterialContentBlock[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { format?: string; blocks?: unknown[] };
    if (parsed?.format !== "sage_blocks" || !Array.isArray(parsed?.blocks)) return null;
    const result: MaterialContentBlock[] = [];
    parsed.blocks.forEach((block: unknown) => {
      if (typeof block !== "object" || block === null) return;
      const row = block as { id?: unknown; type?: unknown; value?: unknown; align?: unknown; size?: unknown };
      const type = typeof row.type === "string" ? row.type : "";
      const value = typeof row.value === "string" ? row.value : "";
      if (!["heading", "paragraph", "video", "image", "link", "pdf", "ppt", "bullet_list", "number_list"].includes(type)) return;

      const align = typeof row.align === "string" && ["left", "center", "right", "justify"].includes(row.align) ? (row.align as BlockAlign) : "left";
      const size = typeof row.size === "string" && ["small", "medium", "large", "full"].includes(row.size) ? (row.size as MediaSize) : "medium";
      result.push({
        id: typeof row.id === "string" && row.id ? row.id : createMaterialBlockId(),
        type: type as MaterialBlockType,
        value,
        align,
        size,
      });
    });
    return result;
  } catch {
    return null;
  }
}

function containsHtmlTag(value?: string): boolean {
  return /<([a-z][\w-]*)\b[^>]*>/i.test(value || "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeRichHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .trim();
}

function normalizeEmbedUrl(url: string): string {
  const trimmed = (url || "").trim();
  if (!trimmed) return "";
  const watchMatch = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/i);
  if (watchMatch?.[1]) return `https://www.youtube.com/embed/${watchMatch[1]}`;
  const shortsMatch = trimmed.match(/youtube\.com\/shorts\/([^&?/]+)/i);
  if (shortsMatch?.[1]) return `https://www.youtube.com/embed/${shortsMatch[1]}`;
  return trimmed;
}

function isImageLikeUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?.*)?$/i.test((url || "").trim());
}

function getTextAlignClass(align?: BlockAlign): string {
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  if (align === "justify") return "text-justify";
  return "text-left";
}

function getMediaWidthClass(size?: MediaSize): string {
  if (size === "small") return "w-full md:w-1/3";
  if (size === "large") return "w-full md:w-5/6";
  if (size === "full") return "w-full";
  return "w-full md:w-2/3";
}

function SectionMaterialContentRenderer({
  isiMateri,
  fileUrl,
  onAddContent,
}: {
  isiMateri?: string;
  fileUrl?: string;
  onAddContent?: () => void;
}) {
  const blocks = parseSectionMaterialBlocks(isiMateri);

  if (blocks && blocks.length > 0) {
    return (
      <div className="space-y-4">
        {blocks.map((block) => {
          if (block.type === "heading") {
            return (
              <h3 key={block.id} className={`text-xl font-semibold text-slate-900 ${getTextAlignClass(block.align)}`}>
                {block.value}
              </h3>
            );
          }
          if (block.type === "paragraph") {
            return (
              <p key={block.id} className={`text-slate-700 whitespace-pre-line leading-relaxed ${getTextAlignClass(block.align)}`}>
                {block.value}
              </p>
            );
          }
          if (block.type === "bullet_list" || block.type === "number_list") {
            const lines = block.value.split("\n").map((line) => line.trim()).filter(Boolean);
            if (lines.length === 0) return null;
            return block.type === "bullet_list" ? (
              <ul key={block.id} className={`list-disc pl-6 text-slate-700 space-y-1 ${getTextAlignClass(block.align)}`}>
                {lines.map((line, idx) => (
                  <li key={`${block.id}-${idx}`}>{line}</li>
                ))}
              </ul>
            ) : (
              <ol key={block.id} className={`list-decimal pl-6 text-slate-700 space-y-1 ${getTextAlignClass(block.align)}`}>
                {lines.map((line, idx) => (
                  <li key={`${block.id}-${idx}`}>{line}</li>
                ))}
              </ol>
            );
          }
          if (block.type === "video") {
            const src = normalizeEmbedUrl(block.value);
            if (!src) return null;
            return (
              <div key={block.id} className={`flex ${block.align === "right" ? "justify-end" : block.align === "center" ? "justify-center" : "justify-start"}`}>
                <div className={`${getMediaWidthClass(block.size)} overflow-hidden rounded-xl border border-slate-200 bg-black/5`}>
                  <iframe
                    src={src}
                    title="Video Materi"
                    className="h-64 w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              </div>
            );
          }
          if (block.type === "image") {
            if (!block.value) return null;
            return (
              <div key={block.id} className={`flex ${block.align === "right" ? "justify-end" : block.align === "center" ? "justify-center" : "justify-start"}`}>
                <div className={`${getMediaWidthClass(block.size)} overflow-hidden rounded-xl border border-slate-200`}>
                  <img src={block.value} alt="Gambar Materi" className="h-auto w-full object-cover" />
                </div>
              </div>
            );
          }
          if (block.type === "link") {
            if (!block.value) return null;
            if (isImageLikeUrl(block.value)) {
              return (
                <div key={block.id} className={`flex ${block.align === "right" ? "justify-end" : block.align === "center" ? "justify-center" : "justify-start"}`}>
                  <div className={`${getMediaWidthClass(block.size)} overflow-hidden rounded-xl border border-slate-200`}>
                    <img src={block.value} alt="Gambar Materi" className="h-auto w-full object-cover" />
                  </div>
                </div>
              );
            }
            return (
              <a
                key={block.id}
                href={block.value}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-800 underline"
              >
                <FiFileText size={14} /> {block.value}
              </a>
            );
          }
          if (block.type === "pdf" || block.type === "ppt") {
            if (!block.value) return null;
            return (
              <a
                key={block.id}
                href={block.value}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-800 underline"
              >
                <FiFileText size={14} /> {block.type.toUpperCase()} Materi
              </a>
            );
          }
          return null;
        })}
        {fileUrl && (
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 hover:underline"
          >
            <FiFileText size={14} /> Download/Lihat File Materi
          </a>
        )}
      </div>
    );
  }

  const trimmed = (isiMateri || "").trim();
  if (trimmed) {
    try {
      const parsed = JSON.parse(trimmed) as { format?: string };
      if (parsed?.format === "sage_section_cards_v1") {
        return (
          <div className="space-y-2">
            <p className="text-sm text-slate-500">Isi materi belum diisi.</p>
            {onAddContent && (
              <button
                type="button"
                onClick={onAddContent}
                className="sage-button-outline !py-1.5 !px-3 text-xs"
              >
                <FiPlus /> Isi Materi
              </button>
            )}
          </div>
        );
      }
    } catch {
      // ignore non-JSON text
    }
    const html = containsHtmlTag(trimmed) ? trimmed : `<p>${escapeHtml(trimmed).replace(/\n/g, "<br/>")}</p>`;
    return <div className="prose prose-slate max-w-none text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
  }

  if (fileUrl) {
    return (
      <a
        href={fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 hover:underline"
      >
        <FiFileText size={14} /> Download/Lihat File Materi
      </a>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-500">Isi materi belum diisi.</p>
      {onAddContent && (
        <button
          type="button"
          onClick={onAddContent}
          className="sage-button-outline !py-1.5 !px-3 text-xs"
        >
          <FiPlus /> Isi Materi
        </button>
      )}
    </div>
  );
}

function truncate100(value: string): string {
  if (value.length <= 100) return value;
  return `${value.slice(0, 100)}...`;
}

function RichTextEditorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const draggingMediaIdRef = useRef<string | null>(null);
  const [pendingImageFiles, setPendingImageFiles] = useState<Array<{ id: string; file: File; previewUrl: string }>>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "<p></p>";
    }
  }, [value]);

  useEffect(() => {
    return () => {
      pendingImageFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, [pendingImageFiles]);

  const runCommand = (command: string, commandValue?: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    if (command === "formatBlock" && commandValue) {
      document.execCommand("formatBlock", false, `<${commandValue}>`);
    } else {
      document.execCommand(command, false, commandValue);
    }
    onChange(editor.innerHTML);
  };

  const triggerImagePicker = () => {
    imageInputRef.current?.click();
  };

  const handlePickImages = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const valid: Array<{ id: string; file: File; previewUrl: string }> = [];
    const rejected: string[] = [];
    Array.from(files).forEach((file) => {
      const mimeOk = file.type === "image/png" || file.type === "image/jpeg";
      if (!mimeOk) {
        rejected.push(`${file.name}: format harus PNG/JPG`);
        return;
      }
      if (file.size > 1024 * 1024) {
        rejected.push(`${file.name}: maksimal 1MB`);
        return;
      }
      valid.push({
        id: `imgpick_${Math.random().toString(36).slice(2, 9)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    });
    if (rejected.length > 0) {
      window.alert(`Sebagian file ditolak:\n${rejected.join("\n")}`);
    }
    if (valid.length === 0) return;
    setPendingImageFiles((prev) => [...prev, ...valid]);
  };

  const removePendingImage = (id: string) => {
    setPendingImageFiles((prev) => {
      const target = prev.find((x) => x.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  };

  const insertUploadedImageBlock = (imageUrl: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const mediaId = `imgblk_${Math.random().toString(36).slice(2, 9)}`;
    editor.focus();
    const safeUrl = escapeHtml(imageUrl);
    document.execCommand(
      "insertHTML",
      false,
      `<p><br/></p><div data-media-block="1" data-media-id="${mediaId}" draggable="true" contenteditable="false" style="position:relative;resize:both;overflow:auto;width:420px;max-width:100%;border:1px dashed #cbd5e1;border-radius:10px;padding:6px;margin:8px auto 8px 0;cursor:move;background:#fff;user-select:none;">
        <button type="button" data-media-drag-handle="1" draggable="true" style="position:absolute;left:8px;top:8px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;padding:2px 6px;font-size:11px;color:#475569;cursor:grab;z-index:4;">drag</button>
        <img src="${safeUrl}" alt="Gambar materi" style="width:100%;height:auto;display:block;border-radius:8px;pointer-events:none;" />
        <div style="position:absolute;right:8px;bottom:6px;font-size:11px;color:#64748b;pointer-events:none;">◢ resize / drag</div>
      </div><p><br/></p>`
    );
    onChange(editor.innerHTML);
  };

  const uploadSelectedImages = async () => {
    if (pendingImageFiles.length === 0) return;
    setUploadingImages(true);
    try {
      for (const item of pendingImageFiles) {
        const formData = new FormData();
        formData.append("file", item.file);
        const res = await fetch("/api/upload", {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body?.filePath) {
          throw new Error(body?.message || `Gagal upload ${item.file.name}`);
        }
        insertUploadedImageBlock(body.filePath);
      }
      pendingImageFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setPendingImageFiles([]);
      if (imageInputRef.current) imageInputRef.current.value = "";
    } catch (err: any) {
      window.alert(err?.message || "Gagal upload gambar.");
    } finally {
      setUploadingImages(false);
    }
  };

  const getCaretRangeFromPoint = (x: number, y: number): Range | null => {
    const doc = document as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    };
    if (typeof doc.caretRangeFromPoint === "function") {
      return doc.caretRangeFromPoint(x, y);
    }
    if (typeof doc.caretPositionFromPoint === "function") {
      const pos = doc.caretPositionFromPoint(x, y);
      if (!pos) return null;
      const range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
      return range;
    }
    return null;
  };

  const toolbarButton = "sage-button-outline !px-2 !py-1 text-xs";

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-2">
        <button type="button" className={`${toolbarButton} font-bold`} onMouseDown={(e) => { e.preventDefault(); runCommand("bold"); }}>
          B
        </button>
        <button type="button" className={`${toolbarButton} italic`} onMouseDown={(e) => { e.preventDefault(); runCommand("italic"); }}>
          I
        </button>
        <button type="button" className={`${toolbarButton} underline`} onMouseDown={(e) => { e.preventDefault(); runCommand("underline"); }}>
          U
        </button>
        <button type="button" className={toolbarButton} onMouseDown={(e) => { e.preventDefault(); runCommand("insertUnorderedList"); }}>
          Bullet
        </button>
        <button type="button" className={toolbarButton} onMouseDown={(e) => { e.preventDefault(); runCommand("insertOrderedList"); }}>
          Number
        </button>
        <button type="button" className={toolbarButton} onMouseDown={(e) => { e.preventDefault(); runCommand("formatBlock", "h2"); }}>
          H2
        </button>
        <button
          type="button"
          className={toolbarButton}
          onMouseDown={(e) => {
            e.preventDefault();
            const url = window.prompt("Masukkan URL link:");
            if (!url) return;
            runCommand("createLink", url.trim());
          }}
        >
          Link
        </button>
        <input
          ref={imageInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,image/png,image/jpeg"
          multiple
          className="hidden"
          onChange={(e) => {
            handlePickImages(e.target.files);
          }}
        />
        <button
          type="button"
          className={toolbarButton}
          onMouseDown={(e) => {
            e.preventDefault();
            triggerImagePicker();
          }}
          title="Pilih banyak gambar (PNG/JPG, maks 1MB per file)"
          aria-label="Pilih gambar"
        >
          <FiPlus />
        </button>
        <button
          type="button"
          className={toolbarButton}
          disabled={uploadingImages || pendingImageFiles.length === 0}
          onMouseDown={(e) => {
            e.preventDefault();
            void uploadSelectedImages();
          }}
          title="Upload semua gambar terpilih dan sisipkan ke editor"
          aria-label="Upload gambar"
        >
          <FiUploadCloud />
        </button>
        {pendingImageFiles.length > 0 && (
          <span className="text-xs text-slate-500">({pendingImageFiles.length})</span>
        )}
      </div>
      {pendingImageFiles.length > 0 && (
        <div className="border-b border-slate-200 bg-slate-50 p-2">
          <p className="text-[11px] font-medium text-slate-600">Preview gambar yang akan di-upload</p>
          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
            {pendingImageFiles.map((item) => (
              <div key={item.id} className="rounded-md border border-slate-200 bg-white p-1.5">
                <img src={item.previewUrl} alt={item.file.name} className="h-20 w-full rounded object-cover border border-slate-200" />
                <p className="mt-1 truncate text-[11px] text-slate-600" title={item.file.name}>{item.file.name}</p>
                <button
                  type="button"
                  className="mt-1 text-[11px] text-red-600 hover:underline"
                  onClick={() => removePendingImage(item.id)}
                >
                  Hapus
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="min-h-[180px] w-full p-3 text-sm text-slate-800 outline-none"
        onInput={() => onChange(editorRef.current?.innerHTML || "")}
        onDragStart={(e) => {
          const target = e.target as HTMLElement;
          const media =
            (target.closest("[data-media-drag-handle='1']")?.closest("[data-media-block='1']") as HTMLDivElement | null) ||
            (target.closest("[data-media-block='1']") as HTMLDivElement | null);
          if (!media) return;
          const mediaId = media.getAttribute("data-media-id");
          if (!mediaId) return;
          draggingMediaIdRef.current = mediaId;
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", mediaId);
        }}
        onDragEnd={() => {
          draggingMediaIdRef.current = null;
        }}
        onDragOver={(e) => {
          if (!draggingMediaIdRef.current) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={(e) => {
          if (!draggingMediaIdRef.current || !editorRef.current) return;
          e.preventDefault();
          const editor = editorRef.current;
          const dragged = editor.querySelector<HTMLElement>(`[data-media-id='${draggingMediaIdRef.current}']`);
          if (!dragged) {
            draggingMediaIdRef.current = null;
            return;
          }
          const dropRange = getCaretRangeFromPoint(e.clientX, e.clientY);
          if (dropRange && editor.contains(dropRange.startContainer) && !dragged.contains(dropRange.startContainer)) {
            dropRange.collapse(true);
            dropRange.insertNode(dragged);
            const after = document.createRange();
            after.setStartAfter(dragged);
            after.collapse(true);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(after);
          } else {
            const targetEl = (e.target as HTMLElement).closest("[data-media-block='1']") as HTMLElement | null;
            if (targetEl && targetEl !== dragged && editor.contains(targetEl)) {
              const rect = targetEl.getBoundingClientRect();
              const shouldInsertAfter = e.clientY > rect.top + rect.height / 2;
              if (shouldInsertAfter) {
                targetEl.parentNode?.insertBefore(dragged, targetEl.nextSibling);
              } else {
                targetEl.parentNode?.insertBefore(dragged, targetEl);
              }
            } else {
              editor.appendChild(dragged);
            }
          }
          draggingMediaIdRef.current = null;
          onChange(editor.innerHTML);
        }}
      />
    </div>
  );
}

function RenameSectionModal({
  isOpen,
  section,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  section: Material | null;
  onClose: () => void;
  onSubmit: (title: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !section) return;
    setTitle(section.judul || "");
    setIsSubmitting(false);
    setError("");
  }, [isOpen, section]);

  if (!isOpen || !section) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Nama section wajib diisi.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      await onSubmit(title.trim());
    } catch (err: any) {
      setError(err?.message || "Gagal mengubah section.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <h3 className="text-lg font-semibold text-slate-900">Edit Section</h3>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Nama Section</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="sage-button-outline" disabled={isSubmitting}>
              Batal
            </button>
            <button type="submit" className="sage-button" disabled={isSubmitting}>
              {isSubmitting ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
      <LoadingDialog isOpen={isSubmitting} message="Menyimpan section..." />
    </div>
  );
}

function QuickAddSectionContentModal({
  isOpen,
  materialTitle,
  initialType,
  lockType = false,
  onClose,
  onSubmit,
  onError,
}: {
  isOpen: boolean;
  materialTitle: string;
  initialType?: SectionContentType;
  lockType?: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    type: SectionContentType;
    title: string;
    body: string;
    materi_mode?: "singkat" | "lengkap";
    materi_description?: string;
    description?: string;
    tugas?: {
      instruction: string;
      due_at?: string;
      submission_type: TaskSubmissionType;
      allowed_formats: string[];
      max_file_mb?: number;
    };
  }) => Promise<void>;
  onError: (message: string) => void;
}) {
  type QuickAddDraft = {
    title: string;
    description: string;
    body: string;
    materiHtml: string;
    imageUrl: string;
    videoUrl: string;
    uploadedFileName: string;
    taskInstruction: string;
    taskDueAt: string;
    taskSubmissionType: TaskSubmissionType;
    taskAllowedFormats: string[];
    taskMaxFileMb: string;
  };
  const createDefaultDraft = (key: string): QuickAddDraft => ({
    title: "",
    description: "",
    body: "",
    materiHtml: key === "materi_singkat" ? "<p></p>" : "",
    imageUrl: "",
    videoUrl: "",
    uploadedFileName: "",
    taskInstruction: "",
    taskDueAt: "",
    taskSubmissionType: "teks",
    taskAllowedFormats: ["pdf", "docx", "pptx"],
    taskMaxFileMb: "5",
  });
  const draftStoreRef = useRef<Record<string, QuickAddDraft>>({});

  const [type, setType] = useState<SectionContentType>(
    initialType === "penilaian" ? "materi" : (initialType || "materi")
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [materiHtml, setMateriHtml] = useState("<p></p>");
  const [materiMode, setMateriMode] = useState<"singkat" | "lengkap">("singkat");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingImagePreviewUrl, setPendingImagePreviewUrl] = useState("");
  const [pendingDocumentFiles, setPendingDocumentFiles] = useState<File[]>([]);
  const [taskInstruction, setTaskInstruction] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [taskSubmissionType, setTaskSubmissionType] = useState<TaskSubmissionType>("teks");
  const [taskAllowedFormats, setTaskAllowedFormats] = useState<string[]>(["pdf", "docx", "pptx"]);
  const [taskMaxFileMb, setTaskMaxFileMb] = useState("5");
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const documentFileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedContentTypeValue =
    type === "materi" ? (materiMode === "lengkap" ? "materi_lengkap" : "materi_singkat") : type;

  const applyDraft = useCallback((draft: QuickAddDraft) => {
    setTitle(draft.title);
    setDescription(draft.description);
    setBody(draft.body);
    setMateriHtml(draft.materiHtml || "<p></p>");
    setImageUrl(draft.imageUrl);
    setVideoUrl(draft.videoUrl);
    setUploadedFileName(draft.uploadedFileName);
    setTaskInstruction(draft.taskInstruction);
    setTaskDueAt(draft.taskDueAt);
    setTaskSubmissionType(draft.taskSubmissionType);
    setTaskAllowedFormats(draft.taskAllowedFormats);
    setTaskMaxFileMb(draft.taskMaxFileMb);
  }, []);

  const persistCurrentDraft = useCallback(
    (key: string) => {
      draftStoreRef.current[key] = {
        title,
        description,
        body,
        materiHtml,
        imageUrl,
        videoUrl,
        uploadedFileName,
        taskInstruction,
        taskDueAt,
        taskSubmissionType,
        taskAllowedFormats,
        taskMaxFileMb,
      };
    },
    [
      title,
      description,
      body,
      materiHtml,
      imageUrl,
      videoUrl,
      uploadedFileName,
      taskInstruction,
      taskDueAt,
      taskSubmissionType,
      taskAllowedFormats,
      taskMaxFileMb,
    ]
  );

  const switchDraftKey = useCallback(
    (nextKey: string) => {
      const currentKey = selectedContentTypeValue;
      persistCurrentDraft(currentKey);
      const targetDraft = draftStoreRef.current[nextKey] || createDefaultDraft(nextKey);
      draftStoreRef.current[nextKey] = targetDraft;
      applyDraft(targetDraft);
      setError("");
      onError("");
    },
    [selectedContentTypeValue, persistCurrentDraft, applyDraft, onError]
  );

  useEffect(() => {
    if (isOpen && lockType) {
      setType(initialType === "penilaian" ? "materi" : (initialType || "materi"));
      setMateriMode("singkat");
      const lockKey = "materi_singkat";
      const targetDraft = draftStoreRef.current[lockKey] || createDefaultDraft(lockKey);
      draftStoreRef.current[lockKey] = targetDraft;
      applyDraft(targetDraft);
    }
  }, [initialType, isOpen, lockType, applyDraft]);

  useEffect(() => {
    return () => {
      if (pendingImagePreviewUrl) {
        URL.revokeObjectURL(pendingImagePreviewUrl);
      }
    };
  }, [pendingImagePreviewUrl]);

  const isAllowedImageExtension = (urlOrName: string): boolean => /\.(png|jpe?g)(\?.*)?$/i.test(urlOrName || "");

  const validateImageLink = async (url: string): Promise<boolean> => {
    if (!/^https?:\/\//i.test(url)) return false;
    if (!isAllowedImageExtension(url)) return false;
    return new Promise((resolve) => {
      const img = new Image();
      const timeoutId = window.setTimeout(() => resolve(false), 8000);
      img.onload = () => {
        window.clearTimeout(timeoutId);
        resolve(true);
      };
      img.onerror = () => {
        window.clearTimeout(timeoutId);
        resolve(false);
      };
      img.src = url;
    });
  };

  const handleAddImageFromLink = async () => {
    const raw = imageUrl.trim();
    if (!raw) {
      setError("Link gambar wajib diisi.");
      return;
    }
    setError("");
    setIsUploadingAsset(true);
    try {
      const ok = await validateImageLink(raw);
      if (!ok) {
        throw new Error("Link gambar tidak valid. Gunakan URL PNG/JPG/JPEG yang bisa diakses.");
      }
      setBody(raw);
      setImageUrl("");
    } catch (err: any) {
      setError(err?.message || "Gagal menambahkan gambar dari link.");
    } finally {
      setIsUploadingAsset(false);
    }
  };

  const handlePickImageFile = (file: File | null) => {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setError("Ukuran gambar maksimal 3MB.");
      return;
    }
    const extOk = isAllowedImageExtension(file.name);
    const mimeOk = file.type === "image/png" || file.type === "image/jpeg";
    if (!extOk && !mimeOk) {
      setError("Format gambar harus PNG, JPG, atau JPEG.");
      return;
    }
    if (pendingImagePreviewUrl) {
      URL.revokeObjectURL(pendingImagePreviewUrl);
    }
    setError("");
    setPendingImageFile(file);
    setPendingImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleUploadImage = async () => {
    if (!pendingImageFile) return;
    setError("");
    setIsUploadingAsset(true);
    try {
      const formData = new FormData();
      formData.append("file", pendingImageFile);
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const uploadBody = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        throw new Error(uploadBody?.message || "Gagal upload gambar.");
      }
      const uploadedPath = typeof uploadBody?.filePath === "string" ? uploadBody.filePath : "";
      if (!uploadedPath) {
        throw new Error("Respons upload gambar tidak valid.");
      }
      setBody(uploadedPath);
      setUploadedFileName(pendingImageFile.name);
      setPendingImageFile(null);
      if (pendingImagePreviewUrl) {
        URL.revokeObjectURL(pendingImagePreviewUrl);
      }
      setPendingImagePreviewUrl("");
    } catch (err: any) {
      setError(err?.message || "Gagal upload gambar.");
    } finally {
      setIsUploadingAsset(false);
      if (imageFileInputRef.current) imageFileInputRef.current.value = "";
    }
  };

  const handleAddVideoEmbed = () => {
    const raw = videoUrl.trim();
    if (!raw) {
      setError("Link video wajib diisi.");
      return;
    }
    const embedUrl = normalizeEmbedUrl(raw);
    if (!/^https?:\/\//i.test(embedUrl)) {
      setError("Link video tidak valid.");
      return;
    }
    setError("");
    setBody(embedUrl);
    setVideoUrl("");
  };

  const handlePickDocumentFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const allowedMime = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ];
    const accepted: File[] = [];
    const rejected: string[] = [];
    Array.from(files).forEach((file) => {
      const lower = (file.name || "").toLowerCase();
      const hasAllowedExt = /\.(pdf|docx|ppt|pptx)$/.test(lower);
      if (!hasAllowedExt && !allowedMime.includes(file.type)) {
        rejected.push(file.name);
        return;
      }
      accepted.push(file);
    });
    if (rejected.length > 0) {
      setError(`Sebagian file ditolak (format): ${rejected.join(", ")}`);
    } else {
      setError("");
    }
    if (accepted.length === 0) return;
    setPendingDocumentFiles((prev) => [...prev, ...accepted]);
  };

  const handleUploadDocument = async () => {
    if (pendingDocumentFiles.length === 0) return;
    setError("");
    setIsUploadingAsset(true);
    try {
      const uploadedPaths: string[] = [];
      const uploadedNames: string[] = [];
      for (const pendingDocumentFile of pendingDocumentFiles) {
        const formData = new FormData();
        formData.append("file", pendingDocumentFile);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        const uploadBody = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok) {
          throw new Error(uploadBody?.message || `Gagal upload dokumen: ${pendingDocumentFile.name}`);
        }
        const uploadedPath = typeof uploadBody?.filePath === "string" ? uploadBody.filePath : "";
        if (!uploadedPath) {
          throw new Error(`Respons upload dokumen tidak valid: ${pendingDocumentFile.name}`);
        }
        uploadedPaths.push(uploadedPath);
        uploadedNames.push(pendingDocumentFile.name);
      }
      setBody(uploadedPaths.join("\n"));
      setUploadedFileName(uploadedNames.join(", "));
      setPendingDocumentFiles([]);
    } catch (err: any) {
      setError(err?.message || "Gagal upload dokumen.");
    } finally {
      setIsUploadingAsset(false);
      if (documentFileInputRef.current) documentFileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Judul konten wajib diisi.");
      return;
    }
    const safeMateriHtml = sanitizeRichHtml(materiHtml || "");
    const materiPlainText = safeMateriHtml.replace(/<[^>]+>/g, "").trim();
    if (type === "materi" && materiMode === "singkat" && !materiPlainText) {
      setError("Isi materi wajib diisi.");
      return;
    }
    if (type === "soal" && !description.trim()) {
      setError("Deskripsi wajib diisi.");
      return;
    }
    if (type === "tugas" && !taskInstruction.trim()) {
      setError("Instruksi tugas wajib diisi.");
      return;
    }
    if ((type === "gambar" || type === "video" || type === "upload") && !body.trim()) {
      setError("Konten belum diisi.");
      return;
    }
    setError("");
    onError("");
    setIsSubmitting(true);
    try {
      await onSubmit({
        type,
        title: title.trim(),
        body:
          type === "materi"
            ? (materiMode === "singkat" ? safeMateriHtml : body.trim())
            : type === "tugas"
              ? taskInstruction.trim()
            : type === "soal"
              ? description.trim()
            : body.trim(),
        materi_mode: type === "materi" ? materiMode : undefined,
        materi_description: type === "materi" && materiMode === "lengkap" ? body.trim() : undefined,
        description: type !== "materi" && type !== "tugas" && type !== "soal" ? description.trim() : undefined,
        tugas:
          type === "tugas"
            ? {
                instruction: taskInstruction.trim(),
                due_at: taskDueAt || undefined,
                submission_type: taskSubmissionType,
                allowed_formats: taskAllowedFormats,
                max_file_mb: taskMaxFileMb.trim() ? Number(taskMaxFileMb.trim()) : undefined,
              }
            : undefined,
      });
    } catch (err: any) {
      const message = err?.message || "Gagal menambah konten.";
      setError(message);
      onError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/45 p-4 flex items-center justify-center">
      <div className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <button
          type="button"
          onClick={() => {
            persistCurrentDraft(selectedContentTypeValue);
            onClose();
          }}
          className="absolute right-3 top-3 rounded-md p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Tutup"
        >
          <FiX />
        </button>
        <h3 className="text-lg font-semibold text-slate-900">{lockType ? "Isi Materi" : "Tambah Konten"}</h3>
        <p className="mt-1 text-sm text-slate-500">Section: {materialTitle}</p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {lockType ? (
            <div>
              <label className="text-sm font-medium text-slate-700">Tipe Konten</label>
              <div className="mt-1 inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                Materi Singkat
              </div>
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium text-slate-700">Tipe Konten</label>
              <select
                value={selectedContentTypeValue}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "materi_singkat") {
                    switchDraftKey("materi_singkat");
                    setType("materi");
                    setMateriMode("singkat");
                    return;
                  }
                  if (value === "materi_lengkap") {
                    switchDraftKey("materi_lengkap");
                    setType("materi");
                    setMateriMode("lengkap");
                    return;
                  }
                  switchDraftKey(value);
                  setType(value as SectionContentType);
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              >
                <option value="materi_singkat">Materi Singkat</option>
                <option value="materi_lengkap">Materi Lengkap</option>
                <option value="soal">Soal</option>
                <option value="tugas">Tugas</option>
                <option value="gambar">Gambar</option>
                <option value="video">Video</option>
                <option value="upload">Upload</option>
              </select>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-slate-700">Judul Konten</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Latihan Bab 1"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              autoFocus
            />
          </div>
          {type !== "materi" && type !== "tugas" && (
            <div>
              <label className="text-sm font-medium text-slate-700">Deskripsi</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Tambahkan deskripsi singkat konten..."
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              />
            </div>
          )}
          <div>
            {type !== "tugas" && type !== "soal" && (
              <label className="text-sm font-medium text-slate-700">
                {type === "materi"
                  ? "Isi Materi"
                  : type === "penilaian"
                      ? "Deskripsi Penilaian"
                      : type === "gambar"
                        ? "Gambar"
                        : type === "video"
                          ? "Video"
                          : "Upload Dokumen"}
              </label>
            )}
            {type === "materi" ? (
              <div className="mt-1 space-y-3">
                <p className="text-xs text-slate-500">Mode: {getMateriModeLabel(materiMode)}</p>
                {materiMode === "singkat" ? (
                  <RichTextEditorField value={materiHtml} onChange={setMateriHtml} />
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={4}
                      placeholder="Tulis deskripsi singkat materi lengkap..."
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                    />
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
                      Isi detail materi lengkap tetap diedit di halaman editor materi lanjutan.
                    </div>
                  </div>
                )}
              </div>
            ) : type === "tugas" ? (
              <div className="mt-1 space-y-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Instruksi Tugas</label>
                  <textarea
                    value={taskInstruction}
                    onChange={(e) => setTaskInstruction(e.target.value)}
                    rows={4}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Tenggat</label>
                    <input
                      type="datetime-local"
                      value={taskDueAt}
                      onChange={(e) => setTaskDueAt(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-1">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Pengumpulan</label>
                    <select
                      value={taskSubmissionType}
                      onChange={(e) => setTaskSubmissionType(e.target.value as TaskSubmissionType)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                    >
                      <option value="teks">Teks</option>
                      <option value="file">File</option>
                      <option value="keduanya">Keduanya</option>
                    </select>
                  </div>
                </div>
                {taskSubmissionType !== "teks" && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Format File</label>
                      <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        {TASK_FORMAT_GROUPS.map((group) => (
                          <div key={group.label}>
                            <p className="text-xs font-semibold text-slate-600">{group.label}</p>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {group.items.map((ext) => {
                                const checked = taskAllowedFormats.includes(ext);
                                return (
                                  <label key={ext} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) =>
                                        setTaskAllowedFormats((prev) =>
                                          e.target.checked ? Array.from(new Set([...prev, ext])) : prev.filter((x) => x !== ext)
                                        )
                                      }
                                    />
                                    .{ext}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Batas Ukuran File (MB)</label>
                      <input
                        type="number"
                        min={1}
                        value={taskMaxFileMb}
                        onChange={(e) => setTaskMaxFileMb(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : type === "gambar" ? (
              <div className="mt-1 space-y-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="Link gambar PNG/JPG/JPEG"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                  />
                  <button
                    type="button"
                    onClick={() => void handleAddImageFromLink()}
                    className="sage-button-outline !py-2 !px-3 text-xs"
                    disabled={isUploadingAsset}
                  >
                    Pakai Link
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={imageFileInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                    className="hidden"
                    onChange={(e) => handlePickImageFile(e.target.files?.[0] || null)}
                  />
                  <button
                    type="button"
                    onClick={() => imageFileInputRef.current?.click()}
                    className="sage-button-outline !py-2 !px-3 text-xs"
                    disabled={isUploadingAsset}
                  >
                    Pilih Gambar (max 3MB)
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleUploadImage()}
                    className="sage-button-outline !py-2 !px-3 text-xs"
                    disabled={!pendingImageFile || isUploadingAsset}
                  >
                    Upload Sekarang
                  </button>
                </div>
                {pendingImagePreviewUrl && (
                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <img src={pendingImagePreviewUrl} alt="Preview gambar" className="h-40 w-full object-cover" />
                  </div>
                )}
                {body && <p className="text-xs text-slate-500 break-all">Tersimpan: {body}</p>}
              </div>
            ) : type === "video" ? (
              <div className="mt-1 space-y-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="Link video (YouTube/link embed)"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                  />
                  <button type="button" onClick={handleAddVideoEmbed} className="sage-button-outline !py-2 !px-3 text-xs">
                    Simpan Link
                  </button>
                </div>
                {videoUrl.trim() && /^https?:\/\//i.test(normalizeEmbedUrl(videoUrl)) && (
                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <iframe
                      src={normalizeEmbedUrl(videoUrl)}
                      title="Preview video"
                      className="h-52 w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  </div>
                )}
                {body && <p className="text-xs text-slate-500 break-all">Embed: {body}</p>}
              </div>
            ) : type === "upload" ? (
              <div className="mt-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={documentFileInputRef}
                    type="file"
                    accept=".pdf,.docx,.ppt,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    multiple
                    className="hidden"
                    onChange={(e) => handlePickDocumentFiles(e.target.files)}
                  />
                  <button
                    type="button"
                    onClick={() => documentFileInputRef.current?.click()}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-100"
                    disabled={isUploadingAsset}
                    title="Pilih banyak dokumen (PPT/PDF/DOCX)"
                    aria-label="Pilih banyak dokumen"
                  >
                    <FiPlus />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleUploadDocument()}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={pendingDocumentFiles.length === 0 || isUploadingAsset}
                    title="Upload semua dokumen yang dipilih"
                    aria-label="Upload semua dokumen"
                  >
                    <FiUploadCloud />
                  </button>
                </div>
                {pendingDocumentFiles.length > 0 && (
                  <div className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-600">
                    <p className="mb-2 font-medium text-slate-700">Preview dokumen terpilih ({pendingDocumentFiles.length})</p>
                    <div className="space-y-1">
                      {pendingDocumentFiles.map((file, idx) => (
                        <div key={`${file.name}-${idx}`} className="flex items-center justify-between gap-2 rounded border border-slate-100 px-2 py-1">
                          <span className="truncate">{file.name}</span>
                          <button
                            type="button"
                            className="text-red-600 hover:underline"
                            onClick={() =>
                              setPendingDocumentFiles((prev) => prev.filter((_, i) => i !== idx))
                            }
                          >
                            Hapus
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {uploadedFileName && <p className="text-xs text-slate-500 truncate">File: {uploadedFileName}</p>}
                {body && <p className="text-xs text-slate-500 break-all">URL: {body}</p>}
              </div>
            ) : type === "soal" ? null : (
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="Tulis detail konten..."
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              />
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                persistCurrentDraft(selectedContentTypeValue);
                onClose();
              }}
              className="sage-button-outline"
              disabled={isSubmitting}
            >
              Batal
            </button>
            <button type="submit" className="sage-button" disabled={isSubmitting}>
              {isSubmitting ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
      <LoadingDialog isOpen={isSubmitting} message="Menyimpan konten..." />
    </div>
  );
}

function QuickEditSectionContentModal({
  isOpen,
  materialId,
  card,
  onClose,
  onSubmit,
  onRefresh,
}: {
  isOpen: boolean;
  materialId: string;
  card: SectionContentCardData | null;
  onClose: () => void;
  onSubmit: (payload: {
    title: string;
    body: string;
    materi_mode?: "singkat" | "lengkap";
    materi_description?: string;
    description?: string;
    tugas?: {
      instruction: string;
      due_at?: string;
      submission_type: TaskSubmissionType;
      allowed_formats: string[];
      max_file_mb?: number;
    };
  }) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [materiHtml, setMateriHtml] = useState("<p></p>");
  const [isDetailMateriEditorOpen, setIsDetailMateriEditorOpen] = useState(false);
  const [isDetailMateriIframeLoading, setIsDetailMateriIframeLoading] = useState(false);
  const [materiMode, setMateriMode] = useState<"singkat" | "lengkap">("singkat");
  const [isMateriLengkapLocked, setIsMateriLengkapLocked] = useState(false);
  const [taskInstruction, setTaskInstruction] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [taskSubmissionType, setTaskSubmissionType] = useState<TaskSubmissionType>("teks");
  const [taskAllowedFormats, setTaskAllowedFormats] = useState<string[]>(["pdf", "docx", "pptx"]);
  const [taskMaxFileMb, setTaskMaxFileMb] = useState("5");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !card) return;
    setTitle(card.title || "");
    setDescription(card.type === "soal" ? (card.meta?.description || card.body || "") : (card.meta?.description || ""));
    const rawBody = card.body || "";
    const fallbackDescription = rawBody && !containsHtmlTag(rawBody) ? rawBody : "";
    setBody(card.meta?.materi_description || fallbackDescription);
    setMateriHtml(card.body || "<p></p>");
    setIsDetailMateriEditorOpen(false);
    const initialMateriMode = card.meta?.materi_mode || "singkat";
    setMateriMode(initialMateriMode);
    setIsMateriLengkapLocked(card.type === "materi" && initialMateriMode === "lengkap");
    setTaskInstruction(card.meta?.tugas_instruction || card.body || "");
    setTaskDueAt(card.meta?.tugas_due_at || "");
    setTaskSubmissionType(card.meta?.tugas_submission_type || "teks");
    setTaskAllowedFormats(Array.isArray(card.meta?.tugas_allowed_formats) ? card.meta.tugas_allowed_formats : ["pdf", "docx", "pptx"]);
    setTaskMaxFileMb(typeof card.meta?.tugas_max_file_mb === "number" ? String(card.meta?.tugas_max_file_mb) : "5");
    setError("");
    setIsSubmitting(false);
    setIsDetailMateriIframeLoading(false);
  }, [isOpen, card]);

  useEffect(() => {
    if (!isDetailMateriEditorOpen) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "sage:materi-editor-ready") {
        setIsDetailMateriIframeLoading(false);
        return;
      }
      if (event.data?.type === "sage:materi-editor-saved") {
        setIsDetailMateriEditorOpen(false);
        void onRefresh?.();
        return;
      }
      if (event.data?.type === "sage:close-materi-editor") {
        setIsDetailMateriEditorOpen(false);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isDetailMateriEditorOpen, onRefresh]);

  if (!isOpen || !card) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Judul konten wajib diisi.");
      return;
    }
    const safeMateriHtml = sanitizeRichHtml(materiHtml || "");
    const materiPlainText = safeMateriHtml.replace(/<[^>]+>/g, "").trim();
    if (card.type === "materi" && materiMode === "singkat" && !materiPlainText) {
      setError("Isi materi wajib diisi.");
      return;
    }
    if (card.type === "soal" && !description.trim()) {
      setError("Deskripsi wajib diisi.");
      return;
    }
    if (card.type === "tugas" && !taskInstruction.trim()) {
      setError("Instruksi tugas wajib diisi.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        body:
          card.type === "materi"
            ? (materiMode === "singkat" ? safeMateriHtml : body.trim())
            : card.type === "tugas"
              ? taskInstruction.trim()
            : card.type === "soal"
              ? description.trim()
            : body.trim(),
        materi_mode: card.type === "materi" ? (isMateriLengkapLocked ? "lengkap" : materiMode) : undefined,
        materi_description:
          card.type === "materi" && (isMateriLengkapLocked || materiMode === "lengkap") ? body.trim() : undefined,
        description: card.type !== "materi" && card.type !== "tugas" && card.type !== "soal" ? description.trim() : undefined,
        tugas:
          card.type === "tugas"
            ? {
                instruction: taskInstruction.trim(),
                due_at: taskDueAt || undefined,
                submission_type: taskSubmissionType,
                allowed_formats: taskAllowedFormats,
                max_file_mb: taskMaxFileMb.trim() ? Number(taskMaxFileMb.trim()) : undefined,
              }
            : undefined,
      });
    } catch (err: any) {
      setError(err?.message || "Gagal menyimpan perubahan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/45 p-4 flex items-center justify-center">
      <div className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Tutup"
        >
          <FiX />
        </button>
        <h3 className="text-lg font-semibold text-slate-900">Edit Konten</h3>
        <p className="mt-1 text-sm text-slate-500">Tipe: {getSectionContentTypeLabel(card.type)}</p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Judul Konten</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              autoFocus
            />
          </div>
          {card.type !== "materi" && card.type !== "tugas" && (
            <div>
              <label className="text-sm font-medium text-slate-700">Deskripsi</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              />
            </div>
          )}
          <div>
            {card.type === "materi" ? (
              <div className="mt-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMateriMode("singkat")}
                    disabled={isMateriLengkapLocked}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                      materiMode === "singkat" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"
                    } ${isMateriLengkapLocked ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    Materi Singkat
                  </button>
                  <button
                    type="button"
                    onClick={() => setMateriMode("lengkap")}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium ${materiMode === "lengkap" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}
                  >
                    Materi Lengkap
                  </button>
                </div>
                {isMateriLengkapLocked && (
                  <p className="text-xs text-slate-500">
                    Materi lengkap dikunci. Tidak bisa diubah ke materi singkat dari menu edit konten.
                  </p>
                )}
                {materiMode === "singkat" ? (
                  <RichTextEditorField value={materiHtml} onChange={setMateriHtml} />
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={4}
                      placeholder="Tulis deskripsi singkat materi lengkap..."
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                    />
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setIsDetailMateriIframeLoading(true);
                          setIsDetailMateriEditorOpen(true);
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-100"
                      >
                        <FiEdit2 size={14} />
                        Buka Editor Materi Lengkap
                      </button>
                      <p className="mt-2 text-xs text-slate-500">
                        Gunakan editor layar penuh untuk mengatur konten materi detail.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : card.type === "tugas" ? (
              <div className="mt-1 space-y-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Instruksi Tugas</label>
                  <textarea
                    value={taskInstruction}
                    onChange={(e) => setTaskInstruction(e.target.value)}
                    rows={4}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-1">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Tenggat</label>
                    <input
                      type="datetime-local"
                      value={taskDueAt}
                      onChange={(e) => setTaskDueAt(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-1">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Pengumpulan</label>
                    <select
                      value={taskSubmissionType}
                      onChange={(e) => setTaskSubmissionType(e.target.value as TaskSubmissionType)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                    >
                      <option value="teks">Teks</option>
                      <option value="file">File</option>
                      <option value="keduanya">Keduanya</option>
                    </select>
                  </div>
                </div>
                {taskSubmissionType !== "teks" && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Format File</label>
                      <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        {TASK_FORMAT_GROUPS.map((group) => (
                          <div key={group.label}>
                            <p className="text-xs font-semibold text-slate-600">{group.label}</p>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {group.items.map((ext) => {
                                const checked = taskAllowedFormats.includes(ext);
                                return (
                                  <label key={ext} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) =>
                                        setTaskAllowedFormats((prev) =>
                                          e.target.checked ? Array.from(new Set([...prev, ext])) : prev.filter((x) => x !== ext)
                                        )
                                      }
                                    />
                                    .{ext}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Batas Ukuran File (MB)</label>
                      <input
                        type="number"
                        min={1}
                        value={taskMaxFileMb}
                        onChange={(e) => setTaskMaxFileMb(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : card.type === "soal" ? null : (
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="Tulis detail konten..."
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
              />
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="sage-button-outline" disabled={isSubmitting}>
              Batal
            </button>
            <button type="submit" className="sage-button" disabled={isSubmitting}>
              {isSubmitting ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
      {isDetailMateriEditorOpen && card.type === "materi" && materiMode === "lengkap" && (
        <div
          className="animate-fade-in fixed inset-0 z-[60] bg-black/45 p-4 flex items-center justify-center"
          onClick={() => {
            setIsDetailMateriEditorOpen(false);
          }}
        >
          <div className="animate-pop-in relative w-full max-w-6xl h-[92vh]" onClick={(e) => e.stopPropagation()}>
            <div className="h-full overflow-hidden rounded-2xl">
              {isDetailMateriIframeLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/90">
                  <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                    <span className="inline-block h-5 w-5 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin" />
                    Memuat editor materi...
                  </div>
                </div>
              )}
              <iframe
                src={`/dashboard/teacher/materi/${materialId}?sectionCardId=${card.id}&openEditMaterial=1&popupOnly=1`}
                title="Editor Materi Lengkap"
                onLoad={() => setIsDetailMateriIframeLoading(false)}
                onError={() => setIsDetailMateriIframeLoading(false)}
                className="h-full w-full"
              />
            </div>
          </div>
        </div>
      )}
      <LoadingDialog isOpen={isSubmitting} message="Menyimpan perubahan konten..." />
    </div>
  );
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
