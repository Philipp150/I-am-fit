"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { PosePlayer } from "@/components/PosePlayer";
import { PrimaryButton, SecondaryButton } from "@/components/ui";
import { useExercise } from "@/lib/hooks";
import { markComplete, markSkipped } from "@/lib/plan";
import { formatDuration } from "@/lib/schedule";
import { Suspense } from "react";

function PracticeInner() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const exercise = useExercise(params.id);
  const planId = search.get("plan") ?? undefined;

  if (!exercise) return <p>Anleitung wird geladen …</p>;

  const current = exercise;

  async function complete() {
    await markComplete(current.id, planId, current.defaultDurationSec);
    router.push("/");
  }

  async function skip() {
    await markSkipped(current.id, planId);
    router.push("/");
  }

  return (
    <div className="space-y-5">
      <Link href="/" className="text-sm text-forest underline">
        Zurück
      </Link>
      <h2 className="font-display text-3xl text-forest-dark">{exercise.title}</h2>
      <p className="text-sm text-forest-light">{formatDuration(exercise.defaultDurationSec)}</p>
      <PosePlayer steps={exercise.steps} />
      <div className="flex flex-col gap-2">
        <PrimaryButton onClick={complete}>Fertig – das zählt</PrimaryButton>
        <SecondaryButton onClick={skip}>Heute nicht, ohne Schuld</SecondaryButton>
      </div>
    </div>
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={<p>Anleitung wird geladen …</p>}>
      <PracticeInner />
    </Suspense>
  );
}
