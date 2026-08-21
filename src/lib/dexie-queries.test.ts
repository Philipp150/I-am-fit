import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { sortByTitle } from "./db";

const HOOKS = readFileSync(resolve(__dirname, "hooks.ts"), "utf8");
const REPOSITORY = readFileSync(resolve(__dirname, "repository.ts"), "utf8");
const DB = readFileSync(resolve(__dirname, "db.ts"), "utf8");

describe("Dexie exercise listing", () => {
  it("sorts by title in memory so missing indexes cannot crash render", () => {
    expect(sortByTitle([{ title: "Zebra" }, { title: "Atem" }, { title: "Nacken" }]).map((item) => item.title)).toEqual([
      "Atem",
      "Nacken",
      "Zebra",
    ]);
  });

  it("does not call orderBy(title) on the exercises table", () => {
    expect(HOOKS).not.toContain('orderBy("title")');
    expect(REPOSITORY).not.toContain('orderBy("title")');
    expect(HOOKS).toContain("listLocalExercises");
    expect(REPOSITORY).toContain("listLocalExercises");
    expect(HOOKS).toContain("useSafeLiveQuery");
  });

  it("keeps exercise title off the Dexie index list", () => {
    expect(DB).toMatch(/exercises:\s*"id, kind, isSystem, updatedAt"/);
    expect(DB).not.toMatch(/exercises:\s*"[^"]*title[^"]*"/);
  });
});
