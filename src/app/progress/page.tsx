"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, Field, fieldClass, PrimaryButton, SecondaryButton } from "@/components/ui";
import { downloadBackupFile, exportCurrentBackup, parseBackup, restoreBackup } from "@/lib/backup";
import { isCloudEnabled } from "@/lib/env";
import { useCompletions, useExercises, useProfile, useSession } from "@/lib/hooks";
import { localStateSummary, migrateLocalToCloud } from "@/lib/migrate";
import { ensureNotificationPermission, parseReminderTime } from "@/lib/reminders";
import { saveProfile, signOut } from "@/lib/repository";
import { addDays, isoDate, startOfDay, streakLength } from "@/lib/schedule";

export default function ProgressPage() {
  const completions = useCompletions();
  const exercises = useExercises();
  const profile = useProfile();
  const session = useSession();
  const [name, setName] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState("08:30");
  const [reminderNote, setReminderNote] = useState<string | null>(null);
  const [backupNote, setBackupNote] = useState<string | null>(null);
  const [migrateNote, setMigrateNote] = useState<string | null>(null);
  const [localCount, setLocalCount] = useState<{ exercises: number; planItems: number; completions: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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
    if (profile) {
      setReminderEnabled(profile.reminderEnabled);
      setReminderTime(profile.reminderTime);
    }
  }, [profile]);

  useEffect(() => {
    if (!isCloudEnabled() || !session || session.id === "solo") return;
    localStateSummary()
      .then((summary) => {
        if (summary.hasData) setLocalCount(summary);
      })
      .catch(() => undefined);
  }, [session]);

  function profileBase() {
    return (
      profile ?? {
        id: session?.id ?? "solo",
        displayName: "",
        reminderEnabled: true,
        reminderTime: "08:30",
        activePlanId: null,
        createdAt: new Date().toISOString(),
      }
    );
  }

  async function saveName() {
    await saveProfile({ ...profileBase(), displayName: name.trim() });
  }

  async function saveReminders() {
    if (!parseReminderTime(reminderTime)) {
      setReminderNote("Bitte eine Uhrzeit im Format 08:30 angeben.");
      return;
    }
    if (reminderEnabled) {
      const permission = await ensureNotificationPermission();
      if (permission === "denied") {
        setReminderNote("Benachrichtigungen sind blockiert. In den Browser-Einstellungen erlauben, dann noch einmal speichern.");
      } else if (permission === "unsupported") {
        setReminderNote("Dieser Browser kann keine lokalen Erinnerungen. Die Uhrzeit wird trotzdem gespeichert.");
      } else {
        setReminderNote("Erinnerung gespeichert. Sie kommt, wenn die App oder die installierte PWA offen bzw. im Hintergrund erreichbar ist.");
      }
    } else {
      setReminderNote("Erinnerungen sind aus.");
    }
    await saveProfile({
      ...profileBase(),
      displayName: name.trim() || profileBase().displayName,
      reminderEnabled,
      reminderTime,
    });
  }

  async function exportBackup() {
    setBackupNote(null);
    try {
      const backup = await exportCurrentBackup();
      downloadBackupFile(backup);
      setBackupNote("Backup heruntergeladen. Eigene Übungen, Plan und Verlauf sind in der Datei.");
    } catch (err) {
      setBackupNote(err instanceof Error ? err.message : "Export fehlgeschlagen");
    }
  }

  async function importBackup(file: File) {
    setBackupNote(null);
    try {
      const backup = parseBackup(await file.text());
      const result = await restoreBackup(backup);
      setBackupNote(`Übernommen: ${result.exercises} eigene Übungen, ${result.planItems} Plan-Einträge, ${result.completions} Verlaufspunkte.`);
    } catch (err) {
      setBackupNote(err instanceof Error ? err.message : "Import fehlgeschlagen");
    }
  }

  async function migrate() {
    setMigrateNote(null);
    try {
      const result = await migrateLocalToCloud();
      setLocalCount(null);
      setMigrateNote(
        `Lokaler Stand ist im Konto: ${result.exercises} eigene Übungen, ${result.planItems} Plan-Einträge, ${result.completions} Verlaufspunkte.`,
      );
    } catch (err) {
      setMigrateNote(err instanceof Error ? err.message : "Übernahme fehlgeschlagen");
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="font-display text-3xl text-forest-dark">Verlauf</h2>
      <p className="text-sm">
        <Link href="/plan" className="text-forest underline">
          Pläne und Einladungen
        </Link>
      </p>
      {isCloudEnabled() && (
        <Card>
          <h3 className="font-display text-xl">Konto</h3>
          {session ? (
            <>
              <p className="mt-2 text-sm">Angemeldet{session.email ? ` als ${session.email}` : ""}. Plan und eigene Übungen liegen in Supabase und sind auf PC und Handy gleich.</p>
              <p className="mt-2 text-sm">
                <Link href="/plan" className="underline">
                  Pläne und Einladungen
                </Link>
              </p>
              <SecondaryButton className="mt-3" onClick={() => signOut()}>
                Abmelden
              </SecondaryButton>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm">Ohne Anmeldung siehst du den Katalog, aber der Plan bleibt nicht geräteübergreifend.</p>
              <Link href="/auth" className="mt-3 inline-flex rounded-full bg-forest px-5 py-3 text-sm text-cream">
                Per E-Mail anmelden
              </Link>
            </>
          )}
        </Card>
      )}
      {localCount && (
        <Card>
          <h3 className="font-display text-xl">Lokalen Stand übernehmen</h3>
          <p className="mt-2 text-sm leading-relaxed">
            In diesem Browser liegen noch {localCount.planItems} Plan-Einträge, {localCount.exercises} eigene Übungen und{" "}
            {localCount.completions} Verlaufspunkte. Du kannst sie in dein Cloud-Konto kopieren.
          </p>
          <PrimaryButton className="mt-3" onClick={migrate}>
            In das Konto kopieren
          </PrimaryButton>
          {migrateNote && <p className="mt-2 text-sm text-forest-dark">{migrateNote}</p>}
        </Card>
      )}
      <Card>
        <p className="text-sm text-forest-light">Aktuelle Serie</p>
        <p className="font-display text-4xl text-forest-dark">{streak} Tage</p>
        <p className="mt-2 text-sm text-ink/80">Kein Streak als Druck. Nur ein Blick zurück: du warst schon da.</p>
      </Card>
      <div
        className="grid grid-cols-7 gap-2"
        role="img"
        aria-label={`Übungen an ${doneDays.size} von 28 Tagen im Raster markiert`}
      >
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
              <span className="text-forest-dark/75">{item.skipped ? "ausgelassen" : item.completedAt.slice(0, 10)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h3 className="font-display text-xl">Erinnerung</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink/80">
          Eine lokale oder Web-Push-Erinnerung zur Wunschzeit. Zusätzlich kannst du einzelne Plan-Einträge mit einer eigenen Uhrzeit versehen.
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-forest"
            checked={reminderEnabled}
            onChange={(event) => setReminderEnabled(event.target.checked)}
          />
          Tägliche Erinnerung
        </label>
        <Field label="Uhrzeit">
          <input
            className={fieldClass}
            type="time"
            value={reminderTime}
            onChange={(event) => setReminderTime(event.target.value)}
            disabled={!reminderEnabled}
          />
        </Field>
        <PrimaryButton className="mt-3" onClick={saveReminders}>
          Erinnerung speichern
        </PrimaryButton>
        {reminderNote && <p className="mt-2 text-sm text-forest-dark">{reminderNote}</p>}
      </Card>
      <Card>
        <h3 className="font-display text-xl">Name für die Begrüßung</h3>
        <Field label="Wie sollen wir dich nennen?">
          <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="optional" />
        </Field>
        <PrimaryButton className="mt-3" onClick={saveName}>
          Speichern
        </PrimaryButton>
        <p className="mt-3 text-xs text-forest-dark/75">
          {isCloudEnabled()
            ? "Mit Konto liegen Name, Plan und Verlauf in Supabase."
            : "Ohne Cloud bleibt alles in diesem Browser."}
        </p>
      </Card>
      <Card>
        <h3 className="font-display text-xl">Backup</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink/80">
          Eigene Übungen, Plan und Verlauf als JSON sichern oder zurückspielen. Katalog-Übungen sind immer in der App und stehen nicht in der Datei.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <PrimaryButton onClick={exportBackup}>Backup herunterladen</PrimaryButton>
          <SecondaryButton onClick={() => fileRef.current?.click()}>Backup einspielen</SecondaryButton>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importBackup(file);
            event.target.value = "";
          }}
        />
        {backupNote && <p className="mt-2 text-sm text-forest-dark">{backupNote}</p>}
      </Card>
    </div>
  );
}
