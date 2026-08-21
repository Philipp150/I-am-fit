import { describe, expect, it } from "vitest";
import { CATALOG_EXERCISES } from "./catalog";
import { findExercisesBySourceUrl, hasDuplicateSourceUrl, normalizeSourceUrl, sourceUrlsMatch } from "./source-match";
import type { Exercise } from "./types";

function sample(partial: Partial<Exercise> & Pick<Exercise, "id" | "title">): Exercise {
  return {
    summary: "",
    kind: "movement",
    categoryIds: ["cat-body"],
    complaintIds: [],
    steps: [{ pose: "stand", text: "Stehen.", durationSec: 8 }],
    defaultDurationSec: 60,
    suggestedRhythm: { kind: "daily", recommendedWeeks: null, note: "Täglich." },
    source: { type: "user" },
    isSystem: false,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...partial,
  };
}

describe("source URL matching", () => {
  it("treats YouTube watch and youtu.be links as the same", () => {
    expect(normalizeSourceUrl("https://youtu.be/dQw4w9WgXcQ?si=abc")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(
      sourceUrlsMatch("https://youtu.be/dQw4w9WgXcQ", "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12s"),
    ).toBe(true);
    expect(sourceUrlsMatch("https://youtu.be/dQw4w9WgXcQ", "https://www.youtube.com/watch?v=aaaaaaaaaaa")).toBe(
      false,
    );
  });

  it("finds an existing user exercise for the same link and does not invent a second id", () => {
    const existing = sample({
      id: "ex-mine",
      title: "Nacken aus dem Reel",
      source: { type: "import", url: "https://youtu.be/dQw4w9WgXcQ", provider: "youtube" },
    });
    const other = sample({
      id: "ex-other",
      title: "Andere",
      source: { type: "import", url: "https://www.youtube.com/watch?v=aaaaaaaaaaa" },
    });
    const hits = findExercisesBySourceUrl([existing, other], "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(hasDuplicateSourceUrl([existing, other], "https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(hits).toHaveLength(1);
    expect(hits[0].id).toBe("ex-mine");
    expect(hits[0].id).not.toBe("ex-other");
  });

  it("matches a system catalog source URL and prefers the user-owned copy when both exist", () => {
    const catalogHit = sample({
      id: "ex-neck-circles",
      title: "Nacken langsam kreisen",
      isSystem: true,
      source: { type: "catalog", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
    });
    const mine = sample({
      id: "ex-user-copy",
      title: "Meine Nackenfassung",
      source: { type: "import", url: "https://youtu.be/dQw4w9WgXcQ" },
    });
    expect(findExercisesBySourceUrl([catalogHit], "https://youtu.be/dQw4w9WgXcQ")[0].id).toBe("ex-neck-circles");
    expect(findExercisesBySourceUrl([catalogHit, mine], "https://youtu.be/dQw4w9WgXcQ")[0].id).toBe("ex-user-copy");
  });

  it("does not treat catalog entries without a URL as duplicates", () => {
    expect(hasDuplicateSourceUrl(CATALOG_EXERCISES, "https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(false);
  });
});
