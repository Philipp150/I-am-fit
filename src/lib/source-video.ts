export type PlaybackKind = "youtube" | "instagram" | "link";

const YOUTUBE_ID = /^[a-zA-Z0-9_-]{11}$/;

export function parseYoutubeVideoId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    const id = parsed.pathname.split("/").filter(Boolean)[0];
    return id && YOUTUBE_ID.test(id) ? id : null;
  }

  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com" ||
    host === "youtube-nocookie.com"
  ) {
    const fromQuery = parsed.searchParams.get("v");
    if (fromQuery && YOUTUBE_ID.test(fromQuery)) return fromQuery;

    const parts = parsed.pathname.split("/").filter(Boolean);
    const nested = parts[0] && ["embed", "shorts", "live", "v"].includes(parts[0]) ? parts[1] : undefined;
    if (nested && YOUTUBE_ID.test(nested)) return nested;
  }

  return null;
}

export function youtubeNocookieEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`;
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}

export function youtubeTimedTextListUrl(videoId: string): string {
  const url = new URL("https://www.youtube.com/api/timedtext");
  url.searchParams.set("type", "list");
  url.searchParams.set("v", videoId);
  return url.toString();
}

export function youtubeTimedTextTrackUrl(videoId: string, lang: string, name?: string): string {
  const url = new URL("https://www.youtube.com/api/timedtext");
  url.searchParams.set("v", videoId);
  url.searchParams.set("lang", lang);
  if (name) url.searchParams.set("name", name);
  return url.toString();
}

export function parseInstagramShortcode(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "instagram.com") return null;
  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  if (!["p", "reel", "reels", "tv"].includes(parts[0])) return null;
  const code = parts[1];
  return /^[A-Za-z0-9_-]+$/.test(code) ? code : null;
}

export function instagramOpenUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.protocol = "https:";
    return parsed.toString();
  } catch {
    return url;
  }
}

export function playbackKind(url: string): PlaybackKind {
  if (parseYoutubeVideoId(url)) return "youtube";
  if (parseInstagramShortcode(url)) return "instagram";
  return "link";
}

export function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
