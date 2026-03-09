"use client";

import { fetchNotificationCenter } from "@/lib/notificationCenter";

export type StudentNotificationPrefs = {
  profileApprovals: boolean;
  classApproved: boolean;
  classInvited: boolean;
  classAnnouncements: boolean;
  systemAnnouncements: boolean;
  newMaterials: boolean;
  deadlineReminders: boolean;
  aiGradingComplete: boolean;
  reviewedScores: boolean;
  newQuestions: boolean;
  appealUpdates: boolean;
  sidebarIndicators: boolean;
};

export type StudentNotificationItem = {
  id: string;
  category?:
    | "profile_approval"
    | "class_approval"
    | "class_invite"
    | "class_announcement"
    | "system_announcement"
    | "material_update"
    | "task_due_soon"
    | "task_overdue"
    | "question_new"
    | "ai_graded"
    | "teacher_review"
    | "appeal_update";
  title: string;
  message: string;
  createdAt: string;
  href?: string;
  isRead?: boolean;
  isActive?: boolean;
};

export const STUDENT_NOTIFICATION_PREFS_KEY = "student_notification_preferences";
const STUDENT_NOTIFICATION_STATE_KEY = "student_notification_state";
const STUDENT_NOTIFICATION_PREFS_PATH = ["notifications", "student"] as const;

type StudentNotificationState = {
  materialSeenByClass?: Record<string, Record<string, string>>;
};

const getStudentDefaultPrefs = (): StudentNotificationPrefs => ({
  profileApprovals: true,
  classApproved: true,
  classInvited: true,
  classAnnouncements: true,
  systemAnnouncements: true,
  newMaterials: true,
  deadlineReminders: true,
  aiGradingComplete: true,
  reviewedScores: true,
  newQuestions: true,
  appealUpdates: true,
  sidebarIndicators: true,
});

const mergeStudentPrefs = (parsed?: Partial<StudentNotificationPrefs> | null): StudentNotificationPrefs => ({
  ...getStudentDefaultPrefs(),
  ...(parsed || {}),
});

const normalizeMaterialSeenByClass = (value: unknown): Record<string, Record<string, string>> => {
  if (!value || typeof value !== "object") return {};
  const next: Record<string, Record<string, string>> = {};
  for (const [classID, rawMaterials] of Object.entries(value as Record<string, unknown>)) {
    if (!rawMaterials || typeof rawMaterials !== "object") continue;
    const materialMap: Record<string, string> = {};
    for (const [materialID, signature] of Object.entries(rawMaterials as Record<string, unknown>)) {
      if (typeof signature === "string" && signature.trim()) {
        materialMap[materialID] = signature;
      }
    }
    if (Object.keys(materialMap).length > 0) {
      next[classID] = materialMap;
    }
  }
  return next;
};

const getStudentDefaultState = (): StudentNotificationState => ({
  materialSeenByClass: {},
});

const mergeStudentNotificationState = (parsed?: Partial<StudentNotificationState> | null): StudentNotificationState => ({
  ...getStudentDefaultState(),
  ...(parsed || {}),
  materialSeenByClass: normalizeMaterialSeenByClass(parsed?.materialSeenByClass),
});

let cachedStudentNotificationState: StudentNotificationState | null = null;

const loadStudentNotificationState = (): StudentNotificationState => {
  if (cachedStudentNotificationState) return cachedStudentNotificationState;
  if (typeof window === "undefined") return getStudentDefaultState();
  try {
    const raw = window.localStorage.getItem(STUDENT_NOTIFICATION_STATE_KEY);
    if (!raw) {
      cachedStudentNotificationState = getStudentDefaultState();
      return cachedStudentNotificationState;
    }
    cachedStudentNotificationState = mergeStudentNotificationState(JSON.parse(raw) as Partial<StudentNotificationState>);
    return cachedStudentNotificationState;
  } catch {
    cachedStudentNotificationState = getStudentDefaultState();
    return cachedStudentNotificationState;
  }
};

const persistStudentNotificationState = (state: StudentNotificationState) => {
  cachedStudentNotificationState = state;
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STUDENT_NOTIFICATION_STATE_KEY, JSON.stringify(state));
};

const readNestedPrefs = (value: unknown, path: readonly string[]): Partial<StudentNotificationPrefs> | null => {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in (current as Record<string, unknown>))) {
      return null;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current && typeof current === "object" ? (current as Partial<StudentNotificationPrefs>) : null;
};

const readStudentNotificationState = (value: unknown): Partial<StudentNotificationState> | null => {
  if (!value || typeof value !== "object") return null;
  const state = (value as Record<string, unknown>).student_notification_state;
  return state && typeof state === "object" ? (state as Partial<StudentNotificationState>) : null;
};

export const loadStudentNotificationPrefs = (): StudentNotificationPrefs => {
  if (typeof window === "undefined") return getStudentDefaultPrefs();
  try {
    const raw = window.localStorage.getItem(STUDENT_NOTIFICATION_PREFS_KEY);
    if (!raw) return getStudentDefaultPrefs();
    return mergeStudentPrefs(JSON.parse(raw) as Partial<StudentNotificationPrefs>);
  } catch {
    return getStudentDefaultPrefs();
  }
};

export const hydrateStudentNotificationPrefs = async (): Promise<StudentNotificationPrefs> => {
  const fallback = loadStudentNotificationPrefs();
  try {
    const res = await fetch("/api/user-preferences", { credentials: "include" });
    if (!res.ok) return fallback;
    const body = await res.json().catch(() => ({}));
    const merged = mergeStudentPrefs(readNestedPrefs(body?.preferences, STUDENT_NOTIFICATION_PREFS_PATH));
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STUDENT_NOTIFICATION_PREFS_KEY, JSON.stringify(merged));
    }
    return merged;
  } catch {
    return fallback;
  }
};

export const hydrateStudentNotificationState = async (): Promise<StudentNotificationState> => {
  const fallback = loadStudentNotificationState();
  try {
    const res = await fetch("/api/user-preferences", { credentials: "include" });
    if (!res.ok) return fallback;
    const body = await res.json().catch(() => ({}));
    const merged = mergeStudentNotificationState(readStudentNotificationState(body?.preferences));
    persistStudentNotificationState(merged);
    return merged;
  } catch {
    return fallback;
  }
};

export const saveStudentNotificationPrefs = async (prefs: StudentNotificationPrefs): Promise<StudentNotificationPrefs> => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STUDENT_NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
  }
  try {
    const res = await fetch("/api/user-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        preferences: {
          notifications: {
            student: prefs,
          },
        },
      }),
    });
    if (!res.ok) throw new Error("save_failed");
    const body = await res.json().catch(() => ({}));
    return mergeStudentPrefs(readNestedPrefs(body?.preferences, STUDENT_NOTIFICATION_PREFS_PATH) || prefs);
  } catch {
    return prefs;
  }
};

export const loadStudentMaterialSeenUpdates = (classID: string): Record<string, string> => {
  const state = loadStudentNotificationState();
  return state.materialSeenByClass?.[classID] || {};
};

export const markStudentMaterialSeen = async (
  classID: string,
  materialID: string,
  signature: string,
): Promise<Record<string, string>> => {
  const current = loadStudentNotificationState();
  const nextByClass = {
    ...(current.materialSeenByClass || {}),
    [classID]: {
      ...((current.materialSeenByClass || {})[classID] || {}),
      [materialID]: signature,
    },
  };
  const nextState = mergeStudentNotificationState({ ...current, materialSeenByClass: nextByClass });
  persistStudentNotificationState(nextState);

  try {
    const res = await fetch("/api/user-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        preferences: {
          student_notification_state: nextState,
        },
      }),
    });
    if (!res.ok) throw new Error("save_failed");
    const body = await res.json().catch(() => ({}));
    const merged = mergeStudentNotificationState(readStudentNotificationState(body?.preferences) || nextState);
    persistStudentNotificationState(merged);
    return merged.materialSeenByClass?.[classID] || {};
  } catch {
    return nextState.materialSeenByClass?.[classID] || {};
  }
};

export const fetchStudentNotifications = async (
  prefs: StudentNotificationPrefs,
): Promise<StudentNotificationItem[]> => {
  const items = (await fetchNotificationCenter(60)) as StudentNotificationItem[];
  return items.filter((item) => {
    if (item.category === "profile_approval") return prefs.profileApprovals;
    if (item.category === "class_approval") return prefs.classApproved;
    if (item.category === "class_invite") return prefs.classInvited;
    if (item.category === "class_announcement") return prefs.classAnnouncements;
    if (item.category === "system_announcement") return prefs.systemAnnouncements;
    if (item.category === "material_update") return prefs.newMaterials;
    if (item.category === "task_due_soon" || item.category === "task_overdue") return prefs.deadlineReminders;
    if (item.category === "question_new") return prefs.newQuestions;
    if (item.category === "ai_graded") return prefs.aiGradingComplete;
    if (item.category === "teacher_review") return prefs.reviewedScores;
    if (item.category === "appeal_update") return prefs.appealUpdates;
    return true;
  });
};
