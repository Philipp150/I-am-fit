import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { distance, figureBounds, figurePoints, fitsViewBox, VIEW_BOX } from "./pose-geometry";
import { mirrorPose, POSE_IDS, POSE_LABELS, POSES } from "./poses";
import type { PoseId } from "./types";

/**
 * These tests measure the drawn figure, not the numbers that were typed in. A keyframe whose name
 * promises a tilt to the left has to put the head to the left of where standing puts it, otherwise
 * the pose picker shows 50 little figures that all claim something they do not do.
 */

const stand = figurePoints(POSES.stand);

function points(id: PoseId) {
  return figurePoints(POSES[id]);
}

/** Pairs that must be exact mirror images of each other. */
const MIRRORED: Array<[PoseId, PoseId]> = [
  ["neckLeft", "neckRight"],
  ["jawLeft", "jawRight"],
  ["walkLeft", "walkRight"],
  ["twist", "twistOther"],
  ["tree", "treeOther"],
  ["lunge", "lungeOther"],
  ["warrior", "warriorOther"],
  ["hipOpen", "hipOpenOther"],
  ["calfWall", "calfWallOther"],
];

describe("authored poses", () => {
  it("keeps labels and keyframes in sync", () => {
    expect([...POSE_IDS].sort()).toEqual(Object.keys(POSE_LABELS).sort());
    expect([...POSE_IDS].sort()).toEqual(Object.keys(POSES).sort());
  });

  it("draws every pose inside the picture instead of clipping heads and feet", () => {
    const outside = POSE_IDS.filter((id) => !fitsViewBox(POSES[id])).map((id) => {
      const bounds = figureBounds(POSES[id]);
      return `${id} x[${Math.round(bounds.minX)},${Math.round(bounds.maxX)}] y[${Math.round(bounds.minY)},${Math.round(bounds.maxY)}]`;
    });
    expect(outside).toEqual([]);
    expect(VIEW_BOX.width).toBeGreaterThan(240);
  });

  it("keeps the poses distinguishable from each other", () => {
    const seen = new Map<string, PoseId>();
    for (const id of POSE_IDS) {
      const key = Object.values(points(id))
        .map((point) => `${Math.round(point.x)},${Math.round(point.y)}`)
        .join("|");
      expect(seen.get(key), `${id} draws the same figure as ${seen.get(key)}`).toBeUndefined();
      seen.set(key, id);
    }
  });

  it("does not cross the legs of a front-facing figure", () => {
    for (const id of POSE_IDS) {
      const pose = POSES[id];
      if (Math.abs(pose.bodyTilt) >= 30) continue;
      const p = points(id);
      expect(p.leftFoot.x, `${id} crosses its feet`).toBeLessThan(p.rightFoot.x + 6);
      expect(p.leftKnee.x, `${id} crosses its knees`).toBeLessThan(p.rightKnee.x + 6);
    }
  });

  it("keeps standing feet on the floor", () => {
    const standing: PoseId[] = ["stand", "reachUp", "shrug", "shouldersDown", "neckLeft", "neckRight", "chestOpen", "heart", "standInhale", "standExhale", "shoulderForward", "wristsFlex", "wristsExtend", "shakeOut", "neckForward", "neckBack", "neckTilt"];
    for (const id of standing) {
      const p = points(id);
      expect(p.leftFoot.y, id).toBeGreaterThan(240);
      expect(p.rightFoot.y, id).toBeGreaterThan(240);
    }
  });

  it("tilts the neck toward the side its name promises", () => {
    // "links" is the screen-left side, the same mirror convention the video mapping uses.
    expect(points("neckLeft").head.x).toBeLessThan(stand.head.x - 12);
    expect(points("neckRight").head.x).toBeGreaterThan(stand.head.x + 12);
    expect(points("neckTilt").head.x).toBeLessThan(stand.head.x - 8);
    // A tilt moves the head sideways without walking the figure off its feet.
    expect(points("neckLeft").hip.x).toBe(stand.hip.x);
  });

  it("sinks the head forward and lifts it back", () => {
    expect(points("neckForward").head.y).toBeGreaterThan(stand.head.y + 8);
    expect(points("neckBack").head.y).toBeLessThan(stand.head.y - 8);
  });

  it("lifts the shoulders for a shrug and drops them for the release", () => {
    expect(points("shrug").leftShoulder.y).toBeLessThan(stand.leftShoulder.y - 10);
    expect(points("shrug").rightShoulder.y).toBeLessThan(stand.rightShoulder.y - 10);
    expect(points("shouldersDown").leftShoulder.y).toBeGreaterThan(stand.leftShoulder.y + 4);
    // A shrug lifts the shoulders, it does not raise the arms.
    expect(Math.abs(POSES.shrug.leftUpperArm)).toBeLessThan(40);
    expect(points("shoulderForward").leftHand.x).toBeGreaterThan(stand.leftHand.x + 10);
  });

  it("steps with the leg its name promises and mirrors the other side", () => {
    const left = points("walkLeft");
    const right = points("walkRight");
    expect(left.leftFoot.y).toBeLessThan(left.rightFoot.y - 8);
    expect(right.rightFoot.y).toBeLessThan(right.leftFoot.y - 8);
    expect(left.leftKnee.y).toBeLessThan(stand.leftKnee.y - 8);
  });

  it("slides the jaw sideways and opens the mouth when it should", () => {
    expect(points("jawLeft").head.x).toBeLessThan(points("jawRight").head.x - 20);
    expect(POSES.jawSoft.jaw).toBeGreaterThan(0);
    expect(POSES.jawLeft.jaw).toBeGreaterThan(0);
    expect(POSES.stand.jaw).toBe(0);
  });

  it("opens the chest instead of folding the arms over it", () => {
    const open = points("chestOpen");
    expect(open.leftHand.x).toBeLessThan(open.leftShoulder.x - 30);
    expect(open.rightHand.x).toBeGreaterThan(open.rightShoulder.x + 30);
    expect(open.leftHand.y).toBeLessThan(stand.leftHand.y - 40);
  });

  it("puts a hand on the chest for the heart pose and both hands on the belly for breath", () => {
    expect(distance(points("heart").rightHand, points("heart").chest)).toBeLessThan(30);
    for (const id of ["breathe", "breatheIn", "breatheOut"] as PoseId[]) {
      const p = points(id);
      expect(Math.abs(p.leftHand.x - p.hip.x), id).toBeLessThan(35);
      expect(Math.abs(p.rightHand.x - p.hip.x), id).toBeLessThan(35);
      expect(p.leftHand.y, id).toBeGreaterThan(p.chest.y);
    }
  });

  it("sits with the hips down and the feet on the floor", () => {
    for (const id of ["sit", "breathe", "twist", "jawSoft", "gazeFar", "hipOpen", "breatheIn"] as PoseId[]) {
      const p = points(id);
      expect(p.hip.y, id).toBeGreaterThan(stand.hip.y + 20);
      expect(p.head.y, id).toBeGreaterThan(stand.head.y + 20);
      expect(p.leftFoot.y, id).toBeGreaterThan(p.hip.y);
    }
  });

  it("does not sit down for standing or lying breath", () => {
    expect(POSES.standInhale.hipY).toBeLessThan(160);
    expect(Math.abs(POSES.standExhale.leftThigh)).toBeLessThan(40);
    for (const id of ["lie", "lieInhale", "lieHold", "lieExhale", "kneesUp"] as PoseId[]) {
      const p = points(id);
      expect(Math.abs(POSES[id].bodyTilt), id).toBeGreaterThan(70);
      // Lying means head and hips at about the same height, head to one side of them.
      expect(Math.abs(p.head.y - p.hip.y), id).toBeLessThan(45);
      expect(p.head.x, id).toBeLessThan(p.hip.x - 60);
    }
    expect(points("kneesUp").leftKnee.y).toBeLessThan(points("kneesUp").hip.y - 20);
  });

  it("rounds the back for the cat and dips it for the cow", () => {
    expect(points("cat").head.y).toBeGreaterThan(points("cow").head.y + 40);
    for (const id of ["cat", "cow", "plank", "cobra", "child"] as PoseId[]) {
      const p = points(id);
      expect(p.head.x, id).toBeLessThan(p.hip.x - 40);
    }
    // A plank rests on its hands and feet, not in mid-air.
    expect(points("plank").leftHand.y).toBeGreaterThan(230);
    expect(points("plank").leftFoot.y).toBeGreaterThan(230);
  });

  it("builds every lateral twin with mirrorPose so the sides cannot drift apart", () => {
    for (const [a, b] of MIRRORED) {
      expect(mirrorPose(POSES[a]), `${b} is not the mirror of ${a}`).toEqual(POSES[b]);
      expect(mirrorPose(mirrorPose(POSES[a])), `${a} does not survive two mirrors`).toEqual(POSES[a]);
      const left = figurePoints(POSES[a]);
      const right = figurePoints(POSES[b]);
      expect(Math.round(left.head.x + right.head.x)).toBe(2 * POSES.stand.hipX);
      expect(Math.round(left.leftFoot.x + right.rightFoot.x)).toBe(2 * POSES.stand.hipX);
    }
  });

  it("keeps a shrug, a jaw and a sunken head untouched by mirroring", () => {
    const mirrored = mirrorPose(POSES.shrug);
    expect(mirrored.shoulderLift).toBe(POSES.shrug.shoulderLift);
    expect(mirrored.headShiftY).toBe(POSES.shrug.headShiftY);
    expect(mirrorPose(POSES.jawSoft).jaw).toBe(POSES.jawSoft.jaw);
  });

  it("draws the figure from the shared geometry instead of its own copy of the measurements", () => {
    const figure = readFileSync(resolve(__dirname, "../components/StickFigure.tsx"), "utf8");
    expect(figure).toContain("FIGURE");
    expect(figure).toContain("viewBoxAttr()");
    expect(figure).not.toContain('viewBox="0 0 200 280"');
  });
});
