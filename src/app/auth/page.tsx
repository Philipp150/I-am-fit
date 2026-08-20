"use client";

import { useState } from "react";
import { Card, Field, fieldClass, PrimaryButton } from "@/components/ui";
import { isCloudEnabled } from "@/lib/env";
import { requestMagicLink } from "@/lib/repository";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await requestMagicLink(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Senden fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  if (!isCloudEnabled()) {
    return (
      <Card>
        <h2 className="font-display text-2xl">Lokaler Modus</h2>
        <p className="mt-2 text-sm">Supabase ist hier nicht konfiguriert. Die App speichert auf diesem Gerät.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-3xl text-forest-dark">Anmelden</h2>
      <p className="text-sm leading-relaxed text-ink/80">
        Ein Link per E-Mail reicht. Danach sind Plan und eigene Übungen auf PC und Handy dieselben.
      </p>
      {sent ? (
        <Card>
          <p>Schau in dein Postfach und öffne den Link. Danach bist du angemeldet.</p>
        </Card>
      ) : (
        <Card>
          <Field label="E-Mail">
            <input className={fieldClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          {error && <p className="mt-2 text-sm text-clay">{error}</p>}
          <PrimaryButton className="mt-4 w-full" disabled={!email || busy} onClick={submit}>
            Link senden
          </PrimaryButton>
        </Card>
      )}
    </div>
  );
}
