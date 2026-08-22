import { guessPoses } from "./import-parse";
import { POSE_IDS, POSE_LABELS } from "./poses";
import type { PoseId } from "./types";

/**
 * Choosing a pose used to mean picking one of 53 unlabelled thumbnails the size of a fingernail,
 * for every single step. The picker now starts with a handful that fit the step text and keeps the
 * rest behind a search field and these groups.
 */
export type PoseGroup = { id: string; title: string; poses: PoseId[] };

export const POSE_GROUPS: PoseGroup[] = [
  {
    id: "head",
    title: "Kopf, Nacken, Kiefer",
    poses: ["neckTilt", "neckLeft", "neckRight", "neckForward", "neckBack", "jawSoft", "jawLeft", "jawRight", "gazeFar"],
  },
  {
    id: "shoulders",
    title: "Schultern und Arme",
    poses: ["shrug", "shouldersDown", "shoulderForward", "chestOpen", "reachUp", "wristsFlex", "wristsExtend", "shakeOut", "heart"],
  },
  {
    id: "torso",
    title: "Rumpf und Drehung",
    poses: ["twist", "twistOther", "cat", "cow", "cobra", "plank", "fold"],
  },
  {
    id: "legs",
    title: "Hüfte und Beine",
    poses: ["squat", "lunge", "lungeOther", "warrior", "warriorOther", "tree", "treeOther", "hipOpen", "hipOpenOther", "calfWall", "calfWallOther"],
  },
  {
    id: "stand",
    title: "Stand und Gehen",
    poses: ["stand", "walkLeft", "walkRight"],
  },
  {
    id: "breath",
    title: "Atem",
    poses: ["breathe", "breatheIn", "breatheOut", "standInhale", "standExhale", "lieInhale", "lieHold", "lieExhale"],
  },
  {
    id: "floor",
    title: "Sitzen und Liegen",
    poses: ["sit", "lie", "kneesUp", "pelvicTuck", "pelvicArch", "child"],
  },
];

export function groupOfPose(pose: PoseId): PoseGroup | undefined {
  return POSE_GROUPS.find((group) => group.poses.includes(pose));
}

/** Umlauts and case should not stand between someone and the pose they are looking for. */
export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

/** "Huefte" is how the word gets typed without an umlaut key, so it has to find "Hüfte" too. */
function needleVariants(query: string): string[] {
  const folded = normalizeSearch(query);
  if (!folded) return [];
  const spelled = folded.replace(/ae/g, "a").replace(/oe/g, "o").replace(/ue/g, "u");
  return spelled === folded ? [folded] : [folded, spelled];
}

export function searchPoses(query: string): PoseId[] {
  const needles = needleVariants(query);
  if (needles.length === 0) return [];
  return POSE_IDS.filter((pose) => {
    const haystack = `${normalizeSearch(POSE_LABELS[pose])} ${normalizeSearch(pose)}`;
    return needles.some((needle) => haystack.includes(needle));
  });
}

/**
 * Everyday words for body parts, mapped to the poses that belong to them. `guessPoses` is tuned for
 * import texts and only fires on fairly specific wording; a step that says "Kopf nach links neigen"
 * should still put the neck poses in front.
 */
const HINTS: Array<{ pattern: RegExp; poses: PoseId[] }> = [
  { pattern: /kopf|nase|ohr|schädel|scheitel|kinn|blick|auge/i, poses: ["neckTilt", "neckLeft", "neckRight", "neckForward", "neckBack", "gazeFar"] },
  { pattern: /kiefer|zahn|zähne|zunge|mund/i, poses: ["jawSoft", "jawLeft", "jawRight"] },
  { pattern: /nacken|hals/i, poses: ["neckLeft", "neckRight", "neckTilt", "neckForward"] },
  { pattern: /schulter|schulterblatt|trapez/i, poses: ["shrug", "shouldersDown", "shoulderForward", "chestOpen"] },
  { pattern: /arm|hand|handgelenk|finger|ellbogen/i, poses: ["reachUp", "wristsFlex", "wristsExtend", "shakeOut"] },
  { pattern: /brust|herz|rippen/i, poses: ["chestOpen", "heart", "breatheIn"] },
  { pattern: /rücken|wirbel|lende/i, poses: ["cat", "cow", "cobra", "fold", "pelvicTuck"] },
  { pattern: /bauch|core|mitte|becken/i, poses: ["plank", "pelvicTuck", "pelvicArch", "kneesUp"] },
  { pattern: /hüfte|gesäß|po\b|leiste/i, poses: ["hipOpen", "hipOpenOther", "lunge", "lungeOther"] },
  { pattern: /knie|bein|wade|fuß|ferse|oberschenkel/i, poses: ["squat", "calfWall", "calfWallOther", "tree", "treeOther"] },
  { pattern: /atem|atmen|einatm|ausatm|luft/i, poses: ["breatheIn", "breatheOut", "standInhale", "standExhale", "lieInhale"] },
  { pattern: /liegen|rückenlage|boden|matte|savasana/i, poses: ["lie", "kneesUp", "lieInhale", "child"] },
  { pattern: /sitzen|sitz|stuhl|seated/i, poses: ["sit", "breathe", "twist", "jawSoft"] },
  { pattern: /stehen|stand|gehen|schritt|laufen/i, poses: ["stand", "walkLeft", "walkRight"] },
  { pattern: /links|linke/i, poses: ["neckLeft", "walkLeft", "jawLeft"] },
  { pattern: /rechts|rechte/i, poses: ["neckRight", "walkRight", "jawRight"] },
];

export function hintedPoses(text: string): PoseId[] {
  const out: PoseId[] = [];
  for (const hint of HINTS) {
    if (!hint.pattern.test(text)) continue;
    for (const pose of hint.poses) if (!out.includes(pose)) out.push(pose);
  }
  return out;
}

export const POSE_SUGGESTION_LIMIT = 8;

/**
 * A short list to start from: what the step text is about, then the neighbours of the pose that is
 * already selected, then the everyday poses. The selected pose is always in the list so it can be
 * seen next to the alternatives.
 */
export function suggestedPoses(stepText: string, selected: PoseId, limit = POSE_SUGGESTION_LIMIT): PoseId[] {
  const out: PoseId[] = [selected];
  const add = (pose: PoseId) => {
    if (!out.includes(pose) && POSE_IDS.includes(pose)) out.push(pose);
  };

  const trimmed = stepText.trim();
  if (trimmed) {
    // Body parts first: `guessPoses` builds a whole sequence for an import and can start with a
    // warm-up pose that has nothing to do with the sentence in front of us.
    for (const pose of hintedPoses(trimmed)) add(pose);
    for (const pose of guessPoses(trimmed)) add(pose);
  }
  for (const pose of groupOfPose(selected)?.poses ?? []) add(pose);
  for (const pose of ["stand", "sit", "breathe", "reachUp"] as PoseId[]) add(pose);

  return out.slice(0, Math.max(1, limit));
}
