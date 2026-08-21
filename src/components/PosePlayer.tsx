"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { captionAtTime, jumpTrackTime, nextStepIndex, playerMode, poseForSteps } from "@/lib/player";
import { hasPlayableTrack, sampleTrackPose } from "@/lib/pose-track";
import type { PoseTrack } from "@/lib/pose-track";
import type { ExerciseStep } from "@/lib/types";
import { StickFigure } from "./StickFigure";

type Props = {
  steps: ExerciseStep[];
  poseTrack?: PoseTrack | null;
  autoPlay?: boolean;
  loop?: boolean;
  className?: string;
  onFinished?: () => void;
};

export function PosePlayer({
  steps,
  poseTrack,
  autoPlay = true,
  loop = true,
  className,
  onFinished,
}: Props) {
  const safeSteps = useMemo(
    () => (steps.length > 0 ? steps : [{ pose: "stand" as const, text: "Noch keine Schritte.", durationSec: 4 }]),
    [steps],
  );
  const track = hasPlayableTrack(poseTrack) ? poseTrack : null;
  const mode = playerMode(track);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const [finished, setFinished] = useState(false);
  const [blend, setBlend] = useState(1);
  const [timeSec, setTimeSec] = useState(0);
  const [clock, setClock] = useState(0);

  const safeIndex = Math.min(Math.max(0, index), safeSteps.length - 1);
  const current = safeSteps[safeIndex];

  const sampled = useMemo(() => {
    if (track) return sampleTrackPose(track, timeSec, loop);
    return {
      pose: poseForSteps(safeSteps, safeIndex, blend),
      t: timeSec,
      finished: false,
      index: safeIndex,
    };
  }, [track, timeSec, loop, safeSteps, safeIndex, blend]);

  const caption = track
    ? captionAtTime(safeSteps, sampled.t, track.durationSec)
    : { index: safeIndex, text: current.text };

  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  const timeRef = useRef(timeSec);
  timeRef.current = timeSec;

  useEffect(() => {
    if (mode === "track") return;
    setBlend(0);
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 420);
      setBlend(t);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [index, mode]);

  useEffect(() => {
    if (mode === "track" || !playing || finished) return;
    const timeout = window.setTimeout(() => {
      const next = nextStepIndex(index, safeSteps.length, loop);
      if (next.finished) {
        setPlaying(false);
        setFinished(true);
        onFinishedRef.current?.();
        return;
      }
      setIndex(next.index);
    }, Math.max(1200, current.durationSec * 1000));
    return () => window.clearTimeout(timeout);
  }, [playing, index, current.durationSec, safeSteps.length, loop, finished, mode]);

  useEffect(() => {
    if (mode !== "track" || !track || !playing || finished) return;
    let frame = 0;
    const started = performance.now() - timeRef.current * 1000;
    const tick = (now: number) => {
      const elapsed = (now - started) / 1000;
      const next = sampleTrackPose(track, elapsed, loop);
      setTimeSec(next.t);
      if (next.finished) {
        setPlaying(false);
        setFinished(true);
        onFinishedRef.current?.();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mode, track, playing, finished, loop, clock]);

  function jump(delta: number) {
    setFinished(false);
    if (track) {
      const nextTime = jumpTrackTime(safeSteps, track.durationSec, timeRef.current, delta);
      timeRef.current = nextTime;
      setTimeSec(nextTime);
      setClock((value) => value + 1);
      setPlaying(true);
      return;
    }
    setIndex((value) => (value + delta + safeSteps.length) % safeSteps.length);
  }

  function replay() {
    setIndex(0);
    setTimeSec(0);
    timeRef.current = 0;
    setFinished(false);
    setPlaying(true);
    setClock((value) => value + 1);
  }

  const stepLabel =
    mode === "track"
      ? `Bewegungsspur · Schritt ${caption.index + 1} von ${safeSteps.length}`
      : `Schritt ${index + 1} von ${safeSteps.length}`;

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-b from-sage/40 to-sand/60 p-4">
        <StickFigure pose={sampled.pose} className="mx-auto h-72 w-full max-w-[240px]" />
        <div className="mt-2 flex items-center justify-center gap-3 text-forest">
          <button
            type="button"
            onClick={() => jump(-1)}
            className="rounded-full p-2 hover:bg-cream/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
            aria-label="Vorheriger Schritt"
          >
            <SkipBack className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (finished) {
                replay();
                return;
              }
              setPlaying((value) => !value);
            }}
            className="rounded-full bg-forest p-3 text-cream shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-cream"
            aria-label={finished ? "Von vorn" : playing ? "Pause" : "Abspielen"}
          >
            {finished ? <RotateCcw className="h-5 w-5" /> : playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={() => jump(1)}
            className="rounded-full p-2 hover:bg-cream/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
            aria-label="Nächster Schritt"
          >
            <SkipForward className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="mt-4">
        <p className="text-xs uppercase tracking-[0.18em] text-forest-light">
          {finished ? "Ende" : stepLabel}
        </p>
        <p className="mt-1 text-lg leading-snug text-ink">
          {finished ? "Die Schrittfolge ist durch. Du kannst sie wiederholen oder den Tag abhaken." : caption.text}
        </p>
      </div>
    </div>
  );
}
