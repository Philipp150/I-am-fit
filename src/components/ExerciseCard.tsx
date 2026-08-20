"use client";

import Link from "next/link";
import { StickFigure } from "./StickFigure";
import { KindBadge } from "./ui";
import { formatDuration } from "@/lib/schedule";
import type { Exercise } from "@/lib/types";

export function ExerciseCard({
  exercise,
  href,
  interactive = true,
}: {
  exercise: Exercise;
  href?: string;
  interactive?: boolean;
}) {
  const target = href ?? `/catalog/${exercise.id}`;
  const pose = exercise.steps[0]?.pose ?? "stand";
  const className = "flex gap-3 rounded-[1.4rem] border border-sand/80 bg-cream p-3 shadow-card";
  const inner = (
    <>
      <div className="h-20 w-16 shrink-0 rounded-2xl bg-sage/30">
        <StickFigure pose={pose} className="h-full w-full" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <KindBadge kind={exercise.kind} />
          {exercise.source.type === "user" && <span className="text-[11px] text-clay">von dir</span>}
          {exercise.source.type === "import" && <span className="text-[11px] text-clay">importiert</span>}
        </div>
        <h3 className="mt-1 truncate font-display text-lg text-forest-dark">{exercise.title}</h3>
        <p className="line-clamp-2 text-sm text-forest-light">{exercise.summary}</p>
        <p className="mt-1 text-xs text-ink/60">{formatDuration(exercise.defaultDurationSec)}</p>
      </div>
    </>
  );

  if (!interactive) {
    return <div className={className}>{inner}</div>;
  }

  return (
    <Link href={target} className={className}>
      {inner}
    </Link>
  );
}
