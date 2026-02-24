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
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <span className="inline-block h-5 w-5 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin" />
          <p className="text-sm text-slate-700">{message}</p>
        </div>
      </div>
    </div>
  );
}

