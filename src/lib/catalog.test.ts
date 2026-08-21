import { describe, expect, it } from "vitest";
import { CATALOG_EXERCISES, CATEGORIES, COMPLAINTS } from "./catalog";
import { POSE_IDS, POSE_LABELS, POSES } from "./poses";

describe("catalog integrity", () => {
  it("defines angles and labels for every pose", () => {
    for (const id of POSE_IDS) {
      expect(POSES[id]).toBeTruthy();
      expect(POSE_LABELS[id]).toBeTruthy();
      expect(POSES[id].jaw).toEqual(expect.any(Number));
      expect(POSES[id].leftHand).toEqual(expect.any(Number));
      expect(POSES[id].shoulderLift).toEqual(expect.any(Number));
      expect(POSES[id].headShiftX).toEqual(expect.any(Number));
      expect(POSES[id].headShiftY).toEqual(expect.any(Number));
      expect(POSES[id].chest).toEqual(expect.any(Number));
    }
  });
  it("references only known categories, complaints and poses", () => {
    const categoryIds = new Set(CATEGORIES.map((item) => item.id));
    const complaintIds = new Set(COMPLAINTS.map((item) => item.id));
    for (const exercise of CATALOG_EXERCISES) {
      expect(exercise.steps.length).toBeGreaterThan(0);
      for (const id of exercise.categoryIds) expect(categoryIds.has(id)).toBe(true);
      for (const id of exercise.complaintIds) expect(complaintIds.has(id)).toBe(true);
      for (const step of exercise.steps) expect(POSES[step.pose]).toBeTruthy();
    }
  });

  it("keeps parent pointers inside the tree", () => {
    const ids = new Set(CATEGORIES.map((item) => item.id));
    for (const category of CATEGORIES) {
      if (category.parentId) expect(ids.has(category.parentId)).toBe(true);
    }
  });

  it("draws a distinct movement for exercises that used to share a generic pose", () => {
    const byId = new Map(CATALOG_EXERCISES.map((item) => [item.id, item]));
    const poses = (id: string) => byId.get(id)?.steps.map((step) => step.pose) ?? [];
    expect(poses("ex-walk-attention")).toContain("walkLeft");
    expect(poses("ex-walk-attention")).toContain("walkRight");
    expect(poses("ex-wrist-circles")).toContain("wristsFlex");
    expect(poses("ex-jaw-release")).toEqual(expect.arrayContaining(["jawSoft", "jawLeft", "jawRight"]));
    expect(poses("ex-eye-rest")).toContain("gazeFar");
    expect(poses("ex-pelvic-tilt")).toContain("pelvicTuck");
    expect(poses("ex-shoulder-dump")).toContain("shrug");
    expect(poses("ex-neck-circles")).toEqual(
      expect.arrayContaining(["neckLeft", "neckRight", "neckForward", "neckBack"]),
    );
    expect(poses("ex-shoulder-rolls")).toContain("shoulderForward");
    expect(poses("ex-warrior")).toContain("warriorOther");
    expect(poses("ex-hip-open")).toContain("hipOpenOther");
    expect(poses("ex-calf-stretch")).toEqual(expect.arrayContaining(["calfWall", "calfWallOther"]));
    expect(poses("ex-desk-break")).toEqual(expect.arrayContaining(["standInhale", "standExhale"]));
    expect(poses("ex-desk-break")).not.toContain("breatheIn");
    expect(poses("ex-478")).toEqual(expect.arrayContaining(["lieInhale", "lieHold", "lieExhale"]));
    expect(poses("ex-body-scan")).not.toContain("breathe");
  });
});
