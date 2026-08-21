import { describe, expect, it } from "vitest";
import { PoseAnalyzeError, buildPoseTrackFromDetections, sampleTimes } from "./pose-analyze";
import { standingLandmarks } from "./pose-map";
import { POSE_COPY } from "./pose-source";
import { hasPlayableTrack, sampleTrackPose } from "./pose-track";

describe("upload analysis path", () => {
  it("samples a modest fps timeline", () => {
    const times = sampleTimes(2, 10);
    expect(times[0]).toBe(0);
    expect(times.length).toBeGreaterThanOrEqual(18);
    expect(times.length).toBeLessThanOrEqual(22);
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
});
