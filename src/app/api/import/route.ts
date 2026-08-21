import { NextResponse } from "next/server";
import { extractMetaFromHtml } from "@/lib/extract-meta";
import {
  deriveExercisesFromMeta,
  detectProvider,
  hasUsableMeta,
  IMPORT_MESSAGES,
  validateSourceUrl,
  type ImportMeta,
} from "@/lib/import-parse";

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
  let title = "";
  let description = "";
  let author: string | undefined;
  let fetchedSomething = false;

  try {
    if (provider === "youtube") {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const oembedResponse = await fetch(oembedUrl, { next: { revalidate: 0 } });
      if (oembedResponse.ok) {
        const oembed = (await oembedResponse.json()) as { title?: string; author_name?: string };
        title = oembed.title ?? "";
        author = oembed.author_name;
        fetchedSomething = Boolean(title);
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
      fetchedSomething = true;
      const html = await pageResponse.text();
      const extracted = extractMetaFromHtml(html.slice(0, 200_000));
      title = title || extracted.title;
      description = extracted.description;
      author = author || extracted.author;
    }
  } catch {
    // Handled below if nothing usable arrived.
  }

  if (!fetchedSomething && !title && !description) {
    return NextResponse.json({ error: IMPORT_MESSAGES.fetch_failed, code: "fetch_failed" }, { status: 422 });
  }

  const meta: ImportMeta = {
    url,
    provider,
    title: title.trim(),
    description: description.trim(),
    author,
  };

  if (!hasUsableMeta(meta)) {
    return NextResponse.json({ error: IMPORT_MESSAGES.missing_meta, code: "missing_meta" }, { status: 422 });
  }

  return NextResponse.json({
    meta,
    drafts: deriveExercisesFromMeta(meta),
  });
}
