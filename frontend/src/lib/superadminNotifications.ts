"use client";

import { fetchNotificationCenter } from "@/lib/notificationCenter";

export type SuperadminNotificationPrefs = {
  approvalRequests: boolean;
  anomalyAlerts: boolean;
  sidebarIndicators: boolean;
};

export type SuperadminNotificationItem = {
  id: string;
  category: "approval_request" | "anomaly_alert";
  title: string;
  message: string;
  createdAt: string;
  href?: string;
  isRead?: boolean;
  isActive?: boolean;
};

export const SUPERADMIN_NOTIFICATION_PREFS_KEY = "superadmin_notification_preferences";
const SUPERADMIN_NOTIFICATION_PREFS_PATH = ["notifications", "superadmin"] as const;

const getSuperadminDefaultPrefs = (): SuperadminNotificationPrefs => ({
  approvalRequests: true,
  anomalyAlerts: true,
  sidebarIndicators: true,
});

const mergeSuperadminPrefs = (parsed?: Partial<SuperadminNotificationPrefs> | null): SuperadminNotificationPrefs => ({
  ...getSuperadminDefaultPrefs(),
  ...(parsed || {}),
});

const readNestedSuperadminPrefs = (value: unknown, path: readonly string[]): Partial<SuperadminNotificationPrefs> | null => {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in (current as Record<string, unknown>))) {
      return null;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current && typeof current === "object" ? (current as Partial<SuperadminNotificationPrefs>) : null;
};

export const loadSuperadminNotificationPrefs = (): SuperadminNotificationPrefs => {
  if (typeof window === "undefined") return getSuperadminDefaultPrefs();
  try {
    const raw = window.localStorage.getItem(SUPERADMIN_NOTIFICATION_PREFS_KEY);
    if (!raw) return getSuperadminDefaultPrefs();
    return mergeSuperadminPrefs(JSON.parse(raw) as Partial<SuperadminNotificationPrefs>);
  } catch {
    return getSuperadminDefaultPrefs();
  }
};

export const hydrateSuperadminNotificationPrefs = async (): Promise<SuperadminNotificationPrefs> => {
  const fallback = loadSuperadminNotificationPrefs();
  try {
    const res = await fetch("/api/user-preferences", { credentials: "include" });
    if (!res.ok) return fallback;
    const body = await res.json().catch(() => ({}));
    const merged = mergeSuperadminPrefs(readNestedSuperadminPrefs(body?.preferences, SUPERADMIN_NOTIFICATION_PREFS_PATH));
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SUPERADMIN_NOTIFICATION_PREFS_KEY, JSON.stringify(merged));
    }
    return merged;
  } catch {
    return fallback;
  }
};

export const saveSuperadminNotificationPrefs = async (
  prefs: SuperadminNotificationPrefs,
): Promise<SuperadminNotificationPrefs> => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SUPERADMIN_NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
  }
  try {
    const res = await fetch("/api/user-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        preferences: {
          notifications: {
            superadmin: prefs,
          },
        },
      }),
    });
    if (!res.ok) throw new Error("save_failed");
    const body = await res.json().catch(() => ({}));
    return mergeSuperadminPrefs(readNestedSuperadminPrefs(body?.preferences, SUPERADMIN_NOTIFICATION_PREFS_PATH) || prefs);
  } catch {
    return prefs;
  }
};

export const fetchSuperadminNotifications = async (
  prefs: SuperadminNotificationPrefs,
): Promise<SuperadminNotificationItem[]> => {
  const items = (await fetchNotificationCenter(60)) as SuperadminNotificationItem[];
  return items.filter((item) => {
    if (item.category === "approval_request") return prefs.approvalRequests;
    if (item.category === "anomaly_alert") return prefs.anomalyAlerts;
    return true;
  });
};
