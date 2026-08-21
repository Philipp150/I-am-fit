import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOG_EXERCISES } from "./catalog";
import {
  catalogPrecachePaths,
  estimateOfflinePayloadBytes,
  isCatalogExercisePath,
  isNetworkOnlyMediaUrl,
  isPracticePath,
  isVideoOrSocialHost,
  pickCachedList,
  pickCachedOne,
  pickNavigationFallback,
  shouldPrecacheVideos,
  YOUTUBE_MINUTE_BYTES_LOW,
} from "./offline";

describe("offline media policy", () => {
  it("treats YouTube, nocookie, thumbnails and googlevideo as network-only", () => {
    expect(isVideoOrSocialHost("www.youtube.com")).toBe(true);
    expect(isVideoOrSocialHost("youtube-nocookie.com")).toBe(true);
    expect(isNetworkOnlyMediaUrl("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe(true);
    expect(isNetworkOnlyMediaUrl("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg")).toBe(true);
    expect(isNetworkOnlyMediaUrl("https://rr1---sn-abc.googlevideo.com/videoplayback")).toBe(true);
    expect(isNetworkOnlyMediaUrl("blob:https://i-am-super-fit.vercel.app/1")).toBe(true);
    expect(isNetworkOnlyMediaUrl("https://cdn.example.com/clip.mp4")).toBe(true);
    expect(isNetworkOnlyMediaUrl("https://i-am-super-fit.vercel.app/practice/ex-neck-circles", "video")).toBe(true);
  });

  it("leaves app origin catalog and pose routes cacheable", () => {
    expect(isNetworkOnlyMediaUrl("https://i-am-super-fit.vercel.app/catalog")).toBe(false);
    expect(isNetworkOnlyMediaUrl("https://i-am-super-fit.vercel.app/practice/ex-neck-circles")).toBe(false);
    expect(isNetworkOnlyMediaUrl("https://i-am-super-fit.vercel.app/_next/static/chunks/app.js")).toBe(false);
    expect(isVideoOrSocialHost("i-am-super-fit.vercel.app")).toBe(false);
  });

  it("keeps Instagram outbound on the network-only list", () => {
    expect(isNetworkOnlyMediaUrl("https://www.instagram.com/reel/AbC_123/")).toBe(true);
    expect(isNetworkOnlyMediaUrl("https://scontent.cdninstagram.com/v/t51.jpg")).toBe(true);
  });
});

describe("offline navigation fallback", () => {
  it("reuses any cached practice page for another exercise id", () => {
    expect(isPracticePath("/practice/ex-neck-circles")).toBe(true);
    expect(isCatalogExercisePath("/catalog/ex-box-breath")).toBe(true);
    expect(isCatalogExercisePath("/catalog/new")).toBe(false);
    expect(isCatalogExercisePath("/catalog/import")).toBe(false);
    expect(
      pickNavigationFallback("/practice/ex-walk-attention", ["/", "/practice/ex-neck-circles"]),
    ).toBe("/practice/ex-neck-circles");
    expect(pickNavigationFallback("/catalog/ex-box-breath", ["/", "/catalog/ex-neck-circles"])).toBe(
      "/catalog/ex-neck-circles",
    );
    expect(pickNavigationFallback("/catalog/new", ["/", "/catalog/new"])).toBe("/catalog/new");
    expect(pickNavigationFallback("/progress", ["/", "/catalog"])).toBe("/");
  });
});

describe("catalog precache and size", () => {
  it("lists shell routes plus every catalog practice and detail path", () => {
    const paths = catalogPrecachePaths();
    expect(paths).toEqual(expect.arrayContaining(["/", "/catalog", "/plan", "/complaints", "/progress"]));
    expect(paths).toContain("/catalog/new");
    for (const exercise of CATALOG_EXERCISES) {
      expect(paths).toContain(`/catalog/${exercise.id}`);
      expect(paths).toContain(`/practice/${exercise.id}`);
    }
    expect(paths.length).toBeGreaterThan(CATALOG_EXERCISES.length * 2);
  });

  it("keeps catalog JSON and pose data far below a YouTube minute so videos stay online-only", () => {
    const size = estimateOfflinePayloadBytes();
    expect(size.catalogJsonBytes).toBeGreaterThan(5_000);
    expect(size.catalogJsonBytes).toBeLessThan(200_000);
    expect(size.poseJsonBytes).toBeGreaterThan(1_000);
    expect(size.poseJsonBytes).toBeLessThan(200_000);
    expect(size.localGuideBytes).toBeLessThan(YOUTUBE_MINUTE_BYTES_LOW / 10);
    expect(shouldPrecacheVideos()).toBe(false);
  });

  it("falls back to Dexie catalog when the cloud query has not loaded", () => {
    const local = [{ id: "ex-neck-circles" }];
    expect(pickCachedList(true, { data: [], status: "pending" }, local)).toEqual(local);
    expect(pickCachedList(true, { data: [], status: "error" }, local)).toEqual(local);
    expect(pickCachedList(true, { data: [{ id: "from-cloud" }], status: "ok" }, local)).toEqual([{ id: "from-cloud" }]);
    expect(pickCachedOne(true, { data: undefined, status: "error" }, { id: "ex-box-breath" })).toEqual({
      id: "ex-box-breath",
    });
  });
});

describe("service worker source", () => {
  it("does not cache YouTube or Instagram and precaches catalog shells", () => {
    const sw = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
    expect(sw).toContain("iamfit-shell-v2");
    expect(sw).toContain("youtube-nocookie");
    expect(sw).toContain("googlevideo");
    expect(sw).toContain("instagram");
    expect(sw).toContain("precache");
    expect(sw).toContain("/catalog");
    expect(sw).not.toContain("cache.addAll(PRECACHE)");
  });
});
