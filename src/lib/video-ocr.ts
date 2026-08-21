import type { VideoTextCue } from "./video-text";

export const VIDEO_OCR_STRIDE = 3;
export const VIDEO_OCR_MAX_WIDTH = 640;

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

export function shouldReadTextAtSample(index: number, total: number, stride = VIDEO_OCR_STRIDE): boolean {
  if (total <= 0) return false;
  if (total <= 4) return true;
  if (index === 0 || index === total - 1) return true;
  return index % Math.max(1, stride) === 0;
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

export function isNoiseOcr(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 3) return true;
  if (/^\d+([:.,]\d+)*$/.test(trimmed)) return true;
  if (/^(www\.|https?:)/i.test(trimmed)) return true;
  const letters = trimmed.match(/\p{L}/gu) ?? [];
  return letters.length < 2;
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
  const { createWorker } = await import("tesseract.js");
  const urls = tesseractCdnUrls();
  const worker = await createWorker("deu", 1, {
    workerPath: urls.workerPath,
    corePath: urls.corePath,
    langPath: urls.langPath,
  });
  await worker.setParameters({
    tessedit_pageseg_mode: "11",
  });
  return {
    async read(image) {
      try {
        const { data } = await worker.recognize(image);
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
