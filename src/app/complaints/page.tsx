"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExerciseCard } from "@/components/ExerciseCard";
import { Card, PrimaryButton } from "@/components/ui";
import { useComplaints, useExercises, usePlanItems } from "@/lib/hooks";
import {
  ONBOARDING_REMINDER_PENDING_KEY,
  browserStorage,
  enabledPlanItems,
  pickOnboardingExercises,
  seedOnboardingPlan,
  writeStorageFlag,
} from "@/lib/onboarding";
import { addExerciseToPlan } from "@/lib/plan";
import { suggestExercisesForComplaints } from "@/lib/suggestions";

export default function ComplaintsPage() {
  const complaints = useComplaints();
  const exercises = useExercises();
  const planItems = usePlanItems();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emptyPlan = enabledPlanItems(planItems).length === 0;

  const suggestions = useMemo(
    () => suggestExercisesForComplaints(selected, exercises),
    [selected, exercises],
  );
  const todaySet = useMemo(
    () =>
      pickOnboardingExercises({
        complaintIds: selected,
        exercises,
        maxCount: 4,
        maxTotalSec: 8 * 60,
      }),
    [selected, exercises],
  );

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function addAll() {
    setBusy(true);
    setError(null);
    try {
      for (const exercise of suggestions.slice(0, 4)) {
        await addExerciseToPlan(exercise);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Konnte nicht in den Plan gelegt werden.");
    } finally {
      setBusy(false);
    }
  }

  async function takeForToday() {
    if (todaySet.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await seedOnboardingPlan(todaySet);
      if (result.seeded) writeStorageFlag(browserStorage(), ONBOARDING_REMINDER_PENDING_KEY);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Der Plan für heute konnte nicht eingerichtet werden.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="font-display text-3xl text-forest-dark">Was merkst du gerade?</h2>
      <p className="text-sm leading-relaxed text-ink/80">
        Keine Diagnose – nur Vorschläge aus der Sammlung. Du entscheidest, was in den Plan kommt.
        {emptyPlan ? " Wenn du magst, landet daraus direkt ein kurzer Plan unter Heute." : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        {complaints.map((complaint) => {
          const active = selected.includes(complaint.id);
          return (
            <button
              key={complaint.id}
              type="button"
              onClick={() => toggle(complaint.id)}
              className={`rounded-full px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest ${active ? "bg-forest text-cream" : "bg-white/70 text-forest-dark"}`}
              aria-pressed={active}
            >
              {complaint.name}
            </button>
          );
        })}
      </div>
      {selected.map((id) => {
        const complaint = complaints.find((item) => item.id === id);
        if (!complaint) return null;
        return (
          <Card key={id}>
            <h3 className="font-display text-xl">{complaint.name}</h3>
            <p className="mt-1 text-sm">{complaint.summary}</p>
            <p className="mt-2 text-sm text-forest-light">{complaint.hint}</p>
          </Card>
        );
      })}
      {selected.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-2xl text-forest-dark">Vorschläge</h3>
            {emptyPlan && todaySet.length > 0 && (
              <PrimaryButton onClick={() => void takeForToday()} disabled={busy}>
                {busy ? "Wird eingerichtet …" : "Für heute übernehmen"}
              </PrimaryButton>
            )}
            {!emptyPlan && suggestions.length > 0 && (
              <PrimaryButton onClick={() => void addAll()} disabled={busy}>
                Die ersten in den Plan
              </PrimaryButton>
            )}
          </div>
          {error && (
            <p className="text-sm text-clay" role="alert">
              {error}
            </p>
          )}
          <div className="space-y-2">
            {(emptyPlan ? todaySet : suggestions).map((exercise) => (
              <ExerciseCard key={exercise.id} exercise={exercise} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
