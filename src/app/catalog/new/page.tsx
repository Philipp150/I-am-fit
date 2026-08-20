"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CategoryPicker } from "@/components/CategoryPicker";
import { StickFigure } from "@/components/StickFigure";
import { Card, Field, fieldClass, PrimaryButton } from "@/components/ui";
import { getDb, newId } from "@/lib/db";
import { useCategories, useComplaints } from "@/lib/hooks";
import { POSE_IDS, POSE_LABELS } from "@/lib/poses";
import type { ExerciseKind, ExerciseStep, PoseId, SuggestedRhythm } from "@/lib/types";

const emptyStep = (): ExerciseStep => ({ pose: "stand", text: "", durationSec: 8 });

export default function NewExercisePage() {
  const router = useRouter();
  const categories = useCategories();
  const complaints = useComplaints();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [kind, setKind] = useState<ExerciseKind>("movement");
  const [categoryIds, setCategoryIds] = useState<string[]>(["cat-body"]);
  const [complaintIds, setComplaintIds] = useState<string[]>([]);
  const [steps, setSteps] = useState<ExerciseStep[]>([emptyStep()]);
  const [duration, setDuration] = useState(90);
  const [note, setNote] = useState("Täglich, so lange es sich richtig anfühlt.");
  const [saving, setSaving] = useState(false);

  function toggle(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
  }

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    const suggestedRhythm: SuggestedRhythm = {
      kind: "daily",
      recommendedWeeks: null,
      note,
    };
    const id = newId("ex");
    const now = new Date().toISOString();
    await getDb().exercises.add({
      id,
      title: title.trim(),
      summary: summary.trim() || "Eigene Übung.",
      kind,
      categoryIds,
      complaintIds,
      steps: steps.map((step) => ({ ...step, text: step.text.trim() || title.trim() })),
      defaultDurationSec: duration,
      suggestedRhythm,
      source: { type: "user" },
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    });
    router.push(`/catalog/${id}`);
  }

  return (
    <div className="space-y-5">
      <h2 className="font-display text-3xl text-forest-dark">Eigene Übung</h2>
      <p className="text-sm text-ink/80">Bewegung, Mantra, Atem – alles darf eine Übung sein. Erkläre sie mit Text und der einheitlichen Figur.</p>
      <Field label="Titel">
        <input className={fieldClass} value={title} onChange={(event) => setTitle(event.target.value)} />
      </Field>
      <Field label="Kurz erklärt">
        <textarea className={fieldClass} rows={3} value={summary} onChange={(event) => setSummary(event.target.value)} />
      </Field>
      <Field label="Art">
        <select className={fieldClass} value={kind} onChange={(event) => setKind(event.target.value as ExerciseKind)}>
          <option value="movement">Bewegung</option>
          <option value="breath">Atem</option>
          <option value="mantra">Mantra</option>
          <option value="mind">Geist / Achtsamkeit</option>
          <option value="other">Andere</option>
        </select>
      </Field>
      <Field label="Dauer in Sekunden">
        <input type="number" min={15} className={fieldClass} value={duration} onChange={(event) => setDuration(Number(event.target.value))} />
      </Field>
      <Field label="Rhythmus-Hinweis">
        <textarea className={fieldClass} rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <Card>
        <h3 className="font-display text-xl">Kategorien</h3>
        <p className="mb-2 text-sm text-forest-light">Mehrere möglich, auch mit Elternkategorien.</p>
        <CategoryPicker
          categories={categories}
          selected={categoryIds}
          onToggle={(id) => setCategoryIds((current) => toggle(current, id))}
        />
      </Card>
      <Card>
        <h3 className="font-display text-xl">Hilft bei Beschwerden</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {complaints.map((complaint) => (
            <button
              key={complaint.id}
              type="button"
              onClick={() => setComplaintIds((current) => toggle(current, complaint.id))}
              className={`rounded-full px-3 py-1.5 text-sm ${complaintIds.includes(complaint.id) ? "bg-forest text-cream" : "bg-white/70 text-forest"}`}
            >
              {complaint.name}
            </button>
          ))}
        </div>
      </Card>
      <Card>
        <h3 className="font-display text-xl">Erklärung in Schritten</h3>
        <p className="mb-3 text-sm text-forest-light">Jeder Schritt ist ein Bild der Figur plus Text. Aneinandergereiht wirkt das wie ein kurzes Video.</p>
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={index} className="rounded-2xl bg-paper p-3">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span>Schritt {index + 1}</span>
                {steps.length > 1 && (
                  <button type="button" className="text-clay" onClick={() => setSteps((current) => current.filter((_, i) => i !== index))}>
                    entfernen
                  </button>
                )}
              </div>
              <div className="grid grid-cols-5 gap-2">
                {POSE_IDS.map((pose) => (
                  <button
                    key={pose}
                    type="button"
                    onClick={() =>
                      setSteps((current) => current.map((item, i) => (i === index ? { ...item, pose: pose as PoseId } : item)))
                    }
                    className={`rounded-xl p-1 ${step.pose === pose ? "bg-sage" : "bg-white/50"}`}
                    title={POSE_LABELS[pose]}
                  >
                    <StickFigure pose={pose} className="h-14 w-full" />
                  </button>
                ))}
              </div>
              <textarea
                className={`${fieldClass} mt-2`}
                rows={2}
                placeholder="Was soll passieren?"
                value={step.text}
                onChange={(event) =>
                  setSteps((current) => current.map((item, i) => (i === index ? { ...item, text: event.target.value } : item)))
                }
              />
              <Field label="Sekunden in der Anleitung">
                <input
                  type="number"
                  min={2}
                  className={fieldClass}
                  value={step.durationSec}
                  onChange={(event) =>
                    setSteps((current) =>
                      current.map((item, i) => (i === index ? { ...item, durationSec: Number(event.target.value) } : item)),
                    )
                  }
                />
              </Field>
            </div>
          ))}
        </div>
        <button type="button" className="mt-3 text-sm text-forest underline" onClick={() => setSteps((current) => [...current, emptyStep()])}>
          Schritt hinzufügen
        </button>
      </Card>
      <PrimaryButton className="w-full" disabled={!title.trim() || saving} onClick={save}>
        Speichern
      </PrimaryButton>
    </div>
  );
}
