"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ExerciseCard } from "@/components/ExerciseCard";
import { Card, PrimaryButton } from "@/components/ui";
import { greeting } from "@/lib/copy";
import { useCompletions, useExercises, usePlanItems, useActivePlan, useProfile } from "@/lib/hooks";
import { formatDuration, streakLength } from "@/lib/schedule";
import { addExerciseToPlan, todayOverview } from "@/lib/plan";
import { creatorAttribution } from "@/lib/plan-share";

export default function HomePage() {
  const exercises = useExercises();
  const planItems = usePlanItems();
  const completions = useCompletions();
  const profile = useProfile();
  const activePlan = useActivePlan();
  const today = useMemo(() => new Date(), []);
  const overview = todayOverview(planItems, completions, today);

  const byId = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [exercises]);
  const streak = streakLength(
    completions.filter((item) => !item.skipped).map((item) => item.completedAt.slice(0, 10)),
    today,
  );
  const starters = exercises.filter((exercise) =>
    ["ex-neck-circles", "ex-mantra-here", "ex-box-breath"].includes(exercise.id),
  );

  async function adoptStarters() {
    for (const exercise of starters) {
      await addExerciseToPlan(exercise);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <p className="text-sm text-forest-light">{greeting(today)}</p>
        <h2 className="mt-1 font-display text-3xl text-forest-dark">
          {profile?.displayName ? `${profile.displayName}, du wolltest üben.` : "Du wolltest üben."}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink/80">
          Die guten Übungen gehen nicht verloren – sie warten hier, mit einer Figur, die immer gleich aussieht, und einem Plan, der dich erinnert.
        </p>
        {activePlan && (
          <p className="mt-2 text-xs text-forest-light">
            Aktiver Plan: {activePlan.title} · {creatorAttribution(activePlan)}
          </p>
        )}
        <div className="mt-4 flex gap-3">
          <Stat label="Heute" value={`${overview.doneCount}/${overview.due.length || "–"}`} />
          <Stat label="Serie" value={streak ? `${streak} Tage` : "neu"} />
        </div>
      </Card>

      {overview.due.length === 0 && planItems.length === 0 ? (
        <Card>
          <h3 className="font-display text-2xl text-forest-dark">Noch kein Plan</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink/80">
            Hol dir drei kurze Anker in den Alltag: Nacken, ein Mantra, ein Atem. Du kannst später alles ändern.
          </p>
          <div className="mt-4 space-y-2">
            {starters.map((exercise) => (
              <ExerciseCard key={exercise.id} exercise={exercise} />
            ))}
          </div>
          <PrimaryButton className="mt-4 w-full" onClick={adoptStarters} disabled={starters.length === 0}>
            Diese drei in den Plan
          </PrimaryButton>
          <Link href="/plan" className="mt-3 inline-block text-sm text-forest underline">
            Alle Pläne
          </Link>
        </Card>
      ) : overview.due.length === 0 ? (
        <Card>
          <h3 className="font-display text-2xl text-forest-dark">Heute Pause im aktiven Plan</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink/80">
            In „{activePlan?.title ?? "deinem Plan"}“ ist heute nichts vorgesehen. Du kannst einen anderen Plan aktivieren.
          </p>
          <Link href="/plan" className="mt-3 inline-block text-sm text-forest underline">
            Pläne ansehen
          </Link>
        </Card>
      ) : overview.allDone ? (
        <Card className="bg-forest text-cream">
          <h3 className="font-display text-2xl">Für heute genug</h3>
          <p className="mt-2 text-sm text-cream/90">Du hast gemacht, was du dir vorgenommen hattest. Mehr muss nicht.</p>
          <Link href="/progress" className="mt-4 inline-block text-sm underline">
            Verlauf ansehen
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          <h3 className="font-display text-2xl text-forest-dark">Heute offen</h3>
          {overview.remaining.map((item) => {
            const exercise = byId.get(item.exerciseId);
            if (!exercise) return null;
            return (
              <div key={item.id} className="space-y-2">
                <ExerciseCard exercise={exercise} />
                <div className="flex gap-2 px-1">
                  <Link
                    href={`/practice/${exercise.id}?plan=${item.id}`}
                    className="rounded-full bg-forest px-4 py-2 text-sm text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-forest"
                  >
                    Jetzt {formatDuration(item.durationSec ?? exercise.defaultDurationSec)}
                  </Link>
                  <Link
                    href={`/catalog/${exercise.id}`}
                    className="rounded-full px-4 py-2 text-sm text-forest-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
                  >
                    Erklärung
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link href="/catalog/import" className="rounded-[1.4rem] bg-clay px-4 py-5 text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-forest">
          <p className="text-xs uppercase tracking-widest">Link</p>
          <p className="font-display text-xl">YouTube / Instagram</p>
        </Link>
        <Link href="/complaints" className="rounded-[1.4rem] bg-forest-dark px-4 py-5 text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-forest">
          <p className="text-xs uppercase tracking-widest">Unwohl</p>
          <p className="font-display text-xl">Übungen vorschlagen</p>
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-2xl bg-sage/30 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wider text-forest-dark/80">{label}</p>
      <p className="font-display text-xl text-forest-dark">{value}</p>
    </div>
  );
}
