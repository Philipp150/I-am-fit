import { describe, expect, it } from "vitest";
import { captionAtTime, nextStepIndex, playerMode, poseForPlayer } from "./player";
import { POSES } from "./poses";
import { encodePoseTrack } from "./pose-track";
import type { ExerciseStep } from "./types";

const steps: ExerciseStep[] = [
  { pose: "stand", text: "Stehen.", durationSec: 4 },
  { pose: "fold", text: "Beugen.", durationSec: 4 },
];

describe("practice player", () => {
  it("advances until the last step, then finishes without looping", () => {
    expect(nextStepIndex(0, 3, false)).toEqual({ index: 1, finished: false });
    expect(nextStepIndex(2, 3, false)).toEqual({ index: 2, finished: true });
  });

  it("wraps when looping", () => {
    expect(nextStepIndex(2, 3, true)).toEqual({ index: 0, finished: false });
  });

  it("treats an empty sequence as finished", () => {
    expect(nextStepIndex(0, 0, false)).toEqual({ index: 0, finished: true });
  });

  it("plays a pose track when present and falls back to PoseIds otherwise", () => {
    const track = encodePoseTrack({
      poses: [POSES.stand, POSES.reachUp],
      durationSec: 2,
      fps: 10,
      sourceKind: "upload",
      analyzedAt: "2026-08-21T10:00:00.000Z",
    });
    expect(playerMode(track)).toBe("track");
    expect(playerMode(undefined)).toBe("steps");
    expect(playerMode(null)).toBe("steps");

    const fromTrack = poseForPlayer({ track, steps, timeSec: 1, stepIndex: 0, blend: 1, loop: false });
    expect(fromTrack.pose.leftUpperArm).not.toBe(POSES.stand.leftUpperArm);

    const fallback = poseForPlayer({ track: null, steps, timeSec: 0, stepIndex: 1, blend: 1, loop: false });
    expect(fallback.pose).toEqual(POSES.fold);
    expect(captionAtTime(steps, 0, 2).text).toBe("Stehen.");
    expect(captionAtTime(steps, 1.2, 2).text).toBe("Beugen.");
  });
});
