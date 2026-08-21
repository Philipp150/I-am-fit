import { afterEach, describe, expect, it, vi } from "vitest";
import { offlineDocumentNavUrl, requestCatalogPrecache } from "./offline-cache";

describe("catalog precache message", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts catalog urls to the active service worker", async () => {
    const postMessage = vi.fn();
    vi.stubGlobal("navigator", {
      serviceWorker: {
        ready: Promise.resolve({ active: { postMessage } }),
      },
    });
    vi.stubGlobal("window", {});
    await requestCatalogPrecache(["/", "/practice/ex-neck-circles"]);
    expect(postMessage).toHaveBeenCalledWith({
      type: "precache",
      urls: ["/", "/practice/ex-neck-circles"],
    });
  });
});

describe("offline document navigation", () => {
  const page = {
    pageOrigin: "https://i-am-super-fit.vercel.app",
    pageHref: "https://i-am-super-fit.vercel.app/catalog",
  };

  it("rewrites same-origin clicks to a full load when offline", () => {
    expect(
      offlineDocumentNavUrl({
        online: false,
        defaultPrevented: false,
        button: 0,
        href: "/practice/ex-neck-circles",
        ...page,
      }),
    ).toBe("https://i-am-super-fit.vercel.app/practice/ex-neck-circles");
  });

  it("leaves client routing alone while online or for outbound video hosts", () => {
    expect(
      offlineDocumentNavUrl({
        online: true,
        defaultPrevented: false,
        button: 0,
        href: "/practice/ex-neck-circles",
        ...page,
      }),
    ).toBeNull();
    expect(
      offlineDocumentNavUrl({
        online: false,
        defaultPrevented: false,
        button: 0,
        href: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
        ...page,
      }),
    ).toBeNull();
  });
});
