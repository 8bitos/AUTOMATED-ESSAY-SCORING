"use client";

import { useCallback, useEffect, useState } from "react";
import ToggleSwitch from "@/components/ToggleSwitch";
import { FiCheckCircle, FiClock, FiXCircle } from "react-icons/fi";

interface ProfileRequest {
  id: string;
  user_id: string;
  request_type?: string;
  user_name?: string | null;
  user_email?: string | null;
  user_role?: string | null;
  requested_changes: Record<string, unknown>;
  status: string;
  reason?: string | null;
  reviewer_name?: string | null;
  created_at: string;
  reviewed_at?: string | null;
}

type AdminSettingItem = {
  key?: string;
  value?: string;
};

const getErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

export default function ProfileRequestsPage() {
  const [requests, setRequests] = useState<ProfileRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("pending");
  const [reasonById, setReasonById] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);
  const [settingLoading, setSettingLoading] = useState(true);
  const [settingSaving, setSettingSaving] = useState(false);
  const [settingMessage, setSettingMessage] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/profile-requests?status=${status}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load requests");
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load requests"));
    } finally {
      setLoading(false);
    }
  }, [status]);

  const loadAutoApproveSetting = useCallback(async () => {
    setSettingLoading(true);
    try {
      const res = await fetch("/api/admin/settings", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load settings");
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      const item = items.find((entry: AdminSettingItem) => entry?.key === "profile_change_auto_approve");
      setAutoApproveEnabled(item?.value === "true");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load settings"));
    } finally {
      setSettingLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    loadAutoApproveSetting();
  }, [loadAutoApproveSetting]);

  const handleReview = async (id: string, action: "approve" | "reject") => {
    setProcessingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/profile-requests/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, reason: reasonById[id] || "" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to review request");
      }
      setReasonById((prev) => ({ ...prev, [id]: "" }));
      await loadRequests();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to review request"));
    } finally {
      setProcessingId(null);
    }
  };

  const handleAutoApproveChange = async (checked: boolean) => {
    setSettingSaving(true);
    setSettingMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/profile_change_auto_approve", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ value: checked ? "true" : "false" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to update setting");
      }
      setAutoApproveEnabled(checked);
      setSettingMessage(checked ? "Auto approve perubahan profil aktif." : "Auto approve perubahan profil nonaktif.");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to update setting"));
    } finally {
      setSettingSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="sage-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Approval</h1>
        <p className="text-sm text-slate-500">Review semua request approval (profil dan verifikasi guru).</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setStatus("pending")}
          className={`rounded-lg px-3 py-2 text-sm ${status === "pending" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
        >
          Pending
        </button>
        <button
          type="button"
          onClick={() => setStatus("approved")}
          className={`rounded-lg px-3 py-2 text-sm ${status === "approved" ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-700"}`}
        >
          Approved
        </button>
        <button
          type="button"
          onClick={() => setStatus("rejected")}
          className={`rounded-lg px-3 py-2 text-sm ${status === "rejected" ? "bg-rose-700 text-white" : "bg-slate-100 text-slate-700"}`}
        >
          Rejected
        </button>
      </div>

      <div className="sage-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Auto ACC perubahan profil</p>
            <p className="text-sm text-slate-500">
              Jika aktif, perubahan profil yang biasanya masuk approval akan langsung diterapkan tanpa antrean review.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {settingLoading ? "Memuat..." : autoApproveEnabled ? "Aktif" : "Nonaktif"}
            </span>
            <div className={settingSaving ? "pointer-events-none opacity-70" : ""}>
              <ToggleSwitch
                checked={autoApproveEnabled}
                onChange={handleAutoApproveChange}
                label="Auto approve perubahan profil"
              />
            </div>
          </div>
        </div>
        {settingMessage && <p className="mt-3 text-sm text-emerald-600">{settingMessage}</p>}
      </div>

      {loading && <div className="text-slate-500">Loading...</div>}
      {error && <div className="text-red-500">{error}</div>}

      {!loading && requests.length === 0 && (
        <div className="sage-panel p-6 text-slate-500">
          Tidak ada data.
        </div>
      )}

      <div className="space-y-4">
        {requests.map((req) => (
          <div key={req.id} className="sage-panel p-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                {req.status === "pending" && <FiClock className="text-amber-600" />}
                {req.status === "approved" && <FiCheckCircle className="text-emerald-600" />}
                {req.status === "rejected" && <FiXCircle className="text-rose-600" />}
                <span className="uppercase tracking-wide text-xs">{req.status}</span>
              </div>
              <span>{new Date(req.created_at).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <p><strong>Nama:</strong> {req.user_name || "-"}</p>
              <p><strong>Email:</strong> {req.user_email || "-"}</p>
              <p><strong>Role:</strong> {req.user_role || "-"}</p>
              <p><strong>Tipe Approval:</strong> {formatRequestType(req.request_type)}</p>
            </div>
            <div className="text-sm text-slate-700">
              <strong>Requested Changes:</strong>
              <pre className="mt-2 rounded bg-slate-50 p-3 text-xs text-slate-600 overflow-x-auto">
                {JSON.stringify(req.requested_changes, null, 2)}
              </pre>
            </div>

            {req.status === "pending" ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  className="sage-input"
                  placeholder="Reason (optional)"
                  value={reasonById[req.id] || ""}
                  onChange={(e) => setReasonById((prev) => ({ ...prev, [req.id]: e.target.value }))}
                />
                <div className="flex gap-2">
                  <button className="sage-button" onClick={() => handleReview(req.id, "approve")} disabled={processingId === req.id}>
                    {processingId === req.id ? "Memproses..." : "Approve"}
                  </button>
                  <button className="sage-button-outline" onClick={() => handleReview(req.id, "reject")} disabled={processingId === req.id}>
                    Reject
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
                <p><strong>Reviewer:</strong> {req.reviewer_name || "-"}</p>
                <p><strong>Reason:</strong> {req.reason || "-"}</p>
                <p><strong>Reviewed At:</strong> {req.reviewed_at ? new Date(req.reviewed_at).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatRequestType(value?: string | null): string {
  if (!value) return "Profile Change";
  if (value === "teacher_verification") return "Teacher Verification";
  if (value === "profile_change") return "Profile Change";
  return value;
}
