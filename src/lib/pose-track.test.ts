import { describe, expect, it } from "vitest";
import { POSES } from "./poses";
import {
  encodePoseTrack,
  estimateTrackJsonBytes,
  frameToPose,
  hasPlayableTrack,
  parsePoseTrack,
  POSE_TRACK_MAX_JSON_BYTES,
  POSE_TRACK_MAX_SAMPLES,
  poseToFrame,
  sampleFpsForDuration,
  sampleTrackPose,
  smoothPoseSeries,
} from "./pose-track";

describe("pose track JSON shape", () => {
  it("packs joint angles in a stable key order and round-trips", () => {
    const track = encodePoseTrack({
      poses: [POSES.stand, POSES.reachUp, POSES.fold],
      durationSec: 2,
      fps: 10,
      sourceKind: "upload",
      analyzedAt: "2026-08-21T10:00:00.000Z",
    });
    expect(track.version).toBe(1);
    expect(track.fps).toBe(10);
    expect(track.durationSec).toBe(2);
    expect(track.frames).toHaveLength(3);
    expect(track.joints[0]).toBe("hipX");
    expect(track.sourceKind).toBe("upload");
    const parsed = parsePoseTrack(JSON.parse(JSON.stringify(track)));
    expect(parsed).toEqual(track);
    expect(frameToPose(track.frames[0], track.joints).hipY).toBeCloseTo(POSES.stand.hipY, 0);
  });

  it("rejects slideshow-like garbage and missing frames", () => {
    expect(parsePoseTrack({ version: 1, frames: ["stand", "fold"] })).toBeNull();
    expect(parsePoseTrack({ version: 2, fps: 10, durationSec: 1, frames: [[0]], joints: ["hipX"], sourceKind: "upload", analyzedAt: "x" })).toBeNull();
    expect(parsePoseTrack(null)).toBeNull();
    expect(hasPlayableTrack(undefined)).toBe(false);
    expect(hasPlayableTrack(parsePoseTrack({ version: 1, fps: 10, durationSec: 1, frames: [], joints: ["hipX"], sourceKind: "upload", analyzedAt: "x" }))).toBe(false);
  });

  it("keeps a minute of motion in the KB to low-hundreds-KB range", () => {
    const poses = Array.from({ length: 600 }, (_, i) => (i % 2 === 0 ? POSES.walkLeft : POSES.walkRight));
    const track = encodePoseTrack({
      poses,
      durationSec: 60,
      fps: 10,
      sourceKind: "upload",
      analyzedAt: "2026-08-21T10:00:00.000Z",
    });
    const bytes = estimateTrackJsonBytes(track);
    expect(bytes).toBeGreaterThan(8_000);
    expect(bytes).toBeLessThan(POSE_TRACK_MAX_JSON_BYTES);
    expect(bytes).toBeLessThan(250_000);
  });
});

describe("track playback sampling", () => {
  const track = encodePoseTrack({
    poses: [POSES.stand, POSES.reachUp],
    durationSec: 1,
    fps: 10,
    sourceKind: "file-url",
    analyzedAt: "2026-08-21T10:00:00.000Z",
  });

  it("interpolates between frames and loops or finishes", () => {
    const start = sampleTrackPose(track, 0, false);
    const mid = sampleTrackPose(track, 0.5, false);
    const end = sampleTrackPose(track, 1, false);
    const looped = sampleTrackPose(track, 1.25, true);
    expect(start.finished).toBe(false);
    expect(end.finished).toBe(true);
    expect(mid.pose.leftUpperArm).toBeGreaterThan(start.pose.leftUpperArm);
    expect(mid.pose.leftUpperArm).toBeLessThan(end.pose.leftUpperArm);
    expect(looped.finished).toBe(false);
    expect(looped.t).toBeCloseTo(0.25, 5);
    expect(poseToFrame(POSES.stand)[0]).toBeGreaterThan(0);
  });

  it("closes the loop through the wrap instead of snapping back to the first frame", () => {
    const ring = encodePoseTrack({
      poses: [POSES.stand, POSES.reachUp, POSES.fold, POSES.squat],
      durationSec: 1,
      fps: 10,
      sourceKind: "upload",
      analyzedAt: "2026-08-21T10:00:00.000Z",
    });
    const before = sampleTrackPose(ring, 0.999, true).pose;
    const after = sampleTrackPose(ring, 0.001, true).pose;
    const jump = Math.abs(before.leftUpperArm - after.leftUpperArm);
    const step = Math.abs(POSES.squat.leftUpperArm - POSES.stand.leftUpperArm);
    expect(jump).toBeLessThan(step * 0.2);
  });
});

describe("sampling budget and smoothing", () => {
  it("lowers the sampling rate for long clips so the analysis stays bounded", () => {
    expect(sampleFpsForDuration(6)).toBe(10);
    expect(sampleFpsForDuration(90) * 90).toBeLessThanOrEqual(POSE_TRACK_MAX_SAMPLES + 10);
    expect(sampleFpsForDuration(90)).toBeGreaterThanOrEqual(2);
  });

  it("takes the shiver out of a jittery series without shifting it in time", () => {
    const noisy = Array.from({ length: 40 }, (_, i) => ({
      ...POSES.stand,
      leftUpperArm: 20 + (i % 2 === 0 ? 9 : -9),
      hipY: 148,
    }));
    const smooth = smoothPoseSeries(noisy);
    const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
    const middle = smooth.slice(10, 30).map((pose) => pose.leftUpperArm);
    expect(spread(middle)).toBeLessThan(6);
    const mean = middle.reduce((sum, value) => sum + value, 0) / middle.length;
    expect(mean).toBeCloseTo(20, 0);
  });

  it("keeps real movement while smoothing", () => {
    const ramp = Array.from({ length: 30 }, (_, i) => ({ ...POSES.stand, leftThigh: i * 3 }));
    const smooth = smoothPoseSeries(ramp);
    expect(smooth[29].leftThigh - smooth[0].leftThigh).toBeGreaterThan(60);
  });

  it("blends rotations along the short arc across the ±180 seam", () => {
    const seam = [
      { ...POSES.stand, leftUpperArm: 178 },
      { ...POSES.stand, leftUpperArm: -178 },
      { ...POSES.stand, leftUpperArm: 178 },
      { ...POSES.stand, leftUpperArm: -178 },
    ];
    for (const pose of smoothPoseSeries(seam)) {
      expect(Math.abs(pose.leftUpperArm)).toBeGreaterThan(170);
    }
  });
});
