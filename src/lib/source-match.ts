import { parseInstagramShortcode, parseYoutubeVideoId } from "./source-video";
import type { Exercise } from "./types";

const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "igsh",
  "igshid",
  "si",
  "feature",
  "pp",
  "t",
];

/** Canonical form so youtu.be and watch?v= count as the same link. */
export function normalizeSourceUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const youtubeId = parseYoutubeVideoId(trimmed);
  if (youtubeId) return `https://www.youtube.com/watch?v=${youtubeId}`;

  const instagram = parseInstagramShortcode(trimmed);
  if (instagram) {
    let kind = "reel";
    try {
      const parsed = new URL(trimmed);
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts[0] === "p" || parts[0] === "tv") kind = parts[0];
      else kind = "reel";
    } catch {
      kind = "reel";
    }
    return `https://www.instagram.com/${kind}/${instagram}`;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    parsed.hash = "";
    parsed.username = "";
    parsed.password = "";
    parsed.hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    parsed.protocol = "https:";
    for (const key of TRACKING_PARAMS) parsed.searchParams.delete(key);
    let path = parsed.pathname;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    parsed.pathname = path;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function sourceUrlsMatch(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const left = normalizeSourceUrl(a);
  const right = normalizeSourceUrl(b);
  return Boolean(left && right && left === right);
}

export function findExercisesBySourceUrl(exercises: Exercise[], url: string): Exercise[] {
  const key = normalizeSourceUrl(url);
  if (!key) return [];
  const matches = exercises.filter((exercise) => sourceUrlsMatch(exercise.source.url, key));
  const owned = matches.filter((exercise) => !exercise.isSystem);
  return owned.length > 0 ? owned : matches;
}

export function hasDuplicateSourceUrl(exercises: Exercise[], url: string): boolean {
  return findExercisesBySourceUrl(exercises, url).length > 0;
}
