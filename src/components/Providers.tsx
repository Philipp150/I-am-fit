"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ReminderHost } from "@/components/Pwa";
import { isCloudEnabled } from "@/lib/env";
import { bootstrap } from "@/lib/repository";

export function Providers({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    bootstrap()
      .then(() => {
        if (active) setReady(true);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Datenbankfehler");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready || typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, [ready]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p>Die Sammlung konnte nicht geladen werden. {error}</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <div className="h-12 w-12 animate-pulse rounded-full bg-forest" />
        <p className="text-sm text-forest-light">
          {isCloudEnabled() ? "Cloud-Sammlung wird vorbereitet …" : "Sammlung wird vorbereitet …"}
        </p>
      </div>
    );
  }

  return (
    <>
      <ReminderHost />
      {children}
    </>
  );
}
