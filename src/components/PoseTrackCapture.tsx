"use client";

import { useEffect, useRef, useState } from "react";
import { analyzeClip, PoseAnalyzeError, type AnalyzeProgress } from "@/lib/pose-analyze";
import { mediaPipeDetector, preparePoseLandmarker } from "@/lib/pose-landmarker";
import {
  acceptVideoFile,
  pixelAvailabilityForUrl,
  pixelNotice,
  POSE_COPY,
} from "@/lib/pose-source";
import { hasPlayableTrack, type PoseTrack } from "@/lib/pose-track";
import { createTesseractReader, type FrameTextReader } from "@/lib/video-ocr";
import {
  motionFromTrack,
  pauseResumeTimes,
  suggestFromVideoText,
  type TimedCaptionCue,
  type VideoTextSuggestion,
} from "@/lib/video-text";
import type { ExerciseStep } from "@/lib/types";
import { PoseTrackCompare } from "./PoseTrackCompare";
import { Field } from "./ui";

/** OCR is a bonus. If Tesseract is not ready by then, the movement track runs without it. */
const OCR_INIT_TIMEOUT_MS = 25_000;

type Props = {
  value?: PoseTrack | null;
  sourceUrl?: string;
  captions?: string;
  captionCues?: TimedCaptionCue[];
  existingTitle?: string;
  existingSummary?: string;
  steps?: ExerciseStep[];
  onChange: (track: PoseTrack | null, suggestion?: VideoTextSuggestion) => void;
};

/** Detached video elements do not always decode on mobile Safari, so the clip lives in the page. */
function createOffscreenVideo(): HTMLVideoElement {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.setAttribute("aria-hidden", "true");
  video.style.cssText = "position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none";
  document.body.appendChild(video);
  return video;
}

function releaseVideo(video: HTMLVideoElement, objectUrl?: string) {
  video.removeAttribute("src");
  video.load();
  video.remove();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
}

export function PoseTrackCapture({
  value,
  sourceUrl,
  captions,
  captionCues,
  existingTitle,
  existingSummary,
  steps = [],
  onChange,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<AnalyzeProgress | null>(null);
  const [readingText, setReadingText] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const cancelRef = useRef<{ aborted: boolean }>({ aborted: false });
  const availability = pixelAvailabilityForUrl(sourceUrl);
  const hasTrack = hasPlayableTrack(value);
  // Once a clip has been read the "no pixels" hint is stale and only confuses.
  const notice = hasTrack || busy ? "" : pixelNotice(availability);

  useEffect(() => {
    const cancel = cancelRef.current;
    return () => {
      cancel.aborted = true;
    };
  }, []);

  async function runAnalysis(video: HTMLVideoElement, sourceKind: "upload" | "file-url", objectUrl?: string) {
    const cancel = { aborted: false };
    cancelRef.current = cancel;
    setBusy(true);
    setError(null);
    setNote(null);
    setReadingText(false);
    setProgress({ ratio: 0, label: POSE_COPY.modelProgress, phase: "model" });

    // Kept as a promise so a reader that shows up after the timeout is still disposed of.
    const readerPromise: Promise<FrameTextReader | null> = createTesseractReader().catch(() => null);

    try {
      await preparePoseLandmarker();
      if (cancel.aborted) throw new PoseAnalyzeError("cancelled", POSE_COPY.cancelled);
      const readText = await Promise.race([
        readerPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), OCR_INIT_TIMEOUT_MS)),
      ]);
      if (cancel.aborted) throw new PoseAnalyzeError("cancelled", POSE_COPY.cancelled);
      setReadingText(Boolean(readText));

      const { track, ocrCues, detectionRate } = await analyzeClip({
        video,
        detect: (image, timeSec) => mediaPipeDetector.detect(image, timeSec),
        readText: readText ? (image, timeSec) => readText.read(image, timeSec) : undefined,
        sourceKind,
        cancel,
        onProgress: setProgress,
      });
      const pauseTimes = pauseResumeTimes(motionFromTrack(track), track.fps);
      const suggestion = suggestFromVideoText({
        ocrCues,
        captions,
        captionCues,
        existingTitle,
        existingSummary,
        durationSec: track.durationSec,
        pauseTimes,
      });
      onChange(track, suggestion);
      const notes: string[] = [];
      if (video.duration > 90) notes.push(POSE_COPY.truncated);
      if (detectionRate < 0.85) notes.push(POSE_COPY.partial(detectionRate));
      if (suggestion.foundText) notes.push(POSE_COPY.ocrApplied);
      setNote(notes.length ? notes.join(" ") : null);
    } catch (err) {
      const message =
        err instanceof PoseAnalyzeError
          ? err.message
          : err instanceof Error
            ? err.message
            : POSE_COPY.loadFailed;
      setError(message);
    } finally {
      await readerPromise.then((created) => created?.dispose?.()).catch(() => undefined);
      releaseVideo(video, objectUrl);
      setBusy(false);
      setProgress(null);
      setReadingText(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!acceptVideoFile(file)) {
      setError("Bitte eine Videodatei wählen (mp4, webm, mov).");
      return;
    }
    const url = URL.createObjectURL(file);
    const video = createOffscreenVideo();
    video.src = url;
    await runAnalysis(video, "upload", url);
  }

  async function analyzePublicFile() {
    if (availability.kind !== "public-file") return;
    const video = createOffscreenVideo();
    video.crossOrigin = "anonymous";
    video.src = availability.url;
    await runAnalysis(video, "file-url");
  }

  const percent = progress ? Math.round(progress.ratio * 100) : 0;
  const frameHint =
    progress?.frame && progress?.frames ? ` · ${POSE_COPY.frameCount(progress.frame, progress.frames)}` : "";

  return (
    <div className="space-y-3 rounded-[1.4rem] border border-sand/80 bg-paper/70 p-3">
      <h4 className="font-display text-lg text-forest-dark">Bewegungsspur</h4>
      <p className="text-sm leading-relaxed text-ink/80">
        Einmal aus einem Clip erkennen, danach spielt die Figur die kompakte Spur. Eingeblendeter Text (Titel, Schritte,
        Seite) wird im selben Durchgang gelesen und in die Vorschläge übernommen. Das Originalvideo bleibt optional und
        braucht Internet.
      </p>
      {notice && (
        <p className="rounded-2xl bg-sage/35 px-3 py-2 text-sm text-forest-dark" role="status">
          {notice}
        </p>
      )}
      {hasTrack && value && (
        <p className="text-sm text-forest-dark" role="status">
          {POSE_COPY.hasTrack(value.durationSec, value.fps)}
        </p>
      )}
      {hasTrack && value && !busy && <PoseTrackCompare track={value} steps={steps} />}
      <Field label={POSE_COPY.uploadLabel}>
        <input
          type="file"
          accept="video/*"
          className="block w-full text-sm"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void onFile(file);
          }}
        />
      </Field>
      {availability.kind === "public-file" && (
        <button
          type="button"
          className="text-sm text-forest underline"
          disabled={busy}
          onClick={() => void analyzePublicFile()}
        >
          {POSE_COPY.analyzeFileLink}
        </button>
      )}
      {busy && (
        <div className="space-y-2">
          <p className="text-sm text-forest-dark" role="status" aria-live="polite">
            {progress?.label ?? POSE_COPY.progress}
            {progress?.phase === "pose" ? ` ${percent} %${frameHint}` : ""}
            {progress?.phase === "pose" && readingText ? ` ${POSE_COPY.ocrProgress}` : ""}
          </p>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-sand"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label={POSE_COPY.progress}
          >
            <div className="h-full rounded-full bg-forest transition-[width]" style={{ width: `${percent}%` }} />
          </div>
          <button
            type="button"
            className="text-sm text-clay underline"
            onClick={() => {
              cancelRef.current.aborted = true;
            }}
          >
            {POSE_COPY.cancel}
          </button>
        </div>
      )}
      {note && !busy && (
        <p className="text-sm text-forest-light" role="status">
          {note}
        </p>
      )}
      {error && !busy && (
        <div className="rounded-2xl bg-clay/15 px-3 py-2 text-sm text-forest-dark" role="alert">
          <p>{error}</p>
          <p className="mt-1 text-forest-light">{POSE_COPY.retry} – wähle die Datei unten noch einmal aus.</p>
        </div>
      )}
      {hasTrack && (
        <button
          type="button"
          className="text-sm text-clay underline"
          disabled={busy}
          onClick={() => {
            onChange(null);
            setError(null);
            setNote(null);
          }}
        >
          {POSE_COPY.remove}
        </button>
      )}
    </div>
  );
}
