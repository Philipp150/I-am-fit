import { describe, expect, it } from "vitest";
import { pixelAvailabilityForUrl, pixelNotice, POSE_COPY } from "./pose-source";

describe("pixel sources for pose analysis", () => {
  it("does not treat YouTube or Instagram embeds as analyzable pixels", () => {
    expect(pixelAvailabilityForUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      kind: "upload-required",
      reason: "youtube",
    });
    expect(pixelAvailabilityForUrl("https://youtu.be/dQw4w9WgXcQ")).toEqual({
      kind: "upload-required",
      reason: "youtube",
    });
    expect(pixelAvailabilityForUrl("https://www.instagram.com/reel/AbC_123xyz/")).toEqual({
      kind: "upload-required",
      reason: "instagram",
    });
    expect(pixelNotice(pixelAvailabilityForUrl("https://youtu.be/dQw4w9WgXcQ"))).toBe(POSE_COPY.youtube);
    expect(pixelNotice(pixelAvailabilityForUrl("https://youtu.be/dQw4w9WgXcQ"))).toContain("nicht analysiert");
  });

  it("accepts a public file URL and otherwise asks for an upload", () => {
    expect(pixelAvailabilityForUrl("https://cdn.example.com/flow.mp4")).toEqual({
      kind: "public-file",
      url: "https://cdn.example.com/flow.mp4",
    });
    expect(pixelAvailabilityForUrl(undefined).kind).toBe("upload-required");
    expect(pixelAvailabilityForUrl("https://example.com/page").kind).toBe("upload-required");
  });
});
