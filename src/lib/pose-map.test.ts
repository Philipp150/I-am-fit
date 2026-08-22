import { describe, expect, it } from "vitest";
import { POSES } from "./poses";
import {
  applyClipOrientation,
  circularMeanDeg,
  dropOrientationOutliers,
  FIGURE_HIP_X,
  FIGURE_HIP_Y,
  landmarkConfidence,
  landmarksHavePerson,
  landmarksToJointAngles,
  mapLandmarksToFrame,
  normalizeDeg,
  median,
  normalizeHipTravel,
  normalizeNeckBias,
  standingLandmarks,
  svgAngleDown,
  svgAngleUp,
  MP,
  type MappedFrame,
  type PoseLandmark,
} from "./pose-map";

function withPoint(base: PoseLandmark[], index: number, x: number, y: number): PoseLandmark[] {
  const next = base.map((point) => ({ ...point }));
  next[index] = { x, y, visibility: 0.99 };
  return next;
}

/** Where a bone drawn along +Y ends up after SVG `rotate(deg)`, in screen coordinates (y down). */
function boneTip(deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: -Math.sin(rad), y: Math.cos(rad) };
}

describe("SVG angle convention", () => {
  it("returns zero for a bone that points straight down", () => {
    expect(svgAngleDown({ x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(0, 5);
    expect(svgAngleUp({ x: 0, y: 0 }, { x: 0, y: -1 })).toBeCloseTo(0, 5);
  });

  it("matches what SVG rotate actually draws, so the figure is not mirrored", () => {
    for (const target of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0.6, y: -0.8 },
      { x: -0.5, y: 0.87 },
    ]) {
      const length = Math.hypot(target.x, target.y);
      const tip = boneTip(svgAngleDown({ x: 0, y: 0 }, target));
      expect(tip.x).toBeCloseTo(target.x / length, 5);
      expect(tip.y).toBeCloseTo(target.y / length, 5);
    }
  });

  it("wraps angles into a half-open turn", () => {
    expect(normalizeDeg(370)).toBeCloseTo(10, 5);
    expect(normalizeDeg(-190)).toBeCloseTo(170, 5);
    expect(normalizeDeg(180)).toBeCloseTo(180, 5);
  });
});

describe("MediaPipe landmarks to mannequin", () => {
  it("maps a standing person to an upright figure close to the stand pose", () => {
    const pose = landmarksToJointAngles(standingLandmarks());
    expect(landmarksHavePerson(standingLandmarks())).toBe(true);
    expect(Math.abs(pose.bodyTilt)).toBeLessThan(12);
    expect(Math.abs(pose.torso)).toBeLessThan(18);
    expect(Math.abs(pose.neck)).toBeLessThan(10);
    expect(Math.abs(pose.leftThigh)).toBeLessThan(25);
    expect(Math.abs(pose.rightThigh)).toBeLessThan(25);
  });

  it("keeps child bones near zero instead of pinning them to their clamp", () => {
    const pose = landmarksToJointAngles(standingLandmarks());
    expect(Math.abs(pose.leftForearm)).toBeLessThan(45);
    expect(Math.abs(pose.rightForearm)).toBeLessThan(45);
    expect(Math.abs(pose.leftShin)).toBeLessThan(30);
    expect(Math.abs(pose.rightShin)).toBeLessThan(30);
  });

  it("puts a raised arm on the same side of the picture as the video shows it", () => {
    // MediaPipe RIGHT_* is the person's right, which a camera shows on the left of the frame.
    const raised = withPoint(
      withPoint(standingLandmarks(), MP.RIGHT_ELBOW, 0.64, 0.16),
      MP.RIGHT_WRIST,
      0.66,
      0.05,
    );
    const pose = landmarksToJointAngles(raised, { aspect: 1 });
    // The figure's screen-left arm is `left*`; its tip has to point up on the screen-left half.
    const tip = boneTip(pose.torso + pose.leftUpperArm);
    expect(tip.y).toBeLessThan(-0.5);
    expect(pose.rightUpperArm).toBeGreaterThan(0);
    expect(Math.abs(pose.leftUpperArm)).toBeGreaterThan(Math.abs(pose.rightUpperArm));
  });

  it("leans the torso to the same side as the person leans on screen", () => {
    const leaning = withPoint(
      withPoint(standingLandmarks(), MP.LEFT_SHOULDER, 0.5, 0.3),
      MP.RIGHT_SHOULDER,
      0.74,
      0.3,
    );
    const pose = landmarksToJointAngles(leaning, { aspect: 1 });
    expect(pose.torso).toBeGreaterThan(4);
  });

  it("corrects for widescreen and portrait framing instead of skewing angles", () => {
    const diagonal = withPoint(standingLandmarks(), MP.RIGHT_ELBOW, 0.62 + 0.1 / (16 / 9), 0.38);
    const wide = landmarksToJointAngles(diagonal, { aspect: 16 / 9 });
    const square = landmarksToJointAngles(
      withPoint(standingLandmarks(), MP.RIGHT_ELBOW, 0.62 + 0.1, 0.38),
      { aspect: 1 },
    );
    expect(wide.leftUpperArm).toBeCloseTo(square.leftUpperArm, 1);
  });

  it("rejects empty or low-visibility detections and keeps the previous pose", () => {
    expect(landmarksHavePerson([])).toBe(false);
    expect(landmarksHavePerson(undefined)).toBe(false);
    const hidden = standingLandmarks().map((point) => ({ ...point, visibility: 0.05 }));
    expect(landmarksHavePerson(hidden)).toBe(false);
    expect(mapLandmarksToFrame(hidden)).toBeNull();
    expect(landmarksToJointAngles(hidden)).toEqual(POSES.stand);
    expect(landmarksToJointAngles(hidden, { previous: POSES.squat })).toEqual(POSES.squat);
    expect(landmarkConfidence(hidden)).toBeLessThan(0.2);
    expect(landmarkConfidence(standingLandmarks())).toBeGreaterThan(0.9);
  });

  it("relaxes a joint that disappears instead of freezing it at a stray angle", () => {
    const armGone = standingLandmarks().map((point, index) =>
      index === MP.RIGHT_ELBOW || index === MP.RIGHT_WRIST ? { ...point, visibility: 0.02 } : point,
    );
    const stray = { ...landmarksToJointAngles(standingLandmarks(), {}), leftUpperArm: 150, leftForearm: -120 };

    const next = landmarksToJointAngles(armGone, { previous: stray });
    expect(Math.abs(next.leftUpperArm)).toBeLessThan(150);
    // The other arm is still visible, so it keeps being measured rather than drifting.
    expect(next.rightUpperArm).toBeCloseTo(stray.rightUpperArm, 0);

    let drifting = stray;
    let previousGap = Math.abs(drifting.leftUpperArm - POSES.stand.leftUpperArm);
    for (let i = 0; i < 60; i++) {
      drifting = landmarksToJointAngles(armGone, { previous: drifting });
      const gap = Math.abs(drifting.leftUpperArm - POSES.stand.leftUpperArm);
      expect(gap).toBeLessThanOrEqual(previousGap);
      previousGap = gap;
    }
    expect(drifting.leftUpperArm).toBe(POSES.stand.leftUpperArm);
    expect(drifting.leftForearm).toBe(POSES.stand.leftForearm);
  });

  it("leaves no leftover shrug, head shift or chest bias in a track frame", () => {
    const pose = landmarksToJointAngles(standingLandmarks());
    expect(pose.shoulderLift).toBe(0);
    expect(pose.headShiftX).toBe(0);
    expect(pose.headShiftY).toBe(0);
    expect(pose.chest).toBe(0);
    expect(pose.jaw).toBe(0);
  });
});

describe("clip orientation", () => {
  function spineFrame(spine: number, confidence = 1): MappedFrame {
    return {
      pose: { ...POSES.stand },
      spine,
      leftThighWorld: spine + 10,
      rightThighWorld: spine - 10,
      hipX: 0.5,
      hipY: 0.5,
      torsoLen: 0.24,
      confidence,
    };
  }

  it("averages angles as directions, not as numbers", () => {
    expect(Math.abs(circularMeanDeg([{ deg: 179 }, { deg: -179 }]))).toBeCloseTo(180, 3);
    expect(circularMeanDeg([{ deg: 10 }, { deg: -10 }])).toBeCloseTo(0, 3);
  });

  it("throws away frames where the detector flipped the person upside down", () => {
    const frames = [
      spineFrame(2),
      spineFrame(-1),
      spineFrame(178),
      spineFrame(-176),
      spineFrame(3),
      spineFrame(0),
    ];
    const { kept, dominant } = dropOrientationOutliers(frames);
    expect(kept).toHaveLength(4);
    expect(Math.abs(dominant)).toBeLessThan(10);
  });

  it("keeps a clip that is lying down from start to end", () => {
    const frames = [spineFrame(88), spineFrame(92), spineFrame(85), spineFrame(95)];
    const { kept, dominant } = dropOrientationOutliers(frames);
    expect(kept).toHaveLength(4);
    expect(dominant).toBeGreaterThan(80);
  });

  it("takes the camera's constant head tilt out but keeps the head moving", () => {
    const frames = [30, 34, 32, 46, 18].map((neck) => {
      const entry = spineFrame(0);
      entry.pose = { ...entry.pose, neck };
      return entry;
    });
    normalizeNeckBias(frames);
    const necks = frames.map((frame) => frame.pose.neck);
    expect(median(necks)).toBeCloseTo(0, 5);
    // The 14 degrees the head actually moved between those two frames survive.
    expect(necks[3] - necks[4]).toBeCloseTo(28, 1);
  });

  it("leaves a clip alone when the head already sits in line with the torso", () => {
    const frames = [1, -1, 0].map((neck) => {
      const entry = spineFrame(0);
      entry.pose = { ...entry.pose, neck };
      return entry;
    });
    normalizeNeckBias(frames);
    expect(frames.map((frame) => frame.pose.neck)).toEqual([1, -1, 0]);
  });

  it("decides the tilt once per clip so an upright figure never flips mid clip", () => {
    const frames = [spineFrame(4), spineFrame(-6), spineFrame(9)];
    applyClipOrientation(frames, 2);
    expect(frames.map((frame) => frame.pose.bodyTilt)).toEqual([0, 0, 0]);
    expect(frames[1].pose.torso).toBeCloseTo(-6, 1);
    expect(frames[1].pose.leftThigh).toBeCloseTo(4, 1);
  });

  it("moves a lying clip into the root group so the legs turn with the body", () => {
    const frames = [spineFrame(88), spineFrame(92)];
    applyClipOrientation(frames, 90);
    expect(frames[0].pose.bodyTilt).toBeCloseTo(90, 1);
    expect(frames[0].pose.torso).toBeCloseTo(-2, 1);
    expect(frames[0].pose.leftThigh).toBeCloseTo(8, 1);
  });
});

describe("hip travel normalization", () => {
  function frame(hipX: number, hipY: number, torsoLen = 0.24): MappedFrame {
    return {
      pose: { ...POSES.stand },
      spine: 0,
      leftThighWorld: 0,
      rightThighWorld: 0,
      hipX,
      hipY,
      torsoLen,
      confidence: 1,
    };
  }

  it("centres the resting hip on the drawing and scales travel by body size", () => {
    const frames = [frame(0.8, 0.5), frame(0.8, 0.5), frame(0.8, 0.62)];
    normalizeHipTravel(frames);
    expect(frames[0].pose.hipX).toBeCloseTo(FIGURE_HIP_X, 5);
    expect(frames[0].pose.hipY).toBeCloseTo(FIGURE_HIP_Y, 5);
    expect(frames[2].pose.hipY).toBeGreaterThan(FIGURE_HIP_Y + 20);
  });

  it("gives the same figure travel for a person filmed twice as far away", () => {
    const near = [frame(0.5, 0.5, 0.3), frame(0.5, 0.65, 0.3)];
    const far = [frame(0.5, 0.5, 0.15), frame(0.5, 0.575, 0.15)];
    normalizeHipTravel(near);
    normalizeHipTravel(far);
    expect(near[1].pose.hipY).toBeCloseTo(far[1].pose.hipY, 1);
  });

  it("stays inside the drawing even when the camera pans", () => {
    const frames = [frame(0.1, 0.1), frame(0.9, 0.95), frame(0.5, 0.5)];
    normalizeHipTravel(frames);
    for (const entry of frames) {
      expect(entry.pose.hipX).toBeGreaterThanOrEqual(72);
      expect(entry.pose.hipX).toBeLessThanOrEqual(128);
      expect(entry.pose.hipY).toBeGreaterThanOrEqual(112);
      expect(entry.pose.hipY).toBeLessThanOrEqual(212);
    }
  });
});
