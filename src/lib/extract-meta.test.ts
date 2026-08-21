import { describe, expect, it } from "vitest";
import {
  extractMetaFromHtml,
  extractYoutubeCaptionTracks,
  isYoutubeTimedTextUrl,
  parseTimedTextList,
  parseTimedTextXml,
  pickCaptionTrack,
} from "./extract-meta";

describe("extractMetaFromHtml", () => {
  it("reads open graph tags", () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Nacken Yoga" />
        <meta property="og:description" content="5 Minuten am Schreibtisch" />
        <meta property="og:site_name" content="YouTube" />
      </head></html>
    `;
    expect(extractMetaFromHtml(html)).toEqual({
      title: "Nacken Yoga",
      description: "5 Minuten am Schreibtisch",
      author: "YouTube",
    });
  });

  it("falls back to the title tag", () => {
    const html = `<html><head><title>Instagram Reel</title></head></html>`;
    expect(extractMetaFromHtml(html).title).toBe("Instagram Reel");
  });

  it("leaves title empty when metadata is missing", () => {
    expect(extractMetaFromHtml("<html></html>")).toEqual({
      title: "",
      description: "",
    });
  });

  it("reads og:image and prefers the longer YouTube shortDescription", () => {
    const html = `
      <meta property="og:title" content="Morgenflow" />
      <meta property="og:description" content="Kurz." />
      <meta property="og:image" content="https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" />
      var ytInitialPlayerResponse = {"shortDescription":"1. Katze-Kuh\\n2. Kindeshaltung\\nLangsam atmen."};
    `;
    const meta = extractMetaFromHtml(html);
    expect(meta.thumbnailUrl).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(meta.description).toContain("Katze-Kuh");
    expect(meta.description).toContain("Kindeshaltung");
  });
});

describe("YouTube captions from the public page", () => {
  it("extracts captionTracks and prefers German over auto-English", () => {
    const html = `"captionTracks":[{"baseUrl":"https://www.youtube.com/api/timedtext?v=aaaaaaaaaaa\\u0026lang=en","languageCode":"en","kind":"asr"},{"baseUrl":"https://www.youtube.com/api/timedtext?v=aaaaaaaaaaa\\u0026lang=de","languageCode":"de","name":{"simpleText":"Deutsch"}}]`;
    const tracks = extractYoutubeCaptionTracks(html);
    expect(tracks).toHaveLength(2);
    expect(tracks[1].baseUrl).toContain("lang=de");
    const picked = pickCaptionTrack(tracks);
    expect(picked?.languageCode).toBe("de");
    expect(isYoutubeTimedTextUrl(picked?.baseUrl ?? "")).toBe(true);
  });

  it("parses timedtext XML into readable text", () => {
    const xml = `
      <?xml version="1.0" encoding="utf-8" ?>
      <transcript>
        <text start="0.5" dur="2">Schultern</text>
        <text start="2.5" dur="2">hoch und fallen lassen</text>
      </transcript>
    `;
    expect(parseTimedTextXml(xml)).toBe("Schultern hoch und fallen lassen");
  });

  it("parses the public timedtext list", () => {
    const xml = `
      <transcript_list>
        <track lang_code="en" name="English" lang_default="false" />
        <track lang_code="de" name="" lang_default="true" />
      </transcript_list>
    `;
    expect(parseTimedTextList(xml)).toEqual([
      { languageCode: "en", name: "English", isDefault: false },
      { languageCode: "de", name: "", isDefault: true },
    ]);
  });

  it("rejects non-YouTube caption URLs", () => {
    expect(isYoutubeTimedTextUrl("https://evil.example/timedtext")).toBe(false);
    expect(isYoutubeTimedTextUrl("https://www.youtube.com/watch?v=aaaaaaaaaaa")).toBe(false);
  });
});
