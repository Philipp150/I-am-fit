"use client";

import { useMemo, useState } from "react";
import { ExerciseCard } from "@/components/ExerciseCard";
import { Card, PrimaryButton, SecondaryButton } from "@/components/ui";
import {
  QUICK_PATHS,
  onboardingTotalSec,
  pickOnboardingExercises,
  seedOnboardingPlan,
  type QuickPath,
} from "@/lib/onboarding";
import { formatDuration } from "@/lib/schedule";
import type { Complaint, Exercise } from "@/lib/types";

export function OnboardingFlow({
  complaints,
  exercises,
  onSeeded,
  onDismiss,
}: {
  complaints: Complaint[];
  exercises: Exercise[];
  onSeeded: (picked: Exercise[]) => void;
  onDismiss: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [pathId, setPathId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const path = QUICK_PATHS.find((item) => item.id === pathId) ?? null;
  const picked = useMemo(
    () =>
      pickOnboardingExercises({
        complaintIds: path ? path.complaintIds : selected,
        exercises,
        maxTotalSec: path?.maxTotalSec,
        maxCount: path?.maxCount,
        preferCategoryIds: path?.preferCategoryIds,
      }),
    [path, selected, exercises],
  );
  const totalSec = onboardingTotalSec(picked);
  const catalogReady = complaints.length > 0 && exercises.length > 0;

  function toggleComplaint(id: string) {
    setPathId(null);
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function choosePath(next: QuickPath) {
    setPathId(next.id);
    setSelected(next.complaintIds);
    setError(null);
  }

  async function confirm() {
    if (picked.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await seedOnboardingPlan(picked);
      if (result.seeded || result.reason === "existing-plan") {
        onSeeded(picked);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Der Plan konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <p className="text-xs uppercase tracking-[0.18em] text-forest-light">Ein Einstieg</p>
      <h3 className="mt-1 font-display text-2xl text-forest-dark">Was merkst du gerade?</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink/80">
        In unter einer Minute steht ein kurzer Plan für heute. Kein Konto, keine Diagnose – nur ein paar Übungen, die du
        wirklich schaffen kannst. Später lässt sich alles ändern.
      </p>

      <div className="mt-4 space-y-2">
        {QUICK_PATHS.map((item) => {
          const active = pathId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => choosePath(item)}
              aria-pressed={active}
              className={`w-full rounded-2xl px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest ${active ? "bg-forest text-cream" : "bg-white/70 text-forest-dark"}`}
            >
              <p className="font-medium">{item.label}</p>
              <p className={`mt-0.5 text-sm ${active ? "text-cream/85" : "text-ink/70"}`}>{item.detail}</p>
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-xs uppercase tracking-[0.16em] text-forest-light">Oder Beschwerden wählen</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {complaints.map((complaint) => {
          const active = selected.includes(complaint.id) && !path;
          return (
            <button
              key={complaint.id}
              type="button"
              onClick={() => toggleComplaint(complaint.id)}
              aria-pressed={selected.includes(complaint.id)}
              className={`rounded-full px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest ${active || Boolean(path?.complaintIds.includes(complaint.id)) ? "bg-forest text-cream" : "bg-white/70 text-forest-dark"}`}
            >
              {complaint.name}
            </button>
          );
        })}
      </div>

      {!catalogReady && (
        <p className="mt-4 text-sm text-forest-light" role="status">
          Sammlung wird vorbereitet … Sobald sie da ist, kannst du starten – auch offline.
        </p>
      )}

      {picked.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-forest-dark">
            Für heute: {picked.length === 1 ? "eine Übung" : `${picked.length} Übungen`} · {formatDuration(totalSec)}
          </p>
          {picked.map((exercise) => (
            <ExerciseCard key={exercise.id} exercise={exercise} interactive={false} />
          ))}
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-clay" role="alert">
          {error}
        </p>
      )}

      <PrimaryButton className="mt-4 w-full" onClick={() => void confirm()} disabled={picked.length === 0 || busy || !catalogReady}>
        {busy ? "Wird eingerichtet …" : "Das reicht für heute"}
      </PrimaryButton>
      <SecondaryButton className="mt-2 w-full" onClick={onDismiss} disabled={busy}>
        Erst mal umsehen
      </SecondaryButton>
    </Card>
  );
}

export function OnboardingCta({ onStart }: { onStart: () => void }) {
  return (
    <Card>
      <h3 className="font-display text-2xl text-forest-dark">Ein Plan für heute</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink/80">
        Beschwerden antippen oder den Büro-Kurzweg nehmen. Dauert unter einer Minute.
      </p>
      <PrimaryButton className="mt-4 w-full" onClick={onStart}>
        Plan in einer Minute
      </PrimaryButton>
    </Card>
  );
}

export function OnboardingReminder({
  time,
  onEnable,
  onSkip,
  note,
  busy,
}: {
  time: string;
  onEnable: () => void;
  onSkip: () => void;
  note: string | null;
  busy?: boolean;
}) {
  return (
    <Card>
      <h3 className="font-display text-2xl text-forest-dark">Erinnerung, wenn du magst</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink/80">
        Ein leiser Hinweis um {time}. Kein Druck, kein Konto – nur falls du dich selbst erinnern wolltest.
      </p>
      <PrimaryButton className="mt-4 w-full" onClick={onEnable} disabled={busy}>
        Erinnerung um {time} an
      </PrimaryButton>
      <SecondaryButton className="mt-2 w-full" onClick={onSkip} disabled={busy}>
        Jetzt nicht
      </SecondaryButton>
      {note && (
        <p className="mt-3 text-sm text-forest-light" role="status">
          {note}
        </p>
      )}
    </Card>
  );
}
