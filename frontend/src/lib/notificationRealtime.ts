export const DEFAULT_NOTIFICATION_POLL_INTERVAL_MS = 30_000;
const MIN_NOTIFICATION_POLL_INTERVAL_MS = 5_000;
const MAX_NOTIFICATION_POLL_INTERVAL_MS = 300_000;

export const clampNotificationPollIntervalMs = (value: number): number => {
  if (!Number.isFinite(value)) return DEFAULT_NOTIFICATION_POLL_INTERVAL_MS;
  if (value < MIN_NOTIFICATION_POLL_INTERVAL_MS) return MIN_NOTIFICATION_POLL_INTERVAL_MS;
  if (value > MAX_NOTIFICATION_POLL_INTERVAL_MS) return MAX_NOTIFICATION_POLL_INTERVAL_MS;
  return value;
};

export const loadNotificationPollIntervalMs = async (): Promise<number> => {
  try {
    const res = await fetch("/api/settings/notifications", { credentials: "include" });
    if (!res.ok) return DEFAULT_NOTIFICATION_POLL_INTERVAL_MS;
    const body = await res.json().catch(() => ({}));
    const seconds = Number(body?.poll_interval_seconds ?? 30);
    return clampNotificationPollIntervalMs(seconds * 1000);
  } catch {
    return DEFAULT_NOTIFICATION_POLL_INTERVAL_MS;
  }
};
