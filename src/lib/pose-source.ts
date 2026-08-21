import { parseInstagramShortcode, parseYoutubeVideoId } from "./source-video";

export const POSE_COPY = {
  progress: "Bewegung wird erkannt …",
  noPerson: "Keine Person im Video gefunden. Nimm einen Clip, in dem der Körper gut zu sehen ist.",
  loadFailed: "Die Bewegungserkennung konnte nicht geladen werden. Prüfe die Verbindung und versuche es erneut.",
  youtube:
    "YouTube liefert in der App keine Pixel – die Einbettung wird nicht analysiert. Metadaten und Schritte bleiben. Lade die Datei oder einen kurzen Clip hoch, damit die Figur der Bewegung folgt.",
  instagram:
    "Instagram liefert in der App keine Pixel. Lade die Datei oder einen kurzen Clip hoch, damit die Figur der Bewegung folgt.",
  noFile:
    "Ohne Videodatei kann die Bewegung nicht erkannt werden. Du kannst die Figur über Schritte steuern oder eine Datei hochladen.",
  uploadLabel: "Videodatei hochladen",
  replace: "Neu erkennen (ersetzt die Spur)",
  remove: "Bewegungsspur entfernen",
  analyzeFileLink: "Öffentliche Videodatei erkennen",
  tooShort: "Das Video ist zu kurz zum Erkennen.",
  truncated: "Die ersten 90 Sekunden wurden erkannt.",
  tainted:
    "Diese Videodatei ließ sich nicht auslesen (oft wegen CORS). Lade die Datei stattdessen direkt hoch.",
  hasTrack: (durationSec: number, fps: number) =>
    `Bewegungsspur vorhanden (${formatTrackSeconds(durationSec)}, ${Math.round(fps)} Bilder/s). Die Figur spielt sie ab; Schritte bleiben bearbeitbar.`,
} as const;

export type PixelReason = "youtube" | "instagram" | "no-file";

export type PixelAvailability =
  | { kind: "upload-required"; reason: PixelReason }
  | { kind: "public-file"; url: string };

const DIRECT_VIDEO = /\.(mp4|webm|m4v|mov)(\?|$)/i;

export function formatTrackSeconds(durationSec: number): string {
  const sec = Math.max(0, Math.round(durationSec));
  if (sec < 60) return `${sec} s`;
  const minutes = Math.floor(sec / 60);
  const rest = sec % 60;
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
}

export function isDirectVideoFileUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    return DIRECT_VIDEO.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function pixelAvailabilityForUrl(url: string | undefined | null): PixelAvailability {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return { kind: "upload-required", reason: "no-file" };
  if (parseYoutubeVideoId(trimmed)) return { kind: "upload-required", reason: "youtube" };
  if (parseInstagramShortcode(trimmed)) return { kind: "upload-required", reason: "instagram" };
  if (isDirectVideoFileUrl(trimmed)) return { kind: "public-file", url: trimmed };
  return { kind: "upload-required", reason: "no-file" };
}

export function pixelNotice(availability: PixelAvailability): string {
  if (availability.kind === "public-file") return "";
  if (availability.reason === "youtube") return POSE_COPY.youtube;
  if (availability.reason === "instagram") return POSE_COPY.instagram;
  return POSE_COPY.noFile;
}

export function acceptVideoFile(file: File | undefined | null): file is File {
  if (!file) return false;
  if (file.type.startsWith("video/")) return true;
  return DIRECT_VIDEO.test(file.name);
}
