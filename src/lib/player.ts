import { lerpPose, POSES } from "./poses";
import { hasPlayableTrack, sampleTrackPose, type PoseTrack } from "./pose-track";
import type { ExerciseStep } from "./types";

export function nextStepIndex(
  index: number,
  length: number,
  loop: boolean,
): { index: number; finished: boolean } {
  if (length <= 0) return { index: 0, finished: true };
  if (index + 1 < length) return { index: index + 1, finished: false };
  if (loop) return { index: 0, finished: false };
  return { index, finished: true };
}

export function playerMode(track: PoseTrack | null | undefined): "track" | "steps" {
  return hasPlayableTrack(track) ? "track" : "steps";
}

export function stepsDurationSec(steps: ExerciseStep[]): number {
  if (steps.length === 0) return 1;
  return steps.reduce((sum, step) => sum + Math.max(0.2, step.durationSec || 0), 0);
}

export function stepStartTimes(steps: ExerciseStep[], totalDuration: number): number[] {
  const duration = Math.max(totalDuration, 0.1);
  const stamped = steps.map((step) =>
    typeof step.startSec === "number" && Number.isFinite(step.startSec) ? Math.max(0, step.startSec) : null,
  );
  if (stamped.some((value) => value !== null)) {
    let last = 0;
    return stamped.map((value, index) => {
      if (value !== null) {
        last = Math.min(duration, value);
        return last;
      }
      const nextStamped = stamped.findIndex((entry, i) => i > index && entry !== null);
      const nextTime = nextStamped >= 0 ? Math.min(duration, stamped[nextStamped] as number) : duration;
      const gap = nextStamped >= 0 ? nextStamped - index + 1 : steps.length - index;
      last = last + (nextTime - last) / Math.max(1, gap);
      return last;
    });
  }
  const sum = stepsDurationSec(steps);
  const scale = sum > 0 ? duration / sum : 1;
  let acc = 0;
  return steps.map((step) => {
    const start = acc * scale;
    acc += Math.max(0.2, step.durationSec || 0);
    return start;
  });
}

export function formatStepClock(timeSec: number): string {
  const sec = Math.max(0, Math.round(timeSec));
  const minutes = Math.floor(sec / 60);
  const rest = sec % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

export function captionAtTime(
  steps: ExerciseStep[],
  timeSec: number,
  durationSec: number,
): { index: number; text: string } {
  if (steps.length === 0) return { index: 0, text: "" };
  const starts = stepStartTimes(steps, Math.max(durationSec, 0.1));
  let index = 0;
  for (let i = 0; i < starts.length; i++) {
    if (timeSec + 1e-4 >= starts[i]) index = i;
  }
  return { index, text: steps[index]?.text ?? "" };
}

export function jumpTrackTime(
  steps: ExerciseStep[],
  durationSec: number,
  currentTime: number,
  deltaSteps: number,
): number {
  if (steps.length === 0) return Math.max(0, currentTime);
  const starts = stepStartTimes(steps, Math.max(durationSec, 0.1));
  let index = 0;
  for (let i = 0; i < starts.length; i++) {
    if (currentTime + 1e-4 >= starts[i]) index = i;
  }
  const next = Math.min(steps.length - 1, Math.max(0, index + deltaSteps));
  return starts[next] ?? 0;
}

export function poseForSteps(steps: ExerciseStep[], index: number, blend: number) {
  const safe = steps.length > 0 ? steps : [{ pose: "stand" as const, text: "", durationSec: 4 }];
  const safeIndex = Math.min(Math.max(0, index), safe.length - 1);
  const current = safe[safeIndex];
  const previous = safe[(safeIndex - 1 + safe.length) % safe.length];
  return lerpPose(POSES[previous.pose] ?? POSES.stand, POSES[current.pose] ?? POSES.stand, blend);
}

export function poseForPlayer(input: {
  track?: PoseTrack | null;
  steps: ExerciseStep[];
  timeSec: number;
  stepIndex: number;
  blend: number;
  loop: boolean;
}) {
  if (hasPlayableTrack(input.track)) {
    return sampleTrackPose(input.track, input.timeSec, input.loop);
  }
  return {
    pose: poseForSteps(input.steps, input.stepIndex, input.blend),
    t: input.timeSec,
    finished: false,
    index: input.stepIndex,
  };
}
