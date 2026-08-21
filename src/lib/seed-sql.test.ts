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

  it("adds pose_track jsonb for compact mannequin timelines", () => {
    const schema = readFileSync(new URL("../../supabase/schema.sql", import.meta.url), "utf8");
    expect(schema).toContain("pose_track jsonb");
    expect(schema).toContain("alter table public.exercises add column if not exists pose_track jsonb");
  });
});
