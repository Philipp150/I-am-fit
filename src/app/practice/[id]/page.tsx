"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { PosePlayer } from "@/components/PosePlayer";
import { PrimaryButton, SecondaryButton } from "@/components/ui";
import { useExercise } from "@/lib/hooks";
import { markComplete, markSkipped } from "@/lib/plan";
import { formatDuration } from "@/lib/schedule";
import { Suspense, useState } from "react";

function PracticeInner() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const exercise = useExercise(params.id);
  const planId = search.get("plan") ?? undefined;
  const [ended, setEnded] = useState(false);
  const [run, setRun] = useState(0);

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
      <Link href="/" className="text-sm text-forest underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest">
        Zurück
      </Link>
      <h2 className="font-display text-3xl text-forest-dark">{exercise.title}</h2>
      <p className="text-sm text-forest-light">{formatDuration(exercise.defaultDurationSec)}</p>
      <PosePlayer
        key={run}
        steps={exercise.steps}
        loop={false}
        onFinished={() => setEnded(true)}
      />
      {ended && (
        <p className="rounded-2xl bg-sage/40 px-4 py-3 text-sm text-forest-dark" role="status">
          Die Anleitung ist zu Ende. Wiederholen, wenn du magst – oder den Tag ohne Schuldgefühl abhaken.
        </p>
      )}
      <div className="flex flex-col gap-2">
        <PrimaryButton onClick={complete}>Fertig – das zählt</PrimaryButton>
        {ended && (
          <SecondaryButton
            onClick={() => {
              setEnded(false);
              setRun((value) => value + 1);
            }}
          >
            Noch einmal von vorn
          </SecondaryButton>
        )}
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
