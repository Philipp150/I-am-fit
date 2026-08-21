"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, Field, fieldClass, PrimaryButton, SecondaryButton } from "@/components/ui";
import { isCloudEnabled } from "@/lib/env";
import { usePendingInvites, usePlans, useProfile, useSession } from "@/lib/hooks";
import { creatorAttribution } from "@/lib/plan-share";
import { acceptPlanInvite, archivePlan, createPlan, declinePlanInvite, setActivePlan } from "@/lib/repository";
import type { PlanInvite, TrainingPlan } from "@/lib/types";

export default function PlanPage() {
  const plans = usePlans();
  const profile = useProfile();
  const session = useSession();
  const invites = usePendingInvites();
  const [title, setTitle] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const cloud = isCloudEnabled();
  const signedIn = Boolean(session && session.id !== "solo");
  const visible = useMemo(
    () =>
      plans
        .filter((plan) => (showArchived ? true : !plan.archived))
        .sort((a, b) => Number(b.id === profile?.activePlanId) - Number(a.id === profile?.activePlanId)),
    [plans, showArchived, profile?.activePlanId],
  );
  const archivedCount = plans.filter((plan) => plan.archived).length;

  async function create() {
    setNote(null);
    try {
      await createPlan(title.trim() || "Neuer Plan");
      setTitle("");
      setNote("Der Plan ist angelegt. Du kannst ihn öffnen und Übungen hinzufügen.");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Anlegen fehlgeschlagen");
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-3xl text-forest-dark">Deine Pläne</h2>
      <p className="text-sm leading-relaxed text-ink/80">
        Du kannst mehrere Übungspläne haben – eigene und empfangene. Nur der aktive Plan erscheint unter Heute. Wer den Plan geschickt hat, bleibt sichtbar.
      </p>

      {cloud && !signedIn && (
        <Card>
          <p className="text-sm leading-relaxed">
            Zum Senden und Empfangen per E-Mail bitte{" "}
            <Link href="/auth" className="underline">
              anmelden
            </Link>
            . Lokal in diesem Browser gehen eigene Pläne trotzdem.
          </p>
        </Card>
      )}
      {!cloud && (
        <Card>
          <p className="text-sm leading-relaxed">
            Teilen per E-Mail braucht ein Supabase-Konto. Ohne Cloud bleiben die Pläne in diesem Browser – du kannst mehrere anlegen, aber nicht verschicken.
          </p>
        </Card>
      )}

      {invites.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-display text-2xl text-forest-dark">Empfangen</h3>
          <p className="text-sm text-ink/80">Jemand hat dir einen Plan geschickt. Annehmen kopiert ihn zu dir, ohne deinen aktuellen Plan zu überschreiben.</p>
          {invites.map((invite) => (
            <InviteCard key={invite.id} invite={invite} />
          ))}
        </section>
      )}

      <Card>
        <h3 className="font-display text-xl">Neuen Plan anlegen</h3>
        <Field label="Titel">
          <input className={fieldClass} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="z. B. Nacken, Praxis Müller" />
        </Field>
        <PrimaryButton className="mt-3" onClick={create}>
          Anlegen
        </PrimaryButton>
        {note && <p className="mt-2 text-sm text-forest-dark">{note}</p>}
      </Card>

      {visible.length === 0 && (
        <Card>
          <p className="text-sm">Noch kein Plan. Lege einen an oder nimm Übungen aus der Sammlung auf.</p>
        </Card>
      )}

      <div className="space-y-3">
        {visible.map((plan) => (
          <PlanCard key={plan.id} plan={plan} active={plan.id === profile?.activePlanId} />
        ))}
      </div>

      {archivedCount > 0 && (
        <button type="button" className="text-sm text-forest underline" onClick={() => setShowArchived((value) => !value)}>
          {showArchived ? "Archiv ausblenden" : `${archivedCount} archivierte Pläne zeigen`}
        </button>
      )}
    </div>
  );
}

function PlanCard({ plan, active }: { plan: TrainingPlan; active: boolean }) {
  const [busy, setBusy] = useState(false);

  async function activate() {
    setBusy(true);
    try {
      await setActivePlan(plan.id);
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!confirm("Diesen Plan aus der Liste legen? Du kannst ihn später wieder im Archiv sehen.")) return;
    setBusy(true);
    try {
      await archivePlan(plan.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={active ? "ring-2 ring-forest/40" : ""}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-forest-light">
            {plan.source === "received" ? "Empfangen" : "Eigener Plan"}
            {active ? " · aktiv für Heute" : ""}
            {plan.archived ? " · archiviert" : ""}
          </p>
          <h3 className="font-display text-xl text-forest-dark">{plan.title}</h3>
          <p className="mt-1 text-sm text-forest-light">{creatorAttribution(plan)}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/plan/${plan.id}`} className="inline-flex rounded-full bg-forest px-4 py-2 text-sm text-cream">
          Öffnen
        </Link>
        {!active && !plan.archived && (
          <SecondaryButton disabled={busy} onClick={activate}>
            Für Heute aktivieren
          </SecondaryButton>
        )}
        {!plan.archived && (
          <button type="button" className="text-sm text-forest underline" disabled={busy} onClick={archive}>
            Archivieren
          </button>
        )}
      </div>
    </Card>
  );
}

function InviteCard({ invite }: { invite: PlanInvite }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const sender = invite.fromName.trim() || invite.fromEmail || "jemand";

  async function accept() {
    setBusy(true);
    try {
      const plan = await acceptPlanInvite(invite.id);
      setDone(`Angenommen als „${plan.title}“. Dein bisheriger Plan bleibt. Du kannst den neuen unter Pläne aktivieren.`);
    } catch (err) {
      setDone(err instanceof Error ? err.message : "Annehmen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    setBusy(true);
    try {
      await declinePlanInvite(invite.id);
      setDone("Abgelehnt. Der Plan wurde nicht übernommen.");
    } catch (err) {
      setDone(err instanceof Error ? err.message : "Ablehnen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h3 className="font-display text-xl text-forest-dark">{invite.planSnapshot.title || "Übungsplan"}</h3>
      <p className="mt-1 text-sm text-forest-light">
        von {sender}
        {invite.fromName && invite.fromEmail ? ` (${invite.fromEmail})` : ""}
      </p>
      <p className="mt-2 text-sm text-ink/80">{invite.planSnapshot.items.length} Übungen · Annehmen legt eine Kopie in deinem Konto an.</p>
      {done ? (
        <p className="mt-3 text-sm text-forest-dark">{done}</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <PrimaryButton disabled={busy} onClick={accept}>
            Annehmen
          </PrimaryButton>
          <SecondaryButton disabled={busy} onClick={decline}>
            Ablehnen
          </SecondaryButton>
        </div>
      )}
    </Card>
  );
}
