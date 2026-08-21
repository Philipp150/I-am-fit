import { POSES, type JointAngles } from "./poses";

/** MediaPipe BlazePose landmark indices. */
export const MP = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

export type PoseLandmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

const CORE = [
  MP.LEFT_SHOULDER,
  MP.RIGHT_SHOULDER,
  MP.LEFT_HIP,
  MP.RIGHT_HIP,
  MP.LEFT_KNEE,
  MP.RIGHT_KNEE,
] as const;

export const MIN_CORE_VISIBLE = 4;
export const VISIBILITY_MIN = 0.35;

function vis(lm: PoseLandmark | undefined): number {
  if (!lm) return 0;
  return typeof lm.visibility === "number" ? lm.visibility : 1;
}

function pt(landmarks: PoseLandmark[], index: number): PoseLandmark | undefined {
  const lm = landmarks[index];
  if (!lm || !Number.isFinite(lm.x) || !Number.isFinite(lm.y)) return undefined;
  return lm;
}

function mid(a: PoseLandmark, b: PoseLandmark): PoseLandmark {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, visibility: Math.min(vis(a), vis(b)) };
}

/** Degrees from +Y (down, SVG) toward +X (clockwise). */
export function angleFromDown(from: PoseLandmark, to: PoseLandmark): number {
  return (Math.atan2(to.x - from.x, to.y - from.y) * 180) / Math.PI;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function landmarksHavePerson(landmarks: PoseLandmark[] | null | undefined): boolean {
  if (!landmarks || landmarks.length < 25) return false;
  let visible = 0;
  for (const index of CORE) {
    if (vis(pt(landmarks, index)) >= VISIBILITY_MIN) visible += 1;
  }
  return visible >= MIN_CORE_VISIBLE;
}

function boneAngle(
  parentWorld: number,
  from: PoseLandmark | undefined,
  to: PoseLandmark | undefined,
  fallback: number,
): number {
  if (!from || !to || vis(from) < VISIBILITY_MIN || vis(to) < VISIBILITY_MIN) return fallback;
  return angleFromDown(from, to) - parentWorld;
}

/**
 * Map a MediaPipe pose (normalized image coords, y down) onto the StickFigure FK skeleton.
 */
export function landmarksToJointAngles(landmarks: PoseLandmark[], previous?: JointAngles): JointAngles {
  const base = previous ?? POSES.stand;
  if (!landmarksHavePerson(landmarks)) return base;

  const leftHip = pt(landmarks, MP.LEFT_HIP);
  const rightHip = pt(landmarks, MP.RIGHT_HIP);
  const leftShoulder = pt(landmarks, MP.LEFT_SHOULDER);
  const rightShoulder = pt(landmarks, MP.RIGHT_SHOULDER);
  if (!leftHip || !rightHip || !leftShoulder || !rightShoulder) return base;

  const hip = mid(leftHip, rightHip);
  const shoulder = mid(leftShoulder, rightShoulder);

  const spineFromVertical = (Math.atan2(shoulder.x - hip.x, hip.y - shoulder.y) * 180) / Math.PI;
  const horizontal = Math.abs(spineFromVertical) > 55;
  const bodyTilt = horizontal ? spineFromVertical : 0;
  const torso = horizontal ? 0 : spineFromVertical;
  const parentTorso = bodyTilt + torso;

  const leftElbow = pt(landmarks, MP.LEFT_ELBOW);
  const rightElbow = pt(landmarks, MP.RIGHT_ELBOW);
  const leftWrist = pt(landmarks, MP.LEFT_WRIST);
  const rightWrist = pt(landmarks, MP.RIGHT_WRIST);
  const leftIndex = pt(landmarks, MP.LEFT_INDEX);
  const rightIndex = pt(landmarks, MP.RIGHT_INDEX);
  const leftKnee = pt(landmarks, MP.LEFT_KNEE);
  const rightKnee = pt(landmarks, MP.RIGHT_KNEE);
  const leftAnkle = pt(landmarks, MP.LEFT_ANKLE);
  const rightAnkle = pt(landmarks, MP.RIGHT_ANKLE);
  const nose = pt(landmarks, MP.NOSE);

  const leftThigh = boneAngle(bodyTilt, leftHip, leftKnee, base.leftThigh);
  const rightThigh = boneAngle(bodyTilt, rightHip, rightKnee, base.rightThigh);
  const leftShin = leftKnee && leftAnkle
    ? boneAngle(bodyTilt + leftThigh, leftKnee, leftAnkle, base.leftShin)
    : base.leftShin;
  const rightShin = rightKnee && rightAnkle
    ? boneAngle(bodyTilt + rightThigh, rightKnee, rightAnkle, base.rightShin)
    : base.rightShin;

  const leftUpperArm = boneAngle(parentTorso, leftShoulder, leftElbow, base.leftUpperArm);
  const rightUpperArm = boneAngle(parentTorso, rightShoulder, rightElbow, base.rightUpperArm);
  const leftForearm = leftElbow && leftWrist
    ? boneAngle(parentTorso + leftUpperArm, leftElbow, leftWrist, base.leftForearm)
    : base.leftForearm;
  const rightForearm = rightElbow && rightWrist
    ? boneAngle(parentTorso + rightUpperArm, rightElbow, rightWrist, base.rightForearm)
    : base.rightForearm;
  const leftHand = leftWrist && leftIndex
    ? boneAngle(parentTorso + leftUpperArm + leftForearm, leftWrist, leftIndex, base.leftHand)
    : base.leftHand;
  const rightHand = rightWrist && rightIndex
    ? boneAngle(parentTorso + rightUpperArm + rightForearm, rightWrist, rightIndex, base.rightHand)
    : base.rightHand;

  let neck = base.neck;
  let headShiftX = base.headShiftX;
  let headShiftY = base.headShiftY;
  if (nose && vis(nose) >= VISIBILITY_MIN) {
    neck = angleFromDown(shoulder, nose) - parentTorso;
    headShiftX = clamp((nose.x - shoulder.x) * 80, -18, 18);
    headShiftY = clamp((nose.y - (shoulder.y - 0.12)) * 80, -16, 16);
  }

  const shoulderWidth = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y);
  const hipWidth = Math.hypot(leftHip.x - rightHip.x, leftHip.y - rightHip.y);
  const chest = clamp((shoulderWidth / Math.max(hipWidth, 0.02) - 1.35) * 8, -8, 12);

  const expectedShoulderY = hip.y - 0.22;
  const shoulderLift = clamp((expectedShoulderY - shoulder.y) * 80, -10, 18);

  return {
    hipX: clamp(100 + (hip.x - 0.5) * 90, 72, 128),
    hipY: clamp(148 + (hip.y - 0.55) * 90, 124, 204),
    bodyTilt: clamp(bodyTilt, -120, 120),
    torso: clamp(torso, -100, 110),
    neck: clamp(neck, -50, 50),
    jaw: 0,
    leftUpperArm: clamp(leftUpperArm, -200, 200),
    leftForearm: clamp(leftForearm, -160, 160),
    leftHand: clamp(leftHand, -90, 90),
    rightUpperArm: clamp(rightUpperArm, -200, 200),
    rightForearm: clamp(rightForearm, -160, 160),
    rightHand: clamp(rightHand, -90, 90),
    leftThigh: clamp(leftThigh, -120, 120),
    leftShin: clamp(leftShin, -120, 120),
    rightThigh: clamp(rightThigh, -120, 120),
    rightShin: clamp(rightShin, -120, 120),
    shoulderLift: roundish(shoulderLift),
    headShiftX: roundish(headShiftX),
    headShiftY: roundish(headShiftY),
    chest: roundish(chest),
  };
}

function roundish(value: number): number {
  return Math.round(value * 10) / 10;
}

export function standingLandmarks(): PoseLandmark[] {
  const points: PoseLandmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  const set = (index: number, x: number, y: number) => {
    points[index] = { x, y, visibility: 0.99 };
  };
  set(MP.NOSE, 0.5, 0.16);
  set(MP.LEFT_SHOULDER, 0.38, 0.28);
  set(MP.RIGHT_SHOULDER, 0.62, 0.28);
  set(MP.LEFT_ELBOW, 0.34, 0.42);
  set(MP.RIGHT_ELBOW, 0.66, 0.42);
  set(MP.LEFT_WRIST, 0.32, 0.54);
  set(MP.RIGHT_WRIST, 0.68, 0.54);
  set(MP.LEFT_INDEX, 0.31, 0.58);
  set(MP.RIGHT_INDEX, 0.69, 0.58);
  set(MP.LEFT_HIP, 0.43, 0.52);
  set(MP.RIGHT_HIP, 0.57, 0.52);
  set(MP.LEFT_KNEE, 0.44, 0.72);
  set(MP.RIGHT_KNEE, 0.56, 0.72);
  set(MP.LEFT_ANKLE, 0.44, 0.9);
  set(MP.RIGHT_ANKLE, 0.56, 0.9);
  return points;
}
