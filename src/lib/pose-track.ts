import { lerpPose, POSES, type JointAngles } from "./poses";

export const POSE_TRACK_VERSION = 1 as const;
export const POSE_TRACK_DEFAULT_FPS = 10;
export const POSE_TRACK_MIN_FPS = 8;
export const POSE_TRACK_MAX_FPS = 12;
export const POSE_TRACK_MAX_DURATION_SEC = 90;
export const POSE_TRACK_MAX_JSON_BYTES = 400_000;

export const JOINT_KEYS = [
  "hipX",
  "hipY",
  "bodyTilt",
  "torso",
  "neck",
  "jaw",
  "leftUpperArm",
  "leftForearm",
  "leftHand",
  "rightUpperArm",
  "rightForearm",
  "rightHand",
  "leftThigh",
  "leftShin",
  "rightThigh",
  "rightShin",
  "shoulderLift",
  "headShiftX",
  "headShiftY",
  "chest",
] as const satisfies readonly (keyof JointAngles)[];

export type JointKey = (typeof JOINT_KEYS)[number];

export type PoseTrackSourceKind = "upload" | "file-url";

/** Compact time series of mannequin joint angles. Frames are packed in `joints` order. */
export type PoseTrack = {
  version: typeof POSE_TRACK_VERSION;
  fps: number;
  durationSec: number;
  joints: JointKey[];
  frames: number[][];
  sourceKind: PoseTrackSourceKind;
  analyzedAt: string;
};

export function roundJoint(value: number): number {
  return Math.round(value * 10) / 10;
}

export function poseToFrame(pose: JointAngles, joints: readonly JointKey[] = JOINT_KEYS): number[] {
  return joints.map((key) => roundJoint(pose[key] ?? 0));
}

export function frameToPose(values: number[] | undefined, joints: readonly JointKey[] = JOINT_KEYS): JointAngles {
  const pose: JointAngles = { ...POSES.stand };
  if (!values) return pose;
  for (let i = 0; i < joints.length; i++) {
    const n = values[i];
    if (typeof n === "number" && Number.isFinite(n)) pose[joints[i]] = n;
  }
  return pose;
}

export function estimateTrackJsonBytes(track: PoseTrack): number {
  return new TextEncoder().encode(JSON.stringify(track)).length;
}

function downsampleFrames(frames: number[][], factor: number): number[][] {
  if (factor <= 1) return frames;
  const kept: number[][] = [];
  for (let i = 0; i < frames.length; i += factor) kept.push(frames[i]);
  if (kept.length === 0) return frames;
  const last = frames[frames.length - 1];
  if (kept[kept.length - 1] !== last) kept.push(last);
  return kept;
}

export function encodePoseTrack(input: {
  poses: JointAngles[];
  durationSec: number;
  fps?: number;
  sourceKind: PoseTrackSourceKind;
  analyzedAt?: string;
}): PoseTrack {
  const fps = Math.min(POSE_TRACK_MAX_FPS, Math.max(POSE_TRACK_MIN_FPS, input.fps ?? POSE_TRACK_DEFAULT_FPS));
  const durationSec = Math.max(0.1, Math.min(POSE_TRACK_MAX_DURATION_SEC, input.durationSec));
  const joints = [...JOINT_KEYS];
  let frames = input.poses.map((pose) => poseToFrame(pose, joints));
  if (frames.length === 0) frames = [poseToFrame(POSES.stand, joints)];

  let track: PoseTrack = {
    version: POSE_TRACK_VERSION,
    fps,
    durationSec: roundJoint(durationSec),
    joints,
    frames,
    sourceKind: input.sourceKind,
    analyzedAt: input.analyzedAt ?? new Date().toISOString(),
  };

  let factor = 2;
  while (estimateTrackJsonBytes(track) > POSE_TRACK_MAX_JSON_BYTES && track.frames.length > 8) {
    const nextFrames = downsampleFrames(track.frames, factor);
    const nextFps = Math.max(1, roundJoint(track.fps / factor));
    track = { ...track, fps: nextFps, frames: nextFrames };
    factor *= 2;
  }
  return track;
}

function isJointKey(value: unknown): value is JointKey {
  return typeof value === "string" && (JOINT_KEYS as readonly string[]).includes(value);
}

export function parsePoseTrack(raw: unknown): PoseTrack | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (record.version !== POSE_TRACK_VERSION) return null;
  if (typeof record.fps !== "number" || !Number.isFinite(record.fps) || record.fps <= 0) return null;
  if (typeof record.durationSec !== "number" || !Number.isFinite(record.durationSec) || record.durationSec <= 0) {
    return null;
  }
  if (record.sourceKind !== "upload" && record.sourceKind !== "file-url") return null;
  if (typeof record.analyzedAt !== "string" || !record.analyzedAt) return null;
  if (!Array.isArray(record.frames) || record.frames.length === 0) return null;

  const joints = Array.isArray(record.joints)
    ? record.joints.filter(isJointKey)
    : [...JOINT_KEYS];
  if (joints.length === 0) return null;

  const frames: number[][] = [];
  for (const entry of record.frames) {
    if (!Array.isArray(entry)) return null;
    const row: number[] = [];
    for (let i = 0; i < joints.length; i++) {
      const n = entry[i];
      row.push(typeof n === "number" && Number.isFinite(n) ? n : 0);
    }
    frames.push(row);
  }

  return {
    version: POSE_TRACK_VERSION,
    fps: record.fps,
    durationSec: record.durationSec,
    joints,
    frames,
    sourceKind: record.sourceKind,
    analyzedAt: record.analyzedAt,
  };
}

export function hasPlayableTrack(track: PoseTrack | null | undefined): track is PoseTrack {
  return Boolean(track && track.version === POSE_TRACK_VERSION && track.frames.length > 0 && track.durationSec > 0);
}

export function wrapTime(timeSec: number, durationSec: number): number {
  if (durationSec <= 0) return 0;
  return ((timeSec % durationSec) + durationSec) % durationSec;
}

export function sampleTrackPose(
  track: PoseTrack,
  timeSec: number,
  loop: boolean,
): { pose: JointAngles; t: number; finished: boolean; index: number } {
  const duration = Math.max(track.durationSec, 1 / Math.max(track.fps, 1));
  const n = track.frames.length;
  const joints = track.joints.length > 0 ? track.joints : [...JOINT_KEYS];

  if (n === 0) {
    return { pose: POSES.stand, t: 0, finished: true, index: 0 };
  }

  let t = timeSec;
  let finished = false;
  if (loop) {
    t = wrapTime(t, duration);
  } else if (t >= duration) {
    t = duration;
    finished = true;
  }
  if (t < 0) t = 0;

  if (n === 1) {
    return { pose: frameToPose(track.frames[0], joints), t, finished, index: 0 };
  }

  const pos = duration <= 0 ? 0 : (t / duration) * (n - 1);
  const i0 = Math.min(n - 1, Math.max(0, Math.floor(pos)));
  const i1 = Math.min(n - 1, i0 + 1);
  const frac = pos - i0;
  const pose = lerpPose(frameToPose(track.frames[i0], joints), frameToPose(track.frames[i1], joints), frac);
  return { pose, t, finished, index: i0 };
}
