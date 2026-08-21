"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RhythmFields, type RhythmValue } from "@/components/RhythmFields";
import { Card, fieldClass, Field, PrimaryButton, SecondaryButton } from "@/components/ui";
import { savePlanItem, deletePlanItem } from "@/lib/repository";
import { useExercises, usePlanItems } from "@/lib/hooks";
import { formatDuration, isPlanItemDueOn, rhythmLabel } from "@/lib/schedule";
import type { PlanItem } from "@/lib/types";

export default function PlanPage() {
  const planItems = usePlanItems();
  const exercises = useExercises();
  const [editing, setEditing] = useState<string | null>(null);
  const byId = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [exercises]);
  const today = new Date();

  return (
    <div className="space-y-4">
      <h2 className="font-display text-3xl text-forest-dark">Dein Übungsplan</h2>
      <p className="text-sm leading-relaxed text-ink/80">
        Jede Übung bekommt einen Rhythmus: täglich, an bestimmten Tagen oder für einen begrenzten Zeitraum. Die App erinnert dich daran, dass du das selbst so wolltest.
      </p>
      <Link href="/catalog" className="inline-block rounded-full bg-forest px-4 py-2 text-sm text-cream">
        Übung hinzufügen
      </Link>
      {planItems.length === 0 && (
        <Card>
          <p className="text-sm">Noch leer. Nimm etwas aus der Sammlung oder importiere einen Link.</p>
        </Card>
      )}
      <div className="space-y-3">
        {planItems.map((item) => {
          const exercise = byId.get(item.exerciseId);
          if (!exercise) return null;
          const due = isPlanItemDueOn(item, today);
          return (
            <Card key={item.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl text-forest-dark">{exercise.title}</h3>
                  <p className="text-sm text-forest-light">
                    {rhythmLabel(item.rhythm.kind, item.rhythm.daysOfWeek, item.rhythm.everyNDays)} ·{" "}
                    {formatDuration(item.durationSec ?? exercise.defaultDurationSec)}
                    {item.keepUntil ? ` · bis ${item.keepUntil}` : " · unbegrenzt"}
                    {item.reminderTime ? ` · Erinnerung ${item.reminderTime}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-ink/60">{due ? "Heute vorgesehen" : "Heute Pause"}</p>
                </div>
                <label className="text-xs text-forest-light">
                  <input
                    type="checkbox"
                    className="mr-1 accent-forest"
                    checked={item.enabled}
                    onChange={(event) => savePlanItem({ ...item, enabled: event.target.checked })}
                  />
                  aktiv
                </label>
              </div>
              {editing === item.id ? (
                <EditPlan item={item} onClose={() => setEditing(null)} />
              ) : (
                <button type="button" className="mt-3 text-sm text-forest underline" onClick={() => setEditing(item.id)}>
                  Rhythmus ändern
                </button>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function EditPlan({ item, onClose }: { item: PlanItem; onClose: () => void }) {
  const [rhythm, setRhythm] = useState<RhythmValue>({
    kind: item.rhythm.kind,
    daysOfWeek: item.rhythm.daysOfWeek,
    everyNDays: item.rhythm.everyNDays,
  });
  const [keepUntil, setKeepUntil] = useState<string | null>(item.keepUntil ?? null);
  const [durationSec, setDurationSec] = useState(item.durationSec ?? 60);
  const [reminderTime, setReminderTime] = useState(item.reminderTime ?? "");

  async function save() {
    await savePlanItem({
      ...item,
      rhythm: { ...item.rhythm, ...rhythm },
      keepUntil,
      durationSec,
      reminderTime: reminderTime.trim() || undefined,
    });
    onClose();
  }

  async function remove() {
    await deletePlanItem(item.id);
    onClose();
  }

  return (
    <div className="mt-4 space-y-3">
      <RhythmFields value={rhythm} onChange={setRhythm} keepUntil={keepUntil} onKeepUntil={setKeepUntil} />
      <Field label="Dauer in Sekunden">
        <input type="number" min={15} className={fieldClass} value={durationSec} onChange={(event) => setDurationSec(Number(event.target.value))} />
      </Field>
      <Field label="Eigene Erinnerung (optional)">
        <input
          type="time"
          className={fieldClass}
          value={reminderTime}
          onChange={(event) => setReminderTime(event.target.value)}
        />
      </Field>
      <div className="flex gap-2">
        <PrimaryButton onClick={save}>Speichern</PrimaryButton>
        <SecondaryButton onClick={remove}>Aus dem Plan</SecondaryButton>
      </div>
    </div>
  );
}
