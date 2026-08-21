"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExerciseEditor } from "@/components/ExerciseEditor";
import { PrimaryButton } from "@/components/ui";
import { canSaveDraft, createCustomExercise, emptyCustomDraft } from "@/lib/exercise-draft";
import { useCategories, useComplaints } from "@/lib/hooks";
import { newId, saveExercise } from "@/lib/repository";
import type { DraftExercise } from "@/lib/types";

export default function NewExercisePage() {
  const router = useRouter();
  const categories = useCategories();
  const complaints = useComplaints();
  const [draft, setDraft] = useState<DraftExercise>(emptyCustomDraft);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!canSaveDraft(draft)) return;
    setSaving(true);
    const id = newId("ex");
    const now = new Date().toISOString();
    await saveExercise(
      createCustomExercise({
        id,
        now,
        title: draft.title,
        summary: draft.summary,
        kind: draft.kind,
        categoryIds: draft.categoryIds,
        complaintIds: draft.complaintIds,
        steps: draft.steps,
        defaultDurationSec: draft.defaultDurationSec,
        note: draft.suggestedRhythm.note,
      }),
    );
    router.push(`/catalog/${id}`);
  }

  return (
    <div className="space-y-5">
      <h2 className="font-display text-3xl text-forest-dark">Eigene Übung</h2>
      <p className="text-sm text-ink/80">
        Ohne Link: Bewegung, Mantra, Atem – alles darf eine Übung sein. Erkläre sie mit Text und der einheitlichen Figur.
      </p>
      <ExerciseEditor value={draft} onChange={setDraft} categories={categories} complaints={complaints} />
      <PrimaryButton className="w-full" disabled={!canSaveDraft(draft) || saving} onClick={save}>
        Speichern
      </PrimaryButton>
    </div>
  );
}
