import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { poseModelUrls } from "./pose-landmarker";
import { POSE_COPY } from "./pose-source";

function read(rel: string): string {
  return readFileSync(resolve(__dirname, rel), "utf8");
}

describe("pose track UI copy and player wiring", () => {
  it("plays a track in PosePlayer and falls back to PoseIds", () => {
    const player = read("../components/PosePlayer.tsx");
    expect(player).toContain("hasPlayableTrack");
    expect(player).toContain("sampleTrackPose");
    expect(player).toContain("playerMode");
    expect(player).toContain("poseTrack");
    expect(player).toContain("Bewegungsspur");
  });

  it("offers an upload path and German analysis copy", () => {
    const capture = read("../components/PoseTrackCapture.tsx");
    expect(capture).toContain("POSE_COPY.progress");
    expect(capture).toContain("accept=\"video/*\"");
    expect(capture).toContain("mediaPipeDetector");
    expect(capture).toContain("pixelAvailabilityForUrl");
    expect(capture).not.toContain("yt-dlp");
    expect(POSE_COPY.progress).toBe("Bewegung wird erkannt …");
    expect(POSE_COPY.ocrProgress).toBe("Text im Video wird gelesen …");
    expect(POSE_COPY.noPerson).toContain("Keine Person");
    expect(capture).toContain("analyzeClip");
    expect(capture).toContain("createTesseractReader");
    expect(capture).toContain("POSE_COPY.ocrProgress");
  });

  it("keeps YouTube as metadata-only in import copy", () => {
    const page = read("../app/catalog/import/page.tsx");
    expect(page).toContain("liefern keine");
    expect(page).toContain("Pixel");
    expect(page).toContain("ExerciseEditor");
  });

  it("loads MediaPipe from a public WASM URL instead of YouTube", () => {
    const urls = poseModelUrls();
    expect(urls.wasm).toContain("cdn.jsdelivr.net");
    expect(urls.model).toContain("pose_landmarker_lite");
    expect(urls.wasm).not.toContain("youtube");
    const landmarker = read("./pose-landmarker.ts");
    expect(landmarker).toContain("@mediapipe/tasks-vision");
    expect(landmarker).not.toContain("yt-dlp");
  });
});
