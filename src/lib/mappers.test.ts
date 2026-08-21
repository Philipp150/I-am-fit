import { describe, expect, it } from "vitest";
import { exerciseFromRow, exerciseToRow, planFromRow, planToRow, trainingPlanFromRow, trainingPlanToRow } from "./mappers";
import { encodePoseTrack } from "./pose-track";
import { POSES } from "./poses";
import type { Exercise, PlanItem, TrainingPlan } from "./types";

const sample: Exercise = {
  id: "ex-1",
  title: "Test",
  summary: "Kurz",
  kind: "mantra",
  categoryIds: ["cat-mantras"],
  complaintIds: ["comp-focus"],
  steps: [{ pose: "heart", text: "Sag den Satz.", durationSec: 8 }],
  defaultDurationSec: 60,
  suggestedRhythm: { kind: "daily", recommendedWeeks: null, note: "" },
  source: { type: "user" },
  isSystem: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("supabase mappers", () => {
  it("round-trips a user exercise with owner", () => {
    const row = exerciseToRow(sample, "user-1");
    expect(row.owner_id).toBe("user-1");
    expect(row.category_ids).toEqual(["cat-mantras"]);
    expect(exerciseFromRow(row).title).toBe("Test");
    expect(exerciseFromRow(row).categoryIds).toEqual(["cat-mantras"]);
    expect(exerciseFromRow(row).poseTrack).toBeUndefined();
  });

  it("clears owner for catalog exercises", () => {
    const row = exerciseToRow({ ...sample, isSystem: true }, "user-1");
    expect(row.owner_id).toBeNull();
    expect(row.is_system).toBe(true);
  });

  it("round-trips a named plan and its items", () => {
    const plan: TrainingPlan = {
      id: "plan-1",
      title: "Nacken",
      createdById: "physio-1",
      createdByName: "Alex",
      createdByEmail: "alex@praxis.test",
      source: "received",
      acceptedFromInviteId: "invite-1",
      archived: false,
      createdAt: "2026-08-01T00:00:00.000Z",
    };
    const row = trainingPlanToRow(plan, "patient-1");
    expect(row.owner_id).toBe("patient-1");
    expect(row.created_by_id).toBe("physio-1");
    expect(trainingPlanFromRow(row).source).toBe("received");
    expect(trainingPlanFromRow(row).createdByName).toBe("Alex");

    const item: PlanItem = {
      id: "item-1",
      planId: "plan-1",
      exerciseId: "ex-1",
      enabled: true,
      rhythm: { kind: "daily", startDate: "2026-08-01" },
      createdAt: "2026-08-01T00:00:00.000Z",
    };
    const itemRow = planToRow(item, "patient-1");
    expect(itemRow.plan_id).toBe("plan-1");
    expect(planFromRow(itemRow).planId).toBe("plan-1");
  });

  it("stores a compact pose track as jsonb and reads it back", () => {
    const poseTrack = encodePoseTrack({
      poses: [POSES.stand, POSES.fold],
      durationSec: 3,
      fps: 10,
      sourceKind: "upload",
      analyzedAt: "2026-08-21T10:00:00.000Z",
    });
    const row = exerciseToRow({ ...sample, poseTrack }, "user-1");
    expect(row.pose_track).toEqual(poseTrack);
    expect(exerciseFromRow(row).poseTrack).toEqual(poseTrack);
    expect(exerciseFromRow({ ...row, pose_track: { version: 9 } }).poseTrack).toBeUndefined();
  });

  it("round-trips step start times on the steps jsonb", () => {
    const withStarts: Exercise = {
      ...sample,
      steps: [
        { pose: "stand", text: "Stehen.", durationSec: 8, startSec: 0 },
        { pose: "fold", text: "Beugen.", durationSec: 10, startSec: 14.5 },
      ],
    };
    const row = exerciseToRow(withStarts, "user-1");
    expect(exerciseFromRow(row).steps[1].startSec).toBe(14.5);
  });
});
