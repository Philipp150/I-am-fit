import { isPlanItemDueOn, isoDate } from "./schedule";
import type { Exercise, PlanItem, Profile } from "./types";

const FIRED_KEY = "iamfit-reminder-fired";

export type ReminderTarget = {
  id: string;
  title: string;
  body: string;
  time: string;
};

export function parseReminderTime(value: string): { hours: number; minutes: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

export function nextReminderDate(time: string, from: Date): Date {
  const parsed = parseReminderTime(time) ?? { hours: 8, minutes: 30 };
  const next = new Date(from);
  next.setHours(parsed.hours, parsed.minutes, 0, 0);
  if (next.getTime() <= from.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

export function reminderFireKey(id: string, time: string, date: Date): string {
  return `${id}|${time}|${isoDate(date)}`;
}

export function isReminderDueNow(time: string, now: Date, windowMs = 60_000): boolean {
  const parsed = parseReminderTime(time);
  if (!parsed) return false;
  const scheduled = new Date(now);
  scheduled.setHours(parsed.hours, parsed.minutes, 0, 0);
  const delta = now.getTime() - scheduled.getTime();
  return delta >= 0 && delta < windowMs;
}

export function collectReminderTargets(
  profile: Pick<Profile, "reminderEnabled" | "reminderTime"> | undefined,
  planItems: PlanItem[],
  exercises: Exercise[],
  now: Date,
): ReminderTarget[] {
  const targets: ReminderTarget[] = [];
  if (profile?.reminderEnabled && parseReminderTime(profile.reminderTime)) {
    targets.push({
      id: "profile",
      title: "I am fit",
      body: "Du wolltest üben. Nur eine kurze Erinnerung, kein Druck.",
      time: profile.reminderTime,
    });
  }
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  for (const item of planItems) {
    if (!item.enabled || !item.reminderTime || !parseReminderTime(item.reminderTime)) continue;
    if (!isPlanItemDueOn(item, now)) continue;
    const exercise = byId.get(item.exerciseId);
    targets.push({
      id: item.id,
      title: exercise?.title ?? "Übung",
      body: "Heute im Plan – wenn du magst.",
      time: item.reminderTime,
    });
  }
  return targets;
}

export function dueReminderTargets(
  targets: ReminderTarget[],
  now: Date,
  fired: Set<string>,
  windowMs = 60_000,
): ReminderTarget[] {
  return targets.filter((target) => {
    if (!isReminderDueNow(target.time, now, windowMs)) return false;
    return !fired.has(reminderFireKey(target.id, target.time, now));
  });
}

export function readFiredKeys(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(FIRED_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

export function markFired(keys: string[]): void {
  if (typeof window === "undefined" || keys.length === 0) return;
  const next = readFiredKeys();
  const today = isoDate(new Date());
  for (const key of [...next]) {
    if (!key.endsWith(`|${today}`)) next.delete(key);
  }
  for (const key of keys) next.add(key);
  window.localStorage.setItem(FIRED_KEY, JSON.stringify([...next]));
}

export async function ensureNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return Notification.requestPermission();
}

export async function showLocalNotification(title: string, body: string, url = "/"): Promise<void> {
  if (typeof window === "undefined") return;
  const registration = await navigator.serviceWorker?.ready.catch(() => undefined);
  if (registration?.showNotification) {
    await registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url },
    });
    return;
  }
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "/icon-192.png" });
  }
}
