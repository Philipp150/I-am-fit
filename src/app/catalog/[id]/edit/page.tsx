"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ExerciseEditor } from "@/components/ExerciseEditor";
import { PrimaryButton } from "@/components/ui";
import { canSaveDraft, exerciseToDraft, prepareImportedSave } from "@/lib/exercise-draft";
import { useCategories, useComplaints, useExercise } from "@/lib/hooks";
import { saveExercise } from "@/lib/repository";
import type { DraftExercise } from "@/lib/types";

export default function EditExercisePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const exercise = useExercise(params.id);
  const categories = useCategories();
  const complaints = useComplaints();
  const [draft, setDraft] = useState<DraftExercise | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (exercise) setDraft(exerciseToDraft(exercise));
  }, [exercise]);

  if (!exercise || !draft) {
    return <p className="text-forest-light">Übung wird geladen …</p>;
  }

  async function save() {
    if (!exercise || !draft || !canSaveDraft(draft)) return;
    setSaving(true);
    const now = new Date().toISOString();
    await saveExercise(
      prepareImportedSave({
        draft,
        existing: exercise,
        now,
        newId: exercise.id,
      }),
    );
    router.push(`/catalog/${exercise.id}`);
  }

  return (
    <div className="space-y-5">
      <h2 className="font-display text-3xl text-forest-dark">Übung anpassen</h2>
      <p className="text-sm text-ink/80">
        Titel, Schritte und die Figur kannst du ändern. Das Originalvideo bleibt nur ein Zusatz, falls ein Link hinterlegt ist.
      </p>
      {exercise.isSystem && (
        <p className="rounded-2xl bg-sage/40 px-4 py-3 text-sm text-forest-dark" role="status">
          Damit deine Änderungen bleiben, wird diese Katalog-Übung zu einer eigenen Fassung. Es entsteht keine zweite Kopie.
        </p>
      )}
      <ExerciseEditor value={draft} onChange={setDraft} categories={categories} complaints={complaints} />
      <div className="flex flex-col gap-2">
        <PrimaryButton className="w-full" disabled={!canSaveDraft(draft) || saving} onClick={save}>
          Änderungen speichern
        </PrimaryButton>
        <Link
          href={`/catalog/${exercise.id}`}
          className="inline-flex items-center justify-center rounded-full border border-forest/30 bg-white/50 px-5 py-3 text-center text-sm font-medium text-forest-dark"
        >
          Abbrechen
        </Link>
      </div>
    </div>
  );
}
