"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiBookOpen, FiEdit, FiLayers, FiPlus, FiRefreshCw, FiTrash2, FiX } from "react-icons/fi";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/context/AuthContext";

interface QuestionBankEntry {
  id: string;
  created_by?: string;
  created_by_name?: string;
  class_id: string;
  class_name?: string;
  subject?: string;
  source_material_id?: string;
  material_title?: string;
  source_question_id?: string;
  teks_soal: string;
  level_kognitif?: string;
  keywords?: string[];
  ideal_answer?: string;
  weight?: number;
  rubrics?: any[];
  created_at?: string;
  updated_at?: string;
}

interface TeacherClassOption {
  id: string;
  class_name: string;
}

type RubricType = "analitik" | "holistik";

interface EditableDescriptor {
  score: string;
  description: string;
}

interface EditableRubric {
  nama_aspek: string;
  descriptors: EditableDescriptor[];
}

interface EditorState {
  classId: string;
  subject: string;
  teksSoal: string;
  levelKognitif: string;
  keywords: string;
  idealAnswer: string;
  weight: string;
  rubricType: RubricType;
  analyticRubrics: EditableRubric[];
  holisticAspectName: string;
  holisticDescriptors: EditableDescriptor[];
}

const createInitialEditorState = (): EditorState => ({
  classId: "",
  subject: "Sejarah",
  teksSoal: "",
  levelKognitif: "",
  keywords: "",
  idealAnswer: "",
  weight: "",
  rubricType: "analitik",
  analyticRubrics: [{ nama_aspek: "", descriptors: [{ score: "", description: "" }] }],
  holisticAspectName: "Penilaian Holistik",
  holisticDescriptors: [{ score: "", description: "" }],
});

const parseRubricsToEditor = (entry: QuestionBankEntry): Pick<EditorState, "rubricType" | "analyticRubrics" | "holisticAspectName" | "holisticDescriptors"> => {
  const rubrics = Array.isArray(entry.rubrics) ? entry.rubrics : [];
  const detectedType = (rubrics?.[0] as any)?.rubric_type;
  const rubricType: RubricType =
    detectedType === "holistik" || detectedType === "analitik"
      ? detectedType
      : rubrics.length <= 1
      ? "holistik"
      : "analitik";

  const normalized = rubrics.map((r: any) => ({
    nama_aspek: String(r?.nama_aspek || ""),
    descriptors: Object.entries(r?.descriptors || {}).map(([score, description]) => ({
      score: String(score),
      description: String(description ?? ""),
    })),
  }));

  if (rubricType === "holistik") {
    const first = normalized[0];
    return {
      rubricType,
      analyticRubrics: [{ nama_aspek: "", descriptors: [{ score: "", description: "" }] }],
      holisticAspectName: (first?.nama_aspek || "").trim() || "Penilaian Holistik",
      holisticDescriptors: first?.descriptors?.length ? first.descriptors : [{ score: "", description: "" }],
    };
  }

  return {
    rubricType,
    analyticRubrics: normalized.length
      ? normalized.map((r: any) => ({
          nama_aspek: (r.nama_aspek || "").trim(),
          descriptors: r.descriptors?.length ? r.descriptors : [{ score: "", description: "" }],
        }))
      : [{ nama_aspek: "", descriptors: [{ score: "", description: "" }] }],
    holisticAspectName: "Penilaian Holistik",
    holisticDescriptors: [{ score: "", description: "" }],
  };
};

const buildRubricsPayload = (editor: EditorState) => {
  if (editor.rubricType === "holistik") {
    const descriptors: Record<number, string> = {};
    for (const item of editor.holisticDescriptors) {
      const num = Number(item.score);
      if (!Number.isFinite(num) || !item.description.trim()) continue;
      descriptors[num] = item.description.trim();
    }
    return [
      {
        nama_aspek: editor.holisticAspectName.trim() || "Penilaian Holistik",
        rubric_type: "holistik",
        descriptors,
      },
    ];
  }

  return editor.analyticRubrics
    .map((aspect) => {
      const descriptors: Record<number, string> = {};
      for (const item of aspect.descriptors) {
        const num = Number(item.score);
        if (!Number.isFinite(num) || !item.description.trim()) continue;
        descriptors[num] = item.description.trim();
      }
      return {
        nama_aspek: aspect.nama_aspek.trim() || "Aspek Penilaian",
        rubric_type: "analitik",
        descriptors,
      };
    })
    .filter((a) => Object.keys(a.descriptors).length > 0);
};

const FormModal = ({
  open,
  title,
  classes,
  editor,
  saving,
  saveError,
  saveMessage,
  onClose,
  onChange,
  onSubmit,
}: {
  open: boolean;
  title: string;
  classes: TeacherClassOption[];
  editor: EditorState;
  saving: boolean;
  saveError: string | null;
  saveMessage: string | null;
  onClose: () => void;
  onChange: (next: EditorState) => void;
  onSubmit: (e: React.FormEvent) => void;
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/45 p-4 flex items-center justify-center">
      <div className="w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900">
            <FiX size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="max-h-[calc(92vh-72px)] overflow-y-auto p-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Kelas</label>
              <select
                className="sage-input mt-1 bg-white"
                value={editor.classId}
                onChange={(e) => onChange({ ...editor, classId: e.target.value })}
              >
                <option value="">Pilih kelas</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.class_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Mata Pelajaran</label>
              <input
                className="sage-input mt-1"
                value={editor.subject}
                onChange={(e) => onChange({ ...editor, subject: e.target.value })}
                placeholder="Contoh: Sejarah Indonesia"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Teks Soal</label>
            <textarea className="sage-input mt-1" rows={5} value={editor.teksSoal} onChange={(e) => onChange({ ...editor, teksSoal: e.target.value })} />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium">Level Kognitif</label>
              <select className="sage-input mt-1 bg-white" value={editor.levelKognitif} onChange={(e) => onChange({ ...editor, levelKognitif: e.target.value })}>
                <option value="">Opsional</option>
                <option value="C1">C1</option>
                <option value="C2">C2</option>
                <option value="C3">C3</option>
                <option value="C4">C4</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Bobot</label>
              <input type="number" step="0.01" className="sage-input mt-1" value={editor.weight} onChange={(e) => onChange({ ...editor, weight: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Tipe Rubrik</label>
              <select className="sage-input mt-1 bg-white" value={editor.rubricType} onChange={(e) => onChange({ ...editor, rubricType: e.target.value as RubricType })}>
                <option value="analitik">Analitik</option>
                <option value="holistik">Holistik</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Kata Kunci (pisahkan koma)</label>
            <input className="sage-input mt-1" value={editor.keywords} onChange={(e) => onChange({ ...editor, keywords: e.target.value })} />
          </div>

          <div>
            <label className="text-sm font-medium">Jawaban Ideal</label>
            <textarea className="sage-input mt-1" rows={3} value={editor.idealAnswer} onChange={(e) => onChange({ ...editor, idealAnswer: e.target.value })} />
          </div>

          {editor.rubricType === "analitik" && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex justify-between items-center">
                <p className="text-sm font-semibold text-slate-800">Rubrik Analitik</p>
                <button
                  type="button"
                  className="sage-button-outline"
                  onClick={() =>
                    onChange({
                      ...editor,
                      analyticRubrics: [...editor.analyticRubrics, { nama_aspek: "", descriptors: [{ score: "", description: "" }] }],
                    })
                  }
                >
                  + Aspek
                </button>
              </div>
              {editor.analyticRubrics.map((aspect, i) => (
                <div key={i} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                  <div className="flex gap-2">
                    <input
                      className="sage-input"
                      placeholder={`Nama aspek ${i + 1}`}
                      value={aspect.nama_aspek}
                      onChange={(e) =>
                        onChange({
                          ...editor,
                          analyticRubrics: editor.analyticRubrics.map((r, idx) => (idx === i ? { ...r, nama_aspek: e.target.value } : r)),
                        })
                      }
                    />
                    <button
                      type="button"
                      className="sage-button-outline"
                      onClick={() =>
                        onChange({
                          ...editor,
                          analyticRubrics: editor.analyticRubrics.filter((_, idx) => idx !== i),
                        })
                      }
                    >
                      Hapus
                    </button>
                  </div>
                  {aspect.descriptors.map((d, j) => (
                    <div key={j} className="grid gap-2 md:grid-cols-[120px_1fr_auto]">
                      <input
                        className="sage-input"
                        placeholder="Skor"
                        value={d.score}
                        onChange={(e) =>
                          onChange({
                            ...editor,
                            analyticRubrics: editor.analyticRubrics.map((r, idx) =>
                              idx === i
                                ? {
                                    ...r,
                                    descriptors: r.descriptors.map((item, idy) => (idy === j ? { ...item, score: e.target.value } : item)),
                                  }
                                : r
                            ),
                          })
                        }
                      />
                      <input
                        className="sage-input"
                        placeholder="Deskripsi"
                        value={d.description}
                        onChange={(e) =>
                          onChange({
                            ...editor,
                            analyticRubrics: editor.analyticRubrics.map((r, idx) =>
                              idx === i
                                ? {
                                    ...r,
                                    descriptors: r.descriptors.map((item, idy) => (idy === j ? { ...item, description: e.target.value } : item)),
                                  }
                                : r
                            ),
                          })
                        }
                      />
                      <button
                        type="button"
                        className="sage-button-outline"
                        onClick={() =>
                          onChange({
                            ...editor,
                            analyticRubrics: editor.analyticRubrics.map((r, idx) =>
                              idx === i ? { ...r, descriptors: r.descriptors.filter((_, idy) => idy !== j) } : r
                            ),
                          })
                        }
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-sm text-[color:var(--sage-700)]"
                    onClick={() =>
                      onChange({
                        ...editor,
                        analyticRubrics: editor.analyticRubrics.map((r, idx) =>
                          idx === i ? { ...r, descriptors: [...r.descriptors, { score: "", description: "" }] } : r
                        ),
                      })
                    }
                  >
                    + Tambah Skor
                  </button>
                </div>
              ))}
            </div>
          )}

          {editor.rubricType === "holistik" && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">Rubrik Holistik</p>
              <input
                className="sage-input"
                placeholder="Nama aspek holistik"
                value={editor.holisticAspectName}
                onChange={(e) => onChange({ ...editor, holisticAspectName: e.target.value })}
              />
              {editor.holisticDescriptors.map((d, i) => (
                <div key={i} className="grid gap-2 md:grid-cols-[120px_1fr_auto]">
                  <input
                    className="sage-input"
                    placeholder="Skor"
                    value={d.score}
                    onChange={(e) =>
                      onChange({
                        ...editor,
                        holisticDescriptors: editor.holisticDescriptors.map((item, idx) => (idx === i ? { ...item, score: e.target.value } : item)),
                      })
                    }
                  />
                  <input
                    className="sage-input"
                    placeholder="Deskripsi"
                    value={d.description}
                    onChange={(e) =>
                      onChange({
                        ...editor,
                        holisticDescriptors: editor.holisticDescriptors.map((item, idx) => (idx === i ? { ...item, description: e.target.value } : item)),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="sage-button-outline"
                    onClick={() =>
                      onChange({
                        ...editor,
                        holisticDescriptors: editor.holisticDescriptors.filter((_, idx) => idx !== i),
                      })
                    }
                  >
                    Hapus
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-sm text-[color:var(--sage-700)]"
                onClick={() =>
                  onChange({
                    ...editor,
                    holisticDescriptors: [...editor.holisticDescriptors, { score: "", description: "" }],
                  })
                }
              >
                + Tambah Skor
              </button>
            </div>
          )}

          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          {saveMessage && <p className="text-sm text-emerald-700">{saveMessage}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" className="sage-button-outline" onClick={onClose}>
              Batal
            </button>
            <button type="submit" className="sage-button" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function TeacherBankSoalPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<QuestionBankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [classes, setClasses] = useState<TeacherClassOption[]>([]);
  const [editor, setEditor] = useState<EditorState>(createInitialEditorState());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchEntries = useCallback(async (searchText?: string) => {
    setLoading(true);
    setError(null);
    try {
      const q = (searchText ?? query).trim();
      const qs = new URLSearchParams();
      if (q) qs.set("q", q);
      const url = qs.toString() ? `/api/question-bank?${qs.toString()}` : "/api/question-bank";
      const res = await fetch(url, { credentials: "include" });
      const body = await res.json().catch(() => []);
      if (!res.ok) throw new Error(body?.message || "Gagal memuat bank soal.");
      setEntries(Array.isArray(body) ? body : []);
    } catch (err: any) {
      setError(err?.message || "Gagal memuat bank soal.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch("/api/classes", { credentials: "include" });
      const body = await res.json().catch(() => []);
      if (!res.ok) throw new Error(body?.message || "Gagal memuat kelas.");
      setClasses(
        Array.isArray(body)
          ? body.map((c: any) => ({ id: String(c.id), class_name: String(c.class_name || "Tanpa Nama") }))
          : []
      );
    } catch {
      // biarkan form tetap bisa dibuka
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    fetchClasses();
  }, [fetchEntries, fetchClasses]);

  const openCreateModal = () => {
    const base = createInitialEditorState();
    if (classes.length > 0) base.classId = classes[0].id;
    setEditor(base);
    setEditingEntryId(null);
    setSaveError(null);
    setSaveMessage(null);
    setModalOpen(true);
  };

  const openEditModal = (entry: QuestionBankEntry) => {
    const parsed = parseRubricsToEditor(entry);
    setEditor({
      classId: entry.class_id || "",
      subject: entry.subject || "Sejarah",
      teksSoal: entry.teks_soal || "",
      levelKognitif: entry.level_kognitif || "",
      keywords: Array.isArray(entry.keywords) ? entry.keywords.join(", ") : "",
      idealAnswer: entry.ideal_answer || "",
      weight: typeof entry.weight === "number" ? String(entry.weight) : "",
      ...parsed,
    });
    setEditingEntryId(entry.id);
    setSaveError(null);
    setSaveMessage(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveMessage(null);

    if (!editor.classId) {
      setSaveError("Pilih kelas terlebih dahulu.");
      return;
    }
    if (!editor.subject.trim()) {
      setSaveError("Mata pelajaran wajib diisi.");
      return;
    }
    if (!editor.teksSoal.trim()) {
      setSaveError("Teks soal wajib diisi.");
      return;
    }
    const rubrics = buildRubricsPayload(editor);
    if (!rubrics.length) {
      setSaveError("Isi minimal 1 deskriptor rubrik.");
      return;
    }

    setSaveLoading(true);
    try {
      const parsedKeywords = editor.keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      const parsedWeight = editor.weight === "" ? null : Number(editor.weight);
      const payload = {
        class_id: editor.classId,
        subject: editor.subject.trim(),
        teks_soal: editor.teksSoal.trim(),
        level_kognitif: editor.levelKognitif || null,
        keywords: parsedKeywords.length ? parsedKeywords : null,
        ideal_answer: editor.idealAnswer.trim() || null,
        weight: typeof parsedWeight === "number" && Number.isFinite(parsedWeight) ? parsedWeight : null,
        rubrics,
      };

      const isEdit = Boolean(editingEntryId);
      const url = isEdit ? `/api/question-bank/${editingEntryId}` : "/api/question-bank";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Gagal menyimpan soal bank.");

      setSaveMessage(isEdit ? "Soal bank berhasil diperbarui." : "Soal bank berhasil dibuat.");
      await fetchEntries();
      setTimeout(() => {
        setModalOpen(false);
      }, 300);
    } catch (err: any) {
      setSaveError(err?.message || "Gagal menyimpan soal bank.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/question-bank/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Gagal menghapus soal dari bank.");
      }
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err: any) {
      setError(err?.message || "Gagal menghapus soal dari bank.");
    } finally {
      setDeletingId(null);
    }
  };

  const totalRubrics = useMemo(
    () => entries.reduce((sum, item) => sum + (Array.isArray(item.rubrics) ? item.rubrics.length : 0), 0),
    [entries]
  );

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Bank Soal & Rubrik</h1>
        <p className="text-sm text-slate-500">
          Buat, edit, dan simpan soal reusable. Form dibuat popup agar halaman tetap rapi.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Total Soal Tersimpan</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{entries.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Total Rubrik</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{totalRubrics}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <button type="button" className="sage-button inline-flex items-center gap-2" onClick={openCreateModal}>
              <FiPlus size={14} />
              Buat Soal Bank
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-col gap-2 md:flex-row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari teks soal, kelas, materi, atau mata pelajaran"
            className="sage-input flex-1"
          />
          <button type="button" className="sage-button-outline inline-flex items-center gap-2" onClick={() => fetchEntries(query)}>
            <FiRefreshCw size={14} /> Cari / Refresh
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {loading && <p className="text-sm text-slate-500">Memuat data bank soal...</p>}
        {!loading && entries.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            Belum ada soal yang tersimpan.
          </div>
        )}
        <div className="space-y-3">
          {entries.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
              <p className="font-semibold text-slate-900 line-clamp-2">{item.teks_soal}</p>
              <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="sage-pill inline-flex items-center gap-1"><FiLayers size={12} /> {item.class_name || "-"}</span>
                <span className="sage-pill inline-flex items-center gap-1"><FiBookOpen size={12} /> {item.material_title || "-"}</span>
                <span className="sage-pill">Dibuat oleh: {item.created_by_name || item.created_by || "-"}</span>
                {item.subject && <span className="sage-pill">Mapel: {item.subject}</span>}
                {item.level_kognitif && <span className="sage-pill">Level: {item.level_kognitif}</span>}
                {typeof item.weight === "number" && <span className="sage-pill">Bobot: {item.weight}</span>}
                <span className="sage-pill">Rubrik: {Array.isArray(item.rubrics) ? item.rubrics.length : 0}</span>
              </div>
              {item.ideal_answer && (
                <p className="text-sm text-slate-600 line-clamp-2">
                  <span className="font-medium">Jawaban ideal:</span> {item.ideal_answer}
                </p>
              )}
              {item.created_by && item.created_by === user?.id ? (
                <div className="flex justify-end gap-2">
                  <button type="button" className="sage-button-outline inline-flex items-center gap-1" onClick={() => openEditModal(item)}>
                    <FiEdit size={14} />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="sage-button-outline inline-flex items-center gap-1 text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => setPendingDeleteId(item.id)}
                    disabled={deletingId === item.id}
                  >
                    <FiTrash2 size={14} />
                    {deletingId === item.id ? "Menghapus..." : "Hapus"}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-right">Read-only. Hanya pembuat soal yang bisa edit/hapus.</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <FormModal
        open={modalOpen}
        title={editingEntryId ? "Edit Soal Bank" : "Buat Soal Bank"}
        classes={classes}
        editor={editor}
        saving={saveLoading}
        saveError={saveError}
        saveMessage={saveMessage}
        onClose={() => setModalOpen(false)}
        onChange={setEditor}
        onSubmit={handleSave}
      />

      <ConfirmDialog
        isOpen={Boolean(pendingDeleteId)}
        title="Hapus Soal Bank"
        message="Soal akan dihapus dari bank soal dan tidak bisa dipulihkan. Lanjutkan?"
        confirmLabel="Hapus"
        cancelLabel="Batal"
        danger
        onConfirm={async () => {
          if (!pendingDeleteId) return;
          const id = pendingDeleteId;
          setPendingDeleteId(null);
          await handleDelete(id);
        }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
