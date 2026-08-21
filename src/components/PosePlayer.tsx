"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { nextStepIndex } from "@/lib/player";
import { lerpPose, POSES } from "@/lib/poses";
import type { ExerciseStep } from "@/lib/types";
import { StickFigure } from "./StickFigure";

type Props = {
  steps: ExerciseStep[];
  autoPlay?: boolean;
  loop?: boolean;
  className?: string;
  onFinished?: () => void;
};

export function PosePlayer({ steps, autoPlay = true, loop = true, className, onFinished }: Props) {
  const safeSteps = steps.length > 0 ? steps : [{ pose: "stand" as const, text: "Noch keine Schritte.", durationSec: 4 }];
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const [finished, setFinished] = useState(false);
  const [blend, setBlend] = useState(1);

  const safeIndex = Math.min(Math.max(0, index), safeSteps.length - 1);
  const current = safeSteps[safeIndex];
  const previous = safeSteps[(safeIndex - 1 + safeSteps.length) % safeSteps.length];
  const pose = useMemo(
    () => lerpPose(POSES[previous.pose] ?? POSES.stand, POSES[current.pose] ?? POSES.stand, blend),
    [previous.pose, current.pose, blend],
  );

  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  useEffect(() => {
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
  }, [index]);

  useEffect(() => {
    if (!playing || finished) return;
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
  }, [playing, index, current.durationSec, safeSteps.length, loop, finished]);

  function jump(delta: number) {
    setFinished(false);
    setIndex((value) => {
      const next = (value + delta + safeSteps.length) % safeSteps.length;
      return next;
    });
  }

  function replay() {
    setIndex(0);
    setFinished(false);
    setPlaying(true);
  }

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-b from-sage/40 to-sand/60 p-4">
        <StickFigure pose={pose} className="mx-auto h-72 w-full max-w-[240px]" />
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
          {finished ? "Ende" : `Schritt ${index + 1} von ${safeSteps.length}`}
        </p>
        <p className="mt-1 text-lg leading-snug text-ink">
          {finished ? "Die Schrittfolge ist durch. Du kannst sie wiederholen oder den Tag abhaken." : current.text}
        </p>
      </div>
    </div>
  );
}
