import { describe, expect, it } from "vitest";
import { suggestExercisesForComplaints } from "./suggestions";
import { CATALOG_EXERCISES } from "./catalog";

describe("complaint suggestions", () => {
  it("returns overlapping catalog exercises for neck tension", () => {
    const result = suggestExercisesForComplaints(["comp-neck"], CATALOG_EXERCISES);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((exercise) => exercise.complaintIds.includes("comp-neck"))).toBe(true);
  });

  it("ranks double matches first", () => {
    const result = suggestExercisesForComplaints(["comp-neck", "comp-shoulders"], CATALOG_EXERCISES);
    expect(result[0].complaintIds.filter((id) => id === "comp-neck" || id === "comp-shoulders").length).toBeGreaterThanOrEqual(2);
  });

  it("returns nothing without a complaint", () => {
    expect(suggestExercisesForComplaints([], CATALOG_EXERCISES)).toEqual([]);
  });
});
