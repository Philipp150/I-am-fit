import { describe, expect, it } from "vitest";
import { cleanOcrText, isNoiseOcr, ocrSampleToCue, shouldReadTextAtSample, tesseractCdnUrls } from "./video-ocr";

describe("video OCR helpers", () => {
  it("samples OCR sparser than pose fps", () => {
    const hits = Array.from({ length: 12 }, (_, i) => shouldReadTextAtSample(i, 12, 3)).filter(Boolean).length;
    expect(hits).toBeLessThan(12);
    expect(hits).toBeGreaterThanOrEqual(4);
    expect(shouldReadTextAtSample(0, 12)).toBe(true);
    expect(shouldReadTextAtSample(11, 12)).toBe(true);
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

  it("loads tesseract from jsdelivr, not YouTube", () => {
    const urls = tesseractCdnUrls();
    expect(urls.workerPath).toContain("cdn.jsdelivr.net");
    expect(urls.corePath).toContain("tesseract.js-core");
    expect(urls.workerPath).not.toContain("youtube");
    expect(urls.langPath).not.toContain("youtube");
  });
});
