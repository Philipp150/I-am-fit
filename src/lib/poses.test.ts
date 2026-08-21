import { describe, expect, it } from "vitest";
import { POSE_IDS, POSE_LABELS, POSES } from "./poses";

describe("authored poses", () => {
  it("keeps labels and keyframes in sync", () => {
    expect([...POSE_IDS].sort()).toEqual(Object.keys(POSE_LABELS).sort());
    expect([...POSE_IDS].sort()).toEqual(Object.keys(POSES).sort());
  });

  it("makes shrug lift the shoulders instead of raising the arms", () => {
    expect(POSES.shrug.shoulderLift).toBeGreaterThan(POSES.stand.shoulderLift);
    expect(Math.abs(POSES.shrug.leftUpperArm)).toBeLessThan(40);
  });

  it("tilts the neck in opposite directions and tucks or lifts the head for a circle", () => {
    expect(POSES.neckLeft.neck).toBeGreaterThan(0);
    expect(POSES.neckRight.neck).toBeLessThan(0);
    expect(POSES.neckLeft.headShiftX).toBeGreaterThan(0);
    expect(POSES.neckRight.headShiftX).toBeLessThan(0);
    expect(POSES.neckForward.headShiftY).toBeGreaterThan(0);
    expect(POSES.neckBack.headShiftY).toBeLessThan(0);
  });

  it("walks with opposite legs and does not look like standing", () => {
    expect(POSES.walkLeft.leftThigh).not.toBe(POSES.stand.leftThigh);
    expect(POSES.walkLeft.leftThigh).toBeGreaterThan(POSES.walkRight.leftThigh);
    expect(POSES.walkRight.rightThigh).toBeGreaterThan(POSES.walkLeft.rightThigh);
    expect(POSES.walkLeft.hipX).not.toBe(POSES.walkRight.hipX);
  });

  it("slides the jaw left and right instead of only opening the mouth", () => {
    expect(POSES.jawLeft.headShiftX).toBeGreaterThan(0);
    expect(POSES.jawRight.headShiftX).toBeLessThan(0);
    expect(POSES.jawSoft.jaw).toBeGreaterThan(0);
  });

  it("keeps seated twists seated on both sides", () => {
    expect(POSES.twist.hipY).toBeGreaterThan(170);
    expect(POSES.twistOther.hipY).toBeGreaterThan(170);
    expect(POSES.twist.neck).toBeGreaterThan(0);
    expect(POSES.twistOther.neck).toBeLessThan(0);
  });

  it("does not sit down for standing or lying breath", () => {
    expect(POSES.standInhale.hipY).toBeLessThan(160);
    expect(POSES.standExhale.leftThigh).toBeLessThan(40);
    expect(POSES.lieInhale.bodyTilt).toBeGreaterThan(70);
    expect(POSES.breatheIn.hipY).toBeGreaterThan(170);
  });

  it("mirrors laterality for warrior, hip open and wall calf stretch", () => {
    expect(POSES.warrior.rightThigh).toBeLessThan(POSES.warrior.leftThigh);
    expect(POSES.warriorOther.leftThigh).toBeGreaterThan(POSES.warriorOther.rightThigh);
    expect(POSES.hipOpen.rightThigh).not.toBe(POSES.hipOpenOther.rightThigh);
    expect(POSES.calfWall.rightThigh).not.toBe(POSES.calfWallOther.rightThigh);
  });
});
