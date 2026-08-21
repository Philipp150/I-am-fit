"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { RhythmFields, type RhythmValue } from "@/components/RhythmFields";
import { Card, Field, fieldClass, PrimaryButton, SecondaryButton } from "@/components/ui";
import { isCloudEnabled } from "@/lib/env";
import { useExercises, usePlan, usePlanItemsFor, useProfile, useSession } from "@/lib/hooks";
import { addExerciseToPlan } from "@/lib/plan";
import { creatorAttribution, isValidEmail } from "@/lib/plan-share";
import { deletePlan, deletePlanItem, savePlan, savePlanItem, sendPlanInvite, setActivePlan } from "@/lib/repository";
import { formatDuration, isPlanItemDueOn, rhythmLabel } from "@/lib/schedule";
import type { PlanItem } from "@/lib/types";

export default function PlanDetailPage() {
  const params = useParams<{ id: string }>();
  const plan = usePlan(params.id);
  const items = usePlanItemsFor(params.id);
  const exercises = useExercises();
  const profile = useProfile();
  const session = useSession();
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [email, setEmail] = useState("");
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const today = new Date();
  const byId = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [exercises]);
  const used = useMemo(() => new Set(items.map((item) => item.exerciseId)), [items]);
  const cloud = isCloudEnabled();
  const signedIn = Boolean(session && session.id !== "solo");
  const readOnly = plan?.source === "received";
  const active = plan?.id === profile?.activePlanId;

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises
      .filter((exercise) => !used.has(exercise.id))
      .filter((exercise) => !q || `${exercise.title} ${exercise.summary}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [exercises, used, query]);

  if (!plan) {
    return <p className="text-forest-light">Plan wird geladen …</p>;
  }

  const current = plan;
  const currentTitle = title ?? current.title;

  async function saveTitle() {
    await savePlan({ ...current, title: currentTitle.trim() || current.title });
    setTitle(null);
  }

  async function share() {
    setShareBusy(true);
    setShareNote(null);
    try {
      if (!isValidEmail(email)) {
        setShareNote("Bitte eine gültige E-Mail-Adresse angeben.");
        return;
      }
      const result = await sendPlanInvite(current.id, email);
      setShareNote(
        result.magicLinkSent
          ? `Einladung liegt bereit. Wenn ${email.trim()} schon ein Konto hat, erscheint der Plan dort unter Empfangen. Zusätzlich haben wir einen Anmeldelink an diese Adresse geschickt.`
          : `Einladung gespeichert. Wenn das Konto existiert, erscheint der Plan unter Empfangen. Eine Extra-Mail mit dem Plan selbst schicken wir nicht – die Person öffnet die App und meldet sich mit dieser E-Mail an.`,
      );
      setEmail("");
    } catch (err) {
      setShareNote(err instanceof Error ? err.message : "Senden fehlgeschlagen");
    } finally {
      setShareBusy(false);
    }
  }

  async function removePlan() {
    if (!confirm("Diesen eigenen Plan löschen? Die Übungen in der Sammlung bleiben.")) return;
    await deletePlan(current.id);
    window.location.href = "/plan";
  }

  return (
    <div className="space-y-4">
      <Link href="/plan" className="text-sm text-forest underline">
        Alle Pläne
      </Link>
      <p className="text-[11px] uppercase tracking-wider text-forest-light">
        {plan.source === "received" ? "Empfangen" : "Eigener Plan"}
        {active ? " · aktiv für Heute" : ""}
      </p>
      {readOnly ? (
        <h2 className="font-display text-3xl text-forest-dark">{current.title}</h2>
      ) : (
        <Field label="Titel">
          <input className={fieldClass} value={currentTitle} onChange={(event) => setTitle(event.target.value)} onBlur={saveTitle} />
        </Field>
      )}
      <p className="text-sm text-forest-light">{creatorAttribution(current)}</p>
      <p className="text-sm leading-relaxed text-ink/80">
        {readOnly
          ? "Dieser Plan bleibt so, wie er geschickt wurde. Du kannst ihn für Heute aktivieren oder archivieren."
          : "Rhythmus pro Übung festlegen. Die App erinnert dich daran, dass du das selbst so wolltest."}
      </p>
      <div className="flex flex-wrap gap-2">
        {!active && <PrimaryButton onClick={() => setActivePlan(current.id)}>Für Heute aktivieren</PrimaryButton>}
        {!readOnly && <SecondaryButton onClick={removePlan}>Plan löschen</SecondaryButton>}
      </div>

      {items.length === 0 && (
        <Card>
          <p className="text-sm">Noch leer. {readOnly ? "Es wurden keine Übungen mitgeschickt." : "Nimm etwas aus der Sammlung oder suche unten."}</p>
        </Card>
      )}

      <div className="space-y-3">
        {items.map((item) => {
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
                {!readOnly && (
                  <label className="text-xs text-forest-light">
                    <input
                      type="checkbox"
                      className="mr-1 accent-forest"
                      checked={item.enabled}
                      onChange={(event) => savePlanItem({ ...item, enabled: event.target.checked })}
                    />
                    aktiv
                  </label>
                )}
              </div>
              {!readOnly &&
                (editing === item.id ? (
                  <EditPlan item={item} onClose={() => setEditing(null)} />
                ) : (
                  <button type="button" className="mt-3 text-sm text-forest underline" onClick={() => setEditing(item.id)}>
                    Rhythmus ändern
                  </button>
                ))}
            </Card>
          );
        })}
      </div>

      {!readOnly && (
        <Card>
          <h3 className="font-display text-xl">Übung hinzufügen</h3>
          <p className="mt-2 text-sm text-ink/80">Aus der Sammlung in diesen Plan legen.</p>
          <input
            className={`${fieldClass} mt-3`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Suchen"
            aria-label="Übung für diesen Plan suchen"
          />
          <ul className="mt-3 space-y-2">
            {suggestions.map((exercise) => (
              <li key={exercise.id} className="flex items-center justify-between gap-2">
                <span className="text-sm">{exercise.title}</span>
                <button
                  type="button"
                  className="text-sm text-forest underline"
                  onClick={() => addExerciseToPlan(exercise, { planId: current.id })}
                >
                  Hinzufügen
                </button>
              </li>
            ))}
          </ul>
          <Link href="/catalog" className="mt-3 inline-block text-sm text-forest underline">
            Zur Sammlung
          </Link>
        </Card>
      )}

      <Card>
        <h3 className="font-display text-xl">Per E-Mail senden</h3>
        {!cloud ? (
          <p className="mt-2 text-sm leading-relaxed">Teilen braucht ein Supabase-Konto. Ohne Cloud bleibt dieser Plan nur in diesem Browser.</p>
        ) : !signedIn ? (
          <p className="mt-2 text-sm leading-relaxed">
            Bitte zuerst{" "}
            <Link href="/auth" className="underline">
              anmelden
            </Link>
            , dann kannst du den Plan an eine E-Mail-Adresse schicken.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm leading-relaxed text-ink/80">
              Die andere Person bekommt die Einladung in der App unter Empfangen – wenn sie sich mit dieser E-Mail anmeldet. Der aktuelle Plan dort wird nicht überschrieben.
            </p>
            <Field label="E-Mail der empfangenden Person">
              <input
                className={fieldClass}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@beispiel.de"
              />
            </Field>
            <PrimaryButton className="mt-3" disabled={shareBusy || !email.trim()} onClick={share}>
              Plan senden
            </PrimaryButton>
            {shareNote && <p className="mt-2 text-sm text-forest-dark">{shareNote}</p>}
          </>
        )}
      </Card>
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
        <input type="time" className={fieldClass} value={reminderTime} onChange={(event) => setReminderTime(event.target.value)} />
      </Field>
      <div className="flex gap-2">
        <PrimaryButton onClick={save}>Speichern</PrimaryButton>
        <SecondaryButton onClick={remove}>Aus dem Plan</SecondaryButton>
      </div>
    </div>
  );
}
