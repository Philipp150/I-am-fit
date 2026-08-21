"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ReminderHost } from "@/components/Pwa";
import { OfflineSupport } from "@/components/OfflineSupport";
import { catalogStatusMessage } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";
import { isCloudEnabled } from "@/lib/env";
import { bootstrap, hydrateCloudCatalog } from "@/lib/repository";

export function Providers({ children }: { children: ReactNode }) {
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cloudEnabled = isCloudEnabled();
        const online = typeof navigator === "undefined" || navigator.onLine !== false;
        const initialCount = await getDb().exercises.count();
        if (!active) return;
        setBanner(
          catalogStatusMessage({
            cloudEnabled,
            online,
            localSeeded: false,
            localCatalogCount: initialCount,
            cloudHydrating: false,
            cloudHydrateFailed: false,
            cloudHydrateTimedOut: false,
          }),
        );

        await bootstrap();
        if (!active) return;

        const afterSeed = await getDb().exercises.count();
        if (afterSeed > 0) {
          setBanner(null);
          return;
        }

        const cloudHydrating = cloudEnabled && online;
        setBanner(
          catalogStatusMessage({
            cloudEnabled,
            online,
            localSeeded: true,
            localCatalogCount: afterSeed,
            cloudHydrating,
            cloudHydrateFailed: false,
            cloudHydrateTimedOut: false,
          }),
        );

        if (!cloudHydrating) {
          return;
        }

        const result = await hydrateCloudCatalog();
        if (!active) return;
        const finalCount = await getDb().exercises.count();
        setBanner(
          catalogStatusMessage({
            cloudEnabled,
            online,
            localSeeded: true,
            localCatalogCount: finalCount,
            cloudHydrating: false,
            cloudHydrateFailed: result === "error",
            cloudHydrateTimedOut: result === "timeout",
          }),
        );
      } catch (err: unknown) {
        if (active) {
          setBanner(null);
          setError(err instanceof Error ? err.message : "Datenbankfehler");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  return (
    <>
      {banner ? (
        <p
          role="status"
          className="fixed left-0 right-0 top-0 z-30 bg-forest px-4 py-2 text-center text-sm text-cream"
        >
          {banner}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="fixed left-0 right-0 top-0 z-30 bg-clay px-4 py-2 text-center text-sm text-cream">
          Die Sammlung konnte nicht geladen werden. {error}
        </p>
      ) : null}
      <ReminderHost />
      <OfflineSupport />
      {children}
    </>
  );
}
