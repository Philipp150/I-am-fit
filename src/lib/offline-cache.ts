import { catalogPrecachePaths } from "./offline";

export type OfflineNavClick = {
  online: boolean;
  defaultPrevented: boolean;
  button: number;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  targetAttr?: string | null;
  download?: boolean;
  href: string | null;
  pageOrigin: string;
  pageHref: string;
};

export function offlineDocumentNavUrl(click: OfflineNavClick): string | null {
  if (click.online) return null;
  if (click.defaultPrevented || click.button !== 0) return null;
  if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return null;
  if (click.targetAttr === "_blank" || click.download) return null;
  const href = click.href?.trim() ?? "";
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return null;
  try {
    const url = new URL(href, click.pageHref);
    if (url.origin !== click.pageOrigin) return null;
    return url.href;
  } catch {
    return null;
  }
}

export async function requestCatalogPrecache(paths: string[] = catalogPrecachePaths()): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready.catch(() => undefined);
  const worker = registration?.active;
  if (!worker) return;
  worker.postMessage({ type: "precache", urls: paths });
}

export function listenOfflineDocumentNav(target: Document = document): () => void {
  function onClick(event: MouseEvent) {
    const node = event.target;
    const anchor = node instanceof Element ? node.closest("a") : null;
    const next = offlineDocumentNavUrl({
      online: typeof navigator === "undefined" ? true : navigator.onLine,
      defaultPrevented: event.defaultPrevented,
      button: event.button,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      targetAttr: anchor?.getAttribute("target"),
      download: Boolean(anchor?.hasAttribute("download")),
      href: anchor?.href ?? null,
      pageOrigin: window.location.origin,
      pageHref: window.location.href,
    });
    if (!next) return;
    event.preventDefault();
    window.location.assign(next);
  }

  target.addEventListener("click", onClick, true);
  return () => target.removeEventListener("click", onClick, true);
}

export function scheduleCatalogPrecache(): () => void {
  if (typeof window === "undefined") return () => undefined;
  const run = () => {
    void requestCatalogPrecache();
  };
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
    .requestIdleCallback;
  if (typeof idle === "function") {
    const id = idle(run, { timeout: 4000 });
    const cancel = (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
    return () => cancel?.(id);
  }
  const timeout = window.setTimeout(run, 1200);
  return () => window.clearTimeout(timeout);
}
