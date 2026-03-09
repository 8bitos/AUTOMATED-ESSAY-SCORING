"use client";

export type NotificationCenterItem = {
  id: string;
  category: string;
  title: string;
  message: string;
  createdAt: string;
  href?: string;
  isRead?: boolean;
  isActive?: boolean;
};

type NotificationCenterResponse = {
  items?: Array<{
    id?: string;
    category?: string;
    title?: string;
    message?: string;
    event_at?: string;
    href?: string | null;
    is_read?: boolean;
    is_active?: boolean;
  }>;
  unread_count?: number;
};

export const fetchNotificationCenter = async (limit = 60): Promise<NotificationCenterItem[]> => {
  const res = await fetch(`/api/notifications?limit=${limit}`, { credentials: "include" });
  if (!res.ok) throw new Error("failed_to_load_notification_center");
  const body = (await res.json().catch(() => ({}))) as NotificationCenterResponse;
  const rows = Array.isArray(body.items) ? body.items : [];
  return rows
    .map((item) => ({
      id: String(item?.id || ""),
      category: String(item?.category || ""),
      title: String(item?.title || ""),
      message: String(item?.message || ""),
      createdAt: String(item?.event_at || ""),
      href: item?.href ? String(item.href) : undefined,
      isRead: Boolean(item?.is_read),
      isActive: item?.is_active == null ? true : Boolean(item.is_active),
    }))
    .filter((item) => item.id && item.title);
};

export const markNotificationCenterItemsRead = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) return;
  await fetch("/api/notifications/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ ids }),
  });
};

export const markAllNotificationCenterItemsRead = async (): Promise<void> => {
  await fetch("/api/notifications/read-all", {
    method: "POST",
    credentials: "include",
  });
};
