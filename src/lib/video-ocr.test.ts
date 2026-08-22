import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  cleanOcrText,
  isNoiseOcr,
  ocrSampleToCue,
  shouldReadTextAtSample,
  tesseractCdnUrls,
  VIDEO_OCR_MAX_SAMPLES,
} from "./video-ocr";

function read(rel: string): string {
  return readFileSync(resolve(__dirname, rel), "utf8");
}

describe("video OCR helpers", () => {
  it("samples OCR sparser than pose fps", () => {
    const hits = Array.from({ length: 12 }, (_, i) => shouldReadTextAtSample(i, 12, 3)).filter(Boolean).length;
    expect(hits).toBeLessThan(12);
    expect(hits).toBeGreaterThanOrEqual(4);
    expect(shouldReadTextAtSample(0, 12)).toBe(true);
    expect(shouldReadTextAtSample(11, 12)).toBe(true);
  });

  it("caps OCR reads per clip so a long video does not spend minutes on text", () => {
    const total = 300;
    const hits = Array.from({ length: total }, (_, i) => shouldReadTextAtSample(i, total)).filter(Boolean).length;
    expect(hits).toBeLessThanOrEqual(VIDEO_OCR_MAX_SAMPLES + 2);
    expect(hits).toBeGreaterThan(4);
    expect(shouldReadTextAtSample(0, total)).toBe(true);
    expect(shouldReadTextAtSample(total - 1, total)).toBe(true);
  });

  it("drops timers and one-character OCR as noise", () => {
    expect(isNoiseOcr(cleanOcrText("00:12"))).toBe(true);
    expect(isNoiseOcr("|")).toBe(true);
    expect(isNoiseOcr("8")).toBe(true);
    expect(ocrSampleToCue(1.2, "www.example.com")).toBeNull();
    expect(ocrSampleToCue(3, "Schritt 2: Nacken")).toMatchObject({
      startSec: 3,
      source: "ocr",
      text: "Schritt 2: Nacken",
    });
  });

  it("drops letter salad that Tesseract reads off a gym floor", () => {
    const salad = "WW En ES d. By en l un Le By 4 el 2 BETZ a SETZE 7 z u ze 7 Le a 7a UM BE a ea B";
    expect(isNoiseOcr(cleanOcrText(salad))).toBe(true);
    expect(ocrSampleToCue(2, salad)).toBeNull();
    expect(isNoiseOcr(cleanOcrText("a b c d e f g h"))).toBe(true);
  });

  it("keeps short real overlays", () => {
    expect(isNoiseOcr(cleanOcrText("SQUAT"))).toBe(false);
    expect(isNoiseOcr(cleanOcrText("Nacken rechts"))).toBe(false);
    expect(isNoiseOcr(cleanOcrText("Schritt 1 Schultern kreisen"))).toBe(false);
  });

  it("throws away frames Tesseract itself is unsure about", () => {
    const reader = read("./video-ocr.ts");
    expect(reader).toContain("VIDEO_OCR_MIN_CONFIDENCE");
    expect(reader).toContain("if (confidence < VIDEO_OCR_MIN_CONFIDENCE) return \"\"");
  });

  it("loads tesseract from jsdelivr, not YouTube", () => {
    const urls = tesseractCdnUrls();
    expect(urls.workerPath).toContain("cdn.jsdelivr.net");
    expect(urls.corePath).toContain("tesseract.js-core");
    expect(urls.workerPath).not.toContain("youtube");
    expect(urls.langPath).not.toContain("youtube");
  });
});
