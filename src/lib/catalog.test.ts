import { describe, expect, it } from "vitest";
import { CATALOG_EXERCISES, CATEGORIES, COMPLAINTS } from "./catalog";
import { POSES } from "./poses";

describe("catalog integrity", () => {
  it("references only known categories, complaints and poses", () => {
    const categoryIds = new Set(CATEGORIES.map((item) => item.id));
    const complaintIds = new Set(COMPLAINTS.map((item) => item.id));
    for (const exercise of CATALOG_EXERCISES) {
      expect(exercise.steps.length).toBeGreaterThan(0);
      for (const id of exercise.categoryIds) expect(categoryIds.has(id)).toBe(true);
      for (const id of exercise.complaintIds) expect(complaintIds.has(id)).toBe(true);
      for (const step of exercise.steps) expect(POSES[step.pose]).toBeTruthy();
    }
  });

  it("keeps parent pointers inside the tree", () => {
    const ids = new Set(CATEGORIES.map((item) => item.id));
    for (const category of CATEGORIES) {
      if (category.parentId) expect(ids.has(category.parentId)).toBe(true);
    }
  });
});
