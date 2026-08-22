import type { PoseId } from "./types";

/**
 * Keyframes for the mannequin in `components/StickFigure.tsx`.
 *
 * Every number is an SVG `rotate()` in degrees, which turns **clockwise** on screen because y
 * points down – the same convention the video mapping uses (`pose-map.ts`, `svgAngleDown` /
 * `svgAngleUp`). What that means when authoring a pose:
 *
 * - `left*` is the limb drawn on the **screen-left** half, like a mirror. A label that says "links"
 *   therefore means the side the viewer sees on the left. The video mapping feeds the person's
 *   right-side landmarks into the `left*` slots for exactly the same reason.
 * - Arms and legs are drawn along +Y, so `0` hangs straight down and a **positive angle swings the
 *   limb toward screen-left**: `leftUpperArm: 90` is a horizontal arm pointing left, `180` points
 *   up. For the right side the signs flip.
 * - Child bones are relative to their parent. Bending an elbow or a knee **toward the body** is
 *   therefore negative on the left and positive on the right. Giving the forearm the same sign as
 *   the upper arm flings it outward, which is what used to make every seated pose look like a bird.
 * - The neck is drawn along -Y, so its sign is inverted: positive tips the head to screen-right.
 *   Use `tiltHead` instead of writing `neck` by hand.
 * - `headShiftY` positive lets the head sink, negative lifts it. `shoulderLift` positive raises the
 *   shoulders. `bodyTilt` rotates the whole figure; around -90 it reads as a profile facing
 *   screen-left, which is how the sagittal poses (Stütze, Cobra, Katze, Liegen) are drawn.
 *
 * Sides always come in exact pairs: the mirrored twin is built with `mirrorPose`, never typed a
 * second time. `poses.test.ts` measures the drawn result with `pose-geometry.ts`, so a pose that
 * does not do what its name says fails the suite instead of shipping.
 */

export type JointAngles = {
  hipX: number;
  hipY: number;
  bodyTilt: number;
  torso: number;
  neck: number;
  jaw: number;
  leftUpperArm: number;
  leftForearm: number;
  leftHand: number;
  rightUpperArm: number;
  rightForearm: number;
  rightHand: number;
  leftThigh: number;
  leftShin: number;
  rightThigh: number;
  rightShin: number;
  shoulderLift: number;
  headShiftX: number;
  headShiftY: number;
  chest: number;
};

export const POSE_LABELS: Record<PoseId, string> = {
  stand: "Stand",
  reachUp: "Arme heben",
  fold: "Vorbeuge",
  squat: "Kniebeuge",
  lunge: "Ausfallschritt",
  plank: "Stütze",
  cobra: "Cobra",
  child: "Kind",
  cat: "Katze",
  cow: "Kuh",
  twist: "Drehung",
  sit: "Sitz",
  breathe: "Atmung",
  neckTilt: "Nacken",
  lie: "Liegen",
  warrior: "Krieger",
  tree: "Baum",
  hipOpen: "Hüfte",
  chestOpen: "Brustöffner",
  heart: "Herz",
  neckLeft: "Nacken links",
  neckRight: "Nacken rechts",
  shrug: "Schultern hoch",
  shouldersDown: "Schultern schwer",
  jawSoft: "Kiefer locker",
  gazeFar: "Blick in die Ferne",
  kneesUp: "Knie aufgestellt",
  pelvicTuck: "Becken kippen",
  pelvicArch: "Becken lösen",
  walkLeft: "Schritt links",
  walkRight: "Schritt rechts",
  wristsFlex: "Handgelenke beugen",
  wristsExtend: "Handgelenke strecken",
  shakeOut: "Ausschütteln",
  twistOther: "Drehung andere Seite",
  treeOther: "Baum andere Seite",
  lungeOther: "Ausfall andere Seite",
  breatheIn: "Einatmen",
  breatheOut: "Ausatmen",
  neckForward: "Nacken vorn",
  neckBack: "Nacken hinten",
  jawLeft: "Kiefer links",
  jawRight: "Kiefer rechts",
  warriorOther: "Krieger andere Seite",
  hipOpenOther: "Hüfte andere Seite",
  calfWall: "Wade an der Wand",
  calfWallOther: "Wade andere Seite",
  shoulderForward: "Schultern vorn",
  standInhale: "Einatmen im Stand",
  standExhale: "Ausatmen im Stand",
  lieInhale: "Einatmen im Liegen",
  lieHold: "Atem halten im Liegen",
  lieExhale: "Ausatmen im Liegen",
};

const stand: JointAngles = {
  hipX: 100,
  hipY: 148,
  bodyTilt: 0,
  torso: 0,
  neck: 0,
  jaw: 0,
  leftUpperArm: 18,
  leftForearm: -6,
  leftHand: 0,
  rightUpperArm: -18,
  rightForearm: 6,
  rightHand: 0,
  leftThigh: 9,
  leftShin: -5,
  rightThigh: -9,
  rightShin: 5,
  shoulderLift: 0,
  headShiftX: 0,
  headShiftY: 0,
  chest: 0,
};

/** Head tilt in the direction a reader expects: positive leans the head toward screen-left. */
function tiltHead(deg: number): Partial<JointAngles> {
  return { neck: -deg, headShiftX: -Math.round(deg * 0.25) };
}

/**
 * Cross-legged sitting. From the front a chair cannot be drawn, so the shins fold in front of the
 * hips: thighs out, shins back toward the middle. Feet land next to each other on the floor.
 */
const sit: JointAngles = {
  ...stand,
  hipY: 186,
  torso: -3,
  leftUpperArm: 24,
  leftForearm: -22,
  rightUpperArm: -24,
  rightForearm: 22,
  leftThigh: 66,
  leftShin: -104,
  rightThigh: -66,
  rightShin: 104,
};

/** Lying on the back, head to screen-left. The whole figure is a little over 230 units long. */
const lie: JointAngles = {
  ...stand,
  hipX: 104,
  hipY: 206,
  bodyTilt: -90,
  torso: 0,
  neck: 0,
  leftUpperArm: 10,
  leftForearm: -6,
  rightUpperArm: -10,
  rightForearm: 6,
  leftThigh: 4,
  leftShin: -2,
  rightThigh: -4,
  rightShin: 2,
};

/** All fours, head to screen-left: spine across the picture, arms and thighs down to the floor. */
const quadruped: JointAngles = {
  ...stand,
  hipX: 126,
  hipY: 150,
  bodyTilt: -90,
  leftUpperArm: 92,
  leftForearm: 4,
  rightUpperArm: 88,
  rightForearm: -4,
  leftThigh: 92,
  leftShin: -22,
  rightThigh: 88,
  rightShin: -18,
};

function j(over: Partial<JointAngles>, base: JointAngles = stand): JointAngles {
  return { ...base, ...over };
}

const MIRROR_AXIS = 2 * stand.hipX;

/** The same pose seen from the other side. Sides swap and every rotation flips its sign. */
export function mirrorPose(pose: JointAngles): JointAngles {
  return {
    hipX: MIRROR_AXIS - pose.hipX,
    hipY: pose.hipY,
    bodyTilt: -pose.bodyTilt,
    torso: -pose.torso,
    neck: -pose.neck,
    jaw: pose.jaw,
    leftUpperArm: -pose.rightUpperArm,
    leftForearm: -pose.rightForearm,
    leftHand: -(pose.rightHand ?? 0),
    rightUpperArm: -pose.leftUpperArm,
    rightForearm: -pose.leftForearm,
    rightHand: -(pose.leftHand ?? 0),
    leftThigh: -pose.rightThigh,
    leftShin: -pose.rightShin,
    rightThigh: -pose.leftThigh,
    rightShin: -pose.leftShin,
    shoulderLift: pose.shoulderLift ?? 0,
    headShiftX: -(pose.headShiftX ?? 0),
    headShiftY: pose.headShiftY ?? 0,
    chest: pose.chest ?? 0,
  };
}

const reachUp = j({
  leftUpperArm: 152,
  leftForearm: -12,
  rightUpperArm: -152,
  rightForearm: 12,
  headShiftY: -3,
  chest: 5,
});

const fold = j({
  hipY: 150,
  torso: -88,
  neck: -6,
  leftUpperArm: 94,
  leftForearm: 6,
  rightUpperArm: 86,
  rightForearm: -6,
  leftThigh: 6,
  leftShin: -3,
  rightThigh: -6,
  rightShin: 3,
});

const squat = j({
  hipY: 170,
  torso: 7,
  leftUpperArm: 42,
  leftForearm: -76,
  rightUpperArm: -42,
  rightForearm: 76,
  leftThigh: 52,
  leftShin: -52,
  rightThigh: -52,
  rightShin: 52,
});

const lunge = j({
  hipX: 104,
  hipY: 166,
  torso: -6,
  leftUpperArm: 142,
  leftForearm: -14,
  rightUpperArm: -26,
  rightForearm: 10,
  leftThigh: 46,
  leftShin: -42,
  rightThigh: -52,
  rightShin: 26,
});

/**
 * Front support. The body is one arm length above the floor, so the axis runs from the shoulders
 * down to the feet instead of lying flat, and the arms drop straight to the ground.
 */
const plank = j({
  hipX: 102,
  hipY: 196,
  bodyTilt: -62,
  torso: 2,
  neck: 8,
  leftUpperArm: 64,
  leftForearm: -4,
  rightUpperArm: 60,
  rightForearm: 4,
  leftThigh: 4,
  leftShin: -2,
  rightThigh: 0,
  rightShin: 2,
});

const cobra = j({
  hipX: 96,
  hipY: 228,
  bodyTilt: -76,
  torso: 38,
  neck: 14,
  chest: 8,
  leftUpperArm: 52,
  leftForearm: -34,
  rightUpperArm: 48,
  rightForearm: 34,
  leftThigh: -4,
  leftShin: 2,
  rightThigh: 0,
  rightShin: -2,
});

const child = j({
  hipX: 146,
  hipY: 188,
  bodyTilt: -110,
  torso: 0,
  neck: -8,
  headShiftY: 4,
  leftUpperArm: -146,
  leftForearm: 12,
  rightUpperArm: -150,
  rightForearm: -12,
  leftThigh: 112,
  leftShin: -96,
  rightThigh: 108,
  rightShin: -92,
});

// Rounded back, head tucked toward the floor.
const cat = j({ torso: -22, neck: -24, headShiftY: 6, chest: -6 }, quadruped);
// Dipped back, chest and chin lifted.
const cow = j({ torso: 14, neck: 20, headShiftY: -4, chest: 8 }, quadruped);

const twist = j(
  {
    torso: -8,
    leftUpperArm: -54,
    leftForearm: -34,
    rightUpperArm: -84,
    rightForearm: 26,
    ...tiltHead(-22),
  },
  sit,
);

const breathe = j(
  {
    torso: -3,
    chest: 4,
    leftUpperArm: 28,
    leftForearm: -88,
    rightUpperArm: -32,
    rightForearm: 100,
  },
  sit,
);

const neckTilt = j({ ...tiltHead(18), headShiftY: 5, leftUpperArm: 10, rightUpperArm: -10 });

const warrior = j({
  hipX: 100,
  hipY: 174,
  torso: -4,
  chest: 5,
  leftUpperArm: 96,
  leftForearm: -8,
  rightUpperArm: -96,
  rightForearm: 8,
  leftThigh: 58,
  leftShin: -30,
  rightThigh: -50,
  rightShin: 6,
});

const tree = j({
  leftUpperArm: 156,
  leftForearm: -22,
  rightUpperArm: -156,
  rightForearm: 22,
  leftThigh: 6,
  leftShin: -3,
  rightThigh: -46,
  rightShin: 66,
});

const hipOpen = j(
  {
    torso: -6,
    leftUpperArm: 22,
    leftForearm: -30,
    rightUpperArm: -26,
    rightForearm: 34,
    leftThigh: 74,
    leftShin: -112,
    rightThigh: -96,
    rightShin: 62,
  },
  sit,
);

const chestOpen = j({
  torso: -10,
  chest: 10,
  shoulderLift: -3,
  headShiftY: -3,
  leftUpperArm: 108,
  leftForearm: -12,
  rightUpperArm: -108,
  rightForearm: 12,
});

/** One hand rests on the sternum, the other stays soft at the side. */
const heart = j({
  leftUpperArm: 16,
  leftForearm: -8,
  rightUpperArm: -26,
  rightForearm: 104,
  rightHand: 12,
  chest: 4,
});

const neckLeft = j({
  ...tiltHead(26),
  leftUpperArm: 8,
  rightUpperArm: -12,
  shoulderLift: -2,
});

const shrug = j({
  shoulderLift: 16,
  headShiftY: 5,
  leftUpperArm: 14,
  leftForearm: -5,
  rightUpperArm: -14,
  rightForearm: 5,
});

const shouldersDown = j({
  shoulderLift: -7,
  headShiftY: -3,
  leftUpperArm: 10,
  leftForearm: -4,
  rightUpperArm: -10,
  rightForearm: 4,
});

const jawSoft = j(
  {
    jaw: 14,
    headShiftY: 3,
    leftUpperArm: 26,
    leftForearm: -26,
    rightUpperArm: -26,
    rightForearm: 26,
  },
  sit,
);

const gazeFar = j(
  {
    torso: -6,
    headShiftY: -7,
    leftUpperArm: 34,
    leftForearm: -40,
    rightUpperArm: -34,
    rightForearm: 40,
  },
  sit,
);

/** On the back with the feet planted: knees point up, shins come back down to the floor. */
const kneesUp = j({
  hipX: 116,
  hipY: 206,
  bodyTilt: -90,
  leftUpperArm: 12,
  leftForearm: -8,
  rightUpperArm: -12,
  rightForearm: 8,
  leftThigh: -48,
  leftShin: 104,
  rightThigh: -44,
  rightShin: 100,
});

const pelvicTuck = j({ hipY: 210, torso: 12, neck: 4, headShiftY: 2 }, kneesUp);
const pelvicArch = j({ hipY: 202, torso: -12, neck: -6, headShiftY: -2 }, kneesUp);

/** A step with the screen-left leg: that knee lifts, the arms swing in opposition. */
const walkLeft = j({
  hipX: 96,
  torso: 3,
  leftUpperArm: 6,
  leftForearm: -22,
  rightUpperArm: -30,
  rightForearm: 16,
  leftThigh: 44,
  leftShin: -68,
  rightThigh: -10,
  rightShin: 6,
});

const wristsFlex = j({
  leftUpperArm: 40,
  leftForearm: -86,
  leftHand: -68,
  rightUpperArm: -40,
  rightForearm: 86,
  rightHand: 68,
});

const wristsExtend = j({
  leftUpperArm: 40,
  leftForearm: -86,
  leftHand: 64,
  rightUpperArm: -40,
  rightForearm: 86,
  rightHand: -64,
});

const shakeOut = j({
  leftUpperArm: 62,
  leftForearm: -52,
  leftHand: 34,
  rightUpperArm: -28,
  rightForearm: 64,
  rightHand: -30,
  shoulderLift: 4,
});

const breatheIn = j(
  {
    torso: -8,
    chest: 10,
    leftUpperArm: 34,
    leftForearm: -92,
    rightUpperArm: -34,
    rightForearm: 92,
  },
  sit,
);

const breatheOut = j(
  {
    torso: 4,
    chest: -4,
    leftUpperArm: 24,
    leftForearm: -100,
    rightUpperArm: -24,
    rightForearm: 100,
  },
  sit,
);

const neckForward = j({
  torso: 6,
  headShiftY: 15,
  leftUpperArm: 8,
  leftForearm: -4,
  rightUpperArm: -8,
  rightForearm: 4,
});

const neckBack = j({
  torso: -6,
  headShiftY: -13,
  leftUpperArm: 8,
  leftForearm: -4,
  rightUpperArm: -8,
  rightForearm: 4,
});

/** Jaw slides toward screen-left; the head slides with it, the tilt stays small. */
const jawLeft = j(
  {
    jaw: 10,
    ...tiltHead(8),
    headShiftX: -13,
    headShiftY: 3,
    leftUpperArm: 26,
    leftForearm: -26,
    rightUpperArm: -26,
    rightForearm: 26,
  },
  sit,
);

const calfWall = j({
  hipX: 96,
  hipY: 150,
  torso: 10,
  chest: 2,
  leftUpperArm: 104,
  leftForearm: -20,
  leftHand: -8,
  rightUpperArm: -104,
  rightForearm: 20,
  rightHand: 8,
  leftThigh: 6,
  leftShin: -3,
  rightThigh: -34,
  rightShin: 30,
});

const shoulderForward = j({
  torso: 8,
  neck: 0,
  headShiftY: 4,
  chest: -7,
  shoulderLift: 5,
  leftUpperArm: 26,
  leftForearm: -52,
  rightUpperArm: -26,
  rightForearm: 52,
});

const standInhale = j({
  torso: -8,
  chest: 10,
  shoulderLift: 3,
  headShiftY: -3,
  leftUpperArm: 26,
  leftForearm: -12,
  rightUpperArm: -26,
  rightForearm: 12,
});

const standExhale = j({
  torso: 3,
  chest: -3,
  shoulderLift: -4,
  headShiftY: 2,
  leftUpperArm: 12,
  leftForearm: -6,
  rightUpperArm: -12,
  rightForearm: 6,
});

const lieInhale = j({ torso: -6, chest: 9, leftUpperArm: 20, leftForearm: -14, rightUpperArm: -20, rightForearm: 14 }, lie);
const lieHold = j({ torso: -2, chest: 5, leftUpperArm: 14, leftForearm: -10, rightUpperArm: -14, rightForearm: 10 }, lie);
const lieExhale = j({ torso: 4, chest: -4, leftUpperArm: 8, leftForearm: -6, rightUpperArm: -8, rightForearm: 6 }, lie);

export const POSES: Record<PoseId, JointAngles> = {
  stand,
  sit,
  lie,
  reachUp,
  fold,
  squat,
  lunge,
  plank,
  cobra,
  child,
  cat,
  cow,
  twist,
  breathe,
  neckTilt,
  warrior,
  tree,
  hipOpen,
  chestOpen,
  heart,
  neckLeft,
  neckRight: mirrorPose(neckLeft),
  shrug,
  shouldersDown,
  jawSoft,
  gazeFar,
  kneesUp,
  pelvicTuck,
  pelvicArch,
  walkLeft,
  walkRight: mirrorPose(walkLeft),
  wristsFlex,
  wristsExtend,
  shakeOut,
  twistOther: mirrorPose(twist),
  treeOther: mirrorPose(tree),
  lungeOther: mirrorPose(lunge),
  breatheIn,
  breatheOut,
  neckForward,
  neckBack,
  jawLeft,
  jawRight: mirrorPose(jawLeft),
  warriorOther: mirrorPose(warrior),
  hipOpenOther: mirrorPose(hipOpen),
  calfWall,
  calfWallOther: mirrorPose(calfWall),
  shoulderForward,
  standInhale,
  standExhale,
  lieInhale,
  lieHold,
  lieExhale,
};

export const POSE_IDS = Object.keys(POSES) as PoseId[];

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpPose(a: JointAngles, b: JointAngles, t: number): JointAngles {
  const keys = Object.keys({ ...a, ...b }) as (keyof JointAngles)[];
  const out = { ...a };
  for (const key of keys) {
    out[key] = lerp(a[key] ?? 0, b[key] ?? 0, t);
  }
  return out;
}
