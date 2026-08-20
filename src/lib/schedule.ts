import type { PlanItem, RhythmKind } from "./types";

const WEEKDAY = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];

export function dayOfWeek(date: Date): number {
  return date.getDay();
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function isPlanItemDueOn(item: Pick<PlanItem, "enabled" | "rhythm" | "keepUntil">, date: Date): boolean {
  if (!item.enabled) return false;
  const day = startOfDay(date);
  if (item.keepUntil) {
    const until = startOfDay(parseIsoDate(item.keepUntil));
    if (day > until) return false;
  }

  const start = startOfDay(parseIsoDate(item.rhythm.startDate));
  if (day < start) return false;

  const weekday = dayOfWeek(day);
  switch (item.rhythm.kind) {
    case "daily":
      return true;
    case "weekdays":
      return WEEKDAY.includes(weekday);
    case "weekends":
      return WEEKEND.includes(weekday);
    case "days":
      return (item.rhythm.daysOfWeek ?? []).includes(weekday);
    case "every_n_days": {
      const n = Math.max(1, item.rhythm.everyNDays ?? 2);
      const diff = Math.round((day.getTime() - start.getTime()) / 86_400_000);
      return diff % n === 0;
    }
    default:
      return false;
  }
}

export function rhythmLabel(kind: RhythmKind, daysOfWeek?: number[], everyNDays?: number): string {
  switch (kind) {
    case "daily":
      return "jeden Tag";
    case "weekdays":
      return "unter der Woche";
    case "weekends":
      return "am Wochenende";
    case "every_n_days":
      return `alle ${everyNDays ?? 2} Tage`;
    case "days": {
      const names = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
      const selected = (daysOfWeek ?? []).map((day) => names[day]).join(", ");
      return selected ? `an ${selected}` : "an gewählten Tagen";
    }
  }
}

export function streakLength(completionDates: string[], today = new Date()): number {
  const unique = new Set(completionDates);
  let streak = 0;
  let cursor = startOfDay(today);
  while (unique.has(isoDate(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  if (streak === 0) {
    const yesterday = addDays(startOfDay(today), -1);
    if (unique.has(isoDate(yesterday))) {
      cursor = yesterday;
      while (unique.has(isoDate(cursor))) {
        streak += 1;
        cursor = addDays(cursor, -1);
      }
    }
  }
  return streak;
}

export function formatDuration(totalSec: number): string {
  if (totalSec < 60) return `${totalSec} Sek.`;
  const minutes = Math.round(totalSec / 60);
  return minutes === 1 ? "1 Min." : `${minutes} Min.`;
}
