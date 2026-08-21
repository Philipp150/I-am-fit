import { afterEach, describe, expect, it, vi } from "vitest";
import { isCloudEnabled, storageBackend } from "./env";

describe("repository storage switch", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses local Dexie when Supabase env is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(isCloudEnabled()).toBe(false);
    expect(storageBackend()).toBe("local");
  });

  it("uses the cloud backend when URL and anon key are set", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    expect(isCloudEnabled()).toBe(true);
    expect(storageBackend()).toBe("cloud");
  });

  it("stays local if only one of the two cloud vars is present", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(storageBackend()).toBe("local");
  });
});
