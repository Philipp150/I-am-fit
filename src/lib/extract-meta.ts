export type CaptionTrack = {
  baseUrl: string;
  languageCode: string;
  kind?: string;
  name?: string;
};

export type ExtractedMeta = {
  title: string;
  description: string;
  author?: string;
  thumbnailUrl?: string;
  captionTracks?: CaptionTrack[];
};

export function extractMetaFromHtml(html: string): ExtractedMeta {
  const ogTitle = matchMeta(html, "og:title") || matchTitle(html);
  const ogDescription = matchMeta(html, "og:description") || matchMeta(html, "description");
  const author = matchMeta(html, "og:site_name") || matchMeta(html, "author");
  const ogImage = matchMeta(html, "og:image") || matchMeta(html, "twitter:image");
  const youtubeDescription = extractYoutubeShortDescription(html);
  const description = pickLonger(decode(ogDescription || ""), youtubeDescription);
  const captionTracks = extractYoutubeCaptionTracks(html);

  const result: ExtractedMeta = {
    title: decode(ogTitle || ""),
    description,
  };
  if (author) result.author = decode(author);
  if (ogImage) result.thumbnailUrl = decode(ogImage);
  if (captionTracks.length > 0) result.captionTracks = captionTracks;
  return result;
}

export function extractYoutubeShortDescription(html: string): string {
  const match = html.match(/"shortDescription":"((?:\\.|[^"\\])*)"/);
  if (!match) return "";
  return unescapeJsonString(match[1]).trim();
}

export function extractYoutubeCaptionTracks(html: string): CaptionTrack[] {
  const parsed = extractJsonArrayAfter(html, "captionTracks");
  if (!Array.isArray(parsed)) return [];
  const tracks: CaptionTrack[] = [];
  for (const entry of parsed) {
    const track = captionTrackFromUnknown(entry);
    if (track) tracks.push(track);
  }
  return tracks;
}

function captionTrackFromUnknown(entry: unknown): CaptionTrack | null {
  if (!entry || typeof entry !== "object") return null;
  const record = entry as Record<string, unknown>;
  const baseUrl = typeof record.baseUrl === "string" ? record.baseUrl : "";
  const languageCode = typeof record.languageCode === "string" ? record.languageCode : "";
  if (!baseUrl || !languageCode) return null;
  const kind = typeof record.kind === "string" ? record.kind : undefined;
  const name =
    record.name && typeof record.name === "object" && record.name !== null
      ? typeof (record.name as { simpleText?: unknown }).simpleText === "string"
        ? (record.name as { simpleText: string }).simpleText
        : undefined
      : typeof record.name === "string"
        ? record.name
        : undefined;
  return { baseUrl, languageCode, kind, name };
}

export function pickCaptionTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (tracks.length === 0) return null;
  const scored = [...tracks].sort((a, b) => captionScore(b) - captionScore(a));
  return scored[0] ?? null;
}

export function parseTimedTextXml(xml: string): string {
  const parts = [...xml.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gi)].map((match) =>
    decode(stripTags(match[1])).replace(/\s+/g, " ").trim(),
  );
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export type TimedTextListTrack = {
  languageCode: string;
  name: string;
  isDefault: boolean;
};

export function parseTimedTextList(xml: string): TimedTextListTrack[] {
  return [...xml.matchAll(/<track\b([^>]*)\/?>/gi)]
    .map((match) => {
      const attrs = match[1];
      const languageCode = attr(attrs, "lang_code") ?? "";
      const name = attr(attrs, "name") ?? "";
      const isDefault = /lang_default=["']true["']/i.test(attrs);
      return { languageCode, name, isDefault };
    })
    .filter((track) => track.languageCode);
}

export function isYoutubeTimedTextUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    return (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      host === "youtube.com" &&
      parsed.pathname.includes("timedtext")
    );
  } catch {
    return false;
  }
}

function captionScore(track: CaptionTrack): number {
  const lang = track.languageCode.toLowerCase();
  let score = 0;
  if (lang === "de" || lang.startsWith("de-")) score += 30;
  else if (lang === "en" || lang.startsWith("en-")) score += 20;
  if (track.kind !== "asr") score += 10;
  return score;
}

function pickLonger(a: string, b: string): string {
  return b.length > a.length ? b : a;
}

function extractJsonArrayAfter(html: string, key: string): unknown[] | null {
  const needle = `"${key}":`;
  const start = html.indexOf(needle);
  if (start < 0) return null;
  const bracket = html.indexOf("[", start + needle.length);
  if (bracket < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  const limit = Math.min(html.length, bracket + 80_000);
  for (let i = bracket; i < limit; i++) {
    const ch = html[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "[") depth += 1;
    else if (ch === "]") {
      depth -= 1;
      if (depth === 0) {
        try {
          const value = JSON.parse(html.slice(bracket, i + 1)) as unknown;
          return Array.isArray(value) ? value : null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function unescapeJsonString(value: string): string {
  return value
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function matchMeta(html: string, name: string): string | null {
  const property = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escapeRegExp(name)}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i",
  );
  const contentFirst = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapeRegExp(name)}["'][^>]*>`,
    "i",
  );
  return html.match(property)?.[1] ?? html.match(contentFirst)?.[1] ?? null;
}

function matchTitle(html: string): string | null {
  return html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? null;
}

function attr(source: string, name: string): string | null {
  return source.match(new RegExp(`${escapeRegExp(name)}=["']([^"']*)["']`, "i"))?.[1] ?? null;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decode(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .trim();
}
