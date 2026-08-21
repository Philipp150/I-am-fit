import { describe, expect, it } from "vitest";
import {
  composeImportMeta,
  deriveExercisesFromMeta,
  detectProvider,
  extractNumberedItems,
  guessKind,
  guessPoses,
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
    expect(extractNumberedItems("1. Schultern hoch 2. Nacken neigen 3. Kiefer lösen")).toEqual([
      "Schultern hoch",
      "Nacken neigen",
      "Kiefer lösen",
    ]);
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
    expect(drafts[0].source.url).toBe("https://www.youtube.com/watch?v=1");
    expect(drafts[0].source.provider).toBe("youtube");
  });

  it("uses public captions for numbered steps and stores thumbnail plus provider", () => {
    const drafts = deriveExercisesFromMeta({
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      provider: "youtube",
      title: "Nacken am Schreibtisch",
      description: "Kurzes Video.",
      captions: "Heute:\n1. Schultern hochziehen\n2. Nacken neigen\n3. Kiefer lösen",
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      author: "Studio Wald",
    });
    expect(drafts).toHaveLength(3);
    expect(drafts[0].title).toBe("Schultern hochziehen");
    expect(drafts[0].source.provider).toBe("youtube");
    expect(drafts[0].source.thumbnailUrl).toContain("hqdefault");
    expect(drafts[1].title).toBe("Nacken neigen");
    expect(drafts[0].steps.map((step) => step.pose)).toEqual(
      expect.arrayContaining(["shrug", "shouldersDown"]),
    );
    expect(drafts[1].steps.map((step) => step.pose)).toEqual(
      expect.arrayContaining(["neckLeft", "neckRight"]),
    );
    expect(drafts[1].steps.some((step) => step.pose === "shrug")).toBe(false);
    expect(drafts[2].steps.map((step) => step.pose)).toEqual(
      expect.arrayContaining(["jawSoft", "jawLeft", "jawRight"]),
    );
  });

  it("composes oembed title, author and thumbnail over page meta", () => {
    const meta = composeImportMeta({
      url: "https://youtu.be/dQw4w9WgXcQ",
      provider: "youtube",
      oembed: {
        title: "oEmbed Titel",
        author_name: "Kanal",
        thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      },
      page: { title: "HTML Titel", description: "Beschreibung aus der Seite, lang genug." },
      captions: "Atme ein. Atme aus.",
    });
    expect(meta.title).toBe("oEmbed Titel");
    expect(meta.author).toBe("Kanal");
    expect(meta.thumbnailUrl).toContain("hqdefault");
    expect(meta.description).toContain("Beschreibung");
    expect(meta.captions).toContain("Atme ein");
    expect(hasUsableMeta(meta)).toBe(true);
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
    expect(drafts[0].steps.some((step) => step.pose === "shrug")).toBe(false);
    expect(drafts[0].steps.map((step) => step.pose)).toEqual(
      expect.arrayContaining(["neckLeft", "neckRight"]),
    );
  });

  it("does not treat numbered Schritt lists as walking", () => {
    expect(guessPoses("Schritt 1: aufrecht stehen. Schritt 2: atmen.")).not.toContain("walkLeft");
  });

  it("keeps a neck stretch on neck poses even if the video text mentions shoulders", () => {
    const poses = guessPoses(
      "Nacken dehnen gegen Verspannungen",
      "Schultern nicht hochziehen. Kopf zur Seite neigen. Langsam kreisen.",
    );
    expect(poses).toEqual(expect.arrayContaining(["neckLeft", "neckRight"]));
    expect(poses).not.toContain("shrug");
    expect(poses).not.toContain("walkLeft");
  });

  it("does not shrug when the cue is to keep the shoulders down", () => {
    expect(guessPoses("Nacken neigen. Schultern nicht hochziehen.")).not.toContain("shrug");
  });

  it("animates walking from gehen, not from a standing default", () => {
    const poses = guessPoses("Zwei Minuten achtsam gehen");
    expect(poses).toEqual(expect.arrayContaining(["walkLeft", "walkRight"]));
    expect(poses[0]).toBe("stand");
  });

  it("moves the jaw instead of freezing the head for a Kiefer video", () => {
    expect(guessPoses("Kiefer locker lassen")).toEqual(
      expect.arrayContaining(["jawSoft", "jawLeft", "jawRight"]),
    );
  });

  it("shows both sides for a lunge that names a side change", () => {
    expect(guessPoses("Ausfallschritt, dann die andere Seite")).toEqual(
      expect.arrayContaining(["lunge", "lungeOther"]),
    );
  });
});
