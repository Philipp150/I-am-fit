"use client";

import { useEffect, useState } from "react";
import { poseForSteps } from "@/lib/player";
import { POSE_COPY } from "@/lib/pose-source";
import { sampleTrackPose, type PoseTrack } from "@/lib/pose-track";
import type { ExerciseStep } from "@/lib/types";
import { StickFigure } from "./StickFigure";

/**
 * Side by side proof that the analysis did something: the authored pose the figure would show
 * without a clip, next to the motion that came out of the clip.
 */
export function PoseTrackCompare({ track, steps }: { track: PoseTrack; steps: ExerciseStep[] }) {
  const [timeSec, setTimeSec] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setTimeSec((now - start) / 1000);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [track]);

  const duration = Math.max(track.durationSec, 0.1);
  const after = sampleTrackPose(track, timeSec, true).pose;
  const safeSteps = steps.length > 0 ? steps : [{ pose: "stand" as const, text: "", durationSec: 4 }];
  const stepIndex = Math.floor((timeSec % duration) / (duration / safeSteps.length)) % safeSteps.length;
  const before = poseForSteps(safeSteps, stepIndex, 1);

  return (
    <div className="rounded-2xl bg-white/60 p-3">
      <div className="grid grid-cols-2 gap-3">
        <figure className="m-0">
          <StickFigure pose={before} className="h-40 w-full" />
          <figcaption className="mt-1 text-center text-xs text-forest-light">{POSE_COPY.compareBefore}</figcaption>
        </figure>
        <figure className="m-0">
          <StickFigure pose={after} className="h-40 w-full" accent="#2F6B4F" />
          <figcaption className="mt-1 text-center text-xs text-forest-dark">{POSE_COPY.compareAfter}</figcaption>
        </figure>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-forest-light">{POSE_COPY.compareHint}</p>
    </div>
  );
}
