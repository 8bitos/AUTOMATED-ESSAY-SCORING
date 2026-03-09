"use client";

import React from "react";

interface NoticeDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  tone?: "info" | "success" | "error";
  buttonLabel?: string;
  onClose: () => void;
}

export default function NoticeDialog({
  isOpen,
  title = "Informasi",
  message,
  tone = "info",
  buttonLabel = "Tutup",
  onClose,
}: NoticeDialogProps) {
  if (!isOpen) return null;

  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
      : tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200"
      : "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200";

  return (
    <div className="fixed inset-0 z-[90] bg-black/45 p-4 flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${toneClass}`}>{message}</div>
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onClose} className="sage-button">
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
