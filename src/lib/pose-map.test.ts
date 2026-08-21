import { describe, expect, it } from "vitest";
import { POSES } from "./poses";
import {
  angleFromDown,
  landmarksHavePerson,
  landmarksToJointAngles,
  standingLandmarks,
  MP,
  type PoseLandmark,
} from "./pose-map";

function raiseLeftArm(base: PoseLandmark[]): PoseLandmark[] {
  const next = base.map((point) => ({ ...point }));
  next[MP.LEFT_ELBOW] = { x: 0.38, y: 0.16, visibility: 0.99 };
  next[MP.LEFT_WRIST] = { x: 0.38, y: 0.08, visibility: 0.99 };
  return next;
}

describe("MediaPipe landmarks to mannequin", () => {
  it("maps a standing person to an upright figure close to the stand pose", () => {
    const pose = landmarksToJointAngles(standingLandmarks());
    expect(landmarksHavePerson(standingLandmarks())).toBe(true);
    expect(Math.abs(pose.bodyTilt)).toBeLessThan(12);
    expect(Math.abs(pose.torso)).toBeLessThan(18);
    expect(pose.hipY).toBeGreaterThan(130);
    expect(pose.hipY).toBeLessThan(170);
    expect(Math.abs(pose.leftThigh)).toBeLessThan(25);
    expect(Math.abs(pose.rightThigh)).toBeLessThan(25);
  });

  it("lifts the left arm when the wrist is above the shoulder", () => {
    const stand = landmarksToJointAngles(standingLandmarks());
    const reach = landmarksToJointAngles(raiseLeftArm(standingLandmarks()), stand);
    expect(Math.abs(reach.leftUpperArm)).toBeGreaterThan(Math.abs(stand.leftUpperArm));
  });

  it("rejects empty or low-visibility detections", () => {
    expect(landmarksHavePerson([])).toBe(false);
    expect(landmarksHavePerson(undefined)).toBe(false);
    const hidden = standingLandmarks().map((point) => ({ ...point, visibility: 0.05 }));
    expect(landmarksHavePerson(hidden)).toBe(false);
    expect(landmarksToJointAngles(hidden)).toEqual(POSES.stand);
  });

  it("treats a downward vector as zero degrees in SVG space", () => {
    expect(angleFromDown({ x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(0, 5);
  });
});
