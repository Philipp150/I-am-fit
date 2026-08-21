import { NextResponse } from "next/server";
import {
  extractMetaFromHtml,
  isYoutubeTimedTextUrl,
  parseTimedTextList,
  parseTimedTextXml,
  parseTimedTextCues,
  pickCaptionTrack,
  type CaptionTrack,
  type ExtractedMeta,
  type TimedCaptionCue,
} from "@/lib/extract-meta";
import {
  composeImportMeta,
  deriveExercisesFromMeta,
  detectProvider,
  hasUsableMeta,
  IMPORT_MESSAGES,
  validateSourceUrl,
  type OEmbedMeta,
} from "@/lib/import-parse";
import {
  parseYoutubeVideoId,
  youtubeTimedTextListUrl,
  youtubeTimedTextTrackUrl,
} from "@/lib/source-video";

const HTML_LIMIT = 1_200_000;
const CAPTION_LIMIT = 20_000;
const FETCH_MS = 8_000;

export async function POST(request: Request) {
  let body: { url?: string } = {};
  try {
    body = (await request.json()) as { url?: string };
  } catch {
    return NextResponse.json({ error: IMPORT_MESSAGES.invalid_url, code: "invalid_url" }, { status: 400 });
  }

  const url = body.url?.trim() ?? "";
  const invalid = validateSourceUrl(url);
  if (invalid) {
    return NextResponse.json({ error: invalid.message, code: invalid.code }, { status: 400 });
  }

  const provider = detectProvider(url);
  let oembed: OEmbedMeta | null = null;
  let page: ExtractedMeta | null = null;
  let fetchedSomething = false;

  try {
    if (provider === "youtube") {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const oembedResponse = await fetch(oembedUrl, { next: { revalidate: 0 }, signal: AbortSignal.timeout(FETCH_MS) });
      if (oembedResponse.ok) {
        oembed = (await oembedResponse.json()) as OEmbedMeta;
        fetchedSomething = Boolean(oembed.title);
      }
    }

    const pageResponse = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "I-am-fit/0.1 (exercise import; +https://schlag.art)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(FETCH_MS),
    });
    if (pageResponse.ok) {
      fetchedSomething = true;
      const html = (await pageResponse.text()).slice(0, HTML_LIMIT);
      page = extractMetaFromHtml(html);
    }
  } catch {
    // Handled below if nothing usable arrived.
  }

  const videoId = provider === "youtube" ? parseYoutubeVideoId(url) : null;
  const captionResult = videoId
    ? await readYoutubeCaptions(videoId, page?.captionTracks ?? [])
    : { text: "", cues: [] as TimedCaptionCue[] };

  if (!fetchedSomething && !oembed?.title && !page?.title && !page?.description && !captionResult.text) {
    return NextResponse.json({ error: IMPORT_MESSAGES.fetch_failed, code: "fetch_failed" }, { status: 422 });
  }

  const meta = composeImportMeta({
    url,
    provider,
    oembed,
    page,
    captions: captionResult.text,
    captionCues: captionResult.cues,
  });

  if (!hasUsableMeta(meta)) {
    return NextResponse.json({ error: IMPORT_MESSAGES.missing_meta, code: "missing_meta" }, { status: 422 });
  }

  return NextResponse.json({
    meta: {
      ...meta,
      usedCaptions: Boolean(meta.captions),
    },
    drafts: deriveExercisesFromMeta(meta),
  });
}

function captionsFromXml(xml: string | null): { text: string; cues: TimedCaptionCue[] } {
  if (!xml) return { text: "", cues: [] };
  const cues = parseTimedTextCues(xml).slice(0, 400);
  const text = parseTimedTextXml(xml).slice(0, CAPTION_LIMIT);
  return { text, cues };
}

async function readYoutubeCaptions(
  videoId: string,
  tracks: CaptionTrack[],
): Promise<{ text: string; cues: TimedCaptionCue[] }> {
  const empty = { text: "", cues: [] as TimedCaptionCue[] };
  try {
    const fromPage = pickCaptionTrack(tracks);
    if (fromPage && isYoutubeTimedTextUrl(fromPage.baseUrl)) {
      const xml = await fetchText(fromPage.baseUrl);
      const parsed = captionsFromXml(xml);
      if (parsed.text) return parsed;
    }

    const listXml = await fetchText(youtubeTimedTextListUrl(videoId));
    if (!listXml) return empty;
    const listed = parseTimedTextList(listXml);
    const preferred =
      listed.find((track) => track.languageCode.toLowerCase().startsWith("de")) ??
      listed.find((track) => track.isDefault) ??
      listed.find((track) => track.languageCode.toLowerCase().startsWith("en")) ??
      listed[0];
    if (!preferred) return empty;
    const trackUrl = youtubeTimedTextTrackUrl(videoId, preferred.languageCode, preferred.name || undefined);
    if (!isYoutubeTimedTextUrl(trackUrl)) return empty;
    const xml = await fetchText(trackUrl);
    return captionsFromXml(xml);
  } catch {
    return empty;
  }
}

async function fetchText(resource: string): Promise<string | null> {
  try {
    const response = await fetch(resource, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_MS),
      headers: { Accept: "text/xml, application/xml, text/plain;q=0.9, */*;q=0.1" },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}
