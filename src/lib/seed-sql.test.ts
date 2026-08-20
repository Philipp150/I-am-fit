import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATALOG_EXERCISES } from "./catalog";

describe("supabase seed", () => {
  it("includes every catalog exercise id", () => {
    const seed = readFileSync(new URL("../../supabase/seed.sql", import.meta.url), "utf8");
    for (const exercise of CATALOG_EXERCISES) {
      expect(seed).toContain(`'${exercise.id}'`);
    }
  });
});
