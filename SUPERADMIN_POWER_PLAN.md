# Superadmin Power Plan (Actionable)

Rencana ini disesuaikan dengan fondasi yang sudah ada di project saat ini, supaya peningkatan menu superadmin bisa jalan cepat tanpa refactor besar.

## Tujuan
- Menjadikan superadmin bukan hanya approval dashboard, tapi pusat operasi sistem.
- Fokus pada observability, kontrol antrian AI, governance, dan audit.

## Existing Foundation (Sudah Ada)
- Admin dashboard summary: `GET /api/admin/dashboard-summary`
- Admin AI statistics: `GET /api/admin/api-statistics`
- Grading mode: `GET/PUT /api/admin/settings/grading-mode`
- User management: `GET/PUT/DELETE /api/admin/users*`, reset password, verify teacher
- Approval requests: `GET /api/admin/profile-requests`, `POST /api/admin/profile-requests/{id}/review`
- DB signals untuk AI & grading:
  - `ai_api_usage_logs`
  - `essay_submissions.ai_grading_status`, `ai_grading_error`, `ai_graded_at`
  - `system_settings`

## Menu Baru Prioritas (Minggu Ini)

### 1) AI Ops
Menu path: `/dashboard/superadmin/ai-ops`

Scope:
- Ringkasan AI health: requests today, success/error rate, avg latency, token remaining.
- Grafik harian (7/14/30 hari): request + token.
- Breakdown error type dan feature.
- Panel rate-limit usage real-time (RPM/TPM/RPD vs limit).

Backend:
- Reuse: `GET /api/admin/api-statistics?days={n}`
- Tambahan endpoint kecil:
  - `GET /api/admin/api-statistics/health`

Contoh response:
```json
{
  "latency_p95_ms": 1840,
  "error_rate_24h": 3.2,
  "top_error_types": [
    {"error_type": "rate_limit", "count": 12},
    {"error_type": "timeout", "count": 5}
  ]
}
```

SQL inti:
- `PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms)`
- `GROUP BY error_type` 24 jam terakhir.

Effort: 1-2 hari.

### 2) Queue Monitor
Menu path: `/dashboard/superadmin/queue-monitor`

Scope:
- Counter status submission: `queued`, `processing`, `completed`, `failed`.
- Tabel job gagal (error + waktu + siswa + kelas + soal).
- Aksi retry: single dan bulk.
- Filter by class, date range, status.

Backend endpoint baru:
- `GET /api/admin/grading-queue/summary`
- `GET /api/admin/grading-queue/jobs?status=failed&class_id=&from=&to=&page=&size=`
- `POST /api/admin/grading-queue/retry`

Request retry:
```json
{
  "submission_ids": ["uuid-1", "uuid-2"],
  "mode": "requeue"
}
```

Response retry:
```json
{
  "accepted": 2,
  "skipped": 1,
  "details": [
    {"submission_id": "uuid-1", "status": "queued"}
  ]
}
```

Implementasi service:
- Tambah method admin di `EssaySubmissionService`:
  - `GetQueueSummary()`
  - `ListQueueJobs(filter)`
  - `RetrySubmissions([]string)`
- Retry minimal aman:
  - reset `ai_grading_status='queued'`
  - clear `ai_grading_error`
  - enqueue job jika service AI available.

Effort: 2 hari.

### 3) Approval Center+
Menu path: `/dashboard/superadmin/approval-center`

Scope:
- Gabung list profile requests + teacher verification context.
- Tampilkan aging (berapa lama pending).
- Sorting default: pending paling lama dulu.
- Quick action approve/reject + reason template.

Backend:
- Reuse endpoint existing profile requests.
- Tambahan opsional:
  - `GET /api/admin/profile-requests/summary`

Effort: 0.5-1 hari (mostly frontend).

### 4) Config Center
Menu path: `/dashboard/superadmin/config`

Scope:
- Edit setting operasional dari UI: `grading_mode`, `GEMINI_LIMIT_*` mirror setting, feature toggle.
- Audit note saat update setting.

Backend endpoint baru:
- `GET /api/admin/settings`
- `PUT /api/admin/settings/{key}`

Whitelist key awal:
- `grading_mode`
- `ai_retry_enabled`
- `ai_retry_max_attempts`
- `queue_max_size`

Catatan:
- Jangan edit env langsung dari UI.
- Simpan override di `system_settings`, lalu service baca prioritas DB > ENV fallback.

Effort: 1 hari.

### 5) Audit Trail (MVP)
Menu path: `/dashboard/superadmin/audit-log`

Scope:
- Log aksi admin kritis.
- Filter by actor, action, date.
- Detail payload before/after (redacted).

Migration baru:
- `000037_create_admin_audit_logs_table.up.sql`

Skema:
```sql
CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_admin_audit_logs_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX idx_admin_audit_logs_actor_action ON admin_audit_logs(actor_id, action, created_at DESC);
```

Aksi yang wajib tercatat:
- approve/reject request
- update/delete user
- reset password
- verify teacher
- update setting
- retry queue job

Effort: 1-1.5 hari.

### 6) User Risk & Lifecycle
Menu path: `/dashboard/superadmin/user-health`

Scope:
- Segment user: never login, dormant 30/60/90 hari, teacher profile incomplete.
- Bulk action: send reminder (placeholder), force reset password, disable account (opsional tahap 2).

Backend:
- Reuse `/api/admin/users` + tambahkan query filter:
  - `inactive_days`
  - `never_login=true`
  - `teacher_missing_subject=true`

Effort: 1 hari.

## Perubahan Sidebar Superadmin
Saat ini menu superadmin: Dashboard, Approval, Manajemen User, Setting.

Target menu:
- Dashboard
- Approval Center
- Manajemen User
- AI Ops
- Queue Monitor
- Config Center
- Audit Log
- User Health
- Setting (opsional tetap ada, atau digabung ke Config Center)

## Sprint Plan (5 Hari)
Hari 1:
- AI Ops (backend tambahan health + frontend page)

Hari 2-3:
- Queue Monitor end-to-end (summary, list jobs, retry)

Hari 4:
- Approval Center+ polish + Config Center basic

Hari 5:
- Audit Trail MVP + wiring ke aksi admin utama

## Acceptance Criteria Minimum
- Superadmin bisa melihat kondisi AI dan queue dalam < 10 detik tanpa buka DB.
- Superadmin bisa retry gagal grading tanpa akses server.
- Semua aksi admin kritis tercatat di audit log.
- Perubahan setting operasional bisa dilakukan dari UI dengan whitelist aman.

## Risiko & Mitigasi
- Risiko: retry massal memicu rate limit AI.
  - Mitigasi: batasi max retry per request (mis. 100), throttling worker tetap aktif.

- Risiko: setting salah dari UI.
  - Mitigasi: whitelist key + validasi tipe + confirmation dialog.

- Risiko: audit log bocor data sensitif.
  - Mitigasi: redact field sensitif (`password`, token, email sebagian) sebelum simpan metadata.

## Rekomendasi Implementasi Pertama
Mulai dari:
1. AI Ops
2. Queue Monitor

Alasan:
- Dampak operasional paling besar.
- Data dan fondasi backend sudah ada, jadi delivery cepat.
