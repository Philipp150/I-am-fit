"use client";

import { useMemo, useState } from "react";
import { ExerciseCard } from "@/components/ExerciseCard";
import { Card, PrimaryButton } from "@/components/ui";
import { useComplaints, useExercises } from "@/lib/hooks";
import { addExerciseToPlan } from "@/lib/plan";
import { suggestExercisesForComplaints } from "@/lib/suggestions";

export default function ComplaintsPage() {
  const complaints = useComplaints();
  const exercises = useExercises();
  const [selected, setSelected] = useState<string[]>([]);

  const suggestions = useMemo(
    () => suggestExercisesForComplaints(selected, exercises),
    [selected, exercises],
  );

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function addAll() {
    for (const exercise of suggestions.slice(0, 4)) {
      await addExerciseToPlan(exercise);
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="font-display text-3xl text-forest-dark">Was merkst du gerade?</h2>
      <p className="text-sm leading-relaxed text-ink/80">
        Keine Diagnose – nur Vorschläge aus der Sammlung. Du entscheidest, was in den Plan kommt.
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
          <div className="flex items-center justify-between">
            <h3 className="font-display text-2xl text-forest-dark">Vorschläge</h3>
            {suggestions.length > 0 && (
              <PrimaryButton onClick={addAll}>Die ersten in den Plan</PrimaryButton>
            )}
          </div>
          <div className="space-y-2">
            {suggestions.map((exercise) => (
              <ExerciseCard key={exercise.id} exercise={exercise} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
