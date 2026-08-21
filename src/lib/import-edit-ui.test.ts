import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(resolve(__dirname, rel), "utf8");
}

describe("import and custom-exercise UI", () => {
  it("makes generated import fields and the mannequin editable instead of a dead preview", () => {
    const page = read("../app/catalog/import/page.tsx");
    expect(page).toContain("ExerciseEditor");
    expect(page).toContain("findExercisesBySourceUrl");
    expect(page).toContain("Dieser Link ist schon in der Sammlung");
    expect(page).toContain("Ohne Link anlegen");
    expect(page).toContain("Anpassungen speichern");
    expect(page).not.toContain("ExerciseCard");
  });

  it("creates exercises without a URL from the eigene-Übung form", () => {
    const page = read("../app/catalog/new/page.tsx");
    expect(page).toContain("createCustomExercise");
    expect(page).toContain("emptyCustomDraft");
    expect(page).toContain("Ohne Link");
    expect(page).toContain("ExerciseEditor");
  });

  it("lets saved exercises change fields and PosePlayer steps afterwards", () => {
    const detail = read("../app/catalog/[id]/page.tsx");
    const edit = read("../app/catalog/[id]/edit/page.tsx");
    const editor = read("../components/ExerciseEditor.tsx");
    expect(detail).toContain("Felder und Figur anpassen");
    expect(detail).toContain("/catalog/${exercise.id}/edit");
    expect(edit).toContain("ExerciseEditor");
    expect(edit).toContain("prepareImportedSave");
    expect(editor).toContain("PosePlayer");
    expect(editor).toContain("applyPoseOverride");
    expect(editor).toContain("Anzeige der Figur");
  });

  it("does not reintroduce CaptionTrack null, getProfile-in-addCompletion, or Dexie orderBy title", () => {
    const extract = read("./extract-meta.ts");
    const repository = read("./repository.ts");
    const db = read("./db.ts");
    expect(extract).toContain("captionTrackFromUnknown");
    expect(extract).toContain("if (track) tracks.push(track)");
    expect(repository).toContain("export async function getProfile(): Promise<Profile | undefined> {");
    expect(repository).toContain("export async function addCompletion(item: Completion): Promise<void> {");
    expect(db).not.toMatch(/exercises:\s*"[^"]*title[^"]*"/);
    expect(db).not.toContain('orderBy("title")');
    expect(repository).not.toContain('orderBy("title")');
  });
});
