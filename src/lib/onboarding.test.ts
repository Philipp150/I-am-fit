import { describe, expect, it, vi } from "vitest";
import { CATALOG_EXERCISES } from "./catalog";
import {
  FIRST_RUN_DURATION_SEC,
  ONBOARDING_DISMISS_KEY,
  ONBOARDING_REMINDER_PENDING_KEY,
  ONBOARDING_THEMES,
  enabledPlanItems,
  onboardingDismissedFrom,
  pickFirstRunExercise,
  pickOnboardingExercises,
  reminderAffordancePendingFrom,
  seedOnboardingPlan,
  shouldShowOnboarding,
  type SeedOnboardingDeps,
} from "./onboarding";
import { isPlanItemDueOn } from "./schedule";
import type { Exercise, PlanItem, TrainingPlan } from "./types";

const selfPlan: TrainingPlan = {
  id: "plan-self",
  title: "Mein Plan",
  createdById: "solo",
  createdByName: "",
  createdByEmail: "",
  source: "self",
  acceptedFromInviteId: null,
  archived: false,
  createdAt: "2026-08-01T00:00:00.000Z",
};

const receivedPlan: TrainingPlan = {
  ...selfPlan,
  id: "plan-received",
  title: "Physio",
  source: "received",
};

function item(partial: Partial<PlanItem> & Pick<PlanItem, "id" | "exerciseId">): PlanItem {
  return {
    planId: "plan-self",
    enabled: true,
    rhythm: { kind: "daily", startDate: "2026-08-01" },
    createdAt: "2026-08-01T00:00:00.000Z",
    ...partial,
  };
}

describe("onboarding gate (first-run vs returning)", () => {
  it("shows the full flow on a first visit with an empty plan", () => {
    expect(shouldShowOnboarding([], false)).toBe("flow");
    expect(shouldShowOnboarding([item({ id: "p1", exerciseId: "ex-a", enabled: false })], false)).toBe("flow");
  });

  it("hides the flow for a returning user who already has plan items", () => {
    expect(shouldShowOnboarding([item({ id: "p1", exerciseId: "ex-a" })], false)).toBe("hidden");
    expect(shouldShowOnboarding([item({ id: "p1", exerciseId: "ex-a" })], true)).toBe("hidden");
  });

  it("keeps a quiet CTA when the empty-plan flow was dismissed", () => {
    expect(shouldShowOnboarding([], true)).toBe("cta");
    expect(onboardingDismissedFrom({ getItem: (key) => (key === ONBOARDING_DISMISS_KEY ? "1" : null) })).toBe(true);
    expect(onboardingDismissedFrom({ getItem: () => null })).toBe(false);
  });

  it("treats only enabled entries as a real plan", () => {
    expect(enabledPlanItems([item({ id: "p1", exerciseId: "ex-a", enabled: false })])).toEqual([]);
  });

  it("does not mark a returning user as needing the post-onboarding reminder", () => {
    expect(shouldShowOnboarding([item({ id: "p1", exerciseId: "ex-a" })], false)).toBe("hidden");
    expect(reminderAffordancePendingFrom({ getItem: () => null })).toBe(false);
    expect(
      reminderAffordancePendingFrom({
        getItem: (key) => (key === ONBOARDING_REMINDER_PENDING_KEY ? "1" : null),
      }),
    ).toBe(true);
  });
});

describe("first-run themes", () => {
  it("offers German chips for region, goal and topic including Bauch", () => {
    expect(ONBOARDING_THEMES.map((theme) => theme.label)).toEqual(["Nacken", "Rücken", "Bauch", "Beweglichkeit", "Büro"]);
    expect(JSON.stringify(ONBOARDING_THEMES)).not.toMatch(/beschwerde|diagnose|schmerz/i);
  });

  it("maps Bauch to a 60-second core starter", () => {
    const exercise = pickFirstRunExercise("comp-belly", CATALOG_EXERCISES);
    expect(exercise?.id).toBe("ex-belly-wake");
    expect(FIRST_RUN_DURATION_SEC).toBe(60);
  });
});

describe("complaint pick", () => {
  it("returns nothing without a complaint, and ranks overlapping catalog exercises", () => {
    expect(pickOnboardingExercises({ complaintIds: [], exercises: CATALOG_EXERCISES })).toEqual([]);
    const sleep = pickOnboardingExercises({
      complaintIds: ["comp-sleep"],
      exercises: CATALOG_EXERCISES,
      maxTotalSec: 240,
      maxCount: 2,
      preferCategoryIds: ["cat-evening", "cat-breath"],
    });
    expect(sleep.length).toBeGreaterThan(0);
    expect(sleep.every((exercise) => exercise.complaintIds.includes("comp-sleep"))).toBe(true);
  });
});

describe("plan seed", () => {
  const neck = CATALOG_EXERCISES.find((exercise) => exercise.id === "ex-neck-circles") as Exercise;
  const desk = CATALOG_EXERCISES.find((exercise) => exercise.id === "ex-desk-break") as Exercise;
  const saturday = new Date(2026, 7, 22);

  function deps(overrides: Partial<SeedOnboardingDeps> & { items?: PlanItem[]; plan?: TrainingPlan }): SeedOnboardingDeps {
    const addToPlan = overrides.addToPlan ?? vi.fn(async (exercise: Exercise) => `item-${exercise.id}`);
    return {
      ensureActivePlan: overrides.ensureActivePlan ?? (async () => overrides.plan ?? selfPlan),
      listItemsForPlan: overrides.listItemsForPlan ?? (async () => overrides.items ?? []),
      createPlan: overrides.createPlan ?? vi.fn(async () => selfPlan),
      addToPlan,
      today: saturday,
    };
  }

  it("seeds a first-run plan as daily-from-today so Heute is immediately doable", async () => {
    const addToPlan = vi.fn(async (exercise: Exercise) => `item-${exercise.id}`);
    const result = await seedOnboardingPlan([desk, neck], deps({ addToPlan, items: [] }));
    expect(result).toEqual({
      seeded: true,
      exerciseIds: ["ex-desk-break", "ex-neck-circles"],
      itemIds: ["item-ex-desk-break", "item-ex-neck-circles"],
    });
    expect(addToPlan).toHaveBeenCalledTimes(2);
    const first = addToPlan.mock.calls[0][1];
    expect(first?.rhythm).toEqual({ kind: "daily", startDate: "2026-08-22" });
    expect(first?.durationSec).toBe(60);
    expect(first?.keepUntil).toBeNull();
    expect(first?.planId).toBe("plan-self");
    expect(
      isPlanItemDueOn(
        {
          enabled: true,
          rhythm: first?.rhythm ?? { kind: "daily", startDate: "2026-08-22" },
          keepUntil: null,
        },
        saturday,
      ),
    ).toBe(true);
  });

  it("does not wipe a returning user's existing plan", async () => {
    const addToPlan = vi.fn(async () => "nope");
    const existing = [item({ id: "keep-me", exerciseId: "ex-mantra-here", planId: "plan-self" })];
    const result = await seedOnboardingPlan([neck], deps({ addToPlan, items: existing }));
    expect(result).toEqual({
      seeded: false,
      reason: "existing-plan",
      exerciseIds: ["ex-mantra-here"],
    });
    expect(addToPlan).not.toHaveBeenCalled();
  });

  it("leaves a received plan untouched and seeds a new personal plan instead", async () => {
    const addToPlan = vi.fn(async (exercise: Exercise) => `item-${exercise.id}`);
    const create = vi.fn(async () => ({ ...selfPlan, id: "plan-new" }));
    const result = await seedOnboardingPlan(
      [neck],
      deps({
        addToPlan,
        plan: receivedPlan,
        items: [],
        createPlan: create,
      }),
    );
    expect(result.seeded).toBe(true);
    expect(create).toHaveBeenCalledWith("Mein Plan", true);
    expect(addToPlan.mock.calls[0][1]?.planId).toBe("plan-new");
  });

  it("does not replace a received plan that already has exercises", async () => {
    const addToPlan = vi.fn(async () => "nope");
    const create = vi.fn(async () => selfPlan);
    const result = await seedOnboardingPlan(
      [neck],
      deps({
        addToPlan,
        createPlan: create,
        plan: receivedPlan,
        items: [item({ id: "physio-1", exerciseId: "ex-hip-open", planId: "plan-received" })],
      }),
    );
    expect(result.seeded).toBe(false);
    expect(create).not.toHaveBeenCalled();
    expect(addToPlan).not.toHaveBeenCalled();
  });
});
