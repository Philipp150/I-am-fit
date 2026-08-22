import { POSES, type JointAngles } from "./poses";

/** MediaPipe BlazePose landmark indices. */
export const MP = {
  NOSE: 0,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
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

/** StickFigure geometry the mapper has to match (see `components/StickFigure.tsx`). */
export const FIGURE_TORSO = 68;
export const FIGURE_HIP_X = 100;
export const FIGURE_HIP_Y = 148;

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

const DEG = 180 / Math.PI;

/**
 * The mannequin's `left*` joints are drawn on the screen-left half of the SVG, and in a normal
 * camera image the screen-left half shows the person's right side. Feeding MediaPipe's right-side
 * landmarks into the `left*` slots makes the figure copy what the video shows instead of flipping it.
 */
const SCREEN_LEFT = {
  shoulder: MP.RIGHT_SHOULDER,
  elbow: MP.RIGHT_ELBOW,
  wrist: MP.RIGHT_WRIST,
  index: MP.RIGHT_INDEX,
  hip: MP.RIGHT_HIP,
  knee: MP.RIGHT_KNEE,
  ankle: MP.RIGHT_ANKLE,
} as const;

const SCREEN_RIGHT = {
  shoulder: MP.LEFT_SHOULDER,
  elbow: MP.LEFT_ELBOW,
  wrist: MP.LEFT_WRIST,
  index: MP.LEFT_INDEX,
  hip: MP.LEFT_HIP,
  knee: MP.LEFT_KNEE,
  ankle: MP.LEFT_ANKLE,
} as const;

type Side = {
  readonly shoulder: number;
  readonly elbow: number;
  readonly wrist: number;
  readonly index: number;
  readonly hip: number;
  readonly knee: number;
  readonly ankle: number;
};

type Pt = { x: number; y: number; v: number };

function vis(lm: PoseLandmark | undefined): number {
  if (!lm) return 0;
  return typeof lm.visibility === "number" ? lm.visibility : 1;
}

function pt(landmarks: PoseLandmark[], index: number, aspect: number): Pt | undefined {
  const lm = landmarks[index];
  if (!lm || !Number.isFinite(lm.x) || !Number.isFinite(lm.y)) return undefined;
  return { x: lm.x * aspect, y: lm.y, v: vis(lm) };
}

function seen(point: Pt | undefined): point is Pt {
  return Boolean(point && point.v >= VISIBILITY_MIN);
}

function mid(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, v: Math.min(a.v, b.v) };
}

export function normalizeDeg(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  let value = deg % 360;
  if (value > 180) value -= 360;
  if (value <= -180) value += 360;
  return value;
}

/**
 * SVG `rotate(a)` turns clockwise on screen because y points down, so a bone drawn along +Y ends up
 * at `(-sin a, cos a)`. That is the inverse sign of `atan2(dx, dy)`; getting it wrong mirrors the
 * whole figure and makes every child bone (forearm, shin) drift into its clamp.
 */
export function svgAngleDown(from: { x: number; y: number }, to: { x: number; y: number }): number {
  return normalizeDeg(Math.atan2(-(to.x - from.x), to.y - from.y) * DEG);
}

/** Same for a bone drawn along -Y, which is how the neck and the torso are built. */
export function svgAngleUp(from: { x: number; y: number }, to: { x: number; y: number }): number {
  return normalizeDeg(Math.atan2(to.x - from.x, -(to.y - from.y)) * DEG);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return Math.min(max, Math.max(min, 0));
  return Math.min(max, Math.max(min, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function landmarksHavePerson(landmarks: PoseLandmark[] | null | undefined): boolean {
  if (!landmarks || landmarks.length < 25) return false;
  let visible = 0;
  for (const index of CORE) {
    if (vis(landmarks[index]) >= VISIBILITY_MIN) visible += 1;
  }
  return visible >= MIN_CORE_VISIBLE;
}

export function landmarkConfidence(landmarks: PoseLandmark[] | null | undefined): number {
  if (!landmarks || landmarks.length < 25) return 0;
  let sum = 0;
  for (const index of CORE) sum += Math.min(1, Math.max(0, vis(landmarks[index])));
  return sum / CORE.length;
}

export type MapOptions = {
  previous?: JointAngles;
  /** Video width / height. Normalized landmarks are squeezed per axis, so angles need this. */
  aspect?: number;
};

/**
 * One analyzed video frame. Angles are ready for the mannequin; the hip fields stay in
 * aspect-corrected image units so the whole clip can be re-centred and re-scaled afterwards.
 */
export type MappedFrame = {
  pose: JointAngles;
  hipX: number;
  hipY: number;
  torsoLen: number;
  confidence: number;
};

function limbChain(
  landmarks: PoseLandmark[],
  aspect: number,
  side: Side,
  parentWorld: number,
  base: { upper: number; fore: number; hand: number },
): { upper: number; fore: number; hand: number } {
  const shoulder = pt(landmarks, side.shoulder, aspect);
  const elbow = pt(landmarks, side.elbow, aspect);
  const wrist = pt(landmarks, side.wrist, aspect);
  const finger = pt(landmarks, side.index, aspect);

  let upper = base.upper;
  let upperWorld = parentWorld + base.upper;
  if (seen(shoulder) && seen(elbow)) {
    upperWorld = svgAngleDown(shoulder, elbow);
    upper = normalizeDeg(upperWorld - parentWorld);
  }

  let fore = base.fore;
  let foreWorld = upperWorld + base.fore;
  if (seen(elbow) && seen(wrist)) {
    foreWorld = svgAngleDown(elbow, wrist);
    fore = normalizeDeg(foreWorld - upperWorld);
  }

  let hand = base.hand;
  if (seen(wrist) && seen(finger)) {
    hand = normalizeDeg(svgAngleDown(wrist, finger) - foreWorld);
  }

  return {
    upper: clamp(upper, -180, 180),
    fore: clamp(fore, -170, 170),
    hand: clamp(hand, -90, 90),
  };
}

function legChain(
  landmarks: PoseLandmark[],
  aspect: number,
  side: Side,
  parentWorld: number,
  base: { thigh: number; shin: number },
): { thigh: number; shin: number } {
  const hip = pt(landmarks, side.hip, aspect);
  const knee = pt(landmarks, side.knee, aspect);
  const ankle = pt(landmarks, side.ankle, aspect);

  let thigh = base.thigh;
  let thighWorld = parentWorld + base.thigh;
  if (seen(hip) && seen(knee)) {
    thighWorld = svgAngleDown(hip, knee);
    thigh = normalizeDeg(thighWorld - parentWorld);
  }

  let shin = base.shin;
  if (seen(knee) && seen(ankle)) {
    shin = normalizeDeg(svgAngleDown(knee, ankle) - thighWorld);
  }

  return { thigh: clamp(thigh, -170, 170), shin: clamp(shin, -170, 170) };
}

/** Map one MediaPipe detection onto the StickFigure FK skeleton. `null` means "no usable person". */
export function mapLandmarksToFrame(landmarks: PoseLandmark[], options: MapOptions = {}): MappedFrame | null {
  if (!landmarksHavePerson(landmarks)) return null;
  const aspect = Number.isFinite(options.aspect) && (options.aspect as number) > 0 ? (options.aspect as number) : 1;
  const base = options.previous ?? POSES.stand;

  const leftHip = pt(landmarks, SCREEN_LEFT.hip, aspect);
  const rightHip = pt(landmarks, SCREEN_RIGHT.hip, aspect);
  const leftShoulder = pt(landmarks, SCREEN_LEFT.shoulder, aspect);
  const rightShoulder = pt(landmarks, SCREEN_RIGHT.shoulder, aspect);
  if (!leftHip || !rightHip || !leftShoulder || !rightShoulder) return null;

  const hip = mid(leftHip, rightHip);
  const shoulder = mid(leftShoulder, rightShoulder);
  const torsoLen = Math.hypot(shoulder.x - hip.x, shoulder.y - hip.y);
  if (!(torsoLen > 1e-4)) return null;

  // The spine angle is split so that a lying body also turns the legs (bodyTilt is the root group).
  const spine = svgAngleUp(hip, shoulder);
  const bodyTilt = Math.abs(spine) > 55 ? clamp(spine, -150, 150) : 0;
  const torso = clamp(normalizeDeg(spine - bodyTilt), -100, 100);
  const torsoWorld = bodyTilt + torso;

  const left = limbChain(landmarks, aspect, SCREEN_LEFT, torsoWorld, {
    upper: base.leftUpperArm,
    fore: base.leftForearm,
    hand: base.leftHand ?? 0,
  });
  const right = limbChain(landmarks, aspect, SCREEN_RIGHT, torsoWorld, {
    upper: base.rightUpperArm,
    fore: base.rightForearm,
    hand: base.rightHand ?? 0,
  });
  const leftLeg = legChain(landmarks, aspect, SCREEN_LEFT, bodyTilt, {
    thigh: base.leftThigh,
    shin: base.leftShin,
  });
  const rightLeg = legChain(landmarks, aspect, SCREEN_RIGHT, bodyTilt, {
    thigh: base.rightThigh,
    shin: base.rightShin,
  });

  // The neck bone points up out of the torso, so it is measured from up, not from down.
  const leftEar = pt(landmarks, MP.LEFT_EAR, aspect);
  const rightEar = pt(landmarks, MP.RIGHT_EAR, aspect);
  const nose = pt(landmarks, MP.NOSE, aspect);
  const head = seen(leftEar) && seen(rightEar) ? mid(leftEar, rightEar) : seen(nose) ? nose : undefined;
  const neck = head ? clamp(normalizeDeg(svgAngleUp(shoulder, head) - torsoWorld), -45, 45) : base.neck;

  return {
    pose: {
      // Placeholders: the whole clip is re-centred and re-scaled once all frames are known.
      hipX: FIGURE_HIP_X,
      hipY: FIGURE_HIP_Y,
      bodyTilt: round1(bodyTilt),
      torso: round1(torso),
      neck: round1(neck),
      jaw: 0,
      leftUpperArm: round1(left.upper),
      leftForearm: round1(left.fore),
      leftHand: round1(left.hand),
      rightUpperArm: round1(right.upper),
      rightForearm: round1(right.fore),
      rightHand: round1(right.hand),
      leftThigh: round1(leftLeg.thigh),
      leftShin: round1(leftLeg.shin),
      rightThigh: round1(rightLeg.thigh),
      rightShin: round1(rightLeg.shin),
      // A single camera view cannot tell a shrug, a head shift or a chest turn apart from
      // perspective, and guessing them biased every frame. They stay neutral for tracks.
      shoulderLift: 0,
      headShiftX: 0,
      headShiftY: 0,
      chest: 0,
    },
    hipX: hip.x,
    hipY: hip.y,
    torsoLen,
    confidence: landmarkConfidence(landmarks),
  };
}

export function landmarksToJointAngles(landmarks: PoseLandmark[], options: MapOptions = {}): JointAngles {
  return mapLandmarksToFrame(landmarks, options)?.pose ?? options.previous ?? POSES.stand;
}

/**
 * Turn per-frame hip positions into figure coordinates: the resting hip sits at the drawing's
 * origin and travel is measured in torso lengths, so a squat dips as far in the figure as in the
 * clip no matter how the camera was framed or how far away the person stood.
 */
export function normalizeHipTravel(frames: MappedFrame[]): void {
  if (frames.length === 0) return;
  const originX = median(frames.map((frame) => frame.hipX));
  const originY = median(frames.map((frame) => frame.hipY));
  const torsoLen = median(frames.map((frame) => frame.torsoLen));
  const unit = torsoLen > 1e-4 ? FIGURE_TORSO / torsoLen : 0;
  for (const frame of frames) {
    frame.pose.hipX = round1(clamp(FIGURE_HIP_X + (frame.hipX - originX) * unit, 72, 128));
    frame.pose.hipY = round1(clamp(FIGURE_HIP_Y + (frame.hipY - originY) * unit, 112, 212));
  }
}

export function median(values: number[]): number {
  const usable = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (usable.length === 0) return 0;
  const middle = Math.floor(usable.length / 2);
  return usable.length % 2 === 1 ? usable[middle] : (usable[middle - 1] + usable[middle]) / 2;
}

export function standingLandmarks(): PoseLandmark[] {
  const points: PoseLandmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  const set = (index: number, x: number, y: number) => {
    points[index] = { x, y, visibility: 0.99 };
  };
  set(MP.NOSE, 0.5, 0.16);
  set(MP.LEFT_EAR, 0.455, 0.155);
  set(MP.RIGHT_EAR, 0.545, 0.155);
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
