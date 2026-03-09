"use client";

import { fetchNotificationCenter } from "@/lib/notificationCenter";

export type TeacherNotificationPrefs = {
  classRequests: boolean;
  assessmentUpdates: boolean;
  appealRequests: boolean;
  profileApprovals: boolean;
  systemAnnouncements: boolean;
  classAnnouncements: boolean;
  sidebarIndicators: boolean;
};

export type TeacherNotificationItem = {
  id: string;
  category: "class_request" | "assessment_update" | "appeal_request" | "profile_approval" | "system_announcement" | "class_announcement";
  title: string;
  message: string;
  createdAt: string;
  href?: string;
  isRead?: boolean;
  isActive?: boolean;
};

export const TEACHER_NOTIFICATION_PREFS_KEY = "teacher_notification_preferences";

const getTeacherDefaultPrefs = (): TeacherNotificationPrefs => ({
  classRequests: true,
  assessmentUpdates: true,
  appealRequests: true,
  profileApprovals: true,
  systemAnnouncements: true,
  classAnnouncements: true,
  sidebarIndicators: true,
});

const mergeTeacherPrefs = (parsed?: Partial<TeacherNotificationPrefs> | null): TeacherNotificationPrefs => ({
  ...getTeacherDefaultPrefs(),
  ...(parsed || {}),
});

const readTeacherPrefs = (value: unknown): Partial<TeacherNotificationPrefs> | null => {
  const notifications = value && typeof value === "object" ? (value as Record<string, unknown>).notifications : null;
  const teacher = notifications && typeof notifications === "object" ? (notifications as Record<string, unknown>).teacher : null;
  return teacher && typeof teacher === "object" ? (teacher as Partial<TeacherNotificationPrefs>) : null;
};

export const loadTeacherNotificationPrefs = (): TeacherNotificationPrefs => {
  if (typeof window === "undefined") return getTeacherDefaultPrefs();
  try {
    const raw = window.localStorage.getItem(TEACHER_NOTIFICATION_PREFS_KEY);
    if (!raw) return getTeacherDefaultPrefs();
    return mergeTeacherPrefs(JSON.parse(raw) as Partial<TeacherNotificationPrefs>);
  } catch {
    return getTeacherDefaultPrefs();
  }
};

export const hydrateTeacherNotificationPrefs = async (): Promise<TeacherNotificationPrefs> => {
  const fallback = loadTeacherNotificationPrefs();
  try {
    const res = await fetch("/api/user-preferences", { credentials: "include" });
    if (!res.ok) return fallback;
    const body = await res.json().catch(() => ({}));
    const merged = mergeTeacherPrefs(readTeacherPrefs(body?.preferences));
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TEACHER_NOTIFICATION_PREFS_KEY, JSON.stringify(merged));
    }
    return merged;
  } catch {
    return fallback;
  }
};

export const saveTeacherNotificationPrefs = async (prefs: TeacherNotificationPrefs): Promise<TeacherNotificationPrefs> => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(TEACHER_NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
  }
  try {
    const res = await fetch("/api/user-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        preferences: {
          notifications: {
            teacher: prefs,
          },
        },
      }),
    });
    if (!res.ok) throw new Error("save_failed");
    const body = await res.json().catch(() => ({}));
    return mergeTeacherPrefs(readTeacherPrefs(body?.preferences) || prefs);
  } catch {
    return prefs;
  }
};

export const fetchTeacherNotifications = async (
  prefs: TeacherNotificationPrefs,
): Promise<TeacherNotificationItem[]> => {
  const items = (await fetchNotificationCenter(60)) as TeacherNotificationItem[];
  return items.filter((item) => {
    if (item.category === "class_request") return prefs.classRequests;
    if (item.category === "assessment_update") return prefs.assessmentUpdates;
    if (item.category === "appeal_request") return prefs.appealRequests;
    if (item.category === "profile_approval") return prefs.profileApprovals;
    if (item.category === "system_announcement") return prefs.systemAnnouncements;
    if (item.category === "class_announcement") return prefs.classAnnouncements;
    return true;
  });
};
