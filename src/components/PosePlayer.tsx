"use client";

import { useEffect, useMemo, useState } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { lerpPose, POSES } from "@/lib/poses";
import type { ExerciseStep } from "@/lib/types";
import { StickFigure } from "./StickFigure";

type Props = {
  steps: ExerciseStep[];
  autoPlay?: boolean;
  className?: string;
};

export function PosePlayer({ steps, autoPlay = true, className }: Props) {
  const safeSteps = steps.length > 0 ? steps : [{ pose: "stand" as const, text: "Noch keine Schritte.", durationSec: 4 }];
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const [blend, setBlend] = useState(1);

  const current = safeSteps[index];
  const previous = safeSteps[(index - 1 + safeSteps.length) % safeSteps.length];
  const pose = useMemo(
    () => lerpPose(POSES[previous.pose] ?? POSES.stand, POSES[current.pose] ?? POSES.stand, blend),
    [previous.pose, current.pose, blend],
  );

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
    if (!playing) return;
    const timeout = window.setTimeout(() => {
      setIndex((value) => (value + 1) % safeSteps.length);
    }, Math.max(1200, current.durationSec * 1000));
    return () => window.clearTimeout(timeout);
  }, [playing, index, current.durationSec, safeSteps.length]);

  function jump(delta: number) {
    setIndex((value) => (value + delta + safeSteps.length) % safeSteps.length);
  }

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-b from-sage/40 to-sand/60 p-4">
        <StickFigure pose={pose} className="mx-auto h-72 w-full max-w-[240px]" />
        <div className="mt-2 flex items-center justify-center gap-3 text-forest">
          <button type="button" onClick={() => jump(-1)} className="rounded-full p-2 hover:bg-cream/70" aria-label="Vorheriger Schritt">
            <SkipBack className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setPlaying((value) => !value)}
            className="rounded-full bg-forest p-3 text-cream shadow-soft"
            aria-label={playing ? "Pause" : "Abspielen"}
          >
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <button type="button" onClick={() => jump(1)} className="rounded-full p-2 hover:bg-cream/70" aria-label="Nächster Schritt">
            <SkipForward className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="mt-4">
        <p className="text-xs uppercase tracking-[0.18em] text-forest-light">
          Schritt {index + 1} von {safeSteps.length}
        </p>
        <p className="mt-1 text-lg leading-snug text-ink">{current.text}</p>
      </div>
    </div>
  );
}
