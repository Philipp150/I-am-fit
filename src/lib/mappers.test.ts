import { describe, expect, it } from "vitest";
import { exerciseFromRow, exerciseToRow } from "./mappers";
import type { Exercise } from "./types";

const sample: Exercise = {
  id: "ex-1",
  title: "Test",
  summary: "Kurz",
  kind: "mantra",
  categoryIds: ["cat-mantras"],
  complaintIds: ["comp-focus"],
  steps: [{ pose: "heart", text: "Sag den Satz.", durationSec: 8 }],
  defaultDurationSec: 60,
  suggestedRhythm: { kind: "daily", recommendedWeeks: null, note: "Täglich." },
  source: { type: "user" },
  isSystem: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("supabase mappers", () => {
  it("round-trips a user exercise with owner", () => {
    const row = exerciseToRow(sample, "user-1");
    expect(row.owner_id).toBe("user-1");
    expect(row.category_ids).toEqual(["cat-mantras"]);
    expect(exerciseFromRow(row).title).toBe("Test");
    expect(exerciseFromRow(row).categoryIds).toEqual(["cat-mantras"]);
  });

  it("clears owner for catalog exercises", () => {
    const row = exerciseToRow({ ...sample, isSystem: true }, "user-1");
    expect(row.owner_id).toBeNull();
    expect(row.is_system).toBe(true);
  });
});
