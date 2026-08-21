import { lerpPose, type JointAngles } from "./poses";
import { landmarksHavePerson, landmarksToJointAngles, type PoseLandmark } from "./pose-map";
import { POSE_COPY } from "./pose-source";
import {
  encodePoseTrack,
  POSE_TRACK_DEFAULT_FPS,
  POSE_TRACK_MAX_DURATION_SEC,
  type PoseTrack,
  type PoseTrackSourceKind,
} from "./pose-track";
import { grabVideoFrame, ocrSampleToCue, shouldReadTextAtSample, type FrameTextReader } from "./video-ocr";
import type { VideoTextCue } from "./video-text";

export type PoseAnalyzeCode = "no-person" | "no-pixels" | "load-failed" | "too-short" | "tainted";

export class PoseAnalyzeError extends Error {
  readonly code: PoseAnalyzeCode;

  constructor(code: PoseAnalyzeCode, message: string) {
    super(message);
    this.name = "PoseAnalyzeError";
    this.code = code;
  }
}

export type PoseDetector = {
  detect(image: unknown, timeSec: number): PoseLandmark[] | null | Promise<PoseLandmark[] | null>;
};

export type AnalyzeProgress = {
  ratio: number;
  label: string;
};

export function sampleTimes(durationSec: number, fps: number, maxDuration = POSE_TRACK_MAX_DURATION_SEC): number[] {
  const clipped = Math.min(Math.max(0, durationSec), maxDuration);
  if (clipped < 0.15) return [];
  const step = 1 / Math.max(1, fps);
  const times: number[] = [];
  for (let t = 0; t < clipped - 0.02; t += step) times.push(Number(t.toFixed(3)));
  const last = Number(Math.max(0, clipped - 0.04).toFixed(3));
  if (times.length === 0 || times[times.length - 1] < last - step / 2) times.push(last);
  return times;
}

export function buildPoseTrackFromDetections(input: {
  durationSec: number;
  fps?: number;
  detections: Array<PoseLandmark[] | null>;
  sourceKind: PoseTrackSourceKind;
  analyzedAt?: string;
}): PoseTrack {
  const fps = input.fps ?? POSE_TRACK_DEFAULT_FPS;
  const durationSec = Math.min(POSE_TRACK_MAX_DURATION_SEC, Math.max(0, input.durationSec));
  if (durationSec < 0.15 || input.detections.length === 0) {
    throw new PoseAnalyzeError("too-short", POSE_COPY.tooShort);
  }

  const poses: Array<JointAngles | null> = [];
  let last: JointAngles | undefined;
  let hits = 0;
  for (const detection of input.detections) {
    if (detection && landmarksHavePerson(detection)) {
      last = landmarksToJointAngles(detection, last);
      hits += 1;
      poses.push(last);
    } else if (last) {
      poses.push(last);
    } else {
      poses.push(null);
    }
  }

  const firstHit = poses.findIndex((pose) => pose !== null);
  const found = firstHit >= 0 ? poses[firstHit] : null;
  if (hits === 0 || !found) {
    throw new PoseAnalyzeError("no-person", POSE_COPY.noPerson);
  }

  let fill: JointAngles = found;
  const filled: JointAngles[] = poses.map((pose) => {
    if (pose) {
      fill = pose;
      return pose;
    }
    return fill;
  });

  const smoothed = filled.map((pose, index) => {
    if (index === 0) return pose;
    return lerpPose(filled[index - 1], pose, 0.55);
  });

  return encodePoseTrack({
    poses: smoothed,
    durationSec,
    fps,
    sourceKind: input.sourceKind,
    analyzedAt: input.analyzedAt,
  });
}

export async function analyzeVideoSamples(input: {
  durationSec: number;
  fps?: number;
  sourceKind: PoseTrackSourceKind;
  detect: PoseDetector["detect"];
  seek?: (timeSec: number) => Promise<unknown>;
  onProgress?: (progress: AnalyzeProgress) => void;
  analyzedAt?: string;
}): Promise<PoseTrack> {
  const fps = input.fps ?? POSE_TRACK_DEFAULT_FPS;
  const times = sampleTimes(input.durationSec, fps);
  if (times.length === 0) throw new PoseAnalyzeError("too-short", POSE_COPY.tooShort);

  const detections: Array<PoseLandmark[] | null> = [];
  for (let i = 0; i < times.length; i++) {
    const timeSec = times[i];
    input.onProgress?.({
      ratio: i / times.length,
      label: POSE_COPY.progress,
    });
    if (input.seek) await input.seek(timeSec);
    try {
      detections.push((await input.detect(undefined, timeSec)) ?? null);
    } catch {
      detections.push(null);
    }
  }
  input.onProgress?.({ ratio: 1, label: POSE_COPY.progress });
  return buildPoseTrackFromDetections({
    durationSec: Math.min(input.durationSec, POSE_TRACK_MAX_DURATION_SEC),
    fps,
    detections,
    sourceKind: input.sourceKind,
    analyzedAt: input.analyzedAt,
  });
}

export function seekVideo(video: HTMLVideoElement, timeSec: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      reject(new PoseAnalyzeError("too-short", POSE_COPY.tooShort));
      return;
    }
    const target = Math.min(Math.max(0, timeSec), Math.max(0, video.duration - 0.04));
    if (Math.abs(video.currentTime - target) < 0.01) {
      resolve();
      return;
    }
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new PoseAnalyzeError("no-pixels", POSE_COPY.tainted));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    try {
      video.currentTime = target;
    } catch {
      cleanup();
      reject(new PoseAnalyzeError("no-pixels", POSE_COPY.tainted));
    }
  });
}

export function waitForVideoMetadata(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 1 && Number.isFinite(video.duration)) {
      resolve();
      return;
    }
    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new PoseAnalyzeError("no-pixels", POSE_COPY.tainted));
    };
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("error", onError);
  });
}

export async function loadVideoElement(src: string, crossOrigin?: "anonymous"): Promise<HTMLVideoElement> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  if (crossOrigin) video.crossOrigin = crossOrigin;
  video.src = src;
  await waitForVideoMetadata(video);
  return video;
}

export async function analyzeHtmlVideo(input: {
  video: HTMLVideoElement;
  detect: PoseDetector["detect"];
  sourceKind: PoseTrackSourceKind;
  fps?: number;
  onProgress?: (progress: AnalyzeProgress) => void;
  analyzedAt?: string;
}): Promise<PoseTrack> {
  const result = await analyzeClip({
    video: input.video,
    detect: input.detect,
    sourceKind: input.sourceKind,
    fps: input.fps,
    onProgress: input.onProgress,
    analyzedAt: input.analyzedAt,
  });
  return result.track;
}

export type ClipAnalysis = {
  track: PoseTrack;
  ocrCues: VideoTextCue[];
};

export async function analyzeClip(input: {
  video: HTMLVideoElement;
  detect: PoseDetector["detect"];
  sourceKind: PoseTrackSourceKind;
  fps?: number;
  readText?: FrameTextReader["read"];
  onProgress?: (progress: AnalyzeProgress) => void;
  analyzedAt?: string;
}): Promise<ClipAnalysis> {
  await waitForVideoMetadata(input.video);
  const duration = input.video.duration;
  if (!Number.isFinite(duration) || duration < 0.15) {
    throw new PoseAnalyzeError("too-short", POSE_COPY.tooShort);
  }
  const fps = input.fps ?? POSE_TRACK_DEFAULT_FPS;
  const times = sampleTimes(duration, fps);
  if (times.length === 0) throw new PoseAnalyzeError("too-short", POSE_COPY.tooShort);

  const detections: Array<PoseLandmark[] | null> = [];
  const ocrCues: VideoTextCue[] = [];
  const canvas = typeof document !== "undefined" ? document.createElement("canvas") : undefined;
  const progressLabel = input.readText
    ? `${POSE_COPY.progress} ${POSE_COPY.ocrProgress}`
    : POSE_COPY.progress;

  for (let i = 0; i < times.length; i++) {
    const timeSec = times[i];
    input.onProgress?.({
      ratio: i / times.length,
      label: progressLabel,
    });
    await seekVideo(input.video, timeSec);
    try {
      detections.push((await input.detect(input.video, timeSec)) ?? null);
    } catch {
      detections.push(null);
    }
    if (input.readText && shouldReadTextAtSample(i, times.length)) {
      try {
        const frame = canvas ? grabVideoFrame(input.video, canvas) : input.video;
        const raw = frame ? await input.readText(frame, timeSec) : "";
        const cue = ocrSampleToCue(timeSec, raw);
        if (cue) ocrCues.push(cue);
      } catch {
        // OCR is optional; pose continues.
      }
    }
  }
  input.onProgress?.({ ratio: 1, label: progressLabel });
  const track = buildPoseTrackFromDetections({
    durationSec: Math.min(duration, POSE_TRACK_MAX_DURATION_SEC),
    fps,
    detections,
    sourceKind: input.sourceKind,
    analyzedAt: input.analyzedAt,
  });
  return { track, ocrCues };
}
