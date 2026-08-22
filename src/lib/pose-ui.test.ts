import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { poseModelUrls, wasmBaseCandidates } from "./pose-landmarker";
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

  it("shows progress, a way out and a retry hint instead of a silent wait", () => {
    const capture = read("../components/PoseTrackCapture.tsx");
    expect(capture).toContain("role=\"progressbar\"");
    expect(capture).toContain("POSE_COPY.cancel");
    expect(capture).toContain("POSE_COPY.retry");
    expect(capture).toContain("POSE_COPY.modelProgress");
    expect(capture).toContain("POSE_COPY.frameCount");
    expect(POSE_COPY.cancel).toBe("Abbrechen");
    expect(POSE_COPY.modelProgress).toContain("geladen");
    expect(POSE_COPY.tooFewPeopleFrames(0.1)).toContain("10 %");
    expect(POSE_COPY.partial(0.6)).toContain("60 %");
  });

  it("hides the upload hint once a track exists and shows a before/after", () => {
    const capture = read("../components/PoseTrackCapture.tsx");
    expect(capture).toContain("hasTrack || busy ? \"\" : pixelNotice(availability)");
    expect(capture).toContain("PoseTrackCompare");
    const compare = read("../components/PoseTrackCompare.tsx");
    expect(compare).toContain("poseForSteps");
    expect(compare).toContain("sampleTrackPose");
    expect(compare).toContain("POSE_COPY.compareBefore");
    expect(compare).toContain("POSE_COPY.compareAfter");
    expect(POSE_COPY.compareAfter).toContain("Bewegungsspur");
  });

  it("keeps YouTube as metadata-only in import copy", () => {
    const page = read("../app/catalog/import/page.tsx");
    expect(page).toContain("liefern keine");
    expect(page).toContain("Pixel");
    expect(page).toContain("ExerciseEditor");
  });

  it("loads MediaPipe from our own origin first and a public CDN second", () => {
    const urls = poseModelUrls();
    expect(urls.wasm).toContain("cdn.jsdelivr.net");
    expect(urls.wasmLocal).toBe("/mediapipe/wasm");
    expect(urls.model).toContain("pose_landmarker_lite");
    expect(urls.wasm).not.toContain("youtube");
    const candidates = wasmBaseCandidates("https://i-am-super-fit.vercel.app");
    expect(candidates[0]).toBe("https://i-am-super-fit.vercel.app/mediapipe/wasm");
    expect(candidates[1]).toContain("cdn.jsdelivr.net");
    const landmarker = read("./pose-landmarker.ts");
    expect(landmarker).toContain("@mediapipe/tasks-vision");
    expect(landmarker).not.toContain("yt-dlp");
    expect(landmarker).toContain("withTimeout");
  });

  it("copies the MediaPipe WASM into public before every build", () => {
    const pkg = JSON.parse(read("../../package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts.prebuild).toContain("assets:mediapipe");
    expect(pkg.scripts["assets:mediapipe"]).toContain("copy-mediapipe-wasm");
    const script = readFileSync(resolve(__dirname, "../../scripts/copy-mediapipe-wasm.mjs"), "utf8");
    expect(script).toContain("@mediapipe/tasks-vision/wasm");
    expect(script).toContain("public/mediapipe/wasm");
    const ignore = readFileSync(resolve(__dirname, "../../.gitignore"), "utf8");
    expect(ignore).toContain("/public/mediapipe/");
  });
});
