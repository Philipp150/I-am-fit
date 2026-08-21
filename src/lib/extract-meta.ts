export function extractMetaFromHtml(html: string): { title: string; description: string; author?: string } {
  const ogTitle = matchMeta(html, "og:title") || matchTitle(html);
  const ogDescription = matchMeta(html, "og:description") || matchMeta(html, "description");
  const author = matchMeta(html, "og:site_name") || matchMeta(html, "author");
  return {
    title: decode(ogTitle || ""),
    description: decode(ogDescription || ""),
    author: author ? decode(author) : undefined,
  };
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}
