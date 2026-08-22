import { describe, expect, it } from "vitest";
import {
  buildPoseTrackFromDetections,
  detectionRate,
  MIN_DETECTION_RATE,
  PoseAnalyzeError,
  sampleTimes,
} from "./pose-analyze";
import { MP, standingLandmarks, type PoseLandmark } from "./pose-map";
import { POSE_COPY } from "./pose-source";
import {
  hasPlayableTrack,
  POSE_TRACK_MAX_SAMPLES,
  sampleFpsForDuration,
  sampleTrackPose,
} from "./pose-track";
import { poseForSteps } from "./player";
import type { ExerciseStep } from "./types";

function squatting(depth: number): PoseLandmark[] {
  const points = standingLandmarks().map((point) => ({ ...point }));
  for (const index of [MP.LEFT_HIP, MP.RIGHT_HIP]) {
    points[index] = { ...points[index], y: points[index].y + depth };
  }
  for (const index of [MP.LEFT_KNEE, MP.RIGHT_KNEE]) {
    points[index] = { ...points[index], x: points[index].x + (index === MP.LEFT_KNEE ? -0.06 : 0.06) };
  }
  return points;
}

describe("upload analysis path", () => {
  it("samples a modest fps timeline", () => {
    const times = sampleTimes(2, 10);
    expect(times[0]).toBe(0);
    expect(times.length).toBeGreaterThanOrEqual(18);
    expect(times.length).toBeLessThanOrEqual(22);
  });

  it("spends a fixed sample budget so a long clip does not run for minutes", () => {
    for (const duration of [4, 20, 45, 90]) {
      const fps = sampleFpsForDuration(duration);
      expect(sampleTimes(duration, fps).length).toBeLessThanOrEqual(POSE_TRACK_MAX_SAMPLES + 2);
    }
    expect(sampleFpsForDuration(5)).toBe(10);
    expect(sampleFpsForDuration(90)).toBeLessThan(10);
    expect(sampleFpsForDuration(90)).toBeGreaterThanOrEqual(2);
  });

  it("builds a playable track from detections that contain a person", () => {
    const detections = [standingLandmarks(), standingLandmarks(), standingLandmarks()];
    const track = buildPoseTrackFromDetections({
      durationSec: 1.2,
      fps: 10,
      detections,
      sourceKind: "upload",
      analyzedAt: "2026-08-21T10:00:00.000Z",
    });
    expect(hasPlayableTrack(track)).toBe(true);
    expect(track.sourceKind).toBe("upload");
    expect(sampleTrackPose(track, 0, false).pose.hipY).toBeGreaterThan(120);
  });

  it("fails clearly when no person is found", () => {
    expect(() =>
      buildPoseTrackFromDetections({
        durationSec: 1,
        fps: 10,
        detections: [null, [], null],
        sourceKind: "upload",
        analyzedAt: "2026-08-21T10:00:00.000Z",
      }),
    ).toThrow(PoseAnalyzeError);
    try {
      buildPoseTrackFromDetections({
        durationSec: 1,
        fps: 10,
        detections: [null, null],
        sourceKind: "upload",
        analyzedAt: "2026-08-21T10:00:00.000Z",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(PoseAnalyzeError);
      expect((error as PoseAnalyzeError).code).toBe("no-person");
      expect((error as PoseAnalyzeError).message).toBe(POSE_COPY.noPerson);
    }
  });

  it("refuses a track that only caught a person in a handful of frames", () => {
    const detections = Array.from({ length: 20 }, (_, i) => (i === 3 ? standingLandmarks() : null));
    expect(detectionRate(detections)).toBeLessThan(MIN_DETECTION_RATE);
    try {
      buildPoseTrackFromDetections({
        durationSec: 2,
        fps: 10,
        detections,
        sourceKind: "upload",
      });
      throw new Error("expected a PoseAnalyzeError");
    } catch (error) {
      expect((error as PoseAnalyzeError).code).toBe("no-person");
      expect((error as PoseAnalyzeError).message).toContain("5 %");
    }
  });

  it("bridges short gaps with the last seen pose instead of snapping to a default", () => {
    const detections = [squatting(0.14), null, null, squatting(0.14), squatting(0.14), squatting(0.14)];
    const track = buildPoseTrackFromDetections({
      durationSec: 0.6,
      fps: 10,
      detections,
      sourceKind: "upload",
    });
    const deep = sampleTrackPose(track, 0.1, false).pose;
    const gap = sampleTrackPose(track, 0.2, false).pose;
    expect(Math.abs(gap.hipY - deep.hipY)).toBeLessThan(6);
  });

  it("turns a squat into hip travel and knee bend, not a still figure", () => {
    const detections = Array.from({ length: 24 }, (_, i) => squatting(i % 12 < 6 ? 0 : 0.16));
    const track = buildPoseTrackFromDetections({
      durationSec: 2.4,
      fps: 10,
      detections,
      sourceKind: "upload",
    });
    const hips = track.frames.map((frame) => frame[track.joints.indexOf("hipY")]);
    expect(Math.max(...hips) - Math.min(...hips)).toBeGreaterThan(15);
    const thighs = track.frames.map((frame) => frame[track.joints.indexOf("leftThigh")]);
    expect(Math.max(...thighs) - Math.min(...thighs)).toBeGreaterThan(5);
  });

  it("plays a track that differs from the authored fallback poses", () => {
    const steps: ExerciseStep[] = [{ pose: "stand", text: "Stehen", durationSec: 4 }];
    const detections = Array.from({ length: 16 }, (_, i) => squatting(i % 8 < 4 ? 0 : 0.16));
    const track = buildPoseTrackFromDetections({
      durationSec: 1.6,
      fps: 10,
      detections,
      sourceKind: "upload",
    });
    const fallback = poseForSteps(steps, 0, 1);
    const samples = [0, 0.4, 0.8, 1.2].map((t) => sampleTrackPose(track, t, true).pose);
    const differs = samples.some((pose) => Math.abs(pose.hipY - fallback.hipY) > 4);
    const moves = Math.max(...samples.map((p) => p.hipY)) - Math.min(...samples.map((p) => p.hipY));
    expect(differs).toBe(true);
    expect(moves).toBeGreaterThan(4);
  });
});
