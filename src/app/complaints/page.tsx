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
  orderedThemes,
  pickFirstRunExercise,
  seedOnboardingPlan,
  writeStorageFlag,
} from "@/lib/onboarding";
import { addExerciseToPlan } from "@/lib/plan";
import { suggestExercisesForComplaints } from "@/lib/suggestions";

export default function ThemesPage() {
  const complaints = useComplaints();
  const exercises = useExercises();
  const planItems = usePlanItems();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const themes = useMemo(() => orderedThemes(complaints), [complaints]);
  const emptyPlan = enabledPlanItems(planItems).length === 0;

  const suggestions = useMemo(
    () => suggestExercisesForComplaints(selected, exercises),
    [selected, exercises],
  );
  const todaySet = useMemo(() => {
    const starter = selected[0] ? pickFirstRunExercise(selected[0], exercises) : undefined;
    return starter ? [starter] : suggestions.slice(0, 1);
  }, [selected, exercises, suggestions]);

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
      <h2 id="thema-frage" className="font-display text-3xl text-forest-dark">
        Worum soll’s gehen?
      </h2>
      <p className="text-sm leading-relaxed text-ink/80">
        Thema, Ziel oder Körperregion – Nacken, Bauch, Büro. Keine Diagnose. Du entscheidest, was in den Plan kommt.
        {emptyPlan ? " Wenn du magst, landet daraus direkt eine Minute unter Heute." : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        {themes.map((theme) => {
          const active = selected.includes(theme.id);
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => toggle(theme.id)}
              className={`rounded-full px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest ${active ? "bg-forest text-cream" : "bg-white/70 text-forest-dark"}`}
              aria-pressed={active}
            >
              {theme.name}
            </button>
          );
        })}
      </div>
      {selected.map((id) => {
        const theme = themes.find((item) => item.id === id);
        if (!theme) return null;
        return (
          <Card key={id}>
            <h3 className="font-display text-xl">{theme.name}</h3>
            <p className="mt-1 text-sm">{theme.summary}</p>
            <p className="mt-2 text-sm text-forest-light">{theme.hint}</p>
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
