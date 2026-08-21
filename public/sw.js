const CACHE = "iamfit-shell-v3";
const PRECACHE = [
  "/",
  "/catalog",
  "/plan",
  "/complaints",
  "/progress",
  "/catalog/new",
  "/catalog/import",
  "/auth",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest",
];

const VIDEO_HOST_SUFFIXES = [
  "youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
  "ytimg.com",
  "googlevideo.com",
  "instagram.com",
  "cdninstagram.com",
  "fbcdn.net",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => precacheUrls(cache, PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (shouldBypassCache(url, request)) return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(networkFirstNavigate(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "precache" && Array.isArray(data.urls)) {
    event.waitUntil(caches.open(CACHE).then((cache) => precacheUrls(cache, data.urls)));
    return;
  }
  if (data.type !== "notify") return;
  event.waitUntil(
    self.registration.showNotification(data.title || "I am fit", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(target);
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    }),
  );
});

function isVideoOrSocialHost(hostname) {
  const host = hostname.replace(/^www\./, "").toLowerCase();
  return VIDEO_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith("." + suffix));
}

function shouldBypassCache(url, request) {
  const destination = request.destination || "";
  if (destination === "video" || destination === "media") return true;
  if (url.protocol === "blob:" || url.protocol === "data:") return true;
  if (/\.(mp4|webm|m4v|mov|m3u8|wasm|task)(\?|$)/i.test(url.pathname)) return true;
  if (isVideoOrSocialHost(url.hostname)) return true;
  const range = request.headers && request.headers.get("range");
  if (range) return true;
  return false;
}

function isCatalogExercisePath(pathname) {
  if (!pathname.startsWith("/catalog/")) return false;
  const rest = pathname.slice("/catalog/".length);
  if (!rest || rest.includes("/")) return false;
  return rest !== "new" && rest !== "import";
}

function isPracticePath(pathname) {
  if (!pathname.startsWith("/practice/")) return false;
  const rest = pathname.slice("/practice/".length);
  return Boolean(rest) && !rest.includes("/");
}

async function precacheUrls(cache, urls) {
  for (const entry of urls) {
    try {
      const url = new URL(entry, self.location.origin);
      if (url.origin !== self.location.origin) continue;
      if (shouldBypassCache(url, { destination: "", headers: { get: () => null } })) continue;
      const response = await fetch(url.href, { credentials: "same-origin" });
      if (response.ok) await cache.put(url.pathname + url.search, response.clone());
      if (response.ok) await cache.put(url.href, response);
    } catch {
      // One missing page must not abort the rest of the catalog.
    }
  }
}

async function networkFirstNavigate(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const fallback = await navigationFallback(cache, request);
    if (fallback) return fallback;
    return Response.error();
  }
}

async function navigationFallback(cache, request) {
  const exact = await cache.match(request);
  if (exact) return exact;
  const url = new URL(request.url);
  const cached = await cache.keys();
  const paths = cached.map((entry) => new URL(entry.url).pathname);
  let candidate;
  if (isPracticePath(url.pathname)) {
    candidate = paths.find((path) => isPracticePath(path));
  } else if (isCatalogExercisePath(url.pathname)) {
    candidate = paths.find((path) => isCatalogExercisePath(path));
  }
  if (candidate) {
    const match = await cache.match(candidate);
    if (match) return match;
  }
  const home = await cache.match("/");
  if (home) return home;
  return null;
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return Response.error();
  }
}
