import { describe, expect, it } from "vitest";
import { getAncestors, getDescendantIds, matchesCategoryFilter } from "./categories";
import type { Category } from "./types";

const categories: Category[] = [
  { id: "a", name: "A", slug: "a", parentId: null, description: "", isSystem: true },
  { id: "b", name: "B", slug: "b", parentId: "a", description: "", isSystem: true },
  { id: "c", name: "C", slug: "c", parentId: "b", description: "", isSystem: true },
  { id: "d", name: "D", slug: "d", parentId: null, description: "", isSystem: true },
];

describe("categories", () => {
  it("walks ancestors from leaf to root", () => {
    expect(getAncestors(categories, "c").map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("includes nested children in descendant ids", () => {
    expect(getDescendantIds(categories, "a").sort()).toEqual(["a", "b", "c"]);
  });

  it("matches an exercise tagged with a child when filtering by parent", () => {
    expect(matchesCategoryFilter(["c"], "a", categories)).toBe(true);
    expect(matchesCategoryFilter(["d"], "a", categories)).toBe(false);
    expect(matchesCategoryFilter(["c"], null, categories)).toBe(true);
  });
});
