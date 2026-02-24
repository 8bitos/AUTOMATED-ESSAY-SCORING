"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiBookOpen,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiRefreshCw,
  FiUserCheck,
  FiUsers,
  FiXCircle,
} from "react-icons/fi";

interface AdminSummary {
  total_students: number;
  total_teachers: number;
  total_classes_active: number;
  total_materials: number;
  submissions_today: number;
  pending_profile_requests: number;
}

interface ProfileRequestItem {
  id: string;
  user_id: string;
  request_type?: string;
  user_name?: string | null;
  user_email?: string | null;
  user_role?: string | null;
  requested_changes?: Record<string, unknown>;
  status: string;
  reason?: string | null;
  reviewer_name?: string | null;
  created_at: string;
  reviewed_at?: string | null;
}

interface AdminUserItem {
  id: string;
  peran: string;
  mata_pelajaran?: string | null;
  last_login_at?: string | null;
  created_at: string;
}

type ServiceState = "up" | "down";

interface ServiceStatus {
  label: string;
  state: ServiceState;
  detail: string;
}

interface AnomalyAlertItem {
  level: "critical" | "warning" | "info";
  title: string;
  detail: string;
}

export default function SuperadminDashboardPage() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [pending, setPending] = useState<ProfileRequestItem[]>([]);
  const [approved, setApproved] = useState<ProfileRequestItem[]>([]);
  const [rejected, setRejected] = useState<ProfileRequestItem[]>([]);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [anomalyAlerts, setAnomalyAlerts] = useState<AnomalyAlertItem[]>([]);
  const [serviceStatuses, setServiceStatuses] = useState<ServiceStatus[]>([]);
  const [reasonById, setReasonById] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  const checkServices = useCallback(async () => {
    const services = [
      { label: "Auth + Session", url: "/api/me" },
      { label: "Admin API", url: "/api/admin/dashboard-summary" },
      { label: "Protected Ping", url: "/api/ping" },
    ];

    const withTimeout = async (url: string) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(url, { credentials: "include", signal: controller.signal });
        return { ok: res.ok, status: res.status };
      } catch {
        return { ok: false, status: 0 };
      } finally {
        clearTimeout(timer);
      }
    };

    const results = await Promise.all(services.map(async (service) => {
      const result = await withTimeout(service.url);
      return {
        label: service.label,
        state: result.ok ? "up" : "down",
        detail: result.ok ? "OK" : (result.status > 0 ? `HTTP ${result.status}` : "No response"),
      } as ServiceStatus;
    }));

    setServiceStatuses(results);
  }, []);

  const loadDashboard = useCallback(async (initialLoad = false) => {
    if (initialLoad) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [summaryRes, pendingRes, approvedRes, rejectedRes, usersRes, anomalyRes] = await Promise.all([
        fetch("/api/admin/dashboard-summary", { credentials: "include" }),
        fetch("/api/admin/profile-requests?status=pending", { credentials: "include" }),
        fetch("/api/admin/profile-requests?status=approved", { credentials: "include" }),
        fetch("/api/admin/profile-requests?status=rejected", { credentials: "include" }),
        fetch("/api/admin/users?sort=last_login", { credentials: "include" }),
        fetch("/api/admin/anomaly-alerts?days=7", { credentials: "include" }),
      ]);

      if (!summaryRes.ok) throw new Error("Gagal memuat ringkasan dashboard");
      const summaryData = await summaryRes.json();
      setSummary(summaryData);

      const pendingData = pendingRes.ok ? await pendingRes.json() : [];
      setPending(Array.isArray(pendingData) ? pendingData : []);

      const approvedData = approvedRes.ok ? await approvedRes.json() : [];
      setApproved(Array.isArray(approvedData) ? approvedData : []);

      const rejectedData = rejectedRes.ok ? await rejectedRes.json() : [];
      setRejected(Array.isArray(rejectedData) ? rejectedData : []);

      const usersData = usersRes.ok ? await usersRes.json() : [];
      setUsers(Array.isArray(usersData) ? usersData : []);

      if (anomalyRes.ok) {
        const anomalyBody = await anomalyRes.json();
        const mapped = (Array.isArray(anomalyBody?.items) ? anomalyBody.items : []).map((item: any) => ({
          level: item?.level === "critical" ? "critical" : item?.level === "warning" ? "warning" : "info",
          title: String(item?.title || "Anomaly Alert"),
          detail: String(item?.detail || "-"),
        })) as AnomalyAlertItem[];
        setAnomalyAlerts(mapped);
      } else {
        setAnomalyAlerts([]);
      }
    } catch (err: any) {
      setError(err?.message || "Terjadi kesalahan saat memuat dashboard superadmin");
    } finally {
      if (initialLoad) setLoading(false);
      else setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard(true);
    checkServices();
  }, [loadDashboard, checkServices]);

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
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Gagal memproses approval");
      }
      setReasonById((prev) => ({ ...prev, [id]: "" }));
      await loadDashboard(false);
      await checkServices();
    } catch (err: any) {
      setError(err?.message || "Gagal memproses approval");
    } finally {
      setProcessingId(null);
    }
  };

  const health = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const active7d = users.filter((u) => {
      if (!u.last_login_at) return false;
      const t = new Date(u.last_login_at).getTime();
      return Number.isFinite(t) && now - t <= 7 * dayMs;
    }).length;
    const neverLogin = users.filter((u) => !u.last_login_at).length;
    const teacherNoSubject = users.filter((u) => u.peran === "teacher" && !(u.mata_pelajaran || "").trim()).length;
    const activeRate = users.length > 0 ? active7d / users.length : 0;

    return {
      totalUsers: users.length,
      active7d,
      neverLogin,
      teacherNoSubject,
      activeRate,
    };
  }, [users]);

  const alerts = useMemo(() => {
    const items: { level: "critical" | "warning" | "info"; title: string; detail: string }[] = [];
    const pendingCount = summary?.pending_profile_requests ?? 0;
    const submissionsToday = summary?.submissions_today ?? 0;

    if (pendingCount > 10) {
      items.push({
        level: "critical",
        title: "Antrian approval tinggi",
        detail: `${pendingCount} request pending. Prioritaskan review agar antrian approval tidak menumpuk.`,
      });
    } else if (pendingCount > 0) {
      items.push({
        level: "warning",
        title: "Ada request menunggu review",
        detail: `${pendingCount} request pending saat ini.`,
      });
    }

    if (submissionsToday === 0) {
      items.push({
        level: "warning",
        title: "Submisi hari ini nol",
        detail: "Cek apakah aktivitas kelas berjalan normal atau ada kendala akses pengguna.",
      });
    }

    if (health.totalUsers > 0 && health.activeRate < 0.3) {
      items.push({
        level: "warning",
        title: "Aktivitas pengguna rendah",
        detail: `Hanya ${health.active7d}/${health.totalUsers} user aktif dalam 7 hari terakhir.`,
      });
    }

    if (health.teacherNoSubject > 0) {
      items.push({
        level: "info",
        title: "Profil guru belum lengkap",
        detail: `${health.teacherNoSubject} akun guru belum mengisi mata pelajaran.`,
      });
    }

    const merged = [...anomalyAlerts, ...items];
    merged.sort((a, b) => {
      const rank = (level: "critical" | "warning" | "info") => (level === "critical" ? 3 : level === "warning" ? 2 : 1);
      return rank(b.level) - rank(a.level);
    });
    return merged;
  }, [summary, health, anomalyAlerts]);

  const activityFeed = useMemo(() => {
    const normalize = (item: ProfileRequestItem, action: "approved" | "rejected") => ({
      id: item.id,
      action,
      user_name: item.user_name || "User",
      user_role: item.user_role || "-",
      reason: item.reason || null,
      at: item.reviewed_at || item.created_at,
      reviewer_name: item.reviewer_name || "-",
    });

    return [
      ...approved.map((it) => normalize(it, "approved")),
      ...rejected.map((it) => normalize(it, "rejected")),
    ]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 10);
  }, [approved, rejected]);

  const pendingPreview = pending.slice(0, 6);
  const slideTitles = [
    "Superadmin Dashboard",
    "Alerts & Prioritas",
    "Approval Center",
    "User Health Metrics",
  ];
  const totalSlides = slideTitles.length;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="sage-panel p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {slideTitles.map((label, idx) => (
              <button
                key={label}
                type="button"
                onClick={() => setActiveSlide(idx)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  idx === activeSlide
                    ? "bg-[color:var(--sage-700)] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSlide((prev) => (prev - 1 + totalSlides) % totalSlides)}
              className="sage-button-outline !px-2.5 !py-2 text-xs"
              aria-label="Slide sebelumnya"
            >
              <FiChevronLeft />
            </button>
            <button
              type="button"
              onClick={() => setActiveSlide((prev) => (prev + 1) % totalSlides)}
              className="sage-button-outline !px-2.5 !py-2 text-xs"
              aria-label="Slide berikutnya"
            >
              <FiChevronRight />
            </button>
          </div>
        </div>
      </div>

      {activeSlide === 0 && (
        <section className="sage-panel p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Superadmin Dashboard</h1>
              <p className="text-sm text-slate-500">Kontrol pusat pengguna, approval umum, dan monitoring aktivitas LMS.</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                await loadDashboard(false);
                await checkServices();
              }}
              className="sage-button-outline !px-3 !py-2 text-xs"
              disabled={refreshing}
            >
              <FiRefreshCw className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <DashCard title="Total Siswa" value={String(summary?.total_students ?? 0)} icon={<FiUsers />} />
            <DashCard title="Total Guru" value={String(summary?.total_teachers ?? 0)} icon={<FiUsers />} />
            <DashCard title="Kelas Aktif" value={String(summary?.total_classes_active ?? 0)} icon={<FiBookOpen />} />
            <DashCard title="Total Materi" value={String(summary?.total_materials ?? 0)} icon={<FiBookOpen />} />
            <DashCard title="Submisi Hari Ini" value={String(summary?.submissions_today ?? 0)} icon={<FiClock />} />
            <DashCard title="Pending Approval" value={String(summary?.pending_profile_requests ?? 0)} icon={<FiCheckCircle />} danger={Boolean((summary?.pending_profile_requests ?? 0) > 0)} />
          </div>
        </section>
      )}

      {activeSlide === 1 && (
        <section className="sage-panel p-6">
          <div className="flex items-center gap-2">
            <FiAlertTriangle className="text-amber-600" />
            <h2 className="text-lg font-semibold text-slate-900">Alerts & Prioritas</h2>
          </div>
          {loading ? (
            <p className="mt-3 text-sm text-slate-500">Memuat alert...</p>
          ) : alerts.length === 0 ? (
            <p className="mt-3 text-sm text-emerald-700">Tidak ada alert kritikal saat ini.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {alerts.map((alert, idx) => (
                <div
                  key={`${alert.title}-${idx}`}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    alert.level === "critical"
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : alert.level === "warning"
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-sky-200 bg-sky-50 text-sky-800"
                  }`}
                >
                  <p className="font-semibold">{alert.title}</p>
                  <p className="text-xs opacity-90 mt-0.5">{alert.detail}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeSlide === 2 && (
        <section className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <section className="sage-panel p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">Antrian Approval</h2>
                <Link href="/dashboard/superadmin/profile-requests" className="sage-button-outline !px-3 !py-1.5 text-xs">Buka Semua</Link>
              </div>
              {loading ? (
                <p className="text-sm text-slate-500 mt-4">Memuat data...</p>
              ) : pendingPreview.length === 0 ? (
                <p className="text-sm text-slate-500 mt-4">Tidak ada request pending.</p>
              ) : (
                <div className="mt-4 space-y-2">
                  {pendingPreview.map((item) => (
                    <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{item.user_name || "User"}</p>
                          <p className="text-xs text-slate-500">
                            {item.user_role || "-"} · {formatRequestType(item.request_type)} · {new Date(item.created_at).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[11px] uppercase">
                          Pending
                        </span>
                      </div>
                      <input
                        className="sage-input !text-xs"
                        placeholder="Reason (optional)"
                        value={reasonById[item.id] || ""}
                        onChange={(e) => setReasonById((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          className="sage-button !px-3 !py-1.5 !text-xs"
                          onClick={() => handleReview(item.id, "approve")}
                          disabled={processingId === item.id}
                        >
                          <FiUserCheck />
                          {processingId === item.id ? "Memproses..." : "Approve"}
                        </button>
                        <button
                          className="sage-button-outline !px-3 !py-1.5 !text-xs"
                          onClick={() => handleReview(item.id, "reject")}
                          disabled={processingId === item.id}
                        >
                          <FiXCircle />
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="sage-panel p-6 space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">Quick Action</h2>
              <Link href="/dashboard/superadmin/users" className="sage-button w-full justify-center">Kelola Guru & Siswa</Link>
              <Link href="/dashboard/superadmin/profile-requests" className="sage-button-outline w-full justify-center">Review Approval</Link>
              <div className="mt-4 border-t border-slate-200 pt-4 space-y-2">
                <p className="text-sm font-semibold text-slate-900">System Status</p>
                {serviceStatuses.length === 0 ? (
                  <p className="text-xs text-slate-500">Memuat status layanan...</p>
                ) : (
                  serviceStatuses.map((item) => (
                    <div key={item.label} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-xs text-slate-700">{item.label}</p>
                      <span className={`text-[11px] font-semibold ${item.state === "up" ? "text-emerald-700" : "text-rose-700"}`}>
                        {item.state === "up" ? "UP" : "DOWN"} · {item.detail}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <section className="sage-panel p-6">
            <h2 className="text-lg font-semibold text-slate-900">Aktivitas Approval Terakhir</h2>
            {loading ? (
              <p className="text-sm text-slate-500 mt-4">Memuat aktivitas...</p>
            ) : activityFeed.length === 0 ? (
              <p className="text-sm text-slate-500 mt-4">Belum ada aktivitas approval.</p>
            ) : (
              <div className="mt-4 space-y-2">
                {activityFeed.map((item) => (
                  <div key={`${item.action}-${item.id}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-sm text-slate-800">
                      <span className={`font-semibold ${item.action === "approved" ? "text-emerald-700" : "text-rose-700"}`}>
                        {item.action === "approved" ? "APPROVED" : "REJECTED"}
                      </span>{" "}
                      {item.user_name} ({item.user_role})
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(item.at).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })} · reviewer: {item.reviewer_name} · {formatRequestType((pending.find((p) => p.id === item.id) || approved.find((p) => p.id === item.id) || rejected.find((p) => p.id === item.id))?.request_type)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </section>
      )}

      {activeSlide === 3 && (
        <section className="sage-panel p-6">
          <h2 className="text-lg font-semibold text-slate-900">User Health Metrics</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MiniStat label="Total User" value={String(health.totalUsers)} />
            <MiniStat label="Aktif 7 Hari" value={String(health.active7d)} />
            <MiniStat label="Belum Pernah Login" value={String(health.neverLogin)} danger={health.neverLogin > 0} />
            <MiniStat label="Guru Profil Belum Lengkap" value={String(health.teacherNoSubject)} danger={health.teacherNoSubject > 0} />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Rasio user aktif 7 hari: <span className="font-semibold text-slate-700">{(health.activeRate * 100).toFixed(1)}%</span>
          </p>
        </section>
      )}

    </div>
  );
}

function DashCard({ title, value, icon, danger = false }: { title: string; value: string; icon: React.ReactNode; danger?: boolean }) {
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${danger ? "border-rose-200" : "border-slate-200"}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${danger ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>{icon}</span>
      </div>
      <p className={`mt-3 text-2xl font-semibold ${danger ? "text-rose-700" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${danger ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"}`}>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`text-xl font-semibold ${danger ? "text-rose-700" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

function formatRequestType(value?: string | null): string {
  if (!value) return "Profile Change";
  if (value === "teacher_verification") return "Teacher Verification";
  if (value === "profile_change") return "Profile Change";
  return value;
}
