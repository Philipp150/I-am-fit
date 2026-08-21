import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bootstrapWaitsForCloud,
  catalogStatusMessage,
  CLOUD_HYDRATE_TIMEOUT_MS,
  isBrowserOnline,
  runBootstrap,
  shouldStartCloudHydrate,
  withTimeout,
} from "./bootstrap";

const emptyCatalog = {
  cloudEnabled: true,
  online: true,
  localSeeded: true,
  localCatalogCount: 0,
  cloudHydrating: true,
  cloudHydrateFailed: false,
  cloudHydrateTimedOut: false,
};

describe("catalog loading banner", () => {
  it("does not show a banner when Dexie already has exercises", () => {
    expect(
      catalogStatusMessage({
        ...emptyCatalog,
        localCatalogCount: 31,
        cloudHydrating: true,
      }),
    ).toBeNull();
  });

  it("uses the local seed copy before cloud, never the blocking cloud splash", () => {
    expect(
      catalogStatusMessage({
        ...emptyCatalog,
        localSeeded: false,
        localCatalogCount: 0,
        cloudHydrating: false,
      }),
    ).toBe("Sammlung wird vorbereitet …");
    expect(bootstrapWaitsForCloud()).toBe(false);
  });

  it("keeps Cloud-Sammlung wird vorbereitet only while local is empty and cloud is fetching", () => {
    expect(catalogStatusMessage(emptyCatalog)).toBe("Cloud-Sammlung wird vorbereitet …");
  });

  it("does not wait on cloud when offline", () => {
    expect(shouldStartCloudHydrate({ cloudEnabled: true, online: false })).toBe(false);
    expect(
      catalogStatusMessage({
        ...emptyCatalog,
        online: false,
        cloudHydrating: true,
      }),
    ).toBeNull();
  });

  it("times out with a fallback instead of looping forever", () => {
    expect(
      catalogStatusMessage({
        ...emptyCatalog,
        cloudHydrating: false,
        cloudHydrateTimedOut: true,
      }),
    ).toBe("Cloud nicht erreichbar. Lokale Sammlung wird genutzt.");
    expect(
      catalogStatusMessage({
        ...emptyCatalog,
        localCatalogCount: 31,
        cloudHydrateTimedOut: true,
      }),
    ).toBeNull();
  });
});

describe("runBootstrap", () => {
  it("resolves after the local seed even if cloud hydrate never finishes", async () => {
    let cloudStarted = false;
    const result = await runBootstrap({
      cloudEnabled: true,
      online: true,
      seedLocal: async () => undefined,
      seedLocalWithPlan: async () => {
        throw new Error("plan seed is only for local mode");
      },
      hydrateCloud: () => {
        cloudStarted = true;
        return new Promise(() => undefined);
      },
    });
    expect(result).toEqual({ localReady: true, cloudHydrateStarted: true });
    expect(cloudStarted).toBe(true);
  });

  it("skips cloud hydrate when offline", async () => {
    const hydrateCloud = vi.fn(async () => undefined);
    const result = await runBootstrap({
      cloudEnabled: true,
      online: false,
      seedLocal: async () => undefined,
      seedLocalWithPlan: async () => undefined,
      hydrateCloud,
    });
    expect(result.cloudHydrateStarted).toBe(false);
    expect(hydrateCloud).not.toHaveBeenCalled();
  });

  it("seeds the local plan when cloud is disabled", async () => {
    const seedLocalWithPlan = vi.fn(async () => undefined);
    const hydrateCloud = vi.fn(async () => undefined);
    const result = await runBootstrap({
      cloudEnabled: false,
      online: true,
      seedLocal: async () => {
        throw new Error("catalog-only seed is for cloud mode");
      },
      seedLocalWithPlan,
      hydrateCloud,
    });
    expect(result).toEqual({ localReady: true, cloudHydrateStarted: false });
    expect(seedLocalWithPlan).toHaveBeenCalledOnce();
    expect(hydrateCloud).not.toHaveBeenCalled();
  });
});

describe("withTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns timeout after the cloud hydrate budget", async () => {
    vi.useFakeTimers();
    const pending = withTimeout(new Promise<void>(() => undefined), CLOUD_HYDRATE_TIMEOUT_MS);
    await vi.advanceTimersByTimeAsync(CLOUD_HYDRATE_TIMEOUT_MS);
    await expect(pending).resolves.toBe("timeout");
  });

  it("returns the value when the work finishes in time", async () => {
    await expect(withTimeout(Promise.resolve("ok"), CLOUD_HYDRATE_TIMEOUT_MS)).resolves.toBe("ok");
  });
});

describe("isBrowserOnline", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("treats missing navigator as online and respects navigator.onLine", () => {
    expect(isBrowserOnline()).toBe(true);
    vi.stubGlobal("navigator", { onLine: false });
    expect(isBrowserOnline()).toBe(false);
    vi.stubGlobal("navigator", { onLine: true });
    expect(isBrowserOnline()).toBe(true);
  });
});
