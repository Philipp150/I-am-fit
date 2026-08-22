import type { JointAngles } from "./poses";
import {
  applyClipOrientation,
  dropOrientationOutliers,
  landmarksHavePerson,
  mapLandmarksToFrame,
  normalizeHipTravel,
  SMALL_TORSO_LEN,
  median,
  type MappedFrame,
  type PoseLandmark,
} from "./pose-map";
import { POSE_COPY } from "./pose-source";
import {
  encodePoseTrack,
  POSE_TRACK_DEFAULT_FPS,
  POSE_TRACK_MAX_DURATION_SEC,
  sampleFpsForDuration,
  smoothPoseSeries,
  type PoseTrack,
  type PoseTrackSourceKind,
} from "./pose-track";
import { grabVideoFrame, ocrSampleToCue, shouldReadTextAtSample, type FrameTextReader } from "./video-ocr";
import type { VideoTextCue } from "./video-text";

export type PoseAnalyzeCode =
  | "no-person"
  | "no-pixels"
  | "load-failed"
  | "too-short"
  | "tainted"
  | "cancelled";

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

export type AnalyzePhase = "model" | "pose" | "finish";

export type AnalyzeProgress = {
  ratio: number;
  label: string;
  phase: AnalyzePhase;
  frame?: number;
  frames?: number;
};

/** A person has to be visible in at least this share of the samples for the track to be useful. */
export const MIN_DETECTION_RATE = 0.25;

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

export function detectionRate(detections: Array<PoseLandmark[] | null>): number {
  if (detections.length === 0) return 0;
  let hits = 0;
  for (const detection of detections) {
    if (detection && landmarksHavePerson(detection)) hits += 1;
  }
  return hits / detections.length;
}

export type TrackFromDetections = {
  track: PoseTrack;
  /** Share of samples that ended up in the track. */
  detectionRate: number;
  /** The person was far enough away that the angles are rough. */
  smallPerson: boolean;
};

export type DetectionsInput = {
  durationSec: number;
  fps?: number;
  detections: Array<PoseLandmark[] | null>;
  sourceKind: PoseTrackSourceKind;
  analyzedAt?: string;
  /** Video width / height, so angles are not skewed by portrait or widescreen framing. */
  aspect?: number;
};

export function buildPoseTrackFromDetections(input: DetectionsInput): PoseTrack {
  return trackFromDetections(input).track;
}

export function trackFromDetections(input: DetectionsInput): TrackFromDetections {
  const fps = input.fps ?? POSE_TRACK_DEFAULT_FPS;
  const durationSec = Math.min(POSE_TRACK_MAX_DURATION_SEC, Math.max(0, input.durationSec));
  if (durationSec < 0.15 || input.detections.length === 0) {
    throw new PoseAnalyzeError("too-short", POSE_COPY.tooShort);
  }

  const mapped: Array<MappedFrame | null> = [];
  let previous: JointAngles | undefined;
  let sawPerson = 0;
  for (const detection of input.detections) {
    if (detection && landmarksHavePerson(detection)) sawPerson += 1;
    const frame = detection ? mapLandmarksToFrame(detection, { previous, aspect: input.aspect }) : null;
    if (frame) previous = frame.pose;
    mapped.push(frame);
  }

  const sized = mapped.filter((frame): frame is MappedFrame => frame !== null);
  const { kept, dominant } = dropOrientationOutliers(sized);
  const keptSet = new Set(kept);
  const usable = mapped.map((frame) => (frame && keptSet.has(frame) ? frame : null));

  const rate = kept.length / mapped.length;
  if (rate < MIN_DETECTION_RATE) {
    // A person who was seen but always too small is a different problem than no person at all.
    if (sawPerson / mapped.length >= MIN_DETECTION_RATE && sized.length === 0) {
      throw new PoseAnalyzeError("no-person", POSE_COPY.personTooSmall);
    }
    throw new PoseAnalyzeError("no-person", rate === 0 ? POSE_COPY.noPerson : POSE_COPY.tooFewPeopleFrames(rate));
  }

  applyClipOrientation(kept, dominant);
  normalizeHipTravel(kept);

  // Hold the last good frame across short gaps so a briefly hidden person does not snap the figure
  // back to a default pose, and fill the lead-in with the first frame that was actually seen.
  let fill: MappedFrame = kept[0];
  const filled: MappedFrame[] = usable.map((frame) => {
    if (frame) {
      fill = frame;
      return frame;
    }
    return { ...fill, pose: { ...fill.pose } };
  });

  const smoothed = smoothPoseSeries(filled.map((frame) => frame.pose));

  return {
    track: encodePoseTrack({
      poses: smoothed,
      durationSec,
      fps,
      sourceKind: input.sourceKind,
      analyzedAt: input.analyzedAt,
    }),
    detectionRate: rate,
    smallPerson: median(kept.map((frame) => frame.torsoLen)) < SMALL_TORSO_LEN,
  };
}

export async function analyzeVideoSamples(input: {
  durationSec: number;
  fps?: number;
  sourceKind: PoseTrackSourceKind;
  detect: PoseDetector["detect"];
  seek?: (timeSec: number) => Promise<unknown>;
  onProgress?: (progress: AnalyzeProgress) => void;
  analyzedAt?: string;
  aspect?: number;
}): Promise<PoseTrack> {
  const fps = input.fps ?? sampleFpsForDuration(input.durationSec);
  const times = sampleTimes(input.durationSec, fps);
  if (times.length === 0) throw new PoseAnalyzeError("too-short", POSE_COPY.tooShort);

  const detections: Array<PoseLandmark[] | null> = [];
  for (let i = 0; i < times.length; i++) {
    const timeSec = times[i];
    input.onProgress?.({
      ratio: i / times.length,
      label: POSE_COPY.progress,
      phase: "pose",
      frame: i + 1,
      frames: times.length,
    });
    if (input.seek) await input.seek(timeSec);
    try {
      detections.push((await input.detect(undefined, timeSec)) ?? null);
    } catch {
      detections.push(null);
    }
  }
  input.onProgress?.({ ratio: 1, label: POSE_COPY.progress, phase: "finish" });
  return buildPoseTrackFromDetections({
    durationSec: Math.min(input.durationSec, POSE_TRACK_MAX_DURATION_SEC),
    fps,
    detections,
    sourceKind: input.sourceKind,
    analyzedAt: input.analyzedAt,
    aspect: input.aspect,
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
      window.clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    // A seek that never reports back must not freeze the whole analysis on one frame.
    const timer = window.setTimeout(() => {
      cleanup();
      resolve();
    }, 4000);
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

export function waitForVideoMetadata(video: HTMLVideoElement, timeoutMs = 20000): Promise<void> {
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
      window.clearTimeout(timer);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
    };
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new PoseAnalyzeError("no-pixels", POSE_COPY.unreadableFile));
    }, timeoutMs);
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
  /** Share of samples in which a person was found, for honest feedback in the UI. */
  detectionRate: number;
  smallPerson: boolean;
};

export type AnalyzeCancel = { aborted: boolean };

export async function analyzeClip(input: {
  video: HTMLVideoElement;
  detect: PoseDetector["detect"];
  sourceKind: PoseTrackSourceKind;
  fps?: number;
  readText?: FrameTextReader["read"];
  onProgress?: (progress: AnalyzeProgress) => void;
  analyzedAt?: string;
  cancel?: AnalyzeCancel;
}): Promise<ClipAnalysis> {
  await waitForVideoMetadata(input.video);
  const duration = input.video.duration;
  if (!Number.isFinite(duration) || duration < 0.15) {
    throw new PoseAnalyzeError("too-short", POSE_COPY.tooShort);
  }
  const fps = input.fps ?? sampleFpsForDuration(duration);
  const times = sampleTimes(duration, fps);
  if (times.length === 0) throw new PoseAnalyzeError("too-short", POSE_COPY.tooShort);

  const detections: Array<PoseLandmark[] | null> = [];
  const ocrCues: VideoTextCue[] = [];
  const canvas = typeof document !== "undefined" ? document.createElement("canvas") : undefined;

  const stop = () => {
    if (input.cancel?.aborted) throw new PoseAnalyzeError("cancelled", POSE_COPY.cancelled);
  };

  for (let i = 0; i < times.length; i++) {
    stop();
    const timeSec = times[i];
    input.onProgress?.({
      ratio: i / times.length,
      label: POSE_COPY.progress,
      phase: "pose",
      frame: i + 1,
      frames: times.length,
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
  stop();
  input.onProgress?.({ ratio: 1, label: POSE_COPY.finishing, phase: "finish" });
  const aspect =
    input.video.videoWidth > 0 && input.video.videoHeight > 0
      ? input.video.videoWidth / input.video.videoHeight
      : 1;
  const result = trackFromDetections({
    durationSec: Math.min(duration, POSE_TRACK_MAX_DURATION_SEC),
    fps,
    detections,
    sourceKind: input.sourceKind,
    analyzedAt: input.analyzedAt,
    aspect,
  });
  return { ...result, ocrCues };
}
