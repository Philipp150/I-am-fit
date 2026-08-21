import { beforeEach, describe, expect, it, vi } from "vitest";

const listPlanItemsForPlan = vi.fn();
const savePlanItem = vi.fn();
const addCompletion = vi.fn();
const ensureActivePlan = vi.fn();
const getPlan = vi.fn();

vi.mock("./repository", () => ({
  newId: (prefix: string) => `${prefix}-fixed`,
  listPlanItemsForPlan: (id: string) => listPlanItemsForPlan(id),
  savePlanItem: (item: unknown) => savePlanItem(item),
  addCompletion: (item: unknown) => addCompletion(item),
  ensureActivePlan: () => ensureActivePlan(),
  getPlan: (id: string) => getPlan(id),
}));

import { addExerciseToPlan, markComplete, markSkipped } from "./plan";
import type { Exercise, PlanItem, TrainingPlan } from "./types";

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

const activePlan: TrainingPlan = {
  id: "plan-active",
  title: "Mein Plan",
  createdById: "solo",
  createdByName: "",
  createdByEmail: "",
  source: "self",
  acceptedFromInviteId: null,
  archived: false,
  createdAt: "2026-08-01T00:00:00.000Z",
};

describe("plan writes", () => {
  beforeEach(() => {
    listPlanItemsForPlan.mockReset();
    savePlanItem.mockReset();
    addCompletion.mockReset();
    ensureActivePlan.mockReset();
    getPlan.mockReset();
    listPlanItemsForPlan.mockResolvedValue([]);
    savePlanItem.mockResolvedValue(undefined);
    addCompletion.mockResolvedValue(undefined);
    ensureActivePlan.mockResolvedValue(activePlan);
    getPlan.mockResolvedValue(activePlan);
  });

  it("creates a new plan item from catalog rhythm", async () => {
    const id = await addExerciseToPlan(exercise);
    expect(id).toBe("planitem-fixed");
    expect(savePlanItem).toHaveBeenCalledOnce();
    const saved = savePlanItem.mock.calls[0][0] as PlanItem;
    expect(saved.exerciseId).toBe("ex-a");
    expect(saved.planId).toBe("plan-active");
    expect(saved.enabled).toBe(true);
    expect(saved.rhythm.kind).toBe("daily");
    expect(saved.keepUntil).toBeTruthy();
  });

  it("reactivates an existing item and keeps its reminder", async () => {
    listPlanItemsForPlan.mockResolvedValue([
      {
        id: "plan-old",
        planId: "plan-active",
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

  it("refuses to edit a received plan", async () => {
    getPlan.mockResolvedValue({ ...activePlan, source: "received" });
    await expect(addExerciseToPlan(exercise)).rejects.toThrow(/Empfangene Pläne/);
    expect(savePlanItem).not.toHaveBeenCalled();
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
