"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PosePlayer } from "@/components/PosePlayer";
import { Card, KindBadge, PrimaryButton, SecondaryButton } from "@/components/ui";
import { categoryPathLabel } from "@/lib/categories";
import { useCategories, useComplaints, useExercise, usePlanItems, useActivePlan } from "@/lib/hooks";
import { addExerciseToPlan } from "@/lib/plan";
import { formatDuration, rhythmLabel } from "@/lib/schedule";
import { deleteExercise } from "@/lib/repository";

export default function ExerciseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const exercise = useExercise(params.id);
  const categories = useCategories();
  const complaints = useComplaints();
  const planItems = usePlanItems();
  const activePlan = useActivePlan();
  const inPlan = planItems.some((item) => item.exerciseId === exercise?.id && item.enabled);
  const receivedActive = activePlan?.source === "received";

  if (!exercise) {
    return <p className="text-forest-light">Übung wird geladen …</p>;
  }

  const current = exercise;

  async function addToPlan() {
    await addExerciseToPlan(current);
    router.push("/plan");
  }

  async function remove() {
    if (current.isSystem) return;
    if (!confirm("Diese eigene Übung löschen?")) return;
    await deleteExercise(current.id);
    router.push("/catalog");
  }

  return (
    <div className="space-y-5">
      <div>
        <KindBadge kind={exercise.kind} />
        <h2 className="mt-2 font-display text-3xl text-forest-dark">{exercise.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink/80">{exercise.summary}</p>
      </div>
      <PosePlayer steps={exercise.steps} />
      <Card>
        <h3 className="font-display text-xl">Vorgeschlagener Rhythmus</h3>
        <p className="mt-2 text-sm leading-relaxed">{exercise.suggestedRhythm.note}</p>
        <p className="mt-2 text-sm text-forest-light">
          {rhythmLabel(
            exercise.suggestedRhythm.kind,
            exercise.suggestedRhythm.daysOfWeek,
            exercise.suggestedRhythm.everyNDays,
          )}
          {" · "}
          {formatDuration(exercise.defaultDurationSec)}
          {exercise.suggestedRhythm.recommendedWeeks
            ? ` · zuerst ${exercise.suggestedRhythm.recommendedWeeks} Wochen`
            : " · gerne dauerhaft"}
        </p>
      </Card>
      <Card>
        <h3 className="font-display text-xl">Kategorien</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {exercise.categoryIds.map((id) => (
            <li key={id}>{categoryPathLabel(categories, id)}</li>
          ))}
        </ul>
        {exercise.complaintIds.length > 0 && (
          <>
            <h3 className="mt-4 font-display text-xl">Hilft bei</h3>
            <p className="mt-1 text-sm">
              {exercise.complaintIds
                .map((id) => complaints.find((complaint) => complaint.id === id)?.name)
                .filter(Boolean)
                .join(" · ")}
            </p>
          </>
        )}
        {exercise.source.type === "import" && exercise.source.label && (
          <p className="mt-3 text-xs text-forest-light">
            Abgeleitet von „{exercise.source.label}“. Das Originalvideo wird nicht gezeigt – nur die einheitliche Figur.
          </p>
        )}
      </Card>
      <div className="flex flex-col gap-2">
        <Link href={`/practice/${exercise.id}`} className="rounded-full bg-clay py-3 text-center text-sm text-cream">
          Jetzt anleiten lassen
        </Link>
        <PrimaryButton onClick={addToPlan} disabled={receivedActive}>
          {receivedActive
            ? "Aktiver Plan ist empfangen (nur lesen)"
            : inPlan
              ? "Rhythmus im Plan aktualisieren"
              : "In den Plan aufnehmen"}
        </PrimaryButton>
        {!exercise.isSystem && (
          <SecondaryButton onClick={remove}>Eigene Übung löschen</SecondaryButton>
        )}
      </div>
    </div>
  );
}
