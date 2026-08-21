"use client";

import { useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import {
  instagramOpenUrl,
  isSafeHttpUrl,
  parseYoutubeVideoId,
  playbackKind,
  youtubeNocookieEmbedUrl,
  youtubeThumbnailUrl,
} from "@/lib/source-video";

type Props = {
  url?: string;
  thumbnailUrl?: string;
  className?: string;
};

export function SourceVideo({ url, thumbnailUrl, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  if (!url || !isSafeHttpUrl(url)) return null;

  const kind = playbackKind(url);
  const videoId = parseYoutubeVideoId(url);
  const poster =
    (thumbnailUrl && isSafeHttpUrl(thumbnailUrl) ? thumbnailUrl : undefined) ??
    (videoId ? youtubeThumbnailUrl(videoId) : undefined);

  return (
    <section className={`rounded-[1.4rem] border border-sand/80 bg-cream p-3 ${className}`}>
      <h3 className="font-display text-lg text-forest-dark">Originalvideo (zusätzlich)</h3>
      <p className="mt-1 text-xs leading-relaxed text-forest-light">
        Die Anleitung oben bleibt maßgeblich. Das Original kannst du dir extra ansehen – wir laden es erst nach einem Tipp.
      </p>

      {kind === "youtube" && videoId ? (
        <div className="relative mt-3 aspect-video w-full max-w-sm overflow-hidden rounded-2xl bg-forest-dark/10">
          {open ? (
            <iframe
              src={`${youtubeNocookieEmbedUrl(videoId)}?autoplay=1&rel=0`}
              title="Originalvideo"
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="relative flex h-full w-full items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
            >
              {poster ? (
                // Poster only; iframe stays unloaded until the tap (no YouTube cookies yet).
                // eslint-disable-next-line @next/next/no-img-element
                <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : null}
              <span className="relative z-[1] inline-flex items-center gap-2 rounded-full bg-forest px-4 py-2 text-sm text-cream shadow-soft">
                <Play className="h-4 w-4" aria-hidden />
                Video ansehen
              </span>
            </button>
          )}
        </div>
      ) : null}

      {kind === "instagram" ? (
        <div className="mt-3 space-y-2">
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt=""
              className="max-h-40 w-full rounded-2xl object-cover"
            />
          ) : null}
          <a
            href={instagramOpenUrl(url)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-forest/30 bg-white/70 px-4 py-2 text-sm text-forest-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            Auf Instagram öffnen
          </a>
          <p className="text-xs text-forest-light">
            Instagram lässt sich hier nicht zuverlässig einbetten. Der Link öffnet den Originalbeitrag.
          </p>
        </div>
      ) : null}

      {kind === "link" ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 rounded-full border border-forest/30 bg-white/70 px-4 py-2 text-sm text-forest-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          Im Browser öffnen
        </a>
      ) : null}
    </section>
  );
}
