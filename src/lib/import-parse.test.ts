import { describe, expect, it } from "vitest";
import {
  deriveExercisesFromMeta,
  detectProvider,
  extractNumberedItems,
  guessKind,
  hasUsableMeta,
  isSupportedSourceUrl,
  validateSourceUrl,
} from "./import-parse";

describe("import parsing", () => {
  it("detects providers and rejects invalid urls", () => {
    expect(detectProvider("https://www.youtube.com/watch?v=abc")).toBe("youtube");
    expect(detectProvider("https://youtu.be/abc")).toBe("youtube");
    expect(detectProvider("https://www.instagram.com/reel/xyz")).toBe("instagram");
    expect(detectProvider("https://example.com/p")).toBe("web");
    expect(isSupportedSourceUrl("https://youtu.be/abc")).toBe(true);
    expect(isSupportedSourceUrl("not-a-url")).toBe(false);
    expect(validateSourceUrl("")).toMatchObject({ code: "empty_url" });
    expect(validateSourceUrl("ftp://example.com/x")).toMatchObject({ code: "unsupported_protocol" });
    expect(validateSourceUrl("just text")).toMatchObject({ code: "invalid_url" });
    expect(hasUsableMeta({ url: "https://youtu.be/abc", title: "youtu.be", description: "" })).toBe(false);
    expect(hasUsableMeta({ url: "https://youtu.be/abc", title: "Nacken Yoga am Schreibtisch", description: "" })).toBe(
      true,
    );
  });

  it("splits numbered lists into candidate titles", () => {
    const text = `Heute:\n1. Katze-Kuh\n2. Kindeshaltung\n- Bonus`;
    expect(extractNumberedItems(text)).toEqual(["Katze-Kuh", "Kindeshaltung", "Bonus"]);
  });

  it("derives a mantra instead of a workout from matching language", () => {
    const drafts = deriveExercisesFromMeta({
      url: "https://www.youtube.com/watch?v=1",
      provider: "youtube",
      title: "Morgen Mantra: Ich bin hier",
      description: "Eine Affirmation für den Start in den Tag.",
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0].kind).toBe("mantra");
    expect(drafts[0].source.type).toBe("import");
    expect(drafts[0].steps.every((step) => step.pose)).toBe(true);
  });

  it("creates several stick-figure exercises from a counted title", () => {
    const drafts = deriveExercisesFromMeta({
      url: "https://www.instagram.com/reel/neck",
      provider: "instagram",
      title: "5 Übungen für den Nacken",
      description: "Gegen Nackensteifheit am Schreibtisch.",
    });
    expect(drafts).toHaveLength(5);
    expect(drafts[0].complaintIds).toContain("comp-neck");
    expect(drafts[0].categoryIds).toContain("cat-neck");
    expect(guessKind("Box Breathing 4-4-4-4")).toBe("breath");
  });
});
