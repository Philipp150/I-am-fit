import { describe, expect, it } from "vitest";
import { deriveExercisesFromMeta } from "./import-parse";
import { applyPoseOverride, applyStepPatch, canSaveDraft, createCustomExercise, emptyCustomDraft, exerciseToDraft, patchDraft, prepareImportedSave } from "./exercise-draft";
import { POSES } from "./poses";
import { encodePoseTrack } from "./pose-track";
import type { Exercise } from "./types";

const NOW = "2026-08-21T10:00:00.000Z";

describe("edit generated import fields", () => {
  it("lets the user change title, summary, duration, categories and steps before save", () => {
    const [generated] = deriveExercisesFromMeta({
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      provider: "youtube",
      title: "Nacken am Schreibtisch",
      description: "Schultern schwer lassen. Kopf zur Seite neigen.",
    });
    expect(generated.title).toBe("Nacken am Schreibtisch");

    const edited = patchDraft(generated, {
      title: "Mein Nacken-Flow",
      summary: "Kurz und ohne Druck.",
      defaultDurationSec: 120,
      categoryIds: ["cat-neck", "cat-pause"],
      complaintIds: ["comp-neck"],
      steps: applyStepPatch(generated.steps, 0, { text: "Aufrecht stehen, Kiefer locker." }),
    });

    const saved = prepareImportedSave({ draft: edited, now: NOW, newId: "ex-new" });
    expect(saved.id).toBe("ex-new");
    expect(saved.title).toBe("Mein Nacken-Flow");
    expect(saved.summary).toBe("Kurz und ohne Druck.");
    expect(saved.defaultDurationSec).toBe(120);
    expect(saved.categoryIds).toEqual(["cat-neck", "cat-pause"]);
    expect(saved.complaintIds).toEqual(["comp-neck"]);
    expect(saved.steps[0].text).toBe("Aufrecht stehen, Kiefer locker.");
    expect(saved.isSystem).toBe(false);
    expect(saved.source.type).toBe("import");
    expect(saved.source.url).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(saved.poseTrack).toBeUndefined();
  });

  it("updates an existing duplicate instead of creating a second copy", () => {
    const [generated] = deriveExercisesFromMeta({
      url: "https://youtu.be/dQw4w9WgXcQ",
      provider: "youtube",
      title: "Altes Video",
      description: "Erste Fassung.",
    });
    const existing: Exercise = {
      ...generated,
      id: "ex-already",
      title: "Altes Video",
      isSystem: false,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    };
    const edited = patchDraft(exerciseToDraft(existing), { title: "Angepasst", summary: "Neue Kurzfassung." });
    const saved = prepareImportedSave({
      draft: edited,
      existing,
      now: NOW,
      newId: "ex-should-not-use",
    });
    expect(saved.id).toBe("ex-already");
    expect(saved.id).not.toBe("ex-should-not-use");
    expect(saved.createdAt).toBe("2026-07-01T00:00:00.000Z");
    expect(saved.updatedAt).toBe(NOW);
    expect(saved.title).toBe("Angepasst");
    expect(saved.source.url).toBe("https://youtu.be/dQw4w9WgXcQ");
  });
});

describe("create without a source URL", () => {
  it("stores a user-owned exercise with no source url", () => {
    const exercise = createCustomExercise({
      id: "ex-custom",
      now: NOW,
      title: "Pause im Stehen",
      summary: "Zwei Atemzüge, Schultern schwer.",
      kind: "breath",
      categoryIds: ["cat-pause", "cat-breath"],
      complaintIds: ["comp-stress"],
      steps: [
        { pose: "standInhale", text: "Einatmen im Stand.", durationSec: 6 },
        { pose: "standExhale", text: "Ausatmen, Schultern fallen lassen.", durationSec: 8 },
      ],
      defaultDurationSec: 45,
    });
    expect(exercise.id).toBe("ex-custom");
    expect(exercise.title).toBe("Pause im Stehen");
    expect(exercise.source.type).toBe("user");
    expect(exercise.source.url).toBeUndefined();
    expect(exercise.isSystem).toBe(false);
    expect(exercise.kind).toBe("breath");
    expect(exercise.steps).toHaveLength(2);
    expect(exercise.poseTrack).toBeUndefined();
    expect(canSaveDraft(emptyCustomDraft())).toBe(false);
    expect(canSaveDraft(patchDraft(emptyCustomDraft(), { title: "Pause im Stehen" }))).toBe(true);
  });
});

describe("pose override for the mannequin", () => {
  it("changes only the chosen step pose so PosePlayer can follow the new figure", () => {
    const steps = [
      { pose: "stand" as const, text: "Stehen.", durationSec: 8 },
      { pose: "fold" as const, text: "Beugen.", durationSec: 8 },
    ];
    const overridden = applyPoseOverride(steps, 1, "warrior");
    expect(overridden[0].pose).toBe("stand");
    expect(overridden[1].pose).toBe("warrior");
    expect(overridden[1].text).toBe("Beugen.");
    expect(applyPoseOverride(steps, 9, "tree")).toEqual(steps);
  });
});

describe("pose track on drafts", () => {
  it("keeps an uploaded track through save and replaces it on re-analyze", () => {
    const track = encodePoseTrack({
      poses: [POSES.stand, POSES.fold],
      durationSec: 2,
      fps: 10,
      sourceKind: "upload",
      analyzedAt: "2026-08-21T10:00:00.000Z",
    });
    const replaced = encodePoseTrack({
      poses: [POSES.reachUp, POSES.stand],
      durationSec: 1.5,
      fps: 10,
      sourceKind: "upload",
      analyzedAt: "2026-08-21T11:00:00.000Z",
    });
    const first = prepareImportedSave({
      draft: patchDraft(emptyCustomDraft(), { title: "Clip", poseTrack: track }),
      now: NOW,
      newId: "ex-track",
    });
    expect(first.poseTrack).toEqual(track);
    const second = prepareImportedSave({
      draft: patchDraft(exerciseToDraft(first), { poseTrack: replaced }),
      existing: first,
      now: NOW,
      newId: "ex-other",
    });
    expect(second.id).toBe("ex-track");
    expect(second.poseTrack).toEqual(replaced);
    const cleared = prepareImportedSave({
      draft: patchDraft(exerciseToDraft(second), { poseTrack: null }),
      existing: second,
      now: NOW,
      newId: "ex-other",
    });
    expect(cleared.poseTrack).toBeNull();
  });
});
