import { POSE_COPY } from "./pose-source";
import { PoseAnalyzeError, type PoseDetector } from "./pose-analyze";
import type { PoseLandmark } from "./pose-map";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

type PoseLandmarkerLike = {
  detect(image: unknown): { landmarks: Array<Array<{ x: number; y: number; visibility?: number }>> };
  close?: () => void;
};

let landmarkerPromise: Promise<PoseLandmarkerLike> | null = null;

export function poseModelUrls(): { wasm: string; model: string } {
  return { wasm: WASM_BASE, model: MODEL_URL };
}

export function resetPoseLandmarker(): void {
  landmarkerPromise = null;
}

async function createLandmarker(): Promise<PoseLandmarkerLike> {
  try {
    const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
    const landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
      },
      runningMode: "IMAGE",
      numPoses: 1,
      minPoseDetectionConfidence: 0.4,
      minPosePresenceConfidence: 0.4,
      minTrackingConfidence: 0.4,
    });
    return landmarker;
  } catch {
    throw new PoseAnalyzeError("load-failed", POSE_COPY.loadFailed);
  }
}

export function getPoseLandmarker(): Promise<PoseLandmarkerLike> {
  if (!landmarkerPromise) landmarkerPromise = createLandmarker();
  return landmarkerPromise.catch((error) => {
    landmarkerPromise = null;
    throw error;
  });
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
