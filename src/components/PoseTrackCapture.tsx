"use client";

import { useState } from "react";
import { analyzeHtmlVideo, PoseAnalyzeError } from "@/lib/pose-analyze";
import { mediaPipeDetector } from "@/lib/pose-landmarker";
import {
  acceptVideoFile,
  pixelAvailabilityForUrl,
  pixelNotice,
  POSE_COPY,
} from "@/lib/pose-source";
import { hasPlayableTrack, type PoseTrack } from "@/lib/pose-track";
import { Field } from "./ui";

type Props = {
  value?: PoseTrack | null;
  sourceUrl?: string;
  onChange: (track: PoseTrack | null) => void;
};

export function PoseTrackCapture({ value, sourceUrl, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const availability = pixelAvailabilityForUrl(sourceUrl);
  const notice = pixelNotice(availability);
  const hasTrack = hasPlayableTrack(value);

  async function runAnalysis(video: HTMLVideoElement, sourceKind: "upload" | "file-url", revokeUrl?: string) {
    setBusy(true);
    setError(null);
    setNote(null);
    setProgress(POSE_COPY.progress);
    try {
      const track = await analyzeHtmlVideo({
        video,
        detect: (image, timeSec) => mediaPipeDetector.detect(image, timeSec),
        sourceKind,
        onProgress: (state) => setProgress(`${state.label} ${Math.round(state.ratio * 100)} %`),
      });
      onChange(track);
      if (video.duration > 90) setNote(POSE_COPY.truncated);
    } catch (err) {
      const message =
        err instanceof PoseAnalyzeError
          ? err.message
          : err instanceof Error
            ? err.message
            : POSE_COPY.loadFailed;
      setError(message);
    } finally {
      if (revokeUrl) URL.revokeObjectURL(revokeUrl);
      video.removeAttribute("src");
      video.load();
      setBusy(false);
      setProgress(null);
    }
  }

  async function onFile(file: File | undefined) {
    if (!acceptVideoFile(file)) {
      setError("Bitte eine Videodatei wählen (mp4, webm, mov).");
      return;
    }
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    await runAnalysis(video, "upload", url);
  }

  async function analyzePublicFile() {
    if (availability.kind !== "public-file") return;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    video.src = availability.url;
    await runAnalysis(video, "file-url");
  }

  return (
    <div className="space-y-3 rounded-[1.4rem] border border-sand/80 bg-paper/70 p-3">
      <h4 className="font-display text-lg text-forest-dark">Bewegungsspur</h4>
      <p className="text-sm leading-relaxed text-ink/80">
        Einmal aus einem Clip erkennen, danach spielt die Figur die kompakte Spur. Das Originalvideo bleibt optional und
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
        <p className="text-sm text-forest-dark" role="status" aria-live="polite">
          {progress ?? POSE_COPY.progress}
        </p>
      )}
      {note && !busy && (
        <p className="text-sm text-forest-light" role="status">
          {note}
        </p>
      )}
      {error && (
        <p className="rounded-2xl bg-clay/15 px-3 py-2 text-sm text-forest-dark" role="alert">
          {error}
        </p>
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
