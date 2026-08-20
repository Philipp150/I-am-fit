"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ensureSeeded } from "@/lib/db";

export function Providers({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    ensureSeeded()
      .then(() => {
        if (active) setReady(true);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Datenbankfehler");
      });
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p>Die lokale Sammlung konnte nicht geladen werden. {error}</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <div className="h-12 w-12 animate-pulse rounded-full bg-forest" />
        <p className="text-sm text-forest-light">Sammlung wird vorbereitet …</p>
      </div>
    );
  }

  return children;
}
