import { beforeEach, describe, expect, it, vi } from "vitest";

const listPlanItems = vi.fn();
const savePlanItem = vi.fn();
const addCompletion = vi.fn();

vi.mock("./repository", () => ({
  newId: (prefix: string) => `${prefix}-fixed`,
  listPlanItems: () => listPlanItems(),
  savePlanItem: (item: unknown) => savePlanItem(item),
  addCompletion: (item: unknown) => addCompletion(item),
}));

import { addExerciseToPlan, markComplete, markSkipped } from "./plan";
import type { Exercise, PlanItem } from "./types";

const exercise: Exercise = {
  id: "ex-a",
  title: "Test",
  summary: "",
  kind: "movement",
  categoryIds: ["cat-body"],
  complaintIds: [],
  steps: [{ pose: "stand", text: "Stehen", durationSec: 8 }],
  defaultDurationSec: 60,
  suggestedRhythm: { kind: "daily", recommendedWeeks: 2, note: "Kurz." },
  source: { type: "catalog" },
  isSystem: true,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("plan writes", () => {
  beforeEach(() => {
    listPlanItems.mockReset();
    savePlanItem.mockReset();
    addCompletion.mockReset();
    listPlanItems.mockResolvedValue([]);
    savePlanItem.mockResolvedValue(undefined);
    addCompletion.mockResolvedValue(undefined);
  });

  it("creates a new plan item from catalog rhythm", async () => {
    const id = await addExerciseToPlan(exercise);
    expect(id).toBe("plan-fixed");
    expect(savePlanItem).toHaveBeenCalledOnce();
    const saved = savePlanItem.mock.calls[0][0] as PlanItem;
    expect(saved.exerciseId).toBe("ex-a");
    expect(saved.enabled).toBe(true);
    expect(saved.rhythm.kind).toBe("daily");
    expect(saved.keepUntil).toBeTruthy();
  });

  it("reactivates an existing item and keeps its reminder", async () => {
    listPlanItems.mockResolvedValue([
      {
        id: "plan-old",
        exerciseId: "ex-a",
        enabled: false,
        reminderTime: "07:15",
        rhythm: { kind: "weekdays", startDate: "2026-08-01" },
        createdAt: "2026-08-01T00:00:00.000Z",
      } satisfies PlanItem,
    ]);
    const id = await addExerciseToPlan(exercise);
    expect(id).toBe("plan-old");
    const saved = savePlanItem.mock.calls[0][0] as PlanItem;
    expect(saved.enabled).toBe(true);
    expect(saved.reminderTime).toBe("07:15");
  });

  it("records completions and skips", async () => {
    await markComplete("ex-a", "plan-1", 45);
    await markSkipped("ex-a", "plan-1");
    expect(addCompletion.mock.calls[0][0]).toMatchObject({
      exerciseId: "ex-a",
      planItemId: "plan-1",
      durationSec: 45,
    });
    expect(addCompletion.mock.calls[1][0]).toMatchObject({
      exerciseId: "ex-a",
      skipped: true,
    });
  });
});
