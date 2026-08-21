"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExerciseEditor } from "@/components/ExerciseEditor";
import { Card, Field, fieldClass, PrimaryButton, SecondaryButton } from "@/components/ui";
import { canSaveDraft, exerciseToDraft, prepareImportedSave } from "@/lib/exercise-draft";
import { useCategories, useComplaints, useExercises } from "@/lib/hooks";
import { findExercisesBySourceUrl } from "@/lib/source-match";
import { newId, saveExercise } from "@/lib/repository";
import type { DraftExercise, Exercise } from "@/lib/types";
import type { TimedCaptionCue } from "@/lib/video-text";

type ImportResponse = {
  error?: string;
  code?: string;
  meta?: { title: string; provider: string; url: string; usedCaptions?: boolean; captions?: string; captionCues?: TimedCaptionCue[] };
  drafts?: DraftExercise[];
};

type ImportItem = {
  draft: DraftExercise;
  existing?: Exercise;
  selected: boolean;
};

export default function ImportPage() {
  const router = useRouter();
  const exercises = useExercises();
  const categories = useCategories();
  const complaints = useComplaints();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ImportItem[]>([]);
  const [sourceLabel, setSourceLabel] = useState("");
  const [usedCaptions, setUsedCaptions] = useState(false);
  const [captions, setCaptions] = useState("");
  const [captionCues, setCaptionCues] = useState<TimedCaptionCue[]>([]);
  const [duplicate, setDuplicate] = useState(false);

  function loadExisting(matches: Exercise[], label: string) {
    setDuplicate(true);
    setUsedCaptions(false);
    setCaptions("");
    setCaptionCues([]);
    setSourceLabel(label);
    setItems(
      matches.map((exercise) => ({
        draft: exerciseToDraft(exercise),
        existing: exercise,
        selected: true,
      })),
    );
  }

  async function analyze() {
    setLoading(true);
    setError(null);
    setItems([]);
    setDuplicate(false);
    try {
      const localMatches = findExercisesBySourceUrl(exercises, url);
      if (localMatches.length > 0) {
        loadExisting(localMatches, localMatches[0].source.label ?? localMatches[0].title);
        return;
      }

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

      const resolvedUrl = data.meta?.url ?? url;
      const afterFetch = findExercisesBySourceUrl(exercises, resolvedUrl);
      if (afterFetch.length > 0) {
        loadExisting(afterFetch, data.meta?.title ?? afterFetch[0].title);
        return;
      }

      setDuplicate(false);
      setItems(data.drafts.map((draft) => ({ draft, selected: true })));
      setSourceLabel(data.meta?.title ?? url);
      setUsedCaptions(Boolean(data.meta?.usedCaptions));
      setCaptions(data.meta?.captions ?? "");
      setCaptionCues(data.meta?.captionCues ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    const chosen = items.filter((item) => item.selected && canSaveDraft(item.draft));
    if (chosen.length === 0) return;
    setSaving(true);
    const now = new Date().toISOString();
    let lastId = "";
    try {
      for (const item of chosen) {
        const exercise = prepareImportedSave({
          draft: item.draft,
          existing: item.existing,
          now,
          newId: newId("ex"),
        });
        lastId = exercise.id;
        await saveExercise(exercise);
      }
      if (lastId) router.push(`/catalog/${lastId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  const canSave = items.some((item) => item.selected && canSaveDraft(item.draft));

  return (
    <div className="space-y-5">
      <h2 className="font-display text-3xl text-forest-dark">Aus einem Link ableiten</h2>
      <p className="text-sm leading-relaxed text-ink/80">
        Füge einen YouTube- oder Instagram-Link ein. Die App liest öffentlich verfügbare Titel, Beschreibungen und
        Untertitel – wenn sie erreichbar sind – und schlägt Übungen vor. YouTube- und Instagram-Einbettungen liefern keine
        Pixel: sie werden nicht analysiert (weder Bewegung noch eingeblendeter Text). Für Bewegungsspur und Text im Bild
        lade die Datei oder einen kurzen Clip hoch. Das Originalvideo bleibt nur zusätzlich.
      </p>
      <Field label="Link">
        <input
          className={fieldClass}
          placeholder="https://youtu.be/… oder Instagram"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
      </Field>
      <div className="flex flex-col gap-2 sm:flex-row">
        <PrimaryButton disabled={!url || loading} onClick={analyze}>
          {loading ? "Quelle lesen …" : "Übungen ableiten"}
        </PrimaryButton>
        <Link
          href="/catalog/new"
          className="inline-flex items-center justify-center rounded-full border border-forest/30 bg-white/50 px-5 py-3 text-sm font-medium text-forest-dark"
        >
          Ohne Link anlegen
        </Link>
      </div>
      {error && (
        <p className="rounded-2xl bg-clay/15 px-4 py-3 text-sm text-forest-dark" role="alert">
          {error}
        </p>
      )}
      {items.length > 0 && (
        <Card>
          {duplicate ? (
            <>
              <h3 className="font-display text-xl">Dieser Link ist schon in der Sammlung</h3>
              <p className="mt-1 text-sm text-forest-light" role="status">
                Quelle: {sourceLabel}. Es wird keine zweite Kopie angelegt. Du kannst die vorhandene Übung hier
                anpassen – Titel, Schritte und die Anzeige der Figur – und speichern.
              </p>
            </>
          ) : (
            <>
              <h3 className="font-display text-xl">Vorschlag – bitte prüfen und anpassen</h3>
              <p className="mt-1 text-sm text-forest-light">
                Quelle: {sourceLabel}.{" "}
                {usedCaptions
                  ? "Öffentliche Untertitel wurden mitgelesen, danach zeichnen wir unsere Figur."
                  : "Titel und Beschreibung wurden gelesen. Öffentliche Untertitel lagen nicht vor oder waren nicht erreichbar."}{" "}
                Felder und Figur sind bearbeitbar, bevor du speicherst. Bewegungsspur und Text im Bild entstehen nur aus
                einer hochgeladenen Datei (oder einer öffentlichen Videodatei), nicht aus der YouTube-Einbettung. Das
                Originalvideo kannst du später zusätzlich ansehen.
              </p>
            </>
          )}
          <div className="mt-4 space-y-6">
            {items.map((item, index) => (
              <div key={item.existing?.id ?? `draft-${index}`} className="rounded-[1.4rem] border border-sand/80 bg-paper/60 p-3">
                <label className="mb-3 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-forest"
                    checked={item.selected}
                    onChange={() =>
                      setItems((current) =>
                        current.map((entry, i) => (i === index ? { ...entry, selected: !entry.selected } : entry)),
                      )
                    }
                  />
                  {duplicate ? "Anpassen und speichern" : "Übernehmen"}
                </label>
                {item.existing && (
                  <Link href={`/catalog/${item.existing.id}`} className="mb-3 inline-block text-sm text-forest underline">
                    Vorhandene Übung öffnen
                  </Link>
                )}
                <ExerciseEditor
                  value={item.draft}
                  categories={categories}
                  complaints={complaints}
                  captions={captions}
                  captionCues={captionCues}
                  onChange={(draft) =>
                    setItems((current) => current.map((entry, i) => (i === index ? { ...entry, draft } : entry)))
                  }
                />
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <PrimaryButton disabled={!canSave || saving} onClick={save}>
              {duplicate ? "Anpassungen speichern" : "Ausgewählte speichern"}
            </PrimaryButton>
            <SecondaryButton
              onClick={() => {
                setItems([]);
                setUsedCaptions(false);
                setCaptions("");
                setCaptionCues([]);
                setDuplicate(false);
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
