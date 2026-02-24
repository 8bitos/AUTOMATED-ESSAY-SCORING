"use client";

import { useState } from "react";
import { FiX, FiUploadCloud, FiFileText } from "react-icons/fi";

/* ================= MODAL ================= */

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-4xl max-h-[90vh] sage-panel flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10">
          <h2 className="text-lg font-semibold text-[color:var(--ink-900)]">{title}</h2>
          <button
            onClick={onClose}
            className="text-[color:var(--ink-500)] hover:text-[color:var(--sage-700)]"
          >
            <FiX size={22} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

/* ================= TYPES ================= */

interface CreateMaterialFormProps {
  isOpen: boolean;
  onClose: () => void;
  onFinished: () => void;
  classId: string;
}

/* ================= MAIN ================= */

export const CreateMaterialAndQuestionsForm = ({
  isOpen,
  onClose,
  onFinished,
  classId,
}: CreateMaterialFormProps) => {
  const [materialName, setMaterialName] = useState("");
  const [materialType, setMaterialType] = useState<"text" | "file">("text");
  const [materialText, setMaterialText] = useState("");
  const [materialFile, setMaterialFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ================= HANDLERS ================= */

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran file maksimal 5MB.");
      setMaterialFile(null);
      e.target.value = "";
      return;
    }

    setError("");
    setMaterialFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("judul", materialName);
      formData.append("class_id", classId);
      formData.append("materialType", materialType);

      if (materialType === "text") {
        formData.append("isiMateri", materialText);
      } else {
        if (!materialFile) {
          setError("Silakan pilih file materi.");
          setLoading(false);
          return;
        }
        formData.append("file", materialFile);
      }

      const res = await fetch("/api/materials", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Gagal menyimpan materi.");
      }

      onFinished();
      onClose();
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  };

  /* ================= RENDER ================= */

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tambah Materi Pembelajaran">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ===== IDENTITAS ===== */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-[color:var(--ink-700)] uppercase">
            Informasi Materi
          </h3>

          <div>
            <label className="block text-sm font-medium text-[color:var(--ink-700)]">
              Nama Materi
            </label>
            <input
              type="text"
              value={materialName}
              onChange={(e) => setMaterialName(e.target.value)}
              className="mt-1 sage-input"
              placeholder="Contoh: Peristiwa Proklamasi 1945"
              required
            />
          </div>
        </section>

        {/* ===== TIPE ===== */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[color:var(--ink-700)] uppercase">
            Tipe Materi
          </h3>

          <div className="inline-flex rounded-lg border border-black/10 overflow-hidden">
            {["text", "file"].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setMaterialType(type as any)}
                className={`px-5 py-2 text-sm font-medium transition
                  ${
                    materialType === type
                      ? "bg-[color:var(--sage-700)] text-white"
                      : "bg-white text-[color:var(--ink-500)] hover:bg-[color:var(--sand-50)]"
                  }`}
              >
                {type === "text" ? "Teks Manual" : "Upload File"}
              </button>
            ))}
          </div>
        </section>

        {/* ===== CONTENT ===== */}
        <section className="space-y-4">
          {materialType === "text" ? (
            <>
              <label className="block text-sm font-medium text-[color:var(--ink-700)]">
                Isi Materi
              </label>
              <textarea
                value={materialText}
                onChange={(e) => setMaterialText(e.target.value)}
                rows={9}
                className="sage-input"
                placeholder="Tuliskan materi pembelajaran di sini..."
              />
            </>
          ) : (
            <div className="border-2 border-dashed rounded-xl p-6 text-center bg-[color:var(--sand-50)]">
              <FiUploadCloud className="mx-auto text-4xl text-[color:var(--ink-500)]" />
              <p className="mt-2 text-sm text-[color:var(--ink-500)]">
                Upload file PDF / PPT
              </p>
              <label className="mt-3 inline-block cursor-pointer rounded-lg bg-[color:var(--sage-700)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--sage-800)]">
                Pilih File
                <input
                  type="file"
                  accept=".pdf,.ppt,.pptx"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {materialFile && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-[color:var(--sage-700)]">
                  <FiFileText />
                  {materialFile.name}
                </div>
              )}

              <p className="mt-2 text-xs text-[color:var(--ink-500)]">
                Maksimal 5MB
              </p>
            </div>
          )}
        </section>

        {/* ===== ERROR ===== */}
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* ===== ACTIONS ===== */}
        <div className="flex justify-end gap-3 pt-4 border-t border-black/10">
          <button
            type="button"
            onClick={onClose}
            className="sage-button-outline"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="sage-button disabled:opacity-60"
          >
            {loading ? "Menyimpan..." : "Simpan Materi"}
          </button>
        </div>
      </form>
    </Modal>
  );
};
