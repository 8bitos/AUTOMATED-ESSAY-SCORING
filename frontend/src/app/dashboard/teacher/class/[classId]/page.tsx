"use client";

import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { Extension, mergeAttributes, Node } from "@tiptap/core";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import LinkExtension from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import {
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
  type NodeViewProps,
} from "@tiptap/react";
import { createPortal } from "react-dom";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import RichContentEditor from "@/components/editor/RichContentEditor";
import { TeacherPenilaianView } from "@/app/dashboard/teacher/penilaian/TeacherPenilaianView";
import {
  FiAlignCenter,
  FiAlignJustify,
  FiAlignLeft,
  FiAlignRight,
  FiArrowLeft,
  FiMail,
  FiBookOpen,
  FiCode,
  FiColumns,
  FiFileText,
  FiAlertCircle,
  FiUsers,
  FiPlus,
  FiSearch,
  FiBarChart2,
  FiX,
  FiCheckCircle,
  FiChevronsDown,
  FiCopy,
  FiClipboard,
  FiImage,
  FiEdit2,
  FiLink,
  FiList,
  FiMinus,
  FiRotateCcw,
  FiRotateCw,
  FiTrash2,
  FiClock,
  FiActivity,
  FiAward,
  FiChevronLeft,
  FiChevronRight,
  FiLayers,
  FiType,
  FiUploadCloud,
  FiChevronDown,
  FiChevronUp,
  FiSettings,
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
  join_policy?: "approval_required" | "open" | "closed";
  announcement_enabled?: boolean;
  announcement_title?: string;
  announcement_content?: string;
  announcement_tone?: "info" | "success" | "warning" | "urgent";
  announcement_starts_at?: string | null;
  announcement_ends_at?: string | null;
}

type AnnouncementTone = "info" | "success" | "warning" | "urgent";
type JoinPolicy = "approval_required" | "open" | "closed";
type RawSectionMediaItem = NonNullable<NonNullable<SectionContentCardData["meta"]>["media_items"]>[number];

const getJoinPolicyMeta = (policy?: JoinPolicy | string | null) => {
  switch (policy) {
    case "open":
      return {
        label: "Langsung masuk",
        description: "Siswa yang punya kode kelas akan langsung jadi anggota.",
      };
    case "closed":
      return {
        label: "Join via kode ditutup",
        description: "Hanya guru yang bisa menambahkan siswa lewat undangan.",
      };
    default:
      return {
        label: "Perlu ACC guru",
        description: "Siswa yang punya kode kelas masuk ke antrean persetujuan.",
      };
  }
};

const getAnnouncementToneStyles = (tone?: AnnouncementTone) => {
  if (tone === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }
  if (tone === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  if (tone === "urgent") {
    return "border-rose-200 bg-rose-50 text-rose-900";
  }
  return "border-sky-200 bg-sky-50 text-sky-900";
};

const toDateTimeLocalValue = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const isClassAnnouncementActive = (cls?: Pick<ClassDetail, "announcement_enabled" | "announcement_title" | "announcement_content" | "announcement_starts_at" | "announcement_ends_at"> | null) => {
  if (!cls?.announcement_enabled || !cls.announcement_title || !cls.announcement_content) return false;
  const now = Date.now();
  const startsAt = cls.announcement_starts_at ? new Date(cls.announcement_starts_at).getTime() : null;
  const endsAt = cls.announcement_ends_at ? new Date(cls.announcement_ends_at).getTime() : null;
  if (startsAt && now < startsAt) return false;
  if (endsAt && now > endsAt) return false;
  return true;
};

const formatAnnouncementSchedule = (startsAt?: string | null, endsAt?: string | null) => {
  const format = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };
  const startLabel = format(startsAt);
  const endLabel = format(endsAt);
  if (startLabel && endLabel) return `Tayang ${startLabel} sampai ${endLabel}`;
  if (startLabel) return `Mulai tayang ${startLabel}`;
  if (endLabel) return `Berakhir ${endLabel}`;
  return "";
};

function ClassAnnouncementBanner({
  title,
  content,
  tone,
  scheduleLabel,
  compact,
  actions,
}: {
  title: string;
  content: string;
  tone?: AnnouncementTone;
  scheduleLabel?: string;
  compact?: boolean;
  actions?: ReactNode;
}) {
  return (
    <div className={`class-announcement-banner ${compact ? "" : "mt-4"} rounded-2xl border px-4 py-4 shadow-sm ${getAnnouncementToneStyles(tone)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] opacity-70">Banner Pengumuman</p>
          <h2 className="mt-1 text-lg font-semibold leading-tight">{title}</h2>
          {scheduleLabel ? <p className="mt-1 text-xs font-medium opacity-75">{scheduleLabel}</p> : null}
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed opacity-90">{content}</p>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

function AnnouncementModal({
  isOpen,
  title,
  content,
  tone,
  enabled,
  startsAt,
  endsAt,
  error,
  saving,
  onClose,
  onToggleEnabled,
  onTitleChange,
  onContentChange,
  onToneChange,
  onStartsAtChange,
  onEndsAtChange,
  onSave,
  onClear,
}: {
  isOpen: boolean;
  title: string;
  content: string;
  tone: AnnouncementTone;
  enabled: boolean;
  startsAt: string;
  endsAt: string;
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onToneChange: (tone: AnnouncementTone) => void;
  onStartsAtChange: (value: string) => void;
  onEndsAtChange: (value: string) => void;
  onSave: () => void;
  onClear: () => void;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Banner Pengumuman"
      onClick={onClose}
    >
      <div
        className="announcement-modal-panel w-full max-w-xl max-h-[86vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Kelas</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">Banner Pengumuman</h3>
            <p className="mt-1 text-sm text-slate-600">Banner ini akan tampil di halaman kelas guru dan siswa.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
          >
            <FiX />
          </button>
        </div>

        <div className="mt-4 space-y-3.5">
          <label className="announcement-modal-toggle flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Tampilkan banner pengumuman</p>
              <p className="text-xs text-slate-500">Nonaktifkan jika pengumuman ingin disembunyikan sementara.</p>
            </div>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onToggleEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-[1fr_170px]">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Judul Banner</label>
              <input
                type="text"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="Contoh: Ujian dimulai Senin pukul 08.00"
                className="announcement-modal-input w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Tipe Banner</label>
              <select
                value={tone}
                onChange={(e) => onToneChange(e.target.value as AnnouncementTone)}
                className="announcement-modal-input w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              >
                <option value="info">Info</option>
                <option value="success">Berhasil</option>
                <option value="warning">Perhatian</option>
                <option value="urgent">Mendesak</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Isi Pengumuman</label>
            <textarea
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              rows={4}
              placeholder="Tulis pengumuman penting untuk siswa di kelas ini."
              className="announcement-modal-input w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Mulai Tayang</label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => onStartsAtChange(e.target.value)}
                className="announcement-modal-input w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              />
              <p className="mt-1 text-xs text-slate-500">Kosongkan jika banner boleh tampil mulai sekarang.</p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Berakhir Pada</label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => onEndsAtChange(e.target.value)}
                className="announcement-modal-input w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              />
              <p className="mt-1 text-xs text-slate-500">Kosongkan jika banner tidak punya batas akhir.</p>
            </div>
          </div>

          {(title.trim() || content.trim()) && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Preview</p>
              <ClassAnnouncementBanner
                title={title.trim() || "Judul banner"}
                content={content.trim() || "Isi pengumuman akan tampil di sini."}
                tone={tone}
                scheduleLabel={formatAnnouncementSchedule(startsAt, endsAt)}
                compact
              />
            </div>
          )}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
            disabled={saving}
          >
            <FiTrash2 />
            Hapus Banner
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              disabled={saving}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={onSave}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving}
            >
              {saving ? "Menyimpan..." : "Simpan Banner"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ClassSettingsModal({
  isOpen,
  className,
  description,
  joinPolicy,
  saving,
  error,
  onClose,
  onClassNameChange,
  onDescriptionChange,
  onJoinPolicyChange,
  onSave,
}: {
  isOpen: boolean;
  className: string;
  description: string;
  joinPolicy: JoinPolicy;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onClassNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onJoinPolicyChange: (value: JoinPolicy) => void;
  onSave: () => void;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-950/45 px-4 py-6 md:items-center">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative z-[81] my-auto flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Setting Kelas</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">Edit kelas dan akses bergabung</h2>
            <p className="mt-2 text-sm text-slate-500">Atur informasi kelas dan bagaimana siswa bisa masuk ke kelas ini.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            aria-label="Tutup pengaturan kelas"
          >
            <FiX />
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto px-6 py-5">
          <section className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Edit kelas</p>
              <p className="mt-1 text-sm text-slate-500">Ubah nama dan deskripsi tanpa keluar dari workspace kelas.</p>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Nama kelas</span>
              <input
                type="text"
                value={className}
                onChange={(event) => onClassNameChange(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                placeholder="Contoh: XII IPA 2 - Biologi"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Deskripsi kelas</span>
              <textarea
                value={description}
                onChange={(event) => onDescriptionChange(event.target.value)}
                className="mt-2 min-h-[120px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                placeholder="Ringkasan tujuan kelas, aturan, atau fokus materi."
              />
            </label>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Akses bergabung</p>
              <p className="mt-1 text-sm text-slate-500">Tentukan apa yang terjadi saat siswa menggunakan kode kelas.</p>
            </div>
            <div className="space-y-3">
              {([
                {
                  value: "approval_required",
                  label: "Perlu ACC guru",
                  description: "Siswa masuk ke daftar pending dan harus disetujui guru.",
                },
                {
                  value: "open",
                  label: "Langsung masuk",
                  description: "Siswa yang punya kode kelas langsung menjadi anggota.",
                },
                {
                  value: "closed",
                  label: "Tutup join via kode",
                  description: "Kode kelas tidak bisa dipakai join. Gunakan undangan manual dari guru.",
                },
              ] as Array<{ value: JoinPolicy; label: string; description: string }>).map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-4 transition ${
                    joinPolicy === option.value ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="join-policy"
                    className="mt-1 h-4 w-4"
                    checked={joinPolicy === option.value}
                    onChange={() => onJoinPolicyChange(option.value)}
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                    <p className="mt-1 text-sm text-slate-500">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </section>

          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} className="sage-button-outline !px-4 !py-2.5 text-sm" disabled={saving}>
            Batal
          </button>
          <button type="button" onClick={onSave} className="sage-button !px-4 !py-2.5 text-sm" disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan perubahan"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
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
  keywords?: string[];
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
    media_items?: Array<{
      url: string;
      width_percent?: number;
      name?: string;
      kind?: "image" | "video" | "document";
      align?: "left" | "center" | "right";
      caption?: string;
    }>;
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
  const [isWorkspaceDrawerOpen, setIsWorkspaceDrawerOpen] = useState(false);
  const [showClassDescription, setShowClassDescription] = useState(false);
  const [isClassSettingsModalOpen, setIsClassSettingsModalOpen] = useState(false);
  const [classNameDraft, setClassNameDraft] = useState("");
  const [classDescriptionDraft, setClassDescriptionDraft] = useState("");
  const [joinPolicyDraft, setJoinPolicyDraft] = useState<JoinPolicy>("approval_required");
  const [classSettingsError, setClassSettingsError] = useState<string | null>(null);
  const [isSavingClassSettings, setIsSavingClassSettings] = useState(false);
  const [isAnnouncementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [announcementEnabled, setAnnouncementEnabled] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementContent, setAnnouncementContent] = useState("");
  const [announcementTone, setAnnouncementTone] = useState<AnnouncementTone>("info");
  const [announcementStartsAt, setAnnouncementStartsAt] = useState("");
  const [announcementEndsAt, setAnnouncementEndsAt] = useState("");
  const [announcementError, setAnnouncementError] = useState<string | null>(null);
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false);
  const pageRootRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!classDetail) return;
    setAnnouncementEnabled(!!classDetail.announcement_enabled);
    setAnnouncementTitle(classDetail.announcement_title || "");
    setAnnouncementContent(classDetail.announcement_content || "");
    setAnnouncementTone(classDetail.announcement_tone || "info");
    setAnnouncementStartsAt(toDateTimeLocalValue(classDetail.announcement_starts_at));
    setAnnouncementEndsAt(toDateTimeLocalValue(classDetail.announcement_ends_at));
  }, [classDetail]);

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

  useEffect(() => {
    if (!isWorkspaceDrawerOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isWorkspaceDrawerOpen]);

  useEffect(() => {
    if (!isAnnouncementModalOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isAnnouncementModalOpen]);

  useEffect(() => {
    if (!isClassSettingsModalOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isClassSettingsModalOpen]);

  useEffect(() => {
    if (!isWorkspaceDrawerOpen) return;
    setIsWorkspaceDrawerOpen(false);
  }, [activeWorkspaceTab, isWorkspaceDrawerOpen]);

  useEffect(() => {
    const root = pageRootRef.current;
    if (!root) return;
    const applyButtonTooltips = () => {
      root.querySelectorAll<HTMLButtonElement>("button").forEach((btn) => {
        if ((btn.getAttribute("title") || "").trim()) return;
        const ariaLabel = (btn.getAttribute("aria-label") || "").trim();
        const textLabel = (btn.textContent || "").replace(/\s+/g, " ").trim();
        const title = ariaLabel || textLabel || "Aksi";
        btn.setAttribute("title", title);
      });
    };
    applyButtonTooltips();
    const observer = new MutationObserver(() => applyButtonTooltips());
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-label", "title"],
    });
    return () => observer.disconnect();
  }, [activeWorkspaceTab, materials.length, students.length, pendingJoinRequests.length]);

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

  const joinPolicyMeta = getJoinPolicyMeta(classDetail.join_policy);

  const handleCopyClassCode = async () => {
    try {
      await navigator.clipboard.writeText(classDetail.class_code || "");
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1500);
    } catch {
      setError("Gagal menyalin kode kelas.");
    }
  };

  const handleOpenAnnouncementModal = () => {
    if (!classDetail) return;
    setAnnouncementEnabled(!!classDetail.announcement_enabled);
    setAnnouncementTitle(classDetail.announcement_title || "");
    setAnnouncementContent(classDetail.announcement_content || "");
    setAnnouncementTone(classDetail.announcement_tone || "info");
    setAnnouncementStartsAt(toDateTimeLocalValue(classDetail.announcement_starts_at));
    setAnnouncementEndsAt(toDateTimeLocalValue(classDetail.announcement_ends_at));
    setAnnouncementError(null);
    setAnnouncementModalOpen(true);
  };

  const handleOpenClassSettingsModal = () => {
    if (!classDetail) return;
    setClassNameDraft(classDetail.class_name || "");
    setClassDescriptionDraft(classDetail.deskripsi || "");
    setJoinPolicyDraft((classDetail.join_policy as JoinPolicy) || "approval_required");
    setClassSettingsError(null);
    setIsClassSettingsModalOpen(true);
  };

  const handleSaveClassSettings = async () => {
    if (!classDetail) return;
    const trimmedClassName = classNameDraft.trim();
    const trimmedDescription = classDescriptionDraft.trim();
    if (!trimmedClassName) {
      setClassSettingsError("Nama kelas wajib diisi.");
      return;
    }

    setClassSettingsError(null);
    setIsSavingClassSettings(true);
    try {
      const res = await fetch(`${API_URL}/classes/${classId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_name: trimmedClassName,
          deskripsi: trimmedDescription,
          join_policy: joinPolicyDraft,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "Gagal menyimpan pengaturan kelas.");
      setClassDetail((prev) =>
        prev
          ? {
              ...prev,
              class_name: data?.class_name || trimmedClassName,
              deskripsi: data?.deskripsi ?? trimmedDescription,
              join_policy: (data?.join_policy as JoinPolicy | undefined) || joinPolicyDraft,
            }
          : prev
      );
      setIsClassSettingsModalOpen(false);
    } catch (err: any) {
      setClassSettingsError(err?.message || "Gagal menyimpan pengaturan kelas.");
    } finally {
      setIsSavingClassSettings(false);
    }
  };

  const handleSaveAnnouncement = async () => {
    if (!classDetail) return;
    const trimmedTitle = announcementTitle.trim();
    const trimmedContent = announcementContent.trim();
    if (announcementEnabled && !trimmedTitle) {
      setAnnouncementError("Judul banner wajib diisi.");
      return;
    }
    if (announcementEnabled && !trimmedContent) {
      setAnnouncementError("Isi banner wajib diisi.");
      return;
    }
    if (announcementStartsAt && announcementEndsAt && new Date(announcementEndsAt).getTime() < new Date(announcementStartsAt).getTime()) {
      setAnnouncementError("Waktu berakhir harus setelah waktu mulai.");
      return;
    }

    setAnnouncementError(null);
    setIsSavingAnnouncement(true);
    try {
      const res = await fetch(`${API_URL}/classes/${classId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          announcement_enabled: announcementEnabled && !!trimmedTitle && !!trimmedContent,
          announcement_title: trimmedTitle,
          announcement_content: trimmedContent,
          announcement_tone: announcementTone,
          announcement_starts_at: announcementStartsAt || null,
          announcement_ends_at: announcementEndsAt || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "Gagal menyimpan banner pengumuman.");
      setClassDetail((prev) =>
        prev
          ? {
              ...prev,
              announcement_enabled: announcementEnabled && !!trimmedTitle && !!trimmedContent,
              announcement_title: trimmedTitle,
              announcement_content: trimmedContent,
              announcement_tone: announcementTone,
              announcement_starts_at: announcementStartsAt || null,
              announcement_ends_at: announcementEndsAt || null,
            }
          : prev
      );
      setAnnouncementModalOpen(false);
    } catch (err: any) {
      setAnnouncementError(err?.message || "Gagal menyimpan banner pengumuman.");
    } finally {
      setIsSavingAnnouncement(false);
    }
  };

  const handleClearAnnouncement = async () => {
    if (!classDetail) return;
    setAnnouncementError(null);
    setIsSavingAnnouncement(true);
    try {
      const res = await fetch(`${API_URL}/classes/${classId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          announcement_enabled: false,
          announcement_title: "",
          announcement_content: "",
          announcement_tone: "info",
          announcement_starts_at: null,
          announcement_ends_at: null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "Gagal menghapus banner pengumuman.");
      setClassDetail((prev) =>
        prev
          ? {
              ...prev,
              announcement_enabled: false,
              announcement_title: "",
              announcement_content: "",
              announcement_tone: "info",
              announcement_starts_at: null,
              announcement_ends_at: null,
            }
          : prev
      );
      setAnnouncementEnabled(false);
      setAnnouncementTitle("");
      setAnnouncementContent("");
      setAnnouncementTone("info");
      setAnnouncementStartsAt("");
      setAnnouncementEndsAt("");
      setAnnouncementModalOpen(false);
    } catch (err: any) {
      setAnnouncementError(err?.message || "Gagal menghapus banner pengumuman.");
    } finally {
      setIsSavingAnnouncement(false);
    }
  };

  return (
    <div ref={pageRootRef} className="teacher-class-view space-y-6">
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
              <button
                type="button"
                onClick={handleOpenAnnouncementModal}
                className="sage-button-outline !px-3 !py-2 text-xs"
              >
                <FiAlertCircle />
                {classDetail.announcement_enabled ? "Edit Banner" : "Tambah Banner"}
              </button>
              <button
                type="button"
                onClick={handleOpenClassSettingsModal}
                className="sage-button-outline !px-3 !py-2 text-xs"
              >
                <FiSettings />
                Setting
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
            <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Akses Join</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{joinPolicyMeta.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{joinPolicyMeta.description}</p>
            </div>
            <p className="mt-3 text-xs text-slate-500">Bagikan kode ini ke siswa untuk bergabung, sesuai mode akses yang dipilih.</p>
          </div>
        </div>

        {isClassAnnouncementActive(classDetail) ? (
          <ClassAnnouncementBanner
            title={classDetail.announcement_title || ""}
            content={classDetail.announcement_content || ""}
            tone={classDetail.announcement_tone}
            scheduleLabel={formatAnnouncementSchedule(classDetail.announcement_starts_at, classDetail.announcement_ends_at)}
            actions={
              <>
                <button type="button" onClick={handleOpenAnnouncementModal} className="sage-button-outline !px-3 !py-2 text-xs">
                  <FiEdit2 />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={handleClearAnnouncement}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/60 bg-white/60 px-3 py-2 text-xs font-medium text-current transition hover:bg-white"
                  disabled={isSavingAnnouncement}
                >
                  <FiTrash2 />
                  Hapus
                </button>
              </>
            }
          />
        ) : null}
      </header>

      <AnnouncementModal
        isOpen={isAnnouncementModalOpen}
        title={announcementTitle}
        content={announcementContent}
        tone={announcementTone}
        enabled={announcementEnabled}
        startsAt={announcementStartsAt}
        endsAt={announcementEndsAt}
        error={announcementError}
        saving={isSavingAnnouncement}
        onClose={() => setAnnouncementModalOpen(false)}
        onToggleEnabled={setAnnouncementEnabled}
        onTitleChange={setAnnouncementTitle}
        onContentChange={setAnnouncementContent}
        onToneChange={setAnnouncementTone}
        onStartsAtChange={setAnnouncementStartsAt}
        onEndsAtChange={setAnnouncementEndsAt}
        onSave={handleSaveAnnouncement}
        onClear={handleClearAnnouncement}
      />

      <ClassSettingsModal
        isOpen={isClassSettingsModalOpen}
        className={classNameDraft}
        description={classDescriptionDraft}
        joinPolicy={joinPolicyDraft}
        saving={isSavingClassSettings}
        error={classSettingsError}
        onClose={() => setIsClassSettingsModalOpen(false)}
        onClassNameChange={setClassNameDraft}
        onDescriptionChange={setClassDescriptionDraft}
        onJoinPolicyChange={setJoinPolicyDraft}
        onSave={handleSaveClassSettings}
      />

      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setIsWorkspaceDrawerOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <FiLayers size={15} />
          Ruang Kelas
        </button>
      </div>

      <section
        className={`grid gap-4 lg:items-start ${
          isWorkspaceSidebarCollapsed ? "lg:grid-cols-[52px_1fr]" : "lg:grid-cols-[220px_1fr]"
        }`}
      >
        <div className="hidden lg:self-start lg:sticky lg:top-20 lg:block">
          <WorkspaceSidebar
            collapsed={isWorkspaceSidebarCollapsed}
            tabs={workspaceTabs}
            activeTab={activeWorkspaceTab}
            onToggleCollapsed={setIsWorkspaceSidebarCollapsed}
            onSelectTab={setActiveWorkspaceTab}
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Workspace Aktif</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{activeWorkspace.label}</p>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {activeWorkspaceTab === "materials" && `${filteredMaterials.length} konten ditampilkan`}
                {activeWorkspaceTab === "students" && `${filteredStudents.length} siswa ditampilkan`}
                {activeWorkspaceTab === "modules" && `${teachingModules.length} modul ajar`}
                {activeWorkspaceTab === "assessment" && "Mode penilaian kelas aktif"}
                {activeWorkspaceTab === "analytics" && "Ringkasan performa kelas"}
              </div>
            </div>
          </div>
          {activeWorkspaceTab === "materials" && (
            <div className="bg-slate-50 p-4 dark:bg-slate-950/60 sm:p-6">
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
            <div className="bg-slate-50 p-4 dark:bg-slate-950/60 sm:p-6">
            <TeachingModulesPane
              classId={classId}
              items={teachingModules}
              onUpdated={fetchClassData}
            />
            </div>
          )}

          {activeWorkspaceTab === "students" && (
            <div className="bg-slate-50 p-4 dark:bg-slate-950/60 sm:p-6">
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
            <div className="bg-slate-50 p-4 dark:bg-slate-950/60 sm:p-6">
              <TeacherPenilaianView scopedClassIdOverride={classId} />
            </div>
          )}

          {activeWorkspaceTab === "analytics" && (
            <div className="bg-slate-50 p-4 dark:bg-slate-950/60 sm:p-6">
            <AnalyticsPane
              students={students}
              materials={materials}
              pendingRequests={pendingJoinRequests}
              questionCountByMaterial={questionCountByMaterial}
            />
            </div>
          )}
        </div>
      </section>

      {isWorkspaceDrawerOpen && (
        <div className="fixed inset-0 z-[90] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigasi Ruang Kelas">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
            onClick={() => setIsWorkspaceDrawerOpen(false)}
            aria-label="Tutup navigasi ruang kelas"
          />
          <div className="absolute inset-y-0 left-0 w-[84vw] max-w-xs border-r border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Ruang Kelas</p>
              <button
                type="button"
                onClick={() => setIsWorkspaceDrawerOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Tutup drawer ruang kelas"
              >
                <FiX size={16} />
              </button>
            </div>
            <nav className="space-y-1">
              {workspaceTabs.map((tab) => {
                const isActive = activeWorkspaceTab === tab.id;
                return (
                  <button
                    key={`mobile-workspace-${tab.id}`}
                    type="button"
                    onClick={() => setActiveWorkspaceTab(tab.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                      isActive
                        ? "bg-slate-900 text-white dark:bg-slate-700 dark:text-slate-100"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.badge ? (
                      <span
                        className={`inline-flex min-w-[20px] items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          isActive
                            ? "border border-white/20 bg-white/20 text-white dark:border-slate-500/60 dark:bg-slate-600 dark:text-slate-100"
                            : "border border-slate-300 bg-slate-200 text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                        }`}
                      >
                        {tab.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

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
  icon: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{icon}</span>
      </div>
      <p className={`mt-3 ${compact ? "text-sm" : "text-2xl"} truncate font-semibold text-slate-900 dark:text-slate-100`}>{value}</p>
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
  const [isMoreMenuOpen, setMoreMenuOpen] = useState(false);
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState<"" | "duplicate" | "delete">("");
  const [editingContentCard, setEditingContentCard] = useState<{ material: Material; card: SectionContentCardData } | null>(null);
  const [confirmDeleteContentCard, setConfirmDeleteContentCard] = useState<{ material: Material; card: SectionContentCardData } | null>(null);
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
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const hasLoadedSectionBadgePreferenceRef = useRef(false);
  const saveSectionBadgePreferenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalMaterials(items);
  }, [items]);

  useEffect(() => {
    if (!userId) return;
    hasLoadedSectionBadgePreferenceRef.current = false;
    let isMounted = true;

    try {
      const stored = window.localStorage.getItem(`teacher-class:show-section-ordinal:${userId}`);
      if (stored !== null) {
        setShowSectionOrdinalBadge(stored !== "0");
      }
    } catch {
      // ignore local storage errors
    }

    const loadPreference = async () => {
      try {
        const res = await fetch("/api/user-preferences", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        const serverValue = data?.preferences?.showSectionOrdinalBadge;
        if (isMounted && typeof serverValue === "boolean") {
          setShowSectionOrdinalBadge(serverValue);
          try {
            window.localStorage.setItem(`teacher-class:show-section-ordinal:${userId}`, serverValue ? "1" : "0");
          } catch {
            // ignore local storage errors
          }
        }
      } finally {
        if (isMounted) {
          hasLoadedSectionBadgePreferenceRef.current = true;
        }
      }
    };

    void loadPreference();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !hasLoadedSectionBadgePreferenceRef.current) return;

    try {
      window.localStorage.setItem(`teacher-class:show-section-ordinal:${userId}`, showSectionOrdinalBadge ? "1" : "0");
    } catch {
      // ignore local storage errors
    }

    if (saveSectionBadgePreferenceTimerRef.current) {
      clearTimeout(saveSectionBadgePreferenceTimerRef.current);
    }
    saveSectionBadgePreferenceTimerRef.current = setTimeout(() => {
      void fetch("/api/user-preferences", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences: {
            showSectionOrdinalBadge,
          },
        }),
      }).catch(() => {
        // ignore server save errors; local storage fallback remains available
      });
    }, 250);

    return () => {
      if (saveSectionBadgePreferenceTimerRef.current) {
        clearTimeout(saveSectionBadgePreferenceTimerRef.current);
      }
    };
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
      media_items?: SectionMediaItem[];
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
            : {
                ...(((payload.description || "").trim() ? { description: (payload.description || "").trim() } : {})),
                ...(Array.isArray(payload.media_items) && payload.media_items.length > 0 ? { media_items: payload.media_items } : {}),
              },
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
      media_items?: SectionMediaItem[];
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
                          media_items: Array.isArray(payload.media_items) && payload.media_items.length > 0 ? payload.media_items : undefined,
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
                  keywords: Array.isArray(q?.keywords)
                    ? q.keywords.filter((keyword: unknown): keyword is string => typeof keyword === "string").map((keyword: string) => keyword.trim().toLowerCase()).filter(Boolean)
                    : typeof q?.keywords === "string"
                      ? q.keywords.split(",").map((keyword: string) => keyword.trim().toLowerCase()).filter(Boolean)
                      : [],
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

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!isMoreMenuOpen) return;
      if (!moreMenuRef.current) return;
      if (moreMenuRef.current.contains(event.target as globalThis.Node)) return;
      setMoreMenuOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreMenuOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [isMoreMenuOpen]);

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
      <div className="sticky top-2 z-10 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-black/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SearchInput placeholder="Cari materi..." value={query} onChange={onQueryChange} />
          <div className="relative flex items-center gap-2" ref={moreMenuRef}>
            <button onClick={onAdd} className="sage-button">
              <FiPlus /> Tambah Section
            </button>
            <button
              type="button"
              onClick={() => setMoreMenuOpen((prev) => !prev)}
              className={`rounded-md border px-3 py-2 text-xs font-medium transition ${
                isMoreMenuOpen ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              aria-haspopup="menu"
              aria-expanded={isMoreMenuOpen}
              aria-label="Buka pengaturan tampilan section"
            >
              More
            </button>
            {isMoreMenuOpen && (
              <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Urutan
                  <select
                    value={sort}
                    onChange={(e) => onSortChange(e.target.value as "newest" | "alpha")}
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-slate-300"
                  >
                    <option value="newest">Terbaru</option>
                    <option value="alpha">Abjad</option>
                  </select>
                </label>
                <div className="mb-2 flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("card")}
                    className={`flex-1 rounded px-2 py-1 text-xs ${viewMode === "card" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-white"}`}
                  >
                    Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    className={`flex-1 rounded px-2 py-1 text-xs ${viewMode === "table" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-white"}`}
                  >
                    Table
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSectionOrdinalBadge((prev) => !prev)}
                  className={`w-full rounded-md px-2 py-1.5 text-left text-xs ${
                    showSectionOrdinalBadge ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {showSectionOrdinalBadge ? "Hide Section #" : "Show Section #"}
                </button>
              </div>
            )}
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
          <div className="text-[11px] text-slate-500">Mode: {viewMode === "card" ? "Card" : "Table"}</div>
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

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">Viewer Konten Per Section</p>
            <p className="text-xs text-slate-500 mt-1">
              {viewMode === "card" ? "Semua section ditampilkan dalam kartu detail." : "Mode tabel untuk review cepat section."}
            </p>
            {isSavingOrder && <p className="mt-1 text-xs text-slate-500">Menyimpan urutan section...</p>}
            {reorderError && <p className="mt-1 text-xs text-red-600">{reorderError}</p>}
          </div>
          <div className="px-1 py-1 text-right">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Total Section</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{filteredByTypeItems.length}</p>
          </div>
        </div>

        {filteredByTypeItems.length > 0 ? (
          viewMode === "table" ? (
            <div className="overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/30">
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
          <div className="space-y-2">
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
              const fallbackQuestions = sectionQuestions.filter((q) => !usedQuestionIds.has(q.id) && !isTaskSupportQuestion(q));
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
                  className={`rounded-xl border bg-white ${compactDragMode ? "p-3" : "p-4"} space-y-4 shadow-sm transition-[box-shadow,transform,border-color] duration-200 ${
                    isDropTarget
                      ? "border-slate-400 ring-2 ring-slate-200 shadow-md"
                      : "border-slate-200 hover:-translate-y-[1px] hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/30 dark:hover:shadow-black/40"
                  }`}
                >
                  {collapsedSummaryMode ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex items-center gap-1">
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
                      <div className="flex items-center gap-1">
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
                      <label className="inline-flex items-center gap-1.5 px-1 py-1 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={selectedSectionIds.includes(material.id)}
                          onChange={() => toggleSelectSection(material.id)}
                        />
                        Pilih
                      </label>
                      {!compactDragMode && (
                        <>
                          <div className="ml-auto flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => openQuickAdd(material)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                              aria-label="Tambah konten"
                              title="Tambah konten"
                            >
                              <FiPlus />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingSection(material)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                              aria-label="Edit section"
                              title="Edit section"
                            >
                              <FiEdit2 />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteSection(material)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-red-50 text-red-600 transition hover:bg-red-100"
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
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-700 transition hover:bg-slate-200"
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
                          <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white shadow-sm dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/25">
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
                                  className={`bg-white transition-[box-shadow,background-color] duration-200 ${
                                    isContentDropTarget
                                      ? "border-slate-400 ring-2 ring-slate-200 shadow-md"
                                      : `${contentTone.accent} hover:shadow-sm`
                                  }`}
                                >
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() =>
                                      setCollapsedContentCards((prev) => ({
                                        ...prev,
                                        [collapseKey]: !isCollapsed,
                                      }))
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key !== "Enter" && e.key !== " ") return;
                                      e.preventDefault();
                                      setCollapsedContentCards((prev) => ({
                                        ...prev,
                                        [collapseKey]: !isCollapsed,
                                      }));
                                    }}
                                    className="flex w-full items-center gap-3 px-0 py-2.5 text-left hover:bg-slate-50"
                                  >
                                    <div className="flex shrink-0 items-center gap-1">
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
                                    <div className="flex min-w-0 items-start gap-2">
                                      <span className={`inline-flex h-6 w-[74px] shrink-0 items-center justify-center rounded-full px-2.5 text-[11px] font-medium ${contentTone.badge}`}>
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
                                              setConfirmDeleteContentCard({ material, card });
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
                                  </div>
                                  {!isCollapsed && (
                                    <div className="px-0 py-3">
                                      {card.type !== "materi" && card.type !== "tugas" && card.type !== "soal" && (card.meta?.description || "").trim() && (
                                        <div className="mb-2 rounded-md bg-slate-50 px-3 py-2">
                                          <p className="whitespace-pre-wrap text-sm text-slate-700">{card.meta?.description}</p>
                                        </div>
                                      )}
                                      {card.type === "materi" && card.meta?.materi_mode === "lengkap" ? (
                                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
                                          {(() => {
                                            const desc =
                                              (card.meta?.materi_description || "").trim() ||
                                              (((card.body || "") && !containsHtmlTag(card.body)) ? (card.body || "").trim() : "");
                                            return (
                                              <div className="space-y-2">
                                                {desc ? (
                                                  <p className="whitespace-pre-wrap text-sm text-slate-700">{desc}</p>
                                                ) : (
                                                  <p className="text-sm text-slate-600">Konten materi ini dikelola di editor materi lengkap.</p>
                                                )}
                                              </div>
                                            );
                                          })()}
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
                                                  <div className="rounded-md bg-white px-3 py-2">
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
                                          {normalizeSectionMediaItems(card.type, card.body, card.meta).length > 0 ? (
                                            <div className="space-y-2">
                                              {normalizeSectionMediaItems(card.type, card.body, card.meta).map((item, idx) => (
                                                <div
                                                  key={`${item.url}-${idx}`}
                                                  className={`space-y-2 ${
                                                    item.align === "left"
                                                      ? "mr-auto"
                                                      : item.align === "right"
                                                        ? "ml-auto"
                                                        : "mx-auto"
                                                  }`}
                                                  style={{ width: `${Math.max(25, Math.min(100, item.width_percent || 60))}%`, maxWidth: "100%" }}
                                                >
                                                  <div
                                                    className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/20"
                                                  >
                                                    <img src={item.url} alt={item.name || `${card.title}-${idx + 1}`} className="h-auto w-full object-cover" />
                                                  </div>
                                                  {item.caption?.trim() && (
                                                    <p className="text-center text-xs italic text-slate-500">{item.caption.trim()}</p>
                                                  )}
                                                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-slate-700 underline">
                                                    Buka gambar {idx + 1}
                                                  </a>
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <p className="text-sm text-slate-500">Gambar belum diisi.</p>
                                          )}
                                        </div>
                                      ) : card.type === "video" ? (
                                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                                          {normalizeSectionMediaItems(card.type, card.body, card.meta).length > 0 ? (
                                            <div className="space-y-3">
                                              {normalizeSectionMediaItems(card.type, card.body, card.meta).map((item, idx) => (
                                                <div
                                                  key={`${item.url}-${idx}`}
                                                  className={`overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/20 ${
                                                    item.align === "left"
                                                      ? "mr-auto"
                                                      : item.align === "right"
                                                        ? "ml-auto"
                                                        : "mx-auto"
                                                  }`}
                                                  style={{ width: `${Math.max(25, Math.min(100, item.width_percent || 70))}%`, maxWidth: "100%" }}
                                                >
                                                  <iframe
                                                    src={normalizeEmbedUrl(item.url)}
                                                    title={`${card.title}-${idx + 1}`}
                                                    className="h-64 w-full"
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                    referrerPolicy="strict-origin-when-cross-origin"
                                                    allowFullScreen
                                                  />
                                                  {item.caption?.trim() && (
                                                    <div className="border-t border-slate-200 px-3 py-2 text-center text-xs italic text-slate-500 dark:border-slate-700">
                                                      {item.caption.trim()}
                                                    </div>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <p className="text-sm text-slate-500">Link video belum diisi.</p>
                                          )}
                                        </div>
                                      ) : card.type === "upload" ? (
                                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                                          {normalizeSectionMediaItems(card.type, card.body, card.meta).length > 0 ? (
                                            <div className="space-y-1">
                                              {normalizeSectionMediaItems(card.type, card.body, card.meta).map((item, idx) => (
                                                /\.pdf(\?.*)?$/i.test(item.url) ? (
                                                  <div
                                                    key={`${item.url}-${idx}`}
                                                    className={`overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/20 ${
                                                      item.align === "left"
                                                        ? "mr-auto"
                                                        : item.align === "right"
                                                          ? "ml-auto"
                                                          : "mx-auto"
                                                    }`}
                                                    style={{ width: `${Math.max(40, Math.min(100, item.width_percent || 100))}%`, maxWidth: "100%" }}
                                                  >
                                                    <iframe src={item.url} title={`${item.name || "Dokumen"}-${idx + 1}`} className="h-64 w-full" />
                                                    {item.caption?.trim() && (
                                                      <div className="border-t border-slate-200 px-3 py-2 text-center text-xs italic text-slate-500 dark:border-slate-700">
                                                        {item.caption.trim()}
                                                      </div>
                                                    )}
                                                  </div>
                                                ) : (
                                                  <a
                                                    key={`${item.url}-${idx}`}
                                                    href={item.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-800 underline"
                                                  >
                                                    <FiFileText size={14} /> {item.name || `Buka Dokumen ${idx + 1}`}
                                                  </a>
                                                )
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
        isOpen={!!confirmDeleteContentCard}
        title="Hapus Konten"
        message={
          confirmDeleteContentCard
            ? `Hapus konten "${confirmDeleteContentCard.card.title}" dari section "${confirmDeleteContentCard.material.judul}"?`
            : ""
        }
        confirmLabel="Hapus"
        danger
        onCancel={() => setConfirmDeleteContentCard(null)}
        onConfirm={async () => {
          if (!confirmDeleteContentCard) return;
          try {
            setContentActionError("");
            await handleDeleteContentCard(confirmDeleteContentCard.material, confirmDeleteContentCard.card);
            setConfirmDeleteContentCard(null);
          } catch (err: any) {
            setContentActionError(err?.message || "Gagal menghapus konten.");
          }
        }}
      />

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

function isTaskSupportQuestion(question?: MaterialQuestionPreview | null): boolean {
  return Array.isArray(question?.keywords) && question.keywords.some((keyword) => keyword === "tugas_submission");
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
  const sanitized = value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .trim();

  if (typeof document === "undefined") return sanitized;

  const container = document.createElement("div");
  container.innerHTML = sanitized;
  container.querySelectorAll("[data-media-delete='1'], [data-media-hint='1']").forEach((node) => node.remove());
  container.querySelectorAll<HTMLElement>("[data-media-block='1']").forEach((block) => {
    block.removeAttribute("contenteditable");
    block.style.outline = "none";
    block.style.boxShadow = "none";
    block.style.resize = "none";
    block.style.overflow = "visible";
    block.style.border = "0";
    block.style.padding = "0";
    block.style.background = "transparent";
    block.style.minHeight = "";
  });
  container.querySelectorAll<HTMLElement>("iframe, video, embed, object, a").forEach((el) => {
    el.style.pointerEvents = "";
  });
  return container.innerHTML.trim();
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
    return (
      <div
        className="sage-tiptap-render max-w-none text-sm text-[color:var(--ink-700)] dark:text-slate-200"
        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(html) }}
      />
    );
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

type SectionMediaItem = {
  url: string;
  width_percent?: number;
  name?: string;
  kind?: "image" | "video" | "document";
  align?: "left" | "center" | "right";
  caption?: string;
};

function normalizeSectionMediaItems(
  type: SectionContentType,
  body?: string,
  meta?: SectionContentCardData["meta"],
): SectionMediaItem[] {
  const items = Array.isArray(meta?.media_items)
    ? meta.media_items
        .filter((item): item is RawSectionMediaItem =>
          !!item && typeof item.url === "string" && item.url.trim().length > 0
        )
        .map((item) => ({
          url: item.url.trim(),
          width_percent:
            typeof item.width_percent === "number" && Number.isFinite(item.width_percent)
              ? Math.max(25, Math.min(100, item.width_percent))
              : type === "gambar"
                ? 60
                : type === "video"
                  ? 70
                  : 100,
          name: item.name,
          kind: item.kind,
          align: item.align === "left" || item.align === "right" ? item.align : ("center" as const),
          caption: typeof item.caption === "string" ? item.caption : "",
        }))
    : [];

  if (items.length > 0) return items;

  return (body || "")
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((url) => ({
      url,
      width_percent: type === "gambar" ? 60 : type === "video" ? 70 : 100,
      kind: type === "gambar" ? "image" : type === "video" ? "video" : "document",
      align: "center",
      caption: "",
    }));
}

function toAbsoluteUploadUrl(filePath: string): string {
  const trimmed = filePath.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) {
    if (typeof window !== "undefined" && window.location?.origin) {
      return `${window.location.origin}${trimmed}`;
    }
    return trimmed;
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/${trimmed.replace(/^\/+/, "")}`;
  }
  return trimmed;
}

function SectionMediaPreviewPane({
  type,
  mediaItems,
  onUpdate,
  onRemove,
}: {
  type: "gambar" | "video" | "upload";
  mediaItems: SectionMediaItem[];
  onUpdate: (index: number, patch: Partial<SectionMediaItem>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="xl:sticky xl:top-4 space-y-3 rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-sm backdrop-blur text-slate-100">
      <div>
        <p className="text-sm font-medium text-slate-100">Preview Konten</p>
        <p className="text-xs text-slate-400">Atur ukuran, posisi, dan caption tiap item sebelum disimpan.</p>
      </div>
      {mediaItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950 px-3 py-6 text-center text-xs text-slate-400">
          Belum ada file/link yang ditambahkan.
        </div>
      ) : (
        <div className="space-y-3">
          {mediaItems.map((item, idx) => {
            const width = Math.max(25, Math.min(100, item.width_percent || (type === "gambar" ? 60 : type === "video" ? 70 : 100)));
            const align = item.align === "left" || item.align === "right" ? item.align : "center";
            const justifyClass = align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
            return (
              <div key={`${item.url}-${idx}`} className="rounded-xl border border-slate-700 bg-[#071a38] p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-medium text-slate-100">{item.name || `Item ${idx + 1}`}</p>
                  <button type="button" onClick={() => onRemove(idx)} className="text-xs text-red-600 hover:underline">
                    Hapus
                  </button>
                </div>
                <div className={`mt-3 flex min-h-40 items-start rounded-xl border border-dashed border-slate-700 bg-slate-900 p-3 ${justifyClass}`}>
                  <div style={{ width: `${width}%` }} className="max-w-full overflow-hidden rounded-lg border border-slate-700 bg-white">
                    {type === "gambar" ? (
                      <img src={item.url} alt={item.name || `Preview ${idx + 1}`} className="block h-auto w-full object-contain" />
                    ) : type === "video" ? (
                      <iframe
                        src={normalizeEmbedUrl(item.url)}
                        title={item.name || `Preview video ${idx + 1}`}
                        className="h-44 w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                      />
                    ) : /\.pdf(\?.*)?$/i.test(item.url) ? (
                      <iframe src={item.url} title={item.name || `Preview dokumen ${idx + 1}`} className="h-44 w-full" />
                    ) : (
                      <div className="px-3 py-6 text-center text-xs text-slate-600">{item.name || item.url}</div>
                    )}
                    {item.caption?.trim() && (
                      <div className="border-t border-slate-700 px-3 py-2 text-center text-xs text-slate-400 bg-slate-950">
                        {item.caption.trim()}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 space-y-3">
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Posisi</p>
                    <div className="flex gap-2">
                      {[
                        { value: "left", label: "Kiri", icon: FiAlignLeft },
                        { value: "center", label: "Tengah", icon: FiAlignCenter },
                        { value: "right", label: "Kanan", icon: FiAlignRight },
                      ].map((option) => {
                        const Icon = option.icon;
                        const active = align === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => onUpdate(idx, { align: option.value as SectionMediaItem["align"] })}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition ${
                              active
                                ? "border-slate-200 bg-slate-100 text-slate-900"
                                : "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                            }`}
                          >
                            <Icon size={13} />
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Lebar preview</span>
                    <span>{width}%</span>
                  </div>
                  <input
                    type="range"
                    min={25}
                    max={100}
                    step={5}
                    value={width}
                    onChange={(e) => onUpdate(idx, { width_percent: Number(e.target.value) })}
                    className="w-full"
                  />
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Caption</label>
                    <input
                      type="text"
                      value={item.caption || ""}
                      onChange={(e) => onUpdate(idx, { caption: e.target.value })}
                      placeholder="Tambahkan caption opsional..."
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-slate-500"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function normalizeColorInput(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

const FONT_FAMILY_OPTIONS = [
  { label: "Sans Serif", value: "" },
  { label: "Serif", value: "Georgia, Times New Roman, serif" },
  { label: "Monospace", value: "Menlo, Monaco, Consolas, monospace" },
  { label: "Work Sans", value: "Work Sans, system-ui, sans-serif" },
];

const FONT_SIZE_OPTIONS = [
  { label: "Normal", value: "" },
  { label: "12", value: "12px" },
  { label: "14", value: "14px" },
  { label: "16", value: "16px" },
  { label: "18", value: "18px" },
  { label: "24", value: "24px" },
  { label: "32", value: "32px" },
];

const FontFamily = Extension.create({
  name: "fontFamily",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontFamily: {
            default: null,
            parseHTML: (element) => element.style.fontFamily || null,
            renderHTML: (attributes) =>
              attributes.fontFamily
                ? {
                    style: `font-family: ${attributes.fontFamily}`,
                  }
                : {},
          },
        },
      },
    ];
  },
});

const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) =>
              attributes.fontSize
                ? {
                    style: `font-size: ${attributes.fontSize}`,
                  }
                : {},
          },
        },
      },
    ];
  },
});

type ImageAlign = "left" | "center" | "right";

function getImageAlignFromElement(element: HTMLElement): ImageAlign {
  const dataAlign = element.getAttribute("data-align");
  if (dataAlign === "left" || dataAlign === "center" || dataAlign === "right") {
    return dataAlign;
  }

  const inlineFloat = (element.style.float || "").trim();
  if (inlineFloat === "left" || inlineFloat === "right") {
    return inlineFloat;
  }

  const marginLeft = (element.style.marginLeft || "").trim();
  const marginRight = (element.style.marginRight || "").trim();
  if (marginLeft === "auto" && marginRight === "auto") {
    return "center";
  }

  return "center";
}

function getImageStyle(width: string, align: ImageAlign): string {
  const safeWidth = width || "480px";
  const responsiveWidth = /^\d+(\.\d+)?px$/i.test(safeWidth) ? `min(${safeWidth}, 100%)` : safeWidth;

  if (align === "left") {
    return `width: ${responsiveWidth}; height: auto; display: block; margin: 0.75rem auto 0.75rem 0;`;
  }

  if (align === "right") {
    return `width: ${responsiveWidth}; height: auto; display: block; margin: 0.75rem 0 0.75rem auto;`;
  }

  return `width: ${responsiveWidth}; height: auto; display: block; margin: 0.75rem auto;`;
}

function ResizableImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const align = (node.attrs.align || "center") as ImageAlign;

  const startResize = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      const startX = event.clientX;
      const startWidth = wrapper.getBoundingClientRect().width;
      const parentWidth =
        wrapper.closest(".sage-tiptap-content")?.getBoundingClientRect().width ||
        wrapper.closest(".ProseMirror")?.getBoundingClientRect().width ||
        window.innerWidth;

      const handleMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const nextWidth = Math.max(120, Math.min(parentWidth, startWidth + deltaX));
        updateAttributes({ width: `${Math.round(nextWidth)}px` });
      };

      const stopResize = () => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", stopResize);
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", stopResize);
    },
    [updateAttributes],
  );

  return (
    <NodeViewWrapper
      className={`sage-tiptap-image-node sage-tiptap-image-node-${align}${selected ? " is-selected" : ""}`}
      data-align={align}
    >
      <div
        ref={wrapperRef}
        className={`sage-tiptap-image-frame${selected ? " is-selected" : ""}`}
        style={{ width: node.attrs.width || "480px" }}
      >
        <img
          src={String(node.attrs.src || "")}
          alt={String(node.attrs.alt || "")}
          title={String(node.attrs.title || "")}
          className="sage-tiptap-image"
        />
        <button
          type="button"
          className="sage-tiptap-image-handle"
          onMouseDown={startResize}
          title="Resize gambar dari pojok"
          aria-label="Resize gambar dari pojok"
        >
          ◢
        </button>
      </div>
    </NodeViewWrapper>
  );
}

const ResizableImage = Node.create({
  name: "resizableImage",
  group: "block",
  draggable: true,
  selectable: true,
  atom: true,
  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
      width: {
        default: "480px",
        parseHTML: (element) =>
          element.getAttribute("data-width") || element.style.width || element.getAttribute("width") || "480px",
        renderHTML: (attributes) => ({
          "data-width": attributes.width || "480px",
        }),
      },
      align: {
        default: "center",
        parseHTML: (element) => getImageAlignFromElement(element),
        renderHTML: (attributes) => ({
          "data-align": attributes.align || "center",
        }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "img[src]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "img",
      mergeAttributes(HTMLAttributes, {
        style: getImageStyle(
          String(HTMLAttributes.width || "480px"),
          ((HTMLAttributes.align as ImageAlign | undefined) || "center"),
        ),
      }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});

function ToolbarButton({
  active = false,
  disabled = false,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      className={`sage-tiptap-toolbar-button${active ? " is-active" : ""}`}
    >
      {children}
    </button>
  );
}

function RichTextEditorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  return <RichContentEditor value={value} onChange={onChange} allowPdf allowTables imageMaxSizeMb={10} />;
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
    media_items?: SectionMediaItem[];
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
    mediaItems: SectionMediaItem[];
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
    mediaItems: [],
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
  const [mediaItems, setMediaItems] = useState<SectionMediaItem[]>([]);
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
  const mediaPreviewEnabled = type === "gambar" || type === "video" || type === "upload";
  const updateMediaItem = useCallback((index: number, patch: Partial<SectionMediaItem>) => {
    setMediaItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  }, []);
  const renderMediaPreviewPane = () => {
    if (!mediaPreviewEnabled) return null;
    return <SectionMediaPreviewPane type={type as "gambar" | "video" | "upload"} mediaItems={mediaItems} onUpdate={updateMediaItem} onRemove={(idx) => setMediaItems((prev) => prev.filter((_, i) => i !== idx))} />;
  };

  const applyDraft = useCallback((draft: QuickAddDraft) => {
    setTitle(draft.title);
    setDescription(draft.description);
    setBody(draft.body);
    setMateriHtml(draft.materiHtml || "<p></p>");
    setImageUrl(draft.imageUrl);
    setVideoUrl(draft.videoUrl);
    setUploadedFileName(draft.uploadedFileName);
    setMediaItems(draft.mediaItems || []);
    setTaskInstruction(draft.taskInstruction);
    setTaskDueAt(draft.taskDueAt);
    setTaskSubmissionType(draft.taskSubmissionType);
    setTaskAllowedFormats(draft.taskAllowedFormats);
    setTaskMaxFileMb(draft.taskMaxFileMb);
  }, []);

  const resetQuickAddDraft = useCallback((key: string) => {
    if (pendingImagePreviewUrl) {
      URL.revokeObjectURL(pendingImagePreviewUrl);
    }
    const nextDraft = createDefaultDraft(key);
    draftStoreRef.current[key] = nextDraft;
    applyDraft(nextDraft);
    setPendingDocumentFiles([]);
    setPendingImagePreviewUrl("");
    setError("");
    onError("");
  }, [applyDraft, onError, pendingImagePreviewUrl]);

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
        mediaItems,
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
      mediaItems,
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

  useEffect(() => {
    if (type === "gambar" || type === "video" || type === "upload") {
      setBody(mediaItems.map((item) => item.url).join("\n"));
    }
  }, [mediaItems, type]);

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
      setMediaItems((prev) => [...prev, { url: raw, width_percent: 60, kind: "image", align: "center", caption: "" }]);
      setImageUrl("");
    } catch (err: any) {
      setError(err?.message || "Gagal menambahkan gambar dari link.");
    } finally {
      setIsUploadingAsset(false);
    }
  };

  const uploadImageFiles = async (files: File[], previewUrlToRevoke?: string) => {
    setError("");
    setIsUploadingAsset(true);
    try {
      const nextItems: SectionMediaItem[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        const uploadBody = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok) {
          throw new Error(uploadBody?.message || `Gagal upload gambar: ${file.name}`);
        }
        const uploadedPath = typeof uploadBody?.filePath === "string" ? uploadBody.filePath : "";
        if (!uploadedPath) {
          throw new Error(`Respons upload gambar tidak valid: ${file.name}`);
        }
        nextItems.push({ url: uploadedPath, width_percent: 60, name: file.name, kind: "image", align: "center", caption: "" });
      }
      setMediaItems((prev) => [...prev, ...nextItems]);
      setUploadedFileName(nextItems.map((item) => item.name).filter(Boolean).join(", "));
      if (previewUrlToRevoke) {
        URL.revokeObjectURL(previewUrlToRevoke);
      }
      setPendingImagePreviewUrl("");
    } catch (err: any) {
      setError(err?.message || "Gagal upload gambar.");
    } finally {
      setIsUploadingAsset(false);
      if (imageFileInputRef.current) imageFileInputRef.current.value = "";
    }
  };

  const handlePickImageFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const accepted: File[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        setError(`Ukuran gambar maksimal 10MB: ${file.name}`);
        return;
      }
      const extOk = isAllowedImageExtension(file.name);
      const mimeOk = file.type === "image/png" || file.type === "image/jpeg";
      if (!extOk && !mimeOk) {
        setError(`Format gambar harus PNG, JPG, atau JPEG: ${file.name}`);
        return;
      }
      accepted.push(file);
    }
    if (pendingImagePreviewUrl) {
      URL.revokeObjectURL(pendingImagePreviewUrl);
    }
    const nextPreviewUrl = URL.createObjectURL(accepted[0]);
    setError("");
    setPendingImagePreviewUrl(nextPreviewUrl);
    await uploadImageFiles(accepted, nextPreviewUrl);
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
    setMediaItems((prev) => [...prev, { url: embedUrl, width_percent: 70, kind: "video", align: "center", caption: "" }]);
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
      setMediaItems((prev) => [
        ...prev,
        ...uploadedPaths.map((url, idx) => ({
          url,
          name: uploadedNames[idx] || `Dokumen ${idx + 1}`,
          width_percent: 100,
          kind: "document" as const,
          align: "center" as const,
          caption: "",
        })),
      ]);
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
        media_items: type === "gambar" || type === "video" || type === "upload" ? mediaItems : undefined,
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
      resetQuickAddDraft(selectedContentTypeValue);
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
      <div className="relative w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-950">
        <button
          type="button"
          onClick={() => {
            resetQuickAddDraft(selectedContentTypeValue);
            onClose();
          }}
          className="absolute right-3 top-3 rounded-md p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Tutup"
        >
          <FiX />
        </button>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{lockType ? "Isi Materi" : "Tambah Konten"}</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Section: {materialTitle}</p>
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
          <div className={mediaPreviewEnabled ? "grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] xl:items-start" : "space-y-4"}>
          <div className="space-y-4">
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
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      void handlePickImageFiles(e.target.files);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => imageFileInputRef.current?.click()}
                    className="sage-button-outline !py-2 !px-3 text-xs"
                    disabled={isUploadingAsset}
                  >
                    Pilih Gambar (max 10MB, auto upload)
                  </button>
                </div>
                {pendingImagePreviewUrl && <p className="text-xs text-slate-500">Preview upload sedang disiapkan...</p>}
                {body && <p className="text-xs text-slate-500 break-all">Tersimpan: {mediaItems.length} file/link</p>}
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
                {body && <p className="text-xs text-slate-500 break-all">Tersimpan: {mediaItems.length} video</p>}
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
                {body && <p className="text-xs text-slate-500 break-all">Tersimpan: {mediaItems.length} dokumen</p>}
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
          </div>
          {mediaPreviewEnabled && <div>{renderMediaPreviewPane()}</div>}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                resetQuickAddDraft(selectedContentTypeValue);
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
    media_items?: SectionMediaItem[];
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
  const initializedCardIdRef = useRef<string | null>(null);
  const initialMateriModeRef = useRef<"singkat" | "lengkap">("singkat");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [materiHtml, setMateriHtml] = useState("<p></p>");
  const [isDetailMateriEditorOpen, setIsDetailMateriEditorOpen] = useState(false);
  const [isDetailMateriIframeLoading, setIsDetailMateriIframeLoading] = useState(false);
  const [materiMode, setMateriMode] = useState<"singkat" | "lengkap">("singkat");
  const [isMateriModeLocked, setIsMateriModeLocked] = useState(false);
  const [taskInstruction, setTaskInstruction] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [taskSubmissionType, setTaskSubmissionType] = useState<TaskSubmissionType>("teks");
  const [taskAllowedFormats, setTaskAllowedFormats] = useState<string[]>(["pdf", "docx", "pptx"]);
  const [taskMaxFileMb, setTaskMaxFileMb] = useState("5");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [pendingDocumentFiles, setPendingDocumentFiles] = useState<File[]>([]);
  const [pendingImagePreviewUrl, setPendingImagePreviewUrl] = useState("");
  const [mediaItems, setMediaItems] = useState<SectionMediaItem[]>([]);
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const documentFileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingSubmitPayload, setPendingSubmitPayload] = useState<{
    title: string;
    body: string;
    media_items?: SectionMediaItem[];
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
  } | null>(null);
  const mediaPreviewEnabled = card?.type === "gambar" || card?.type === "video" || card?.type === "upload";
  const updateMediaItem = useCallback((index: number, patch: Partial<SectionMediaItem>) => {
    setMediaItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  }, []);

  useEffect(() => {
    if (!isOpen) {
      initializedCardIdRef.current = null;
      return;
    }
    if (!card) return;
    if (initializedCardIdRef.current === card.id) return;
    initializedCardIdRef.current = card.id;
    setTitle(card.title || "");
    setDescription(card.type === "soal" ? (card.meta?.description || card.body || "") : (card.meta?.description || ""));
    const rawBody = card.body || "";
    const fallbackDescription = rawBody && !containsHtmlTag(rawBody) ? rawBody : "";
    setBody(card.meta?.materi_description || fallbackDescription);
    setMateriHtml(card.body || "<p></p>");
    setIsDetailMateriEditorOpen(false);
    const initialMateriMode = card.meta?.materi_mode || "singkat";
    initialMateriModeRef.current = initialMateriMode;
    setMateriMode(initialMateriMode);
    setIsMateriModeLocked(card.type === "materi");
    setTaskInstruction(card.meta?.tugas_instruction || card.body || "");
    setTaskDueAt(card.meta?.tugas_due_at || "");
    setTaskSubmissionType(card.meta?.tugas_submission_type || "teks");
    setTaskAllowedFormats(Array.isArray(card.meta?.tugas_allowed_formats) ? card.meta.tugas_allowed_formats : ["pdf", "docx", "pptx"]);
    setTaskMaxFileMb(typeof card.meta?.tugas_max_file_mb === "number" ? String(card.meta?.tugas_max_file_mb) : "5");
    setImageUrl("");
    setVideoUrl("");
    setUploadedFileName("");
    setPendingDocumentFiles([]);
    setPendingImagePreviewUrl("");
    setMediaItems(normalizeSectionMediaItems(card.type, card.body, card.meta));
    setIsUploadingAsset(false);
    setError("");
    setIsSubmitting(false);
    setPendingSubmitPayload(null);
    setIsDetailMateriIframeLoading(false);
  }, [isOpen, card]);

  useEffect(() => {
    return () => {
      if (pendingImagePreviewUrl) {
        URL.revokeObjectURL(pendingImagePreviewUrl);
      }
    };
  }, [pendingImagePreviewUrl]);

  useEffect(() => {
    if (card?.type === "gambar" || card?.type === "video" || card?.type === "upload") {
      setBody(mediaItems.map((item) => item.url).join("\n"));
    }
  }, [card?.type, mediaItems]);

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

  const buildSubmitPayload = useCallback(() => {
    if (!card) return null;
    if (!title.trim()) {
      setError("Judul konten wajib diisi.");
      return null;
    }
    const safeMateriHtml = sanitizeRichHtml(materiHtml || "");
    const materiPlainText = safeMateriHtml.replace(/<[^>]+>/g, "").trim();
    if (card.type === "materi" && materiMode === "singkat" && !materiPlainText) {
      setError("Isi materi wajib diisi.");
      return null;
    }
    if (card.type === "soal" && !description.trim()) {
      setError("Deskripsi wajib diisi.");
      return null;
    }
    if (card.type === "tugas" && !taskInstruction.trim()) {
      setError("Instruksi tugas wajib diisi.");
      return null;
    }
    if ((card.type === "gambar" || card.type === "video" || card.type === "upload") && mediaItems.length === 0) {
      setError("Konten belum diisi.");
      return null;
    }
    setError("");
    return {
      title: title.trim(),
      body:
        card.type === "materi"
          ? (materiMode === "singkat" ? safeMateriHtml : body.trim())
        : card.type === "tugas"
          ? taskInstruction.trim()
        : card.type === "soal"
          ? description.trim()
          : card.type === "gambar" || card.type === "video" || card.type === "upload"
            ? mediaItems.map((item) => item.url).join("\n")
            : body.trim(),
      media_items: card.type === "gambar" || card.type === "video" || card.type === "upload" ? mediaItems : undefined,
      materi_mode: card.type === "materi" ? (isMateriModeLocked ? initialMateriModeRef.current || materiMode : materiMode) : undefined,
      materi_description:
        card.type === "materi" && ((isMateriModeLocked ? initialMateriModeRef.current : materiMode) === "lengkap") ? body.trim() : undefined,
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
    };
  }, [
    body,
    card,
    card?.type,
    description,
    isMateriModeLocked,
    mediaItems,
    materiHtml,
    materiMode,
    taskAllowedFormats,
    taskDueAt,
    taskInstruction,
    taskMaxFileMb,
    taskSubmissionType,
    title,
  ]);

  const submitPayload = useCallback(async (payload: NonNullable<typeof pendingSubmitPayload>) => {
    setIsSubmitting(true);
    try {
      await onSubmit(payload);
      setPendingSubmitPayload(null);
    } catch (err: any) {
      setError(err?.message || "Gagal menyimpan perubahan.");
    } finally {
      setIsSubmitting(false);
    }
  }, [onSubmit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildSubmitPayload();
    if (!payload) return;
    setPendingSubmitPayload(payload);
  };

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
      if (!ok) throw new Error("Link gambar tidak valid. Gunakan URL PNG/JPG/JPEG yang bisa diakses.");
      setMediaItems((prev) => [...prev, { url: raw, width_percent: 60, kind: "image", align: "center", caption: "" }]);
      setImageUrl("");
    } catch (err: any) {
      setError(err?.message || "Gagal menambahkan gambar dari link.");
    } finally {
      setIsUploadingAsset(false);
    }
  };

  const uploadImageFiles = async (files: File[], previewUrlToRevoke?: string) => {
    setError("");
    setIsUploadingAsset(true);
    try {
      const nextItems: SectionMediaItem[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        const uploadBody = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok) throw new Error(uploadBody?.message || `Gagal upload gambar: ${file.name}`);
        const uploadedPath = typeof uploadBody?.filePath === "string" ? uploadBody.filePath : "";
        if (!uploadedPath) throw new Error(`Respons upload gambar tidak valid: ${file.name}`);
        nextItems.push({ url: uploadedPath, width_percent: 60, name: file.name, kind: "image", align: "center", caption: "" });
      }
      setMediaItems((prev) => [...prev, ...nextItems]);
      setUploadedFileName(nextItems.map((item) => item.name).filter(Boolean).join(", "));
      if (previewUrlToRevoke) URL.revokeObjectURL(previewUrlToRevoke);
      setPendingImagePreviewUrl("");
    } catch (err: any) {
      setError(err?.message || "Gagal upload gambar.");
    } finally {
      setIsUploadingAsset(false);
      if (imageFileInputRef.current) imageFileInputRef.current.value = "";
    }
  };

  const handlePickImageFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const accepted: File[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        setError(`Ukuran gambar maksimal 10MB: ${file.name}`);
        return;
      }
      const extOk = isAllowedImageExtension(file.name);
      const mimeOk = file.type === "image/png" || file.type === "image/jpeg";
      if (!extOk && !mimeOk) {
        setError(`Format gambar harus PNG, JPG, atau JPEG: ${file.name}`);
        return;
      }
      accepted.push(file);
    }
    if (pendingImagePreviewUrl) URL.revokeObjectURL(pendingImagePreviewUrl);
    const nextPreviewUrl = URL.createObjectURL(accepted[0]);
    setPendingImagePreviewUrl(nextPreviewUrl);
    setError("");
    await uploadImageFiles(accepted, nextPreviewUrl);
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
    setMediaItems((prev) => [...prev, { url: embedUrl, width_percent: 70, kind: "video", align: "center", caption: "" }]);
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
        if (!uploadRes.ok) throw new Error(uploadBody?.message || `Gagal upload dokumen: ${pendingDocumentFile.name}`);
        const uploadedPath = typeof uploadBody?.filePath === "string" ? uploadBody.filePath : "";
        if (!uploadedPath) throw new Error(`Respons upload dokumen tidak valid: ${pendingDocumentFile.name}`);
        uploadedPaths.push(uploadedPath);
        uploadedNames.push(pendingDocumentFile.name);
      }
      setMediaItems((prev) => [
        ...prev,
        ...uploadedPaths.map((url, idx) => ({
          url,
          name: uploadedNames[idx] || `Dokumen ${idx + 1}`,
          width_percent: 100,
          kind: "document" as const,
          align: "center" as const,
          caption: "",
        })),
      ]);
      setUploadedFileName(uploadedNames.join(", "));
      setPendingDocumentFiles([]);
    } catch (err: any) {
      setError(err?.message || "Gagal upload dokumen.");
    } finally {
      setIsUploadingAsset(false);
      if (documentFileInputRef.current) documentFileInputRef.current.value = "";
    }
  };

  if (!isOpen || !card) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/45 p-4 flex items-center justify-center">
      <div className="relative w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-950">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Tutup"
        >
          <FiX />
        </button>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Edit Konten</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Tipe: {getSectionContentTypeLabel(card.type)}</p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className={mediaPreviewEnabled ? "grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] xl:items-start" : "space-y-4"}>
          <div className="space-y-4">
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
                    disabled={isMateriModeLocked}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                      materiMode === "singkat" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"
                    } ${isMateriModeLocked ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    Materi Singkat
                  </button>
                  <button
                    type="button"
                    onClick={() => setMateriMode("lengkap")}
                    disabled={isMateriModeLocked}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium ${materiMode === "lengkap" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"} ${isMateriModeLocked ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    Materi Lengkap
                  </button>
                </div>
                {isMateriModeLocked && (
                  <p className="text-xs text-slate-500">
                    Mode materi dikunci di menu edit. Materi singkat tidak bisa diubah ke materi lengkap, dan sebaliknya.
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
            ) : card.type === "gambar" ? (
              <div className="mt-1 space-y-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="Link gambar PNG/JPG/JPEG"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <button type="button" onClick={() => void handleAddImageFromLink()} className="sage-button-outline !py-2 !px-3 text-xs" disabled={isUploadingAsset}>
                    Pakai Link
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={imageFileInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      void handlePickImageFiles(e.target.files);
                    }}
                  />
                  <button type="button" onClick={() => imageFileInputRef.current?.click()} className="sage-button-outline !py-2 !px-3 text-xs" disabled={isUploadingAsset}>
                    Pilih Gambar (max 10MB, auto upload)
                  </button>
                </div>
                {pendingImagePreviewUrl && <p className="text-xs text-slate-500 dark:text-slate-400">Preview upload sedang disiapkan...</p>}
                {body && <p className="text-xs text-slate-500 break-all dark:text-slate-400">Tersimpan: {mediaItems.length} file/link</p>}
              </div>
            ) : card.type === "video" ? (
              <div className="mt-1 space-y-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="Link video (YouTube/link embed)"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <button type="button" onClick={handleAddVideoEmbed} className="sage-button-outline !py-2 !px-3 text-xs">
                    Simpan Link
                  </button>
                </div>
                {body && <p className="text-xs text-slate-500 break-all dark:text-slate-400">Tersimpan: {mediaItems.length} video</p>}
              </div>
            ) : card.type === "upload" ? (
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
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    disabled={isUploadingAsset}
                  >
                    <FiPlus />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleUploadDocument()}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    disabled={pendingDocumentFiles.length === 0 || isUploadingAsset}
                  >
                    <FiUploadCloud />
                  </button>
                </div>
                {pendingDocumentFiles.length > 0 && (
                  <div className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                    <p className="mb-2 font-medium text-slate-700 dark:text-slate-200">Preview dokumen terpilih ({pendingDocumentFiles.length})</p>
                    <div className="space-y-1">
                      {pendingDocumentFiles.map((file, idx) => (
                        <div key={`${file.name}-${idx}`} className="flex items-center justify-between gap-2 rounded border border-slate-100 px-2 py-1 dark:border-slate-800">
                          <span className="truncate">{file.name}</span>
                          <button type="button" className="text-red-600 hover:underline" onClick={() => setPendingDocumentFiles((prev) => prev.filter((_, i) => i !== idx))}>
                            Hapus
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {uploadedFileName && <p className="text-xs text-slate-500 truncate dark:text-slate-400">File: {uploadedFileName}</p>}
                {body && <p className="text-xs text-slate-500 break-all dark:text-slate-400">Tersimpan: {mediaItems.length} dokumen</p>}
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
          </div>
          {mediaPreviewEnabled && (
            <div>
              <SectionMediaPreviewPane
                type={card.type as "gambar" | "video" | "upload"}
                mediaItems={mediaItems}
                onUpdate={updateMediaItem}
                onRemove={(idx) => setMediaItems((prev) => prev.filter((_, i) => i !== idx))}
              />
            </div>
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
      <ConfirmDialog
        isOpen={!!pendingSubmitPayload}
        title="Simpan Perubahan"
        message={`Simpan perubahan untuk konten "${title.trim() || card.title}"?`}
        confirmLabel="Simpan"
        loading={isSubmitting}
        onCancel={() => setPendingSubmitPayload(null)}
        onConfirm={() => {
          if (!pendingSubmitPayload) return;
          void submitPayload(pendingSubmitPayload);
        }}
      />
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
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedStudent(s)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                setSelectedStudent(s);
              }}
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
            </div>
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

function AnalyticsPane({
  students,
  materials,
  pendingRequests,
  questionCountByMaterial,
}: {
  students: ClassMember[];
  materials: Material[];
  pendingRequests: PendingJoinRequest[];
  questionCountByMaterial: Record<string, number>;
}) {
  const [activeSlide, setActiveSlide] = useState(0);

  const analytics = useMemo(() => {
    const activeStudents = students.length;
    const totalMaterials = materials.length;
    const studentMaterialRatio = activeStudents > 0 ? (totalMaterials / activeStudents).toFixed(2) : "0.00";
    const pendingCount = pendingRequests.length;

    const materialBuckets = {
      materi: 0,
      soal: 0,
      tugas: 0,
    };

    let totalQuestions = 0;
    let updatedThisWeek = 0;
    let activeThisWeek = 0;
    let staleStudents = 0;
    let materialsWithQuestions = 0;

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;

    const joinBuckets = [0, 0, 0, 0];
    const joinLabels = ["M1", "M2", "M3", "M4"];

    students.forEach((student) => {
      const lastLogin = student.last_login_at ? new Date(student.last_login_at).getTime() : NaN;
      if (!Number.isNaN(lastLogin) && lastLogin >= sevenDaysAgo) activeThisWeek += 1;
      if (Number.isNaN(lastLogin) || lastLogin < fourteenDaysAgo) staleStudents += 1;

      const joinedAt = student.joined_at ? new Date(student.joined_at).getTime() : NaN;
      if (!Number.isNaN(joinedAt)) {
        const daysSinceJoin = Math.floor((now - joinedAt) / (24 * 60 * 60 * 1000));
        const bucketIndex = daysSinceJoin <= 7 ? 3 : daysSinceJoin <= 14 ? 2 : daysSinceJoin <= 21 ? 1 : 0;
        joinBuckets[bucketIndex] += 1;
      }
    });

    const materialQuestionBars = materials
      .map((material) => {
        const count = questionCountByMaterial[material.id] || 0;
        totalQuestions += count;
        if (count > 0) materialsWithQuestions += 1;
        const updatedAt = new Date(material.updated_at || material.created_at || 0).getTime();
        if (!Number.isNaN(updatedAt) && updatedAt >= sevenDaysAgo) updatedThisWeek += 1;
        const type = material.material_type || "materi";
        if (type === "soal" || type === "tugas" || type === "materi") materialBuckets[type] += 1;
        return {
          id: material.id,
          label: material.judul || "Tanpa judul",
          value: count,
          type,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const maxQuestionBar = Math.max(1, ...materialQuestionBars.map((item) => item.value));

    const activityShare = activeStudents > 0 ? Math.round((activeThisWeek / activeStudents) * 100) : 0;
    const updatedShare = totalMaterials > 0 ? Math.round((updatedThisWeek / totalMaterials) * 100) : 0;
    const questionCoverage = totalMaterials > 0 ? Math.round((materialsWithQuestions / totalMaterials) * 100) : 0;

    const attentionItems = [
      {
        title: "Siswa pasif",
        value: `${staleStudents} siswa`,
        detail: staleStudents > 0 ? "Belum login 14 hari terakhir atau belum ada jejak login." : "Semua siswa masih terlihat aktif.",
      },
      {
        title: "Request pending",
        value: `${pendingCount} request`,
        detail: pendingCount > 0 ? "Ada siswa yang masih menunggu persetujuan masuk kelas." : "Tidak ada antrean join saat ini.",
      },
      {
        title: "Materi tanpa soal",
        value: `${Math.max(0, totalMaterials - materialsWithQuestions)} section`,
        detail: "Bagian ini berpotensi belum punya checkpoint evaluasi.",
      },
    ];

    return {
      activeStudents,
      totalMaterials,
      studentMaterialRatio,
      pendingCount,
      totalQuestions,
      updatedThisWeek,
      activeThisWeek,
      staleStudents,
      activityShare,
      updatedShare,
      questionCoverage,
      materialBuckets,
      materialQuestionBars,
      maxQuestionBar,
      joinBuckets,
      joinLabels,
      attentionItems,
    };
  }, [materials, pendingRequests, questionCountByMaterial, students]);

  const slides = [
    {
      id: "overview",
      title: "Ringkasan kelas",
      kicker: "Overview",
      content: (
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryCard title="Siswa Aktif" value={String(analytics.activeStudents)} icon={<FiUsers />} />
            <SummaryCard title="Materi" value={String(analytics.totalMaterials)} icon={<FiBookOpen />} />
            <SummaryCard title="Soal Tersedia" value={String(analytics.totalQuestions)} icon={<FiClipboard />} />
            <SummaryCard title="Rasio Materi/Siswa" value={analytics.studentMaterialRatio} icon={<FiBarChart2 />} />
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Ringkasan Aktivitas</p>
            <div className="mt-4 space-y-4">
              <ProgressStat label="Aktivitas siswa 7 hari" value={analytics.activityShare} helper={`${analytics.activeThisWeek} dari ${analytics.activeStudents || 0} siswa aktif minggu ini`} tone="sky" />
              <ProgressStat label="Materi diperbarui 7 hari" value={analytics.updatedShare} helper={`${analytics.updatedThisWeek} materi diperbarui minggu ini`} tone="emerald" />
              <ProgressStat label="Coverage soal per section" value={analytics.questionCoverage} helper="Semakin tinggi, semakin banyak section yang punya evaluasi" tone="amber" />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "content",
      title: "Komposisi materi",
      kicker: "Content Map",
      content: (
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Distribusi tipe section</p>
            <div className="mt-5 space-y-4">
              <StackedPillChart
                items={[
                  { label: "Materi", value: analytics.materialBuckets.materi, color: "bg-sky-500" },
                  { label: "Soal", value: analytics.materialBuckets.soal, color: "bg-violet-500" },
                  { label: "Tugas", value: analytics.materialBuckets.tugas, color: "bg-amber-500" },
                ]}
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <MiniMetric label="Materi" value={String(analytics.materialBuckets.materi)} accent="sky" />
                <MiniMetric label="Soal" value={String(analytics.materialBuckets.soal)} accent="violet" />
                <MiniMetric label="Tugas" value={String(analytics.materialBuckets.tugas)} accent="amber" />
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Top section dengan soal terbanyak</p>
            <div className="mt-4 space-y-4">
              {analytics.materialQuestionBars.length > 0 ? analytics.materialQuestionBars.map((item, index) => (
                <BarRow
                  key={item.id}
                  index={index + 1}
                  label={item.label}
                  value={item.value}
                  max={analytics.maxQuestionBar}
                  caption={item.type === "tugas" ? "Section tugas" : item.type === "soal" ? "Section soal" : "Section materi"}
                />
              )) : (
                <EmptyState icon={<FiBookOpen />} title="Belum ada data section" desc="Tambahkan materi dan soal untuk melihat distribusi konten kelas." />
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "students",
      title: "Aktivitas siswa",
      kicker: "Student Pulse",
      content: (
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Aktivitas login siswa</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MiniMetric label="Aktif 7 hari" value={String(analytics.activeThisWeek)} accent="emerald" />
              <MiniMetric label="Pasif 14 hari" value={String(analytics.staleStudents)} accent="rose" />
              <MiniMetric label="Pending join" value={String(analytics.pendingCount)} accent="amber" />
            </div>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/80">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Sinyal cepat</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {analytics.staleStudents > 0
                  ? `${analytics.staleStudents} siswa perlu ditindaklanjuti karena tidak aktif dalam dua minggu terakhir.`
                  : "Tidak ada siswa yang terlihat pasif dalam dua minggu terakhir."}
              </p>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Gelombang siswa bergabung</p>
            <div className="mt-6 flex h-48 items-end gap-4">
              {analytics.joinBuckets.map((value, index) => (
                <div key={analytics.joinLabels[index]} className="flex flex-1 flex-col items-center gap-3">
                  <div className="relative flex h-36 w-full items-end justify-center rounded-2xl bg-slate-100 px-2 py-2 dark:bg-slate-800">
                    <div
                      className="w-full rounded-xl bg-gradient-to-t from-slate-900 via-slate-700 to-slate-500 transition-[height] duration-500 ease-out"
                      style={{ height: `${Math.max(14, (value / Math.max(1, ...analytics.joinBuckets)) * 100)}%` }}
                    />
                    <span className="absolute -top-6 text-xs font-semibold text-slate-500 dark:text-slate-400">{value}</span>
                  </div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{analytics.joinLabels[index]}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">M1 paling lama, M4 paling baru. Ini membantu melihat lonjakan siswa yang baru masuk.</p>
          </div>
        </div>
      ),
    },
    {
      id: "attention",
      title: "Butuh perhatian",
      kicker: "Action Board",
      content: (
        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Checklist tindakan guru</p>
            <div className="mt-4 space-y-3">
              {analytics.attentionItems.map((item) => (
                <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-800/80">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">{item.value}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-300">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Fokus rekomendasi</p>
            <div className="mt-4 grid gap-3">
              <InsightCard
                icon={<FiActivity />}
                title="Dorong aktivasi siswa"
                description={analytics.activeThisWeek < analytics.activeStudents ? "Buka pengumuman kelas atau tugas singkat agar siswa yang pasif punya alasan untuk kembali aktif." : "Aktivitas siswa sudah sehat minggu ini."}
              />
              <InsightCard
                icon={<FiAward />}
                title="Lengkapi evaluasi per section"
                description={analytics.questionCoverage < 60 ? "Masih banyak section yang belum punya soal. Tambahkan checkpoint singkat di materi utama." : "Sebagian besar section sudah memiliki evaluasi."}
              />
              <InsightCard
                icon={<FiClock />}
                title="Rapikan antrean join"
                description={analytics.pendingCount > 0 ? "Ada siswa menunggu masuk. Menyelesaikan antrean ini akan mengurangi friction sebelum mereka mulai belajar." : "Tidak ada hambatan join yang perlu ditindak sekarang."}
              />
            </div>
          </div>
        </div>
      ),
    },
  ];

  const lastSlideIndex = slides.length - 1;

  useEffect(() => {
    if (activeSlide > lastSlideIndex) {
      setActiveSlide(lastSlideIndex);
    }
  }, [activeSlide, lastSlideIndex]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Carousel Analitik</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{slides[activeSlide].title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{slides[activeSlide].kicker}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSlide((prev) => (prev === 0 ? lastSlideIndex : prev - 1))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Slide analitik sebelumnya"
          >
            <FiChevronLeft />
          </button>
          <button
            type="button"
            onClick={() => setActiveSlide((prev) => (prev === lastSlideIndex ? 0 : prev + 1))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Slide analitik berikutnya"
          >
            <FiChevronRight />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-2 shadow-sm dark:border-slate-700 dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
        <div
          className="flex transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: `translateX(-${activeSlide * 100}%)` }}
        >
          {slides.map((slide) => (
            <div key={slide.id} className="w-full shrink-0 px-2 py-2">
              {slide.content}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {slides.map((slide, index) => {
          const isActive = index === activeSlide;
          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => setActiveSlide(index)}
              className={`h-2.5 rounded-full transition-all duration-300 ${isActive ? "w-8 bg-slate-900" : "w-2.5 bg-slate-300 hover:bg-slate-400"}`}
              aria-label={`Buka slide ${index + 1}: ${slide.title}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function ProgressStat({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: number;
  helper: string;
  tone: "sky" | "emerald" | "amber";
}) {
  const toneClass =
    tone === "emerald" ? "from-emerald-500 to-emerald-300" : tone === "amber" ? "from-amber-500 to-amber-300" : "from-sky-500 to-sky-300";
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{value}%</span>
      </div>
      <div className="mt-2 h-3 rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={`h-3 rounded-full bg-gradient-to-r ${toneClass} transition-[width] duration-500`} style={{ width: `${Math.max(8, value)}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{helper}</p>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "sky" | "violet" | "amber" | "emerald" | "rose";
}) {
  const accentClass =
    accent === "violet"
      ? "bg-violet-50 text-violet-700 border-violet-200"
      : accent === "amber"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : accent === "emerald"
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : accent === "rose"
            ? "bg-rose-50 text-rose-700 border-rose-200"
            : "bg-sky-50 text-sky-700 border-sky-200";
  return (
    <div className={`rounded-2xl border px-4 py-4 ${accentClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function StackedPillChart({
  items,
}: {
  items: Array<{ label: string; value: number; color: string }>;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="space-y-3">
      <div className="flex h-4 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        {items.map((item) => {
          const width = total > 0 ? (item.value / total) * 100 : 0;
          return <div key={item.label} className={`${item.color} transition-[width] duration-500`} style={{ width: `${Math.max(total > 0 ? width : 0, item.value > 0 ? 10 : 0)}%` }} />;
        })}
      </div>
      <div className="grid gap-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full ${item.color}`} />
              <span>{item.label}</span>
            </div>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarRow({
  index,
  label,
  value,
  max,
  caption,
}: {
  index: number;
  label: string;
  value: number;
  max: number;
  caption: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{index}. {label}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{caption}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{value}</span>
      </div>
      <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-3 rounded-full bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500 transition-[width] duration-500"
          style={{ width: `${Math.max(10, (value / Math.max(1, max)) * 100)}%` }}
        />
      </div>
    </div>
  );
}

function InsightCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-800/80">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">{icon}</span>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-300">{description}</p>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  desc,
}: {
  icon: ReactNode;
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
