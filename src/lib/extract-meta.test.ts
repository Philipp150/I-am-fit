import { describe, expect, it } from "vitest";
import { extractMetaFromHtml } from "./extract-meta";

describe("extractMetaFromHtml", () => {
  it("reads open graph tags", () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Nacken Yoga" />
        <meta property="og:description" content="5 Minuten am Schreibtisch" />
        <meta property="og:site_name" content="YouTube" />
      </head></html>
    `;
    expect(extractMetaFromHtml(html, "https://youtu.be/x")).toEqual({
      title: "Nacken Yoga",
      description: "5 Minuten am Schreibtisch",
      author: "YouTube",
    });
  });

  it("falls back to the title tag", () => {
    const html = `<html><head><title>Instagram Reel</title></head></html>`;
    expect(extractMetaFromHtml(html, "https://instagram.com/reel/1").title).toBe("Instagram Reel");
  });
});
