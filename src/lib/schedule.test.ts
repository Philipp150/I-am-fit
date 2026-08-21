import { describe, expect, it } from "vitest";
import { isoDate, isPlanItemDueOn, streakLength } from "./schedule";
import type { PlanItem } from "./types";

function item(partial: Partial<PlanItem> & Pick<PlanItem, "rhythm">): PlanItem {
  return {
    id: "p1",
    planId: "plan-1",
    exerciseId: "e1",
    enabled: true,
    createdAt: "2026-08-01T00:00:00.000Z",
    ...partial,
  };
}

describe("schedule", () => {
  it("marks daily items due after start, not before", () => {
    const plan = item({
      rhythm: { kind: "daily", startDate: "2026-08-10" },
    });
    expect(isPlanItemDueOn(plan, new Date(2026, 7, 9))).toBe(false);
    expect(isPlanItemDueOn(plan, new Date(2026, 7, 10))).toBe(true);
  });

  it("honors keepUntil and disabled flags", () => {
    const plan = item({
      keepUntil: "2026-08-12",
      rhythm: { kind: "daily", startDate: "2026-08-01" },
    });
    expect(isPlanItemDueOn(plan, new Date(2026, 7, 12))).toBe(true);
    expect(isPlanItemDueOn(plan, new Date(2026, 7, 13))).toBe(false);
    expect(isPlanItemDueOn({ ...plan, enabled: false }, new Date(2026, 7, 11))).toBe(false);
  });

  it("supports weekdays, selected days and every n days", () => {
    const weekdays = item({ rhythm: { kind: "weekdays", startDate: "2026-08-01" } });
    expect(isPlanItemDueOn(weekdays, new Date(2026, 7, 17))).toBe(true); // Monday
    expect(isPlanItemDueOn(weekdays, new Date(2026, 7, 16))).toBe(false); // Sunday

    const custom = item({
      rhythm: { kind: "days", daysOfWeek: [2, 4], startDate: "2026-08-01" },
    });
    expect(isPlanItemDueOn(custom, new Date(2026, 7, 18))).toBe(true); // Tuesday
    expect(isPlanItemDueOn(custom, new Date(2026, 7, 19))).toBe(false);

    const every = item({
      rhythm: { kind: "every_n_days", everyNDays: 3, startDate: "2026-08-10" },
    });
    expect(isPlanItemDueOn(every, new Date(2026, 7, 10))).toBe(true);
    expect(isPlanItemDueOn(every, new Date(2026, 7, 11))).toBe(false);
    expect(isPlanItemDueOn(every, new Date(2026, 7, 13))).toBe(true);
  });

  it("counts streaks including yesterday if today is still empty", () => {
    const today = new Date(2026, 7, 20);
    expect(streakLength([isoDate(today), "2026-08-19"], today)).toBe(2);
    expect(streakLength(["2026-08-19", "2026-08-18"], today)).toBe(2);
    expect(streakLength(["2026-08-18"], today)).toBe(0);
  });
});
