"use client";

import { useState } from "react";
import { CategoryPicker } from "@/components/CategoryPicker";
import { PosePicker } from "@/components/PosePicker";
import { PosePlayer } from "@/components/PosePlayer";
import { PoseTrackCapture } from "@/components/PoseTrackCapture";
import { Card, Field, fieldClass } from "@/components/ui";
import { applyPoseOverride, applyStepPatch, emptyStep, patchDraft } from "@/lib/exercise-draft";
import { formatStepClock } from "@/lib/player";
import { formatTrackSeconds } from "@/lib/pose-source";
import { hasPlayableTrack } from "@/lib/pose-track";
import type { Category, Complaint, DraftExercise, ExerciseKind, PoseId } from "@/lib/types";
import { applyAnalysisToDraft, type TimedCaptionCue } from "@/lib/video-text";

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

/**
 * With a movement track the figure plays the clip, and the per-step poses only apply once the track
 * is gone. Saying so – and asking before dropping a track that took a minute to analyse – beats
 * letting the pose buttons look as if they were being ignored.
 */
function TrackOrPose({ value, onChange }: { value: DraftExercise; onChange: (next: DraftExercise) => void }) {
  const [asking, setAsking] = useState(false);
  const track = value.poseTrack;
  if (!hasPlayableTrack(track)) return null;

  return (
    <div className="mb-4 rounded-2xl bg-sage/35 p-3">
      <p className="font-display text-lg text-forest-dark">Die Figur folgt der Bewegungsspur</p>
      <p className="mt-1 text-sm text-ink/80">
        Aus dem Clip erkannt: {formatTrackSeconds(track.durationSec)}, {track.frames.length} Bilder. Die Posen bei den
        Schritten sind so lange nur die Reserve – sie greifen erst ohne Spur.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={!asking}
          className="rounded-full bg-forest px-4 py-2 text-sm text-cream"
          onClick={() => setAsking(false)}
        >
          Spur verwenden
        </button>
        <button
          type="button"
          aria-pressed={asking}
          className="rounded-full border border-forest/30 bg-white/60 px-4 py-2 text-sm text-forest-dark"
          onClick={() => setAsking(true)}
        >
          Pose wählen
        </button>
      </div>
      {asking && (
        <div className="mt-2 rounded-2xl bg-white/70 p-2 text-sm text-forest-dark" role="status">
          <p>Dafür wird die Bewegungsspur entfernt. Ein neuer Clip kann sie jederzeit wieder erzeugen.</p>
          <button
            type="button"
            className="mt-2 text-clay underline"
            onClick={() => {
              onChange(patchDraft(value, { poseTrack: undefined }));
              setAsking(false);
            }}
          >
            Spur entfernen und Posen nutzen
          </button>
        </div>
      )}
    </div>
  );
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
  const trackDrivesFigure = hasPlayableTrack(value.poseTrack);
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
        <TrackOrPose value={value} onChange={onChange} />
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
              <PosePicker
                value={step.pose}
                stepText={step.text}
                secondary={trackDrivesFigure}
                onChange={(pose: PoseId) =>
                  onChange(patchDraft(value, { steps: applyPoseOverride(value.steps, index, pose) }))
                }
              />
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
