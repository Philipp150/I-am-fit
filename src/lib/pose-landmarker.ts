import { POSE_COPY } from "./pose-source";
import { PoseAnalyzeError, type PoseDetector } from "./pose-analyze";
import type { PoseLandmark } from "./pose-map";

const WASM_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
/** Copied out of node_modules by `scripts/copy-mediapipe-wasm.mjs` before every build. */
const WASM_LOCAL = "/mediapipe/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export const POSE_MODEL_TIMEOUT_MS = 90_000;

type PoseLandmarkerLike = {
  detect(image: unknown): { landmarks: Array<Array<{ x: number; y: number; visibility?: number }>> };
  close?: () => void;
};

let landmarkerPromise: Promise<PoseLandmarkerLike> | null = null;

export function poseModelUrls(): { wasm: string; wasmLocal: string; model: string } {
  return { wasm: WASM_CDN, wasmLocal: WASM_LOCAL, model: MODEL_URL };
}

/**
 * Same-origin files first: a blocked or throttled CDN was indistinguishable from "the app is
 * broken", and the WASM ships in the bundle anyway. The CDN stays as a fallback.
 */
export function wasmBaseCandidates(origin?: string): string[] {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return base ? [`${base}${WASM_LOCAL}`, WASM_CDN] : [WASM_CDN];
}

export function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => Error): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(onTimeout()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function createLandmarker(): Promise<PoseLandmarkerLike> {
  const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision").catch(() => {
    throw new PoseAnalyzeError("load-failed", POSE_COPY.loadFailed);
  });

  let lastError: unknown;
  for (const base of wasmBaseCandidates()) {
    try {
      const vision = await FilesetResolver.forVisionTasks(base);
      return await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: "IMAGE",
        numPoses: 1,
        minPoseDetectionConfidence: 0.4,
        minPosePresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof PoseAnalyzeError
    ? lastError
    : new PoseAnalyzeError("load-failed", POSE_COPY.loadFailed);
}

export function getPoseLandmarker(): Promise<PoseLandmarkerLike> {
  if (!landmarkerPromise) {
    landmarkerPromise = withTimeout(
      createLandmarker(),
      POSE_MODEL_TIMEOUT_MS,
      () => new PoseAnalyzeError("load-failed", POSE_COPY.loadFailed),
    );
  }
  return landmarkerPromise.catch((error) => {
    landmarkerPromise = null;
    throw error;
  });
}

export function resetPoseLandmarker(): void {
  landmarkerPromise = null;
}

/** Load the model before the first frame so the UI can say what it is waiting for. */
export async function preparePoseLandmarker(): Promise<void> {
  await getPoseLandmarker();
}

function copyLandmarks(raw: Array<{ x: number; y: number; visibility?: number }> | undefined): PoseLandmark[] | null {
  if (!raw || raw.length < 25) return null;
  return raw.map((point) => ({
    x: point.x,
    y: point.y,
    visibility: point.visibility,
  }));
}

export const mediaPipeDetector: PoseDetector = {
  async detect(image: unknown): Promise<PoseLandmark[] | null> {
    if (!image) return null;
    const landmarker = await getPoseLandmarker();
    try {
      const result = landmarker.detect(image);
      return copyLandmarks(result.landmarks[0]);
    } catch {
      return null;
    }
  },
};
