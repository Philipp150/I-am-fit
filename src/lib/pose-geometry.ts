import type { JointAngles } from "./poses";

/**
 * The mannequin's measurements and the forward kinematics that turn joint angles into points.
 * `StickFigure` draws from these constants and the pose tests measure with the same functions, so a
 * pose can no longer claim one thing in its name and draw another on the screen.
 *
 * Angle convention (same as `pose-map.ts`): every value is an SVG `rotate()`, which turns clockwise
 * because y points down. Arms and legs are drawn along +Y, so a positive angle swings them toward
 * screen-left. The neck is drawn along -Y, so a positive angle tips the head toward screen-right.
 */
export const FIGURE = {
  hipW: 11,
  shoulderW: 22,
  torso: 68,
  thigh: 50,
  shin: 46,
  foot: 16,
  upper: 36,
  fore: 32,
  hand: 13,
  neck: 16,
  /** Head centre above the top of the neck bone. */
  headGap: 18,
  headRx: 15,
  headRy: 18.5,
  /** Hip joints sit slightly below the root, where the pelvis is drawn. */
  hipDrop: 6,
} as const;

/**
 * Drawing area. A lying figure is about 235 units long, so the box is wider than a standing figure
 * needs; before that the head of every lying pose was cut off at the right edge.
 */
export const VIEW_BOX = { x: -30, y: 0, width: 260, height: 280 } as const;

export const FIGURE_HOME = { x: 100, y: 148 } as const;

export type Point = { x: number; y: number };

/** Position plus rotation. The chest swell is a scale of at most 1.12 in x and is left out. */
type Frame = { x: number; y: number; sin: number; cos: number };

function frame(): Frame {
  return { x: 0, y: 0, sin: 0, cos: 1 };
}

function translate(f: Frame, dx: number, dy: number): Frame {
  return { ...f, x: f.x + (dx * f.cos - dy * f.sin), y: f.y + (dx * f.sin + dy * f.cos) };
}

function rotate(f: Frame, deg: number): Frame {
  const rad = (deg * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);
  return { ...f, sin: f.sin * cos + f.cos * sin, cos: f.cos * cos - f.sin * sin };
}

function origin(f: Frame): Point {
  return { x: f.x, y: f.y };
}

export type FigurePoints = {
  hip: Point;
  chest: Point;
  neckTop: Point;
  head: Point;
  leftShoulder: Point;
  rightShoulder: Point;
  leftElbow: Point;
  rightElbow: Point;
  leftWrist: Point;
  rightWrist: Point;
  leftHand: Point;
  rightHand: Point;
  leftKnee: Point;
  rightKnee: Point;
  leftAnkle: Point;
  rightAnkle: Point;
  leftFoot: Point;
  rightFoot: Point;
};

function leg(root: Frame, side: -1 | 1, thigh: number, shin: number) {
  const hip = rotate(translate(root, side * FIGURE.hipW, FIGURE.hipDrop), thigh);
  const knee = translate(hip, 0, FIGURE.thigh);
  const lower = rotate(knee, shin);
  const ankle = translate(lower, 0, FIGURE.shin);
  return { knee: origin(knee), ankle: origin(ankle), foot: origin(translate(ankle, side * 3, FIGURE.foot)) };
}

function arm(torso: Frame, side: -1 | 1, shoulderY: number, upper: number, fore: number, hand: number) {
  const joint = translate(torso, side * FIGURE.shoulderW, shoulderY);
  const upperArm = rotate(joint, upper);
  const elbow = translate(upperArm, 0, FIGURE.upper);
  const forearm = rotate(elbow, fore);
  const wrist = translate(forearm, 0, FIGURE.fore);
  return {
    shoulder: origin(joint),
    elbow: origin(elbow),
    wrist: origin(wrist),
    hand: origin(translate(rotate(wrist, hand), 0, FIGURE.hand)),
  };
}

/** Where every joint of the mannequin lands, in the coordinates of the SVG viewBox. */
export function figurePoints(angles: JointAngles): FigurePoints {
  const root = rotate(translate(frame(), angles.hipX, angles.hipY), angles.bodyTilt);
  const shoulderY = -FIGURE.torso - (angles.shoulderLift ?? 0);
  const torso = rotate(root, angles.torso);

  const left = leg(root, -1, angles.leftThigh, angles.leftShin);
  const right = leg(root, 1, angles.rightThigh, angles.rightShin);
  const leftArm = arm(torso, -1, shoulderY, angles.leftUpperArm, angles.leftForearm, angles.leftHand ?? 0);
  const rightArm = arm(torso, 1, shoulderY, angles.rightUpperArm, angles.rightForearm, angles.rightHand ?? 0);

  const neckBase = rotate(translate(torso, 0, -FIGURE.torso), angles.neck);
  const head = translate(
    neckBase,
    angles.headShiftX ?? 0,
    -FIGURE.neck - FIGURE.headGap + (angles.headShiftY ?? 0),
  );

  return {
    hip: origin(root),
    chest: origin(translate(torso, 0, -FIGURE.torso / 2)),
    neckTop: origin(translate(neckBase, 0, -FIGURE.neck)),
    head: origin(head),
    leftShoulder: leftArm.shoulder,
    rightShoulder: rightArm.shoulder,
    leftElbow: leftArm.elbow,
    rightElbow: rightArm.elbow,
    leftWrist: leftArm.wrist,
    rightWrist: rightArm.wrist,
    leftHand: leftArm.hand,
    rightHand: rightArm.hand,
    leftKnee: left.knee,
    rightKnee: right.knee,
    leftAnkle: left.ankle,
    rightAnkle: right.ankle,
    leftFoot: left.foot,
    rightFoot: right.foot,
  };
}

export type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

/** Bounding box of everything that gets drawn, head included. */
export function figureBounds(angles: JointAngles): Bounds {
  const points = figurePoints(angles);
  const all = Object.entries(points).map(([key, point]) => ({ key, point }));
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const { key, point } of all) {
    // The head is an ellipse, the joints are dots with a little stroke around them.
    const pad = key === "head" ? FIGURE.headRy : 6;
    minX = Math.min(minX, point.x - pad);
    maxX = Math.max(maxX, point.x + pad);
    minY = Math.min(minY, point.y - pad);
    maxY = Math.max(maxY, point.y + pad);
  }
  return { minX, maxX, minY, maxY };
}

export function fitsViewBox(angles: JointAngles): boolean {
  const bounds = figureBounds(angles);
  return (
    bounds.minX >= VIEW_BOX.x &&
    bounds.maxX <= VIEW_BOX.x + VIEW_BOX.width &&
    bounds.minY >= VIEW_BOX.y &&
    bounds.maxY <= VIEW_BOX.y + VIEW_BOX.height
  );
}

export function viewBoxAttr(): string {
  return `${VIEW_BOX.x} ${VIEW_BOX.y} ${VIEW_BOX.width} ${VIEW_BOX.height}`;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
