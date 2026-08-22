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

/** Shoulder-to-hip distance, relative to the frame height, below which the detection is guesswork. */
export const MIN_TORSO_LEN = 0.06;
/** Below this the person is far enough away that the track is worth a warning. */
export const SMALL_TORSO_LEN = 0.12;
/**
 * A clip has one dominant body orientation. When a frame claims the person flipped by more than
 * this it is a detection failure, not a movement — nobody turns 90 degrees between two samples.
 */
export const MAX_SPINE_DEVIATION = 70;

/**
 * How fast a joint we cannot see any more drifts back to the neutral pose. Freezing it instead
 * meant one bad detection could leave an arm stuck at a strange angle for the rest of the clip.
 */
export const REST_DECAY = 0.12;
/** Distance to neutral, in degrees, at which the drift stops fading and just arrives. */
export const REST_SNAP = 1;

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

function relax(held: number, rest: number): number {
  const delta = normalizeDeg(rest - held);
  // Geometric decay alone never arrives, and a joint parked a degree off neutral for the rest of
  // the clip is both invisible and a needless difference between two otherwise identical frames.
  if (Math.abs(delta) < REST_SNAP) return rest;
  return held + delta * REST_DECAY;
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
 * One analyzed video frame. Limb angles are ready for the mannequin, but everything that depends
 * on how the clip as a whole is oriented or framed is left to a second pass over all frames:
 * `spine` and the thigh angles are still world angles, and the hip position is in aspect-corrected
 * image units.
 */
export type MappedFrame = {
  pose: JointAngles;
  spine: number;
  leftThighWorld: number;
  rightThighWorld: number;
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
  rest: { upper: number; fore: number; hand: number },
): { upper: number; fore: number; hand: number } {
  const shoulder = pt(landmarks, side.shoulder, aspect);
  const elbow = pt(landmarks, side.elbow, aspect);
  const wrist = pt(landmarks, side.wrist, aspect);
  const finger = pt(landmarks, side.index, aspect);

  let upper = relax(base.upper, rest.upper);
  let upperWorld = parentWorld + upper;
  if (seen(shoulder) && seen(elbow)) {
    upperWorld = svgAngleDown(shoulder, elbow);
    upper = normalizeDeg(upperWorld - parentWorld);
  }

  let fore = relax(base.fore, rest.fore);
  let foreWorld = upperWorld + fore;
  if (seen(elbow) && seen(wrist)) {
    foreWorld = svgAngleDown(elbow, wrist);
    fore = normalizeDeg(foreWorld - upperWorld);
  }

  let hand = relax(base.hand, rest.hand);
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
  fallbackWorld: number,
  baseShin: number,
  restThigh: number,
  restShin: number,
): { thighWorld: number; shin: number } {
  const hip = pt(landmarks, side.hip, aspect);
  const knee = pt(landmarks, side.knee, aspect);
  const ankle = pt(landmarks, side.ankle, aspect);

  let thighWorld = relax(fallbackWorld, restThigh);
  if (seen(hip) && seen(knee)) thighWorld = svgAngleDown(hip, knee);

  let shin = relax(baseShin, restShin);
  if (seen(knee) && seen(ankle)) shin = normalizeDeg(svgAngleDown(knee, ankle) - thighWorld);

  return { thighWorld, shin: clamp(shin, -170, 170) };
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
  if (torsoLen < MIN_TORSO_LEN) return null;

  const spine = svgAngleUp(hip, shoulder);
  const torsoWorld = spine;

  const rest = POSES.stand;
  const left = limbChain(
    landmarks,
    aspect,
    SCREEN_LEFT,
    torsoWorld,
    { upper: base.leftUpperArm, fore: base.leftForearm, hand: base.leftHand ?? 0 },
    { upper: rest.leftUpperArm, fore: rest.leftForearm, hand: rest.leftHand ?? 0 },
  );
  const right = limbChain(
    landmarks,
    aspect,
    SCREEN_RIGHT,
    torsoWorld,
    { upper: base.rightUpperArm, fore: base.rightForearm, hand: base.rightHand ?? 0 },
    { upper: rest.rightUpperArm, fore: rest.rightForearm, hand: rest.rightHand ?? 0 },
  );
  const leftLeg = legChain(
    landmarks,
    aspect,
    SCREEN_LEFT,
    base.leftThigh,
    base.leftShin,
    rest.leftThigh,
    rest.leftShin,
  );
  const rightLeg = legChain(
    landmarks,
    aspect,
    SCREEN_RIGHT,
    base.rightThigh,
    base.rightShin,
    rest.rightThigh,
    rest.rightShin,
  );

  // The neck bone points up out of the torso, so it is measured from up, not from down.
  const leftEar = pt(landmarks, MP.LEFT_EAR, aspect);
  const rightEar = pt(landmarks, MP.RIGHT_EAR, aspect);
  const nose = pt(landmarks, MP.NOSE, aspect);
  const head = seen(leftEar) && seen(rightEar) ? mid(leftEar, rightEar) : seen(nose) ? nose : undefined;
  const neck = head ? clamp(normalizeDeg(svgAngleUp(shoulder, head) - torsoWorld), -45, 45) : base.neck;

  return {
    pose: {
      // Placeholders: hip travel and the tilt/torso split need the whole clip, see below.
      hipX: FIGURE_HIP_X,
      hipY: FIGURE_HIP_Y,
      bodyTilt: 0,
      torso: clamp(spine, -100, 100),
      neck: round1(neck),
      jaw: 0,
      leftUpperArm: round1(left.upper),
      leftForearm: round1(left.fore),
      leftHand: round1(left.hand),
      rightUpperArm: round1(right.upper),
      rightForearm: round1(right.fore),
      rightHand: round1(right.hand),
      leftThigh: round1(clamp(leftLeg.thighWorld, -170, 170)),
      leftShin: round1(leftLeg.shin),
      rightThigh: round1(clamp(rightLeg.thighWorld, -170, 170)),
      rightShin: round1(rightLeg.shin),
      // A single camera view cannot tell a shrug, a head shift or a chest turn apart from
      // perspective, and guessing them biased every frame. They stay neutral for tracks.
      shoulderLift: 0,
      headShiftX: 0,
      headShiftY: 0,
      chest: 0,
    },
    spine,
    leftThighWorld: leftLeg.thighWorld,
    rightThighWorld: rightLeg.thighWorld,
    hipX: hip.x,
    hipY: hip.y,
    torsoLen,
    confidence: landmarkConfidence(landmarks),
  };
}

/** Average of angles as directions, so 179° and -179° average to 180° and not to 0°. */
export function circularMeanDeg(values: Array<{ deg: number; weight?: number }>): number {
  let x = 0;
  let y = 0;
  for (const { deg, weight = 1 } of values) {
    const rad = (deg * Math.PI) / 180;
    x += Math.cos(rad) * weight;
    y += Math.sin(rad) * weight;
  }
  if (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9) return 0;
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export function angularDistance(a: number, b: number): number {
  return Math.abs(normalizeDeg(a - b));
}

/**
 * Frames where the detector decided the person is upside down or sideways while the rest of the
 * clip disagrees. BlazePose does that on dark or grainy footage, and a single flipped frame throws
 * the figure across the picture.
 */
export function dropOrientationOutliers(frames: MappedFrame[]): { kept: MappedFrame[]; dominant: number } {
  if (frames.length === 0) return { kept: [], dominant: 0 };
  const first = circularMeanDeg(frames.map((frame) => ({ deg: frame.spine, weight: frame.confidence })));
  const kept = frames.filter((frame) => angularDistance(frame.spine, first) <= MAX_SPINE_DEVIATION);
  if (kept.length === 0) return { kept: frames, dominant: first };
  const dominant = circularMeanDeg(kept.map((frame) => ({ deg: frame.spine, weight: frame.confidence })));
  return { kept, dominant };
}

/**
 * Decide once per clip how much of the spine belongs to the root group (which also carries the
 * legs) and how much is torso bend. Deciding this per frame made a standing figure flip onto its
 * back and up again whenever a single detection wobbled past the threshold.
 */
export function applyClipOrientation(frames: MappedFrame[], dominant: number): void {
  const lying = Math.abs(dominant) > 55;
  const bodyTilt = lying ? round1(clamp(dominant, -150, 150)) : 0;
  for (const frame of frames) {
    frame.pose.bodyTilt = bodyTilt;
    frame.pose.torso = round1(clamp(normalizeDeg(frame.spine - bodyTilt), -100, 100));
    frame.pose.leftThigh = round1(clamp(normalizeDeg(frame.leftThighWorld - bodyTilt), -170, 170));
    frame.pose.rightThigh = round1(clamp(normalizeDeg(frame.rightThighWorld - bodyTilt), -170, 170));
  }
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
