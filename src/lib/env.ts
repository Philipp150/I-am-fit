export function supabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export function supabaseAnonKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
}

export type StorageBackend = "local" | "cloud";

export function isCloudEnabled(): boolean {
  return Boolean(supabaseUrl() && supabaseAnonKey());
}

export function storageBackend(): StorageBackend {
  return isCloudEnabled() ? "cloud" : "local";
}

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
}
