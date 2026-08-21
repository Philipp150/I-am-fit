import { CATALOG_EXERCISES, CATEGORIES, COMPLAINTS } from "./catalog";
import { POSES } from "./poses";

export const APP_SHELL_PATHS = [
  "/",
  "/catalog",
  "/plan",
  "/complaints",
  "/progress",
  "/catalog/new",
  "/catalog/import",
  "/auth",
] as const;

const VIDEO_HOST_SUFFIXES = [
  "youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
  "ytimg.com",
  "googlevideo.com",
  "instagram.com",
  "cdninstagram.com",
  "fbcdn.net",
] as const;

/** Low-end estimate for one minute of YouTube video; streams are not precached. */
export const YOUTUBE_MINUTE_BYTES_LOW = 8_000_000;

export function hostnameOf(url: string, base = "https://i-am-super-fit.vercel.app"): string {
  try {
    return new URL(url, base).hostname;
  } catch {
    return "";
  }
}

export function isVideoOrSocialHost(hostname: string): boolean {
  const host = hostname.replace(/^www\./, "").toLowerCase();
  if (!host) return false;
  return VIDEO_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

export function isNetworkOnlyMediaUrl(url: string, destination = ""): boolean {
  if (destination === "video" || destination === "media") return true;
  try {
    const parsed = new URL(url, "https://i-am-super-fit.vercel.app");
    if (parsed.protocol === "blob:" || parsed.protocol === "data:") return true;
    if (/\.(mp4|webm|m4v|mov|m3u8)(\?|$)/i.test(parsed.pathname)) return true;
    return isVideoOrSocialHost(parsed.hostname);
  } catch {
    return false;
  }
}

export function isCatalogExercisePath(pathname: string): boolean {
  if (!pathname.startsWith("/catalog/")) return false;
  const rest = pathname.slice("/catalog/".length);
  if (!rest || rest.includes("/")) return false;
  return rest !== "new" && rest !== "import";
}

export function isPracticePath(pathname: string): boolean {
  if (!pathname.startsWith("/practice/")) return false;
  const rest = pathname.slice("/practice/".length);
  return Boolean(rest) && !rest.includes("/");
}

export function catalogPrecachePaths(exerciseIds: string[] = CATALOG_EXERCISES.map((item) => item.id)): string[] {
  const pages = exerciseIds.flatMap((id) => [`/catalog/${id}`, `/practice/${id}`]);
  return [...APP_SHELL_PATHS, ...pages];
}

export function pickNavigationFallback(pathname: string, cached: string[]): string | undefined {
  if (cached.includes(pathname)) return pathname;
  if (isPracticePath(pathname)) {
    return cached.find((entry) => isPracticePath(entry));
  }
  if (isCatalogExercisePath(pathname)) {
    return cached.find((entry) => isCatalogExercisePath(entry));
  }
  if (cached.includes("/")) return "/";
  return undefined;
}

export function estimateOfflinePayloadBytes(): {
  catalogJsonBytes: number;
  poseJsonBytes: number;
  localGuideBytes: number;
} {
  const catalogJsonBytes = new TextEncoder().encode(
    JSON.stringify({
      exercises: CATALOG_EXERCISES,
      categories: CATEGORIES,
      complaints: COMPLAINTS,
    }),
  ).length;
  const poseJsonBytes = new TextEncoder().encode(JSON.stringify(POSES)).length;
  return {
    catalogJsonBytes,
    poseJsonBytes,
    localGuideBytes: catalogJsonBytes + poseJsonBytes,
  };
}

/** YouTube/Instagram streams are high volume; catalog JSON and poses are not. */
export function shouldPrecacheVideos(): boolean {
  return false;
}

export function pickCachedList<T>(
  cloudEnabled: boolean,
  remote: { data: T[]; status: "pending" | "ok" | "error" },
  local: T[],
): T[] {
  if (!cloudEnabled) return local;
  if (remote.status === "ok") return remote.data;
  return local.length > 0 ? local : remote.data;
}

export function pickCachedOne<T>(
  cloudEnabled: boolean,
  remote: { data: T | undefined; status: "pending" | "ok" | "error" },
  local: T | undefined,
): T | undefined {
  if (!cloudEnabled) return local;
  if (remote.status === "ok") return remote.data ?? local;
  return local ?? remote.data;
}
