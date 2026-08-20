import { NextResponse } from "next/server";
import { extractMetaFromHtml } from "@/lib/extract-meta";
import { deriveExercisesFromMeta, detectProvider, isSupportedSourceUrl, type ImportMeta } from "@/lib/import-parse";

export async function POST(request: Request) {
  const body = (await request.json()) as { url?: string };
  const url = body.url?.trim() ?? "";
  if (!isSupportedSourceUrl(url)) {
    return NextResponse.json({ error: "Bitte eine gültige http(s)-Adresse einfügen." }, { status: 400 });
  }

  const provider = detectProvider(url);
  let title = "";
  let description = "";
  let author: string | undefined;

  try {
    if (provider === "youtube") {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const oembedResponse = await fetch(oembedUrl, { next: { revalidate: 0 } });
      if (oembedResponse.ok) {
        const oembed = (await oembedResponse.json()) as { title?: string; author_name?: string };
        title = oembed.title ?? "";
        author = oembed.author_name;
      }
    }

    const pageResponse = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "I-am-fit/0.1 (exercise import; +https://schlag.art)",
        Accept: "text/html",
      },
    });
    if (pageResponse.ok) {
      const html = await pageResponse.text();
      const extracted = extractMetaFromHtml(html.slice(0, 200_000), url);
      title = title || extracted.title;
      description = extracted.description;
      author = author || extracted.author;
    }
  } catch {
    // Fall back to URL-derived metadata below.
  }

  if (!title) {
    try {
      const parsed = new URL(url);
      title = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || parsed.hostname);
    } catch {
      title = "Importierte Übung";
    }
  }

  const meta: ImportMeta = {
    url,
    provider,
    title,
    description,
    author,
  };

  return NextResponse.json({
    meta,
    drafts: deriveExercisesFromMeta(meta),
  });
}
