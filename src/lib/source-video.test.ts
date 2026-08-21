import { describe, expect, it } from "vitest";
import {
  instagramOpenUrl,
  parseInstagramShortcode,
  parseYoutubeVideoId,
  playbackKind,
  youtubeNocookieEmbedUrl,
  youtubeThumbnailUrl,
  youtubeTimedTextListUrl,
  youtubeTimedTextTrackUrl,
} from "./source-video";

describe("YouTube URL → embed id", () => {
  it("parses watch?v= including extra query params", () => {
    expect(parseYoutubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYoutubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s&feature=share")).toBe(
      "dQw4w9WgXcQ",
    );
    expect(parseYoutubeVideoId("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("parses youtu.be short links", () => {
    expect(parseYoutubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYoutubeVideoId("https://youtu.be/dQw4w9WgXcQ?si=abc")).toBe("dQw4w9WgXcQ");
  });

  it("parses embed, shorts and live paths", () => {
    expect(parseYoutubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYoutubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYoutubeVideoId("https://www.youtube.com/live/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYoutubeVideoId("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("builds the official nocookie embed URL from the id", () => {
    expect(youtubeNocookieEmbedUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    expect(youtubeThumbnailUrl("dQw4w9WgXcQ")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });

  it("rejects non-YouTube and incomplete ids", () => {
    expect(parseYoutubeVideoId("https://www.instagram.com/reel/abc")).toBeNull();
    expect(parseYoutubeVideoId("https://youtu.be/abc")).toBeNull();
    expect(parseYoutubeVideoId("not-a-url")).toBeNull();
  });
});

describe("Instagram and generic links", () => {
  it("parses public post and reel shortcodes", () => {
    expect(parseInstagramShortcode("https://www.instagram.com/p/AbC_123/")).toBe("AbC_123");
    expect(parseInstagramShortcode("https://www.instagram.com/reel/AbC_123/?igsh=xyz")).toBe("AbC_123");
    expect(parseInstagramShortcode("https://instagram.com/reels/AbC_123")).toBe("AbC_123");
    expect(parseInstagramShortcode("https://www.instagram.com/someone/")).toBeNull();
  });

  it("classifies playback without forcing a player on generic web links", () => {
    expect(playbackKind("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("youtube");
    expect(playbackKind("https://www.instagram.com/reel/AbC_123/")).toBe("instagram");
    expect(playbackKind("https://example.com/workout")).toBe("link");
    expect(instagramOpenUrl("http://instagram.com/reel/AbC_123/")).toMatch(/^https:\/\//);
  });

  it("builds public timedtext URLs without API keys", () => {
    expect(youtubeTimedTextListUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/api/timedtext?type=list&v=dQw4w9WgXcQ",
    );
    expect(youtubeTimedTextTrackUrl("dQw4w9WgXcQ", "de")).toBe(
      "https://www.youtube.com/api/timedtext?v=dQw4w9WgXcQ&lang=de",
    );
    expect(youtubeTimedTextTrackUrl("dQw4w9WgXcQ", "en", "English")).toContain("name=English");
  });
});
