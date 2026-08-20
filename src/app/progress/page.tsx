"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Field, fieldClass, PrimaryButton } from "@/components/ui";
import { getDb } from "@/lib/db";
import { useCompletions, useExercises, useProfile } from "@/lib/hooks";
import { addDays, isoDate, startOfDay, streakLength } from "@/lib/schedule";

export default function ProgressPage() {
  const completions = useCompletions();
  const exercises = useExercises();
  const profile = useProfile();
  const [name, setName] = useState("");
  const today = useMemo(() => new Date(), []);
  const days = useMemo(
    () => Array.from({ length: 28 }, (_, index) => addDays(startOfDay(today), index - 27)),
    [today],
  );
  const doneDays = new Set(completions.filter((item) => !item.skipped).map((item) => item.completedAt.slice(0, 10)));
  const streak = streakLength([...doneDays], today);
  const byId = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [exercises]);
  const recent = completions.slice(0, 12);

  useEffect(() => {
    if (profile?.displayName) setName(profile.displayName);
  }, [profile?.displayName]);

  async function saveName() {
    if (!profile) return;
    await getDb().profile.put({ ...profile, displayName: name.trim() });
  }

  return (
    <div className="space-y-5">
      <h2 className="font-display text-3xl text-forest-dark">Verlauf</h2>
      <Card>
        <p className="text-sm text-forest-light">Aktuelle Serie</p>
        <p className="font-display text-4xl text-forest-dark">{streak} Tage</p>
        <p className="mt-2 text-sm text-ink/70">Kein Streak als Druck. Nur ein Blick zurück: du warst schon da.</p>
      </Card>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const key = isoDate(day);
          const on = doneDays.has(key);
          return (
            <div
              key={key}
              title={key}
              className={`h-8 rounded-lg ${on ? "bg-forest" : "bg-white/70"} ${key === isoDate(today) ? "ring-2 ring-clay" : ""}`}
            />
          );
        })}
      </div>
      <Card>
        <h3 className="font-display text-xl">Zuletzt gemacht</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {recent.length === 0 && <li>Noch nichts markiert.</li>}
          {recent.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>{byId.get(item.exerciseId)?.title ?? "Übung"}</span>
              <span className="text-forest-light">{item.skipped ? "ausgelassen" : item.completedAt.slice(0, 10)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h3 className="font-display text-xl">Name für die Begrüßung</h3>
        <Field label="Wie sollen wir dich nennen?">
          <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="optional" />
        </Field>
        <PrimaryButton className="mt-3" onClick={saveName}>
          Speichern
        </PrimaryButton>
        <p className="mt-3 text-xs text-forest-light">Alles bleibt in diesem Browser (und in der installierten App). Kein Konto nötig.</p>
      </Card>
    </div>
  );
}
