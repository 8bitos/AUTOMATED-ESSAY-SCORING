"use client";

export type StudentNotificationPrefs = {
  profileApprovals: boolean;
  classApproved: boolean;
  classInvited: boolean;
  newMaterials: boolean;
  reviewedScores: boolean;
  newQuestions: boolean;
};

export type StudentNotificationItem = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
};

export const STUDENT_NOTIFICATION_PREFS_KEY = "student_notification_preferences";
const SEEN_QUESTION_COUNT_KEY = "student_seen_question_counts";
const SEEN_PENDING_CLASS_IDS_KEY = "student_seen_pending_class_ids";
const SEEN_APPROVED_CLASS_IDS_KEY = "student_seen_approved_class_ids";
const SEEN_AI_GRADED_SUBMISSION_IDS_KEY = "student_seen_ai_graded_submission_ids";

interface ProfileChangeRequest {
  id: string;
  request_type?: string;
  status?: string;
  reason?: string | null;
  created_at?: string;
  reviewed_at?: string | null;
}

interface StudentClass {
  id: string;
  class_name: string;
  teacher_name?: string;
}

interface PendingClassJoin {
  class_id: string;
  class_name: string;
  teacher_name?: string;
}

interface ClassQuestion {
  id: string;
  submission_id?: string;
  skor_ai?: number;
  umpan_balik_ai?: string;
  revised_score?: number;
  teacher_feedback?: string;
}

interface ClassMaterial {
  id: string;
  judul?: string;
  created_at?: string;
  updated_at?: string;
  essay_questions?: ClassQuestion[];
}

interface StudentClassDetail {
  id: string;
  class_name: string;
  materials?: ClassMaterial[];
}

const requestTypeLabel = (value?: string) => {
  if (value === "teacher_verification") return "verifikasi akun guru";
  if (value === "profile_change") return "perubahan profil";
  return "approval";
};

const nowIso = () => new Date().toISOString();

const readSeenQuestionCounts = (): Record<string, number> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SEEN_QUESTION_COUNT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const readSeenMaterialUpdates = (classID: string): Record<string, string> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(`student_material_seen_updates_${classID}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const persistSeenQuestionCounts = (next: Record<string, number>) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SEEN_QUESTION_COUNT_KEY, JSON.stringify(next));
};

const readStringSet = (key: string): Set<string> => {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((v) => typeof v === "string"));
  } catch {
    return new Set<string>();
  }
};

const persistStringSet = (key: string, value: Set<string>) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(Array.from(value)));
};

export const loadStudentNotificationPrefs = (): StudentNotificationPrefs => {
  if (typeof window === "undefined") {
    return {
      profileApprovals: true,
      classApproved: true,
      classInvited: true,
      newMaterials: true,
      reviewedScores: true,
      newQuestions: true,
    };
  }
  try {
    const raw = window.localStorage.getItem(STUDENT_NOTIFICATION_PREFS_KEY);
    if (!raw) {
      return {
        profileApprovals: true,
        classApproved: true,
        classInvited: true,
        newMaterials: true,
        reviewedScores: true,
        newQuestions: true,
      };
    }
    const parsed = JSON.parse(raw) as Partial<StudentNotificationPrefs>;
    return {
      profileApprovals: parsed.profileApprovals ?? true,
      classApproved: parsed.classApproved ?? true,
      classInvited: parsed.classInvited ?? true,
      newMaterials: parsed.newMaterials ?? true,
      reviewedScores: parsed.reviewedScores ?? true,
      newQuestions: parsed.newQuestions ?? true,
    };
  } catch {
    return {
      profileApprovals: true,
      classApproved: true,
      classInvited: true,
      newMaterials: true,
      reviewedScores: true,
      newQuestions: true,
    };
  }
};

export const fetchStudentNotifications = async (
  prefs: StudentNotificationPrefs,
): Promise<StudentNotificationItem[]> => {
  const items: StudentNotificationItem[] = [];

  if (prefs.profileApprovals) {
    const approvalRes = await fetch("/api/profile-change-requests", { credentials: "include" });
    if (approvalRes.ok) {
      const approvalData = await approvalRes.json();
      const approvals = Array.isArray(approvalData) ? (approvalData as ProfileChangeRequest[]) : [];
      approvals.forEach((req) => {
        if (!req?.id) return;
        if (req.status === "pending") {
          items.push({
            id: `student-approval-pending-${req.id}`,
            title: "Approval Diproses",
            message: `Permintaan ${requestTypeLabel(req.request_type)} kamu sedang diproses admin.`,
            createdAt: req.created_at || nowIso(),
          });
          return;
        }
        if (req.status === "approved") {
          items.push({
            id: `student-approval-approved-${req.id}`,
            title: "Approval Disetujui",
            message: `Permintaan ${requestTypeLabel(req.request_type)} kamu sudah disetujui.`,
            createdAt: req.reviewed_at || req.created_at || nowIso(),
          });
          return;
        }
        if (req.status === "rejected") {
          items.push({
            id: `student-approval-rejected-${req.id}`,
            title: "Approval Ditolak",
            message: req.reason
              ? `Permintaan ${requestTypeLabel(req.request_type)} ditolak: ${req.reason}`
              : `Permintaan ${requestTypeLabel(req.request_type)} kamu ditolak.`,
            createdAt: req.reviewed_at || req.created_at || nowIso(),
          });
        }
      });
    }
  }

  const myClassesRes = await fetch("/api/student/my-classes", { credentials: "include" });
  if (!myClassesRes.ok) {
    return items;
  }
  const pendingClassesRes = await fetch("/api/student/pending-classes", { credentials: "include" });

  const classData = await myClassesRes.json();
  const classes = Array.isArray(classData) ? (classData as StudentClass[]) : [];
  const pendingClassData = pendingClassesRes.ok ? await pendingClassesRes.json() : [];
  const pendingClasses = Array.isArray(pendingClassData) ? (pendingClassData as PendingClassJoin[]) : [];

  // Membership notifications:
  // - if class previously pending and now appears in approved classes => ACC masuk kelas
  // - if class appears in approved classes without pending history => invited by teacher
  const seenPendingClassIDs = readStringSet(SEEN_PENDING_CLASS_IDS_KEY);
  const seenApprovedClassIDs = readStringSet(SEEN_APPROVED_CLASS_IDS_KEY);
  const seenAIGradedSubmissionIDs = readStringSet(SEEN_AI_GRADED_SUBMISSION_IDS_KEY);
  const hasSeenApprovalStateBefore =
    typeof window !== "undefined" && window.localStorage.getItem(SEEN_APPROVED_CLASS_IDS_KEY) != null;

  const pendingNowIDs = new Set<string>();
  pendingClasses.forEach((pending) => {
    if (pending?.class_id) pendingNowIDs.add(pending.class_id);
  });

  if (hasSeenApprovalStateBefore) {
    classes.forEach((cls) => {
      if (!cls?.id || seenApprovedClassIDs.has(cls.id)) return;
      if (seenPendingClassIDs.has(cls.id)) {
        if (prefs.classApproved) {
          items.push({
            id: `student-class-approved-${cls.id}`,
            title: "ACC Masuk Kelas",
            message: `Permintaan masuk kamu ke kelas ${cls.class_name || "-"} sudah disetujui.`,
            createdAt: nowIso(),
          });
        }
      } else {
        if (prefs.classInvited) {
          items.push({
            id: `student-class-invited-${cls.id}`,
            title: "Diundang ke Kelas",
            message: `Kamu diundang masuk ke kelas ${cls.class_name || "-"}${cls.teacher_name ? ` oleh ${cls.teacher_name}` : ""}.`,
            createdAt: nowIso(),
          });
        }
      }
    });
  }

  const nextSeenApproved = new Set<string>(seenApprovedClassIDs);
  classes.forEach((cls) => {
    if (cls?.id) nextSeenApproved.add(cls.id);
  });
  const nextSeenPending = new Set<string>(seenPendingClassIDs);
  pendingNowIDs.forEach((id) => nextSeenPending.add(id));
  persistStringSet(SEEN_APPROVED_CLASS_IDS_KEY, nextSeenApproved);
  persistStringSet(SEEN_PENDING_CLASS_IDS_KEY, nextSeenPending);

  if (classes.length === 0) {
    return items;
  }

  const classResponses = await Promise.all(
    classes.map((cls) => fetch(`/api/student/classes/${cls.id}`, { credentials: "include" })),
  );
  const classDetailsRaw = await Promise.all(
    classResponses.map(async (res) => (res.ok ? res.json() : null)),
  );
  const classDetails = classDetailsRaw.filter(Boolean) as StudentClassDetail[];

  const seenQuestionCounts = readSeenQuestionCounts();
  const nextSeenQuestionCounts: Record<string, number> = { ...seenQuestionCounts };

  classDetails.forEach((detail) => {
    const className = detail.class_name || "kelas";
    const materials = Array.isArray(detail.materials) ? detail.materials : [];
    const seenMaterialUpdates = readSeenMaterialUpdates(detail.id);
    materials.forEach((material) => {
      const materialName = material.judul || "materi";
      const questions = Array.isArray(material.essay_questions) ? material.essay_questions : [];
      const updateSignature = material.updated_at || material.created_at || "";
      const createdAt = updateSignature || nowIso();

      if (prefs.newMaterials && updateSignature && seenMaterialUpdates[material.id] !== updateSignature) {
        items.push({
          id: `student-material-${material.id}-${updateSignature}`,
          title: "Materi Baru / Diperbarui",
          message: `${materialName} di ${className} memiliki update terbaru.`,
          createdAt,
        });
      }

      if (prefs.newQuestions) {
        const key = `${detail.id}:${material.id}`;
        const currentCount = questions.length;
        const previousCount = seenQuestionCounts[key] ?? 0;
        if (currentCount > previousCount) {
          const delta = currentCount - previousCount;
          items.push({
            id: `student-question-${material.id}-${currentCount}`,
            title: "Soal Baru",
            message: `${delta} soal baru tersedia di ${materialName} (${className}).`,
            createdAt,
          });
        }
        nextSeenQuestionCounts[key] = currentCount;
      }

      if (prefs.reviewedScores) {
        questions.forEach((q) => {
          const hasAIGrade = q.skor_ai != null || String(q.umpan_balik_ai || "").trim().length > 0;
          if (q.submission_id && hasAIGrade && !seenAIGradedSubmissionIDs.has(q.submission_id)) {
            items.push({
              id: `student-ai-graded-${q.submission_id}`,
              title: "Penilaian AI Selesai",
              message: `Jawabanmu di ${materialName} (${className}) sudah selesai dinilai AI.`,
              createdAt,
            });
            seenAIGradedSubmissionIDs.add(q.submission_id);
          }

          const hasReview = q.revised_score != null || String(q.teacher_feedback || "").trim().length > 0;
          if (!hasReview) return;
          items.push({
            id: `student-review-${q.id}-${q.revised_score ?? "na"}-${String(q.teacher_feedback || "").length}`,
            title: "Nilai Direview Guru",
            message: `Guru sudah mereview jawabanmu di ${materialName} (${className}).`,
            createdAt,
          });
        });
      }
    });
  });

  persistSeenQuestionCounts(nextSeenQuestionCounts);
  persistStringSet(SEEN_AI_GRADED_SUBMISSION_IDS_KEY, seenAIGradedSubmissionIDs);
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items.slice(0, 40);
};
