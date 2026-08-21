"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExerciseCard } from "@/components/ExerciseCard";
import { Card, Field, fieldClass, PrimaryButton, SecondaryButton } from "@/components/ui";
import { newId, saveExercise } from "@/lib/repository";
import type { DraftExercise, Exercise } from "@/lib/types";

type ImportResponse = {
  error?: string;
  code?: string;
  meta?: { title: string; provider: string; url: string; usedCaptions?: boolean };
  drafts?: DraftExercise[];
};

export default function ImportPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftExercise[]>([]);
  const [selected, setSelected] = useState<boolean[]>([]);
  const [sourceLabel, setSourceLabel] = useState("");
  const [usedCaptions, setUsedCaptions] = useState(false);

  async function analyze() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await response.json()) as ImportResponse;
      if (!response.ok || data.error || !data.drafts) {
        throw new Error(data.error || "Import fehlgeschlagen");
      }
      if (data.drafts.length === 0) {
        throw new Error("Zu diesem Link konnten keine Übungen abgeleitet werden. Titel und Beschreibung fehlen oder sind zu knapp.");
      }
      setDrafts(data.drafts);
      setSelected(data.drafts.map(() => true));
      setSourceLabel(data.meta?.title ?? url);
      setUsedCaptions(Boolean(data.meta?.usedCaptions));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    const now = new Date().toISOString();
    const chosen = drafts.filter((_, index) => selected[index]);
    let lastId = "";
    for (const draft of chosen) {
      const id = newId("ex");
      lastId = id;
      const exercise: Exercise = {
        ...draft,
        id,
        createdAt: now,
        updatedAt: now,
      };
      await saveExercise(exercise);
    }
    if (lastId) router.push(`/catalog/${lastId}`);
  }

  const previewExercises: Exercise[] = drafts.map((draft, index) => ({
    ...draft,
    id: `preview-${index}`,
    createdAt: "",
    updatedAt: "",
  }));

  return (
    <div className="space-y-5">
      <h2 className="font-display text-3xl text-forest-dark">Aus einem Link ableiten</h2>
      <p className="text-sm leading-relaxed text-ink/80">
        Füge einen YouTube- oder Instagram-Link ein. Die App liest öffentlich verfügbare Titel, Beschreibungen und Untertitel – wenn sie erreichbar sind – und schlägt daraus Übungen für unsere Figur vor. Das ist keine Bild-für-Bild-Videoanalyse. Das Originalvideo kannst du später zusätzlich abspielen; die Anleitung bleibt die Figur mit Schritten.
      </p>
      <Field label="Link">
        <input
          className={fieldClass}
          placeholder="https://youtu.be/… oder Instagram"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
      </Field>
      <PrimaryButton disabled={!url || loading} onClick={analyze}>
        {loading ? "Quelle lesen …" : "Übungen ableiten"}
      </PrimaryButton>
      {error && (
        <p className="rounded-2xl bg-clay/15 px-4 py-3 text-sm text-forest-dark" role="alert">
          {error}
        </p>
      )}
      {drafts.length > 0 && (
        <Card>
          <h3 className="font-display text-xl">Vorschlag</h3>
          <p className="mt-1 text-sm text-forest-light">
            Quelle: {sourceLabel}.{" "}
            {usedCaptions
              ? "Öffentliche Untertitel wurden mitgelesen, danach zeichnen wir unsere Figur."
              : "Titel und Beschreibung wurden gelesen. Öffentliche Untertitel lagen nicht vor oder waren nicht erreichbar."}{" "}
            Bitte prüfen, bevor du speicherst. Das Originalvideo kannst du später zusätzlich ansehen.
          </p>
          <div className="mt-4 space-y-3">
            {previewExercises.map((exercise, index) => (
              <label key={exercise.id} className="block">
                <span className="mb-1 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-forest"
                    checked={selected[index]}
                    onChange={() => setSelected((current) => current.map((value, i) => (i === index ? !value : value)))}
                  />
                  Übernehmen
                </span>
                <ExerciseCard exercise={exercise} interactive={false} />
              </label>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <PrimaryButton disabled={!selected.some(Boolean)} onClick={save}>
              Ausgewählte speichern
            </PrimaryButton>
            <SecondaryButton
              onClick={() => {
                setDrafts([]);
                setUsedCaptions(false);
              }}
            >
              Verwerfen
            </SecondaryButton>
          </div>
        </Card>
      )}
    </div>
  );
}
