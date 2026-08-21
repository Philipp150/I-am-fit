export const CLOUD_HYDRATE_TIMEOUT_MS = 8_000;

export type CatalogStatusInput = {
  cloudEnabled: boolean;
  online: boolean;
  localSeeded: boolean;
  localCatalogCount: number;
  cloudHydrating: boolean;
  cloudHydrateFailed: boolean;
  cloudHydrateTimedOut: boolean;
};

export function isBrowserOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

export function shouldStartCloudHydrate(input: { cloudEnabled: boolean; online: boolean }): boolean {
  return input.cloudEnabled && input.online;
}

/** Cloud must never delay first paint once the bundled Dexie catalog can load. */
export function bootstrapWaitsForCloud(): boolean {
  return false;
}

/**
 * Non-blocking status text. Local exercises hide the banner even while cloud syncs.
 * The old full-screen "Cloud-Sammlung wird vorbereitet …" is only for the rare
 * case that Dexie is still empty and a cloud fetch is actually in flight.
 */
export function catalogStatusMessage(input: CatalogStatusInput): string | null {
  if (input.localCatalogCount > 0) return null;

  if (!input.localSeeded) {
    return "Sammlung wird vorbereitet …";
  }

  if (input.cloudHydrateTimedOut || input.cloudHydrateFailed) {
    return "Cloud nicht erreichbar. Lokale Sammlung wird genutzt.";
  }

  if (input.cloudEnabled && input.online && input.cloudHydrating) {
    return "Cloud-Sammlung wird vorbereitet …";
  }

  return null;
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | "timeout"> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve("timeout");
    }, ms);

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function runBootstrap(deps: {
  cloudEnabled: boolean;
  online: boolean;
  seedLocal: () => Promise<void>;
  seedLocalWithPlan: () => Promise<void>;
  hydrateCloud: () => Promise<unknown>;
}): Promise<{ localReady: true; cloudHydrateStarted: boolean }> {
  if (!deps.cloudEnabled) {
    await deps.seedLocalWithPlan();
    return { localReady: true, cloudHydrateStarted: false };
  }

  await deps.seedLocal();
  if (!deps.online) {
    return { localReady: true, cloudHydrateStarted: false };
  }

  void Promise.resolve()
    .then(() => deps.hydrateCloud())
    .catch(() => undefined);
  return { localReady: true, cloudHydrateStarted: true };
}
