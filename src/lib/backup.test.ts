import { describe, expect, it } from "vitest";
import { backupFilename, buildBackup, parseBackup, userExercisesOnly } from "./backup";
import type { Exercise, PlanItem } from "./types";

const system: Exercise = {
  id: "ex-sys",
  title: "Katalog",
  summary: "",
  kind: "movement",
  categoryIds: [],
  complaintIds: [],
  steps: [{ pose: "stand", text: "", durationSec: 8 }],
  defaultDurationSec: 60,
  suggestedRhythm: { kind: "daily", recommendedWeeks: null, note: "" },
  source: { type: "catalog" },
  isSystem: true,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

const own: Exercise = { ...system, id: "ex-mine", title: "Meine", isSystem: false, source: { type: "user" } };

const plan: PlanItem = {
  id: "p1",
  exerciseId: "ex-mine",
  enabled: true,
  rhythm: { kind: "daily", startDate: "2026-08-01" },
  createdAt: "2026-08-01T00:00:00.000Z",
};

describe("backup", () => {
  it("omits catalog exercises from the payload", () => {
    const backup = buildBackup([system, own], [plan], [], undefined, "2026-08-21T10:00:00.000Z");
    expect(userExercisesOnly([system, own]).map((item) => item.id)).toEqual(["ex-mine"]);
    expect(backup.exercises).toHaveLength(1);
    expect(backup.planItems).toHaveLength(1);
    expect(backupFilename(new Date("2026-08-21T10:00:00.000Z"))).toBe("i-am-fit-backup-2026-08-21.json");
  });

  it("round-trips JSON and rejects broken files", () => {
    const backup = buildBackup([own], [plan], [], undefined, "2026-08-21T10:00:00.000Z");
    expect(parseBackup(JSON.stringify(backup)).exercises[0].id).toBe("ex-mine");
    expect(() => parseBackup("{")).toThrow(/JSON/);
    expect(() => parseBackup(JSON.stringify({ version: 99, exercises: [], planItems: [], completions: [] }))).toThrow(
      /Version/,
    );
  });
});
