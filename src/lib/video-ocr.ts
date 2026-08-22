import type { VideoTextCue } from "./video-text";

export const VIDEO_OCR_STRIDE = 3;
export const VIDEO_OCR_MAX_WIDTH = 640;
/** OCR is the slowest step per frame, so a clip gets a fixed number of reads, not a fixed stride. */
export const VIDEO_OCR_MAX_SAMPLES = 14;
/** Below this Tesseract confidence the "text" is usually the background, not an overlay. */
export const VIDEO_OCR_MIN_CONFIDENCE = 62;

export type FrameTextReader = {
  read(image: HTMLCanvasElement | HTMLVideoElement, timeSec: number): Promise<string>;
  dispose?: () => Promise<void>;
};

export function tesseractCdnUrls(): { workerPath: string; corePath: string; langPath: string } {
  return {
    workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@v7.0.0/dist/worker.min.js",
    corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@v7.0.0",
    langPath: "https://tessdata.projectnaptha.com/4.0.0_fast",
  };
}

export function shouldReadTextAtSample(
  index: number,
  total: number,
  stride = VIDEO_OCR_STRIDE,
  maxSamples = VIDEO_OCR_MAX_SAMPLES,
): boolean {
  if (total <= 0 || index < 0 || index >= total) return false;
  if (total <= 4) return true;
  if (index === 0 || index === total - 1) return true;
  const byStride = Math.max(1, stride);
  const byBudget = Math.ceil(total / Math.max(1, maxSamples));
  return index % Math.max(byStride, byBudget) === 0;
}

export function cleanOcrText(raw: string): string {
  return raw
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) =>
      line
        .replace(/[|]/g, " ")
        .replace(/[^\p{L}\p{N}\s:.\-+%/äöüÄÖÜß]/gu, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tesseract happily "reads" gym floors and shadows as strings of one- and two-letter fragments.
 * That noise used to land in the exercise title and summary, so a cue has to look like real words.
 */
export function isNoiseOcr(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 3) return true;
  if (/^\d+([:.,]\d+)*$/.test(trimmed)) return true;
  if (/^(www\.|https?:)/i.test(trimmed)) return true;

  const letters = trimmed.match(/\p{L}/gu) ?? [];
  if (letters.length < 4) return true;
  const dense = trimmed.replace(/\s/g, "");
  if (dense.length > 0 && letters.length / dense.length < 0.55) return true;

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const lettersIn = (token: string) => (token.match(/\p{L}/gu) ?? []).length;
  if (tokens.length === 1) return lettersIn(tokens[0]) < 4;
  const meaningful = tokens.filter((token) => lettersIn(token) >= 3).length;
  if (meaningful < 2) return true;
  const fragments = tokens.filter((token) => lettersIn(token) < 3).length;
  return fragments / tokens.length > 0.5;
}

export function ocrSampleToCue(timeSec: number, raw: string): VideoTextCue | null {
  const text = cleanOcrText(raw);
  if (isNoiseOcr(text)) return null;
  return { startSec: Number(timeSec.toFixed(3)), text, source: "ocr" };
}

export function grabVideoFrame(
  video: HTMLVideoElement,
  canvas?: HTMLCanvasElement,
  maxWidth = VIDEO_OCR_MAX_WIDTH,
): HTMLCanvasElement | null {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return null;
  const scale = Math.min(1, maxWidth / width);
  const target = canvas ?? (typeof document !== "undefined" ? document.createElement("canvas") : null);
  if (!target) return null;
  target.width = Math.max(1, Math.round(width * scale));
  target.height = Math.max(1, Math.round(height * scale));
  const ctx = target.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  try {
    ctx.drawImage(video, 0, 0, target.width, target.height);
    return target;
  } catch {
    return null;
  }
}

export async function createTesseractReader(): Promise<FrameTextReader> {
  const tesseract = await import("tesseract.js");
  const createWorker = tesseract.createWorker;
  const urls = tesseractCdnUrls();
  const worker = await createWorker("deu", 1, {
    workerPath: urls.workerPath,
    corePath: urls.corePath,
    langPath: urls.langPath,
  });
  await worker.setParameters({
    tessedit_pageseg_mode: tesseract.PSM.SPARSE_TEXT,
  });
  return {
    async read(image) {
      try {
        const { data } = await worker.recognize(image);
        const confidence = typeof data.confidence === "number" ? data.confidence : 0;
        if (confidence < VIDEO_OCR_MIN_CONFIDENCE) return "";
        return typeof data.text === "string" ? data.text : "";
      } catch {
        return "";
      }
    },
    async dispose() {
      await worker.terminate();
    },
  };
}
