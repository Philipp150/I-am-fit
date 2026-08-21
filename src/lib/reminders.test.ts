import { describe, expect, it } from "vitest";
import {
  collectReminderTargets,
  dueReminderTargets,
  isReminderDueNow,
  nextReminderDate,
  parseReminderTime,
  reminderFireKey,
} from "./reminders";
import type { Exercise, PlanItem, Profile } from "./types";

const exercise: Exercise = {
  id: "ex-a",
  title: "Nacken",
  summary: "",
  kind: "movement",
  categoryIds: [],
  complaintIds: [],
  steps: [{ pose: "stand", text: "", durationSec: 8 }],
  defaultDurationSec: 60,
  suggestedRhythm: { kind: "daily", recommendedWeeks: null, note: "" },
  source: { type: "catalog" },
  isSystem: true,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("reminders", () => {
  it("parses clock times and rejects invalid ones", () => {
    expect(parseReminderTime("8:05")).toEqual({ hours: 8, minutes: 5 });
    expect(parseReminderTime("24:00")).toBeNull();
    expect(parseReminderTime("nope")).toBeNull();
  });

  it("schedules the next occurrence tomorrow if today's time has passed", () => {
    const from = new Date(2026, 7, 21, 9, 0, 0);
    const next = nextReminderDate("08:30", from);
    expect(next.getDate()).toBe(22);
    expect(next.getHours()).toBe(8);
  });

  it("collects profile and due plan-item reminders", () => {
    const profile: Profile = {
      id: "solo",
      displayName: "",
      reminderEnabled: true,
      reminderTime: "08:30",
      createdAt: "2026-08-01T00:00:00.000Z",
    };
    const items: PlanItem[] = [
      {
        id: "p1",
        exerciseId: "ex-a",
        enabled: true,
        reminderTime: "12:00",
        rhythm: { kind: "daily", startDate: "2026-08-01" },
        createdAt: "2026-08-01T00:00:00.000Z",
      },
      {
        id: "p2",
        exerciseId: "ex-a",
        enabled: true,
        reminderTime: "18:00",
        rhythm: { kind: "weekends", startDate: "2026-08-01" },
        createdAt: "2026-08-01T00:00:00.000Z",
      },
    ];
    const monday = new Date(2026, 7, 17, 12, 0, 10);
    const targets = collectReminderTargets(profile, items, [exercise], monday);
    expect(targets.map((item) => item.id)).toEqual(["profile", "p1"]);
    expect(isReminderDueNow("12:00", monday, 60_000)).toBe(true);
    const due = dueReminderTargets(targets, monday, new Set(), 60_000);
    expect(due.map((item) => item.id)).toEqual(["p1"]);
    expect(reminderFireKey("p1", "12:00", monday)).toBe("p1|12:00|2026-08-17");
  });
});
