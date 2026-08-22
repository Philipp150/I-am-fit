"use client";

import { CategoryPicker } from "@/components/CategoryPicker";
import { PosePlayer } from "@/components/PosePlayer";
import { PoseTrackCapture } from "@/components/PoseTrackCapture";
import { StickFigure } from "@/components/StickFigure";
import { Card, Field, fieldClass } from "@/components/ui";
import { applyPoseOverride, applyStepPatch, emptyStep, patchDraft } from "@/lib/exercise-draft";
import { formatStepClock } from "@/lib/player";
import { POSE_IDS, POSE_LABELS } from "@/lib/poses";
import type { Category, Complaint, DraftExercise, ExerciseKind, PoseId } from "@/lib/types";
import { applyAnalysisToDraft, type TimedCaptionCue } from "@/lib/video-text";

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

export function ExerciseEditor({
  value,
  onChange,
  categories,
  complaints,
  showPlayer = true,
  captions,
  captionCues,
}: {
  value: DraftExercise;
  onChange: (next: DraftExercise) => void;
  categories: Category[];
  complaints: Complaint[];
  showPlayer?: boolean;
  captions?: string;
  captionCues?: TimedCaptionCue[];
}) {
  return (
    <div className="space-y-4">
      <Field label="Titel">
        <input
          className={fieldClass}
          value={value.title}
          onChange={(event) => onChange(patchDraft(value, { title: event.target.value }))}
        />
      </Field>
      <Field label="Kurz erklärt">
        <textarea
          className={fieldClass}
          rows={3}
          value={value.summary}
          onChange={(event) => onChange(patchDraft(value, { summary: event.target.value }))}
        />
      </Field>
      <Field label="Art">
        <select
          className={fieldClass}
          value={value.kind}
          onChange={(event) => onChange(patchDraft(value, { kind: event.target.value as ExerciseKind }))}
        >
          <option value="movement">Bewegung</option>
          <option value="breath">Atem</option>
          <option value="mantra">Mantra</option>
          <option value="mind">Geist / Achtsamkeit</option>
          <option value="other">Andere</option>
        </select>
      </Field>
      <Field label="Dauer in Sekunden">
        <input
          type="number"
          min={15}
          className={fieldClass}
          value={value.defaultDurationSec}
          onChange={(event) => onChange(patchDraft(value, { defaultDurationSec: Number(event.target.value) }))}
        />
      </Field>
      <Field label="Rhythmus-Hinweis">
        <textarea
          className={fieldClass}
          rows={2}
          value={value.suggestedRhythm.note}
          onChange={(event) =>
            onChange(
              patchDraft(value, {
                suggestedRhythm: { ...value.suggestedRhythm, note: event.target.value },
              }),
            )
          }
        />
      </Field>
      <Card>
        <h3 className="font-display text-xl">Kategorien</h3>
        <p className="mb-2 text-sm text-forest-light">Mehrere möglich, auch mit Elternkategorien.</p>
        <CategoryPicker
          categories={categories}
          selected={value.categoryIds}
          onToggle={(id) => onChange(patchDraft(value, { categoryIds: toggle(value.categoryIds, id) }))}
        />
      </Card>
      <Card>
        <h3 className="font-display text-xl">Thema, Ziel, Körperregion</h3>
        <p className="mb-2 text-sm text-forest-light">Worum soll die Übung gehen? Keine Diagnose nötig.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {complaints.map((complaint) => (
            <button
              key={complaint.id}
              type="button"
              onClick={() => onChange(patchDraft(value, { complaintIds: toggle(value.complaintIds, complaint.id) }))}
              className={`rounded-full px-3 py-1.5 text-sm ${value.complaintIds.includes(complaint.id) ? "bg-forest text-cream" : "bg-white/70 text-forest"}`}
            >
              {complaint.name}
            </button>
          ))}
        </div>
      </Card>
      <Card>
        <h3 className="font-display text-xl">Figur und Schritte</h3>
        <p className="mb-3 text-sm text-forest-light">
          Jeder Schritt ist Text plus eine Pose. Wenn eine Bewegungsspur aus einem Clip liegt, spielt die Figur sie ab;
          sonst die gewählten Posen. Text im Video (und vorhandene Untertitel) fließt in Titel und Schritte; neu erkennen
          ersetzt die Spur.
        </p>
        <div className="mb-4">
          <PoseTrackCapture
            value={value.poseTrack}
            sourceUrl={value.source.url}
            captions={captions}
            captionCues={captionCues}
            existingTitle={value.title}
            existingSummary={value.summary}
            steps={value.steps}
            onChange={(poseTrack, suggestion) => onChange(applyAnalysisToDraft(value, poseTrack, suggestion))}
          />
        </div>
        {showPlayer && (
          <div className="mb-4">
            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-forest-light">Anzeige der Figur</p>
            <PosePlayer steps={value.steps} poseTrack={value.poseTrack} autoPlay={false} loop={false} />
          </div>
        )}
        <div className="space-y-4">
          {value.steps.map((step, index) => (
            <div key={index} className="rounded-2xl bg-paper p-3">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span>Schritt {index + 1}</span>
                {value.steps.length > 1 && (
                  <button
                    type="button"
                    className="text-clay"
                    onClick={() =>
                      onChange(patchDraft(value, { steps: value.steps.filter((_, i) => i !== index) }))
                    }
                  >
                    entfernen
                  </button>
                )}
              </div>
              <p className="mb-1 text-xs text-forest-light">Pose für die Figur</p>
              <div className="grid grid-cols-5 gap-2">
                {POSE_IDS.map((pose) => (
                  <button
                    key={pose}
                    type="button"
                    onClick={() =>
                      onChange(patchDraft(value, { steps: applyPoseOverride(value.steps, index, pose as PoseId) }))
                    }
                    className={`rounded-xl p-1 ${step.pose === pose ? "bg-sage" : "bg-white/50"}`}
                    title={POSE_LABELS[pose]}
                    aria-label={POSE_LABELS[pose]}
                    aria-pressed={step.pose === pose}
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
                  onChange(
                    patchDraft(value, { steps: applyStepPatch(value.steps, index, { text: event.target.value }) }),
                  )
                }
              />
              <Field label="Start im Clip (Sekunden, optional)">
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  className={fieldClass}
                  value={step.startSec ?? ""}
                  placeholder="z. B. 12"
                  onChange={(event) => {
                    const raw = event.target.value;
                    const startSec = raw === "" ? undefined : Number(raw);
                    onChange(
                      patchDraft(value, {
                        steps: applyStepPatch(value.steps, index, {
                          startSec: startSec !== undefined && Number.isFinite(startSec) ? startSec : undefined,
                        }),
                      }),
                    );
                  }}
                />
              </Field>
              {typeof step.startSec === "number" && Number.isFinite(step.startSec) && (
                <p className="mt-1 text-xs text-forest-light">Ab {formatStepClock(step.startSec)} im Clip.</p>
              )}
              <Field label="Sekunden in der Anleitung">
                <input
                  type="number"
                  min={2}
                  className={fieldClass}
                  value={step.durationSec}
                  onChange={(event) =>
                    onChange(
                      patchDraft(value, {
                        steps: applyStepPatch(value.steps, index, { durationSec: Number(event.target.value) }),
                      }),
                    )
                  }
                />
              </Field>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-3 text-sm text-forest underline"
          onClick={() => onChange(patchDraft(value, { steps: [...value.steps, emptyStep()] }))}
        >
          Schritt hinzufügen
        </button>
      </Card>
    </div>
  );
}
