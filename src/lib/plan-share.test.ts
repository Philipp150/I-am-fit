import { describe, expect, it } from "vitest";
import {
  acceptInviteToNewPlan,
  creatorAttribution,
  isValidEmail,
  normalizeEmail,
  otherPlansUntouched,
  snapshotFromPlan,
} from "./plan-share";
import type { Exercise, PlanItem, TrainingPlan } from "./types";

const system: Exercise = {
  id: "ex-neck-circles",
  title: "Nacken",
  summary: "",
  kind: "movement",
  categoryIds: ["cat-neck"],
  complaintIds: [],
  steps: [{ pose: "stand", text: "Stehen", durationSec: 8 }],
  defaultDurationSec: 60,
  suggestedRhythm: { kind: "daily", recommendedWeeks: null, note: "" },
  source: { type: "catalog" },
  isSystem: true,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

const custom: Exercise = {
  ...system,
  id: "ex-physio-1",
  title: "Physio-Übung",
  isSystem: false,
  source: { type: "user" },
};

const plan: TrainingPlan = {
  id: "plan-physio",
  title: "Nackenprogramm",
  createdById: "physio-1",
  createdByName: "Alex Physio",
  createdByEmail: "alex@praxis.test",
  source: "self",
  acceptedFromInviteId: null,
  archived: false,
  createdAt: "2026-08-01T00:00:00.000Z",
};

const items: PlanItem[] = [
  {
    id: "item-1",
    planId: "plan-physio",
    exerciseId: "ex-neck-circles",
    enabled: true,
    rhythm: { kind: "daily", startDate: "2026-08-01" },
    durationSec: 90,
    createdAt: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "item-2",
    planId: "plan-physio",
    exerciseId: "ex-physio-1",
    enabled: true,
    rhythm: { kind: "weekdays", startDate: "2026-08-01" },
    reminderTime: "07:30",
    keepUntil: "2026-09-01",
    createdAt: "2026-08-01T00:00:00.000Z",
  },
];

describe("plan sharing helpers", () => {
  it("normalizes and validates emails", () => {
    expect(normalizeEmail("  Alex@Praxis.TEST ")).toBe("alex@praxis.test");
    expect(isValidEmail("alex@praxis.test")).toBe(true);
    expect(isValidEmail("nicht-gültig")).toBe(false);
  });

  it("attributes a plan to the creator name and email", () => {
    expect(creatorAttribution(plan)).toBe("von Alex Physio (alex@praxis.test)");
    expect(creatorAttribution({ ...plan, createdByEmail: "Alex Physio" })).toBe("von Alex Physio");
    expect(creatorAttribution({ createdByName: "", createdByEmail: "", source: "self" })).toBe("von dir");
    expect(creatorAttribution({ createdByName: "", createdByEmail: "", source: "received" })).toBe("von jemand anderem");
  });

  it("snapshots custom exercises and leaves catalog ids in items", () => {
    const snapshot = snapshotFromPlan(plan, items, [system, custom]);
    expect(snapshot.title).toBe("Nackenprogramm");
    expect(snapshot.items).toHaveLength(2);
    expect(snapshot.exercises.map((exercise) => exercise.id)).toEqual(["ex-physio-1"]);
    expect(snapshot.items[0].exerciseId).toBe("ex-neck-circles");
  });
});

describe("accept invite", () => {
  it("copies snapshot into a new plan with sender attribution", () => {
    const snapshot = snapshotFromPlan(plan, items, [system, custom]);
    let n = 0;
    const result = acceptInviteToNewPlan({
      invite: {
        id: "invite-1",
        fromUserId: "physio-1",
        fromName: "Alex Physio",
        fromEmail: "alex@praxis.test",
        planSnapshot: snapshot,
      },
      recipientId: "patient-1",
      existingPlanIds: ["plan-mine", "plan-old"],
      existingExerciseIds: ["ex-neck-circles", "ex-physio-1"],
      now: "2026-08-21T10:00:00.000Z",
      createId: (prefix) => {
        n += 1;
        return `${prefix}-${n}`;
      },
    });

    expect(result.plan.id).toBe("plan-2");
    expect(result.plan.source).toBe("received");
    expect(result.plan.acceptedFromInviteId).toBe("invite-1");
    expect(result.plan.createdById).toBe("physio-1");
    expect(result.plan.createdByName).toBe("Alex Physio");
    expect(result.plan.createdByEmail).toBe("alex@praxis.test");
    expect(result.plan.title).toBe("Nackenprogramm");
    expect(otherPlansUntouched(["plan-mine", "plan-old"], result.plan.id)).toBe(true);
    expect(["plan-mine", "plan-old"]).not.toContain(result.plan.id);

    expect(result.items).toHaveLength(2);
    expect(result.items.every((item) => item.planId === result.plan.id)).toBe(true);
    expect(result.items[0].exerciseId).toBe("ex-neck-circles");
    expect(result.items[1].exerciseId).toBe("ex-1");
    expect(result.items[1].reminderTime).toBe("07:30");
    expect(result.items[1].keepUntil).toBe("2026-09-01");

    expect(result.exercisesToSave).toHaveLength(1);
    expect(result.exercisesToSave[0].id).toBe("ex-1");
    expect(result.exercisesToSave[0].title).toBe("Physio-Übung");
    expect(result.exercisesToSave[0].isSystem).toBe(false);
    expect(result.exercisesToSave[0].id).not.toBe("ex-physio-1");
  });

  it("does not reuse existing plan ids or clobber other plans", () => {
    let n = 0;
    const result = acceptInviteToNewPlan({
      invite: {
        id: "invite-2",
        fromUserId: "physio-1",
        fromName: "Alex",
        fromEmail: "alex@praxis.test",
        planSnapshot: { title: "  ", items: [], exercises: [] },
      },
      recipientId: "patient-1",
      existingPlanIds: ["plan-1"],
      existingExerciseIds: [],
      now: "2026-08-21T10:00:00.000Z",
      createId: (prefix) => {
        n += 1;
        return `${prefix}-${n}`;
      },
    });
    expect(result.plan.id).not.toBe("plan-1");
    expect(result.plan.title).toBe("Empfangener Plan");
    expect(result.items).toEqual([]);
    expect(result.exercisesToSave).toEqual([]);
  });
});
