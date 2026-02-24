"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { FiBookOpen, FiCheckCircle, FiChevronDown, FiClock, FiClipboard, FiFileText, FiSearch } from "react-icons/fi";
import TeacherProfileModal from "@/components/TeacherProfileModal";

interface EssayQuestion {
  id: string;
  submission_id?: string;
}

interface Material {
  id: string;
  judul: string;
  material_type?: "materi" | "soal" | "tugas";
  isi_materi?: string;
  capaian_pembelajaran?: string;
  file_url?: string;
  updated_at?: string;
  created_at?: string;
  essay_questions?: EssayQuestion[];
}

interface ClassDetail {
  id: string;
  teacher_id?: string;
  pengajar_id?: string;
  class_name: string;
  teacher_name?: string;
  class_code: string;
  deskripsi: string;
  materials?: Material[];
}

type MaterialFilter = "all" | "pending" | "submitted";

const summarizeMaterial = (material: Material) => {
  const totalQuestions = material.essay_questions?.length ?? 0;
  const submittedCount = material.essay_questions?.filter((q) => !!q.submission_id).length ?? 0;
  const progress = totalQuestions > 0 ? Math.round((submittedCount / totalQuestions) * 100) : 0;
  const status: "pending" | "submitted" | "no-assignment" =
    totalQuestions === 0 ? "no-assignment" : submittedCount === totalQuestions ? "submitted" : "pending";

  return {
    totalQuestions,
    submittedCount,
    progress,
    status,
  };
};

export default function StudentClassMaterialsPage() {
  const params = useParams();
  const classId = params.classId as string;

  const [cls, setCls] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MaterialFilter>("all");
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});
  const [expandedDescriptionText, setExpandedDescriptionText] = useState<Record<string, boolean>>({});
  const [seenUpdateByMaterial, setSeenUpdateByMaterial] = useState<Record<string, string>>({});
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  useEffect(() => {
    if (!classId) return;

    const fetchClassDetails = async () => {
      try {
        const res = await fetch(`/api/student/classes/${classId}`, { credentials: "include" });
        if (!res.ok) throw new Error("Gagal memuat kelas.");
        const data = await res.json();
        setCls(data);
      } catch (err: any) {
        setError(err.message || "Terjadi kesalahan.");
      } finally {
        setLoading(false);
      }
    };

    fetchClassDetails();
  }, [classId]);

  useEffect(() => {
    if (!classId) return;
    try {
      const raw = window.localStorage.getItem(`student_material_seen_updates_${classId}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (parsed && typeof parsed === "object") {
        setSeenUpdateByMaterial(parsed);
      }
    } catch {
      setSeenUpdateByMaterial({});
    }
  }, [classId]);

  const materialUpdateSignature = (material: Material): string =>
    material.updated_at || material.created_at || "";

  const markMaterialSeen = (material: Material) => {
    const signature = materialUpdateSignature(material);
    if (!signature) return;
    setSeenUpdateByMaterial((prev) => {
      const next = { ...prev, [material.id]: signature };
      try {
        window.localStorage.setItem(`student_material_seen_updates_${classId}`, JSON.stringify(next));
      } catch {
        // ignore write failure (private mode/storage limit)
      }
      return next;
    });
  };

  const materials = cls?.materials ?? [];

  const filteredMaterials = useMemo(() => {
    return materials.filter((material) => {
      const summary = summarizeMaterial(material);
      const matchQuery = material.judul.toLowerCase().includes(query.trim().toLowerCase());
      const matchFilter =
        filter === "all" ||
        (filter === "pending" && summary.status === "pending") ||
        (filter === "submitted" && summary.status === "submitted");
      return matchQuery && matchFilter;
    });
  }, [materials, query, filter]);

  const submittedMaterials = materials.filter((m) => summarizeMaterial(m).status === "submitted").length;

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-[color:var(--ink-500)]">Loading...</div>;
  }

  if (error) {
    return <div className="sage-panel p-6 text-red-500">{error}</div>;
  }

  if (!cls) return null;

  return (
    <div className="space-y-6">
      <section className="sage-panel p-6">
        <Link href="/dashboard/student/my-classes" className="text-sm text-[color:var(--sage-700)] hover:underline">
          ← Kembali ke kelas saya
        </Link>
        <h1 className="mt-2 text-3xl text-[color:var(--ink-900)]">{cls.class_name}</h1>
        <p className="text-[color:var(--ink-500)] mt-1">{cls.deskripsi}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-[color:var(--ink-600)]">
          <span className="sage-pill">Kode: {cls.class_code}</span>
          <span className="sage-pill">
            Guru:{" "}
            <button
              type="button"
              onClick={() => setProfileModalOpen(true)}
              className="text-[color:var(--sage-700)] hover:underline"
            >
              {cls.teacher_name || "-"}
            </button>
          </span>
          <span className="sage-pill">{materials.length} Materi</span>
          <span className="sage-pill">{submittedMaterials} Materi Selesai</span>
        </div>
      </section>

      <section className="sage-panel p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="relative block">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-500)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari judul materi..."
              className="sage-input pl-10"
            />
          </label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as MaterialFilter)}
            className="sage-input min-w-44"
          >
            <option value="all">Semua Materi</option>
            <option value="pending">Belum Selesai</option>
            <option value="submitted">Sudah Selesai</option>
          </select>
        </div>
      </section>

      <section className="grid gap-4">
        {filteredMaterials.length === 0 && (
          <div className="sage-panel p-8 text-center text-[color:var(--ink-500)]">Tidak ada materi sesuai filter.</div>
        )}

        {filteredMaterials.map((material) => {
          const summary = summarizeMaterial(material);
          const updateSignature = materialUpdateSignature(material);
          const hasUnreadUpdate = Boolean(updateSignature && seenUpdateByMaterial[material.id] !== updateSignature);
          const descriptionText = material.capaian_pembelajaran?.trim() || "";
          const descriptionShort =
            descriptionText.length > 180 ? `${descriptionText.slice(0, 180).trimEnd()}...` : descriptionText;
          const hasLongDescription = descriptionText.length > 180;
          const showFullDescription = !!expandedDescriptionText[material.id];
          const statusLabel =
            summary.status === "submitted"
              ? "Selesai"
              : summary.status === "pending"
                ? "Belum Selesai"
                : "Tanpa Tugas";
          const type = (material.material_type || "materi") as "materi" | "soal" | "tugas";
          const typeIcon =
            type === "soal" ? <FiFileText size={16} className="text-blue-600" /> : type === "tugas" ? <FiClipboard size={16} className="text-purple-600" /> : <FiBookOpen size={16} className="text-emerald-600" />;

          return (
            <div key={material.id} className="sage-card p-5 hover:-translate-y-0.5 transition">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[color:var(--ink-900)]">
                      {typeIcon}
                      <span>{material.judul}</span>
                    </h2>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        (material.material_type || "materi") === "soal"
                          ? "bg-blue-100 text-blue-700"
                          : (material.material_type || "materi") === "tugas"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {(material.material_type || "materi") === "soal"
                        ? "Soal"
                        : (material.material_type || "materi") === "tugas"
                          ? "Tugas"
                          : "Materi"}
                    </span>
                    {hasUnreadUpdate && <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" title="Ada update materi" />}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-[color:var(--ink-600)]">
                    <span className="inline-flex items-center gap-1 sage-pill">
                      <FiBookOpen size={13} /> {summary.totalQuestions} Soal
                    </span>
                    <span className="inline-flex items-center gap-1 sage-pill">
                      {summary.status === "submitted" ? <FiCheckCircle size={13} /> : <FiClock size={13} />}
                      {statusLabel}
                    </span>
                  </div>
                </div>
                <div className="text-right min-w-28">
                  <p className="text-xs text-[color:var(--ink-500)]">Progress</p>
                  <p className="text-lg font-semibold text-[color:var(--ink-900)]">{summary.progress}%</p>
                </div>
              </div>

              <div className="mt-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs text-[color:var(--sage-700)] hover:underline"
                  onClick={() => {
                    setExpandedDescriptions((prev) => ({ ...prev, [material.id]: !prev[material.id] }));
                    markMaterialSeen(material);
                  }}
                >
                  Deskripsi Materi
                  <FiChevronDown className={`transition-transform ${expandedDescriptions[material.id] ? "rotate-180" : ""}`} />
                </button>

                {expandedDescriptions[material.id] && (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-[color:var(--ink-700)] whitespace-pre-line">
                    {descriptionText ? (showFullDescription ? descriptionText : descriptionShort) : "Deskripsi materi belum tersedia."}
                    {descriptionText && hasLongDescription && (
                      <button
                        type="button"
                        className="mt-2 block text-xs text-[color:var(--sage-700)] hover:underline"
                        onClick={() =>
                          setExpandedDescriptionText((prev) => ({ ...prev, [material.id]: !prev[material.id] }))
                        }
                      >
                        {showFullDescription ? "Tampilkan ringkas" : "Lihat selengkapnya"}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-3 h-2 rounded-full bg-[color:var(--sand-100)] overflow-hidden">
                <div className="h-full bg-[color:var(--sage-700)]" style={{ width: `${summary.progress}%` }} />
              </div>

              <div className="mt-4 flex justify-end">
                <Link
                  href={`/dashboard/student/classes/${classId}/materials/${material.id}`}
                  className="sage-button-outline !px-3 !py-1.5 text-xs"
                  onClick={() => markMaterialSeen(material)}
                >
                  Buka Materi
                </Link>
              </div>
            </div>
          );
        })}
      </section>

      <TeacherProfileModal
        teacherId={cls.teacher_id || cls.pengajar_id}
        teacherName={cls.teacher_name}
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </div>
  );
}
