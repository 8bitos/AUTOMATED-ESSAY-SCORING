"use client";

import { useEffect, useState } from "react";
import { FiCheckCircle, FiClock, FiXCircle } from "react-icons/fi";

interface ProfileRequest {
  id: string;
  user_id: string;
  request_type?: string;
  user_name?: string | null;
  user_email?: string | null;
  user_role?: string | null;
  requested_changes: Record<string, any>;
  status: string;
  reason?: string | null;
  reviewer_name?: string | null;
  created_at: string;
  reviewed_at?: string | null;
}

export default function ProfileRequestsPage() {
  const [requests, setRequests] = useState<ProfileRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("pending");
  const [reasonById, setReasonById] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/profile-requests?status=${status}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load requests");
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [status]);

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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessingId(null);
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
