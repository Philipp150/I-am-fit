import { describe, expect, it } from "vitest";
import { greeting } from "./copy";
import { todayOverview } from "./plan";
import type { Completion, PlanItem } from "./types";

describe("today overview", () => {
  const plan: PlanItem[] = [
    {
      id: "p1",
      exerciseId: "ex-a",
      enabled: true,
      rhythm: { kind: "daily", startDate: "2026-08-01" },
      createdAt: "2026-08-01T00:00:00.000Z",
    },
    {
      id: "p2",
      exerciseId: "ex-b",
      enabled: true,
      rhythm: { kind: "weekends", startDate: "2026-08-01" },
      createdAt: "2026-08-01T00:00:00.000Z",
    },
  ];

  it("lists remaining due items and ignores skipped completions", () => {
    const monday = new Date(2026, 7, 17);
    const completions: Completion[] = [
      { id: "c1", exerciseId: "ex-a", completedAt: "2026-08-17T08:00:00.000Z" },
    ];
    const overview = todayOverview(plan, completions, monday);
    expect(overview.due.map((item) => item.id)).toEqual(["p1"]);
    expect(overview.remaining).toEqual([]);
    expect(overview.doneCount).toBe(1);
    expect(overview.allDone).toBe(true);
  });

  it("keeps an item open when it was only skipped", () => {
    const monday = new Date(2026, 7, 17);
    const overview = todayOverview(
      plan,
      [{ id: "c1", exerciseId: "ex-a", completedAt: "2026-08-17T08:00:00.000Z", skipped: true }],
      monday,
    );
    expect(overview.remaining.map((item) => item.id)).toEqual(["p1"]);
    expect(overview.allDone).toBe(false);
  });
});

describe("greeting copy", () => {
  it("changes with the hour", () => {
    expect(greeting(new Date(2026, 7, 21, 8))).toBe("Guten Morgen");
    expect(greeting(new Date(2026, 7, 21, 15))).toBe("Schön, dass du vorbeischaust");
    expect(greeting(new Date(2026, 7, 21, 19))).toBe("Guten Abend");
    expect(greeting(new Date(2026, 7, 21, 23))).toBe("Noch ein kleiner Anker");
  });
});
