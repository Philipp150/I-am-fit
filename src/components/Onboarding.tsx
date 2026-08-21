"use client";

import { useState } from "react";
import { ExerciseCard } from "@/components/ExerciseCard";
import { ThemeChips } from "@/components/ThemeChips";
import { Card, PrimaryButton, SecondaryButton } from "@/components/ui";
import { FIRST_RUN_DURATION_SEC, ONBOARDING_THEMES, pickFirstRunExercise, seedOnboardingPlan } from "@/lib/onboarding";
import { formatDuration } from "@/lib/schedule";
import type { Exercise } from "@/lib/types";

export function OnboardingFlow({
  exercises,
  onSeeded,
  onDismiss,
}: {
  complaints?: unknown;
  exercises: Exercise[];
  onSeeded: (picked: Exercise[]) => void;
  onDismiss: () => void;
}) {
  const [themeId, setThemeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picked = themeId ? pickFirstRunExercise(themeId, exercises) : undefined;
  const catalogReady = exercises.length > 0;

  async function confirm() {
    if (!picked || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await seedOnboardingPlan([picked]);
      if (result.seeded || result.reason === "existing-plan") {
        onSeeded([picked]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Der Plan konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <p className="text-xs uppercase tracking-[0.18em] text-forest-light">Thema</p>
      <h3 id="thema-frage" className="mt-1 font-display text-2xl text-forest-dark">
        Worum soll’s gehen?
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-ink/80">
        Ein Thema, eine Minute – Körperregion, Ziel oder Alltag. Auch Bauch zählt. Keine Diagnose, kein Konto. Später
        lässt sich alles ändern.
      </p>

      <div className="mt-4">
        <ThemeChips
          labelledBy="thema-frage"
          items={ONBOARDING_THEMES.map((theme) => ({ id: theme.id, label: theme.label }))}
          selectedIds={themeId ? [themeId] : []}
          onSelect={(id) => {
            setThemeId(id);
            setError(null);
          }}
        />
      </div>

      {themeId && (
        <p className="mt-3 text-sm text-forest-light">
          {ONBOARDING_THEMES.find((theme) => theme.id === themeId)?.detail}
        </p>
      )}

      {!catalogReady && (
        <p className="mt-4 text-sm text-forest-light" role="status">
          Sammlung wird vorbereitet … Sobald sie da ist, kannst du starten – auch offline.
        </p>
      )}

      {picked && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-forest-dark">Für heute: eine Übung · {formatDuration(FIRST_RUN_DURATION_SEC)}</p>
          <ExerciseCard exercise={picked} interactive={false} />
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-clay" role="alert">
          {error}
        </p>
      )}

      <PrimaryButton className="mt-4 w-full" onClick={confirm} disabled={!picked || busy || !catalogReady}>
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
      <h3 className="font-display text-2xl text-forest-dark">Worum soll’s gehen?</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink/80">
        Thema, Ziel oder Körperregion – eine Minute für heute. Auch Bauch zählt.
      </p>
      <PrimaryButton className="mt-4 w-full" onClick={onStart}>
        Thema wählen
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
