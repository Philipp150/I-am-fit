import { describe, expect, it } from "vitest";
import { emptyCustomDraft, patchDraft, prepareImportedSave } from "./exercise-draft";
import { encodePoseTrack } from "./pose-track";
import { POSES } from "./poses";
import {
  applyAnalysisToDraft,
  applyVideoTextToDraft,
  clusterOverlayCues,
  mergedTranscript,
  mergeVideoCues,
  parseStepMarker,
  pauseResumeTimes,
  suggestFromVideoText,
  type VideoTextCue,
} from "./video-text";

function ocr(startSec: number, text: string): VideoTextCue {
  return { startSec, text, source: "ocr" };
}

describe("video text merge and step stamps", () => {
  it("keeps captions when OCR is present", () => {
    const ocrCues = [ocr(0, "Nacken Yoga"), ocr(1, "Nacken Yoga")];
    const captions = "Atme ein. Schultern schwer lassen.";
    const merged = mergedTranscript(ocrCues, captions);
    expect(merged).toContain("Atme ein");
    expect(merged).toContain("Nacken Yoga");
    const cues = mergeVideoCues(ocrCues, [{ startSec: 0, text: captions, source: "caption" }]);
    expect(cues.some((cue) => cue.source === "caption")).toBe(true);
    expect(cues.some((cue) => cue.source === "ocr")).toBe(true);
  });

  it("turns OCR Schritt markers into steps with start times", () => {
    const suggestion = suggestFromVideoText({
      ocrCues: [
        ocr(0.2, "Nackenflow"),
        ocr(0.5, "Nackenflow"),
        ocr(1, "Schritt 1: Aufrecht stehen"),
        ocr(1.4, "Schritt 1: Aufrecht stehen"),
        ocr(14, "Schritt 2: Nacken neigen"),
        ocr(14.4, "Schritt 2: Nacken neigen"),
        ocr(28, "Schritt 3: Kiefer lösen"),
        ocr(28.4, "Schritt 3: Kiefer lösen"),
      ],
      captions: "Öffentliche Untertitel: langsam atmen.",
      existingTitle: "Video vom Kanal",
      existingSummary: "Kurzes Video.",
      durationSec: 40,
    });
    expect(suggestion.foundText).toBe(true);
    expect(suggestion.captionText).toContain("langsam atmen");
    expect(suggestion.steps).toHaveLength(3);
    expect(suggestion.steps?.[0].startSec).toBeCloseTo(1, 0);
    expect(suggestion.steps?.[1].startSec).toBeCloseTo(14, 0);
    expect(suggestion.steps?.[2].startSec).toBeCloseTo(28, 0);
    expect(suggestion.steps?.[1].text).toMatch(/Nacken/i);
    expect(suggestion.steps?.[1].pose).not.toBe("walkLeft");
  });

  it("stamps numbered caption items using timed cues and does not drop the transcript", () => {
    const suggestion = suggestFromVideoText({
      ocrCues: [ocr(2, "links"), ocr(2.4, "links")],
      captions: "Heute:\n1. Schultern hochziehen\n2. Nacken neigen\n3. Kiefer lösen",
      captionCues: [
        { startSec: 0.5, durationSec: 2, text: "Heute Schultern hochziehen" },
        { startSec: 12, durationSec: 2, text: "Nacken neigen zur Seite" },
        { startSec: 24, durationSec: 2, text: "Kiefer lösen und atmen" },
      ],
      existingTitle: "Nacken am Schreibtisch",
      durationSec: 36,
    });
    expect(suggestion.foundText).toBe(true);
    expect(suggestion.captionText).toContain("Schultern hochziehen");
    expect(suggestion.ocrText).toContain("links");
    expect(suggestion.steps?.length).toBe(3);
    expect(suggestion.steps?.[0].startSec).toBeCloseTo(0.5, 0);
    expect(suggestion.steps?.[1].startSec).toBeCloseTo(12, 0);
    expect(suggestion.steps?.[2].startSec).toBeCloseTo(24, 0);
    expect(suggestion.summary).toContain("Schultern");
  });

  it("does not invent twenty steps from OCR noise", () => {
    const noise: VideoTextCue[] = Array.from({ length: 24 }, (_, index) =>
      ocr(index * 0.3, index % 2 === 0 ? `${index}` : "|"),
    );
    const suggestion = suggestFromVideoText({
      ocrCues: noise,
      captions: "",
      existingTitle: "Pause im Stehen",
      durationSec: 8,
    });
    expect(suggestion.steps).toBeUndefined();
    expect((suggestion.steps ?? []).length).toBeLessThan(3);
    const segments = clusterOverlayCues(noise);
    expect(segments.length).toBeLessThan(8);
  });

  it("falls back to pose-only metadata when no text is found", () => {
    const draft = patchDraft(emptyCustomDraft(), {
      title: "Importtitel",
      summary: "Aus YouTube gelesen.",
      steps: [{ pose: "stand", text: "Stehen.", durationSec: 8 }],
    });
    const suggestion = suggestFromVideoText({
      ocrCues: [ocr(0, "8"), ocr(0.4, "|"), ocr(0.8, "00:12")],
      captions: "   ",
      existingTitle: draft.title,
      existingSummary: draft.summary,
      durationSec: 12,
    });
    expect(suggestion.foundText).toBe(false);
    const track = encodePoseTrack({
      poses: [POSES.stand, POSES.fold],
      durationSec: 2,
      fps: 10,
      sourceKind: "upload",
      analyzedAt: "2026-08-21T10:00:00.000Z",
    });
    const next = applyAnalysisToDraft(draft, track, suggestion);
    expect(next.poseTrack).toEqual(track);
    expect(next.title).toBe("Importtitel");
    expect(next.summary).toBe("Aus YouTube gelesen.");
    expect(next.steps).toEqual(draft.steps);
  });

  it("applies OCR steps onto a draft without dropping captions already in the summary", () => {
    const draft = patchDraft(emptyCustomDraft(), {
      title: "Video vom Kanal",
      summary: "Öffentliche Untertitel: atme ein.",
      steps: [{ pose: "stand", text: "Stehen.", durationSec: 8 }],
    });
    const suggestion = suggestFromVideoText({
      ocrCues: [
        ocr(0, "Schritt 1: Stehen"),
        ocr(0.5, "Schritt 1: Stehen"),
        ocr(10, "Schritt 2: Beugen"),
        ocr(10.5, "Schritt 2: Beugen"),
      ],
      captions: "Öffentliche Untertitel: atme ein.",
      existingTitle: draft.title,
      existingSummary: draft.summary,
      durationSec: 20,
    });
    const next = applyVideoTextToDraft(draft, suggestion);
    expect(next.steps).toHaveLength(2);
    expect(next.steps[0].startSec).toBeDefined();
    expect(next.summary).toContain("atme ein");
    const saved = prepareImportedSave({ draft: next, now: "2026-08-21T10:00:00.000Z", newId: "ex-ocr" });
    expect(saved.steps[1].startSec).toBeCloseTo(10, 0);
  });

  it("parses Schritt markers and treats pause-resume as a weak extra boundary only with nearby text", () => {
    expect(parseStepMarker("Schritt 2: Nacken neigen")).toEqual({ index: 2, label: "Nacken neigen" });
    expect(parseStepMarker("Step 1")).toEqual({ index: 1, label: "" });
    const pauses = pauseResumeTimes([40, 40, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 35, 40], 2, 2.5);
    expect(pauses.length).toBeGreaterThanOrEqual(1);
  });
});
