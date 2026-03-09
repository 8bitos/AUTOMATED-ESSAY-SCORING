"use client";

import React from "react";

interface LoadingDialogProps {
  isOpen: boolean;
  message?: string;
}

export default function LoadingDialog({ isOpen, message = "Memproses, mohon tunggu..." }: LoadingDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[95] bg-black/45 p-4 flex items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700 dark:border-slate-700 dark:border-t-slate-100" />
          <p className="text-sm text-slate-700 dark:text-slate-200">{message}</p>
        </div>
      </div>
    </div>
  );
}
