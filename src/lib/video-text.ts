import type { TimedCaptionCue } from "./extract-meta";
import { extractNumberedItems, guessCategoryIds, guessComplaintIds, guessKind, guessPoses } from "./import-parse";
import type { PoseTrack } from "./pose-track";
import type { DraftExercise, ExerciseKind, ExerciseStep, PoseId } from "./types";

export type { TimedCaptionCue };

export const VIDEO_TEXT_MAX_STEPS = 8;
export const VIDEO_TEXT_MIN_GAP_SEC = 3;
export const VIDEO_TEXT_MIN_HOLD_SEC = 0.8;

export type VideoTextSource = "ocr" | "caption";

export type VideoTextCue = {
  startSec: number;
  text: string;
  source: VideoTextSource;
  holdSec?: number;
};

export type OverlaySegment = {
  startSec: number;
  endSec: number;
  text: string;
  samples: number;
};

export type VideoTextSuggestion = {
  foundText: boolean;
  title?: string;
  summary?: string;
  steps?: ExerciseStep[];
  kind?: ExerciseKind;
  categoryIds?: string[];
  complaintIds?: string[];
  defaultDurationSec?: number;
  ocrText: string;
  captionText: string;
};

const STEP_MARKER =
  /\b(?:schritt|step|teil|übung|uebung|asana)\s*(\d{1,2})(?:\s*[:.)\-–]\s*(.+))?/i;

export function captionCuesToVideoCues(cues: TimedCaptionCue[] | undefined | null): VideoTextCue[] {
  if (!cues?.length) return [];
  return cues
    .map((cue) => ({
      startSec: Number.isFinite(cue.startSec) ? Math.max(0, cue.startSec) : 0,
      text: cue.text.replace(/\s+/g, " ").trim(),
      source: "caption" as const,
      holdSec: Number.isFinite(cue.durationSec) ? Math.max(0, cue.durationSec ?? 0) : undefined,
    }))
    .filter((cue) => cue.text.length > 1);
}

export function captionsToVideoCues(captions: string | undefined | null): VideoTextCue[] {
  const text = captions?.replace(/\s+/g, " ").trim() ?? "";
  if (!text) return [];
  return [{ startSec: 0, text, source: "caption" }];
}

export function mergeVideoCues(ocr: VideoTextCue[], captions: VideoTextCue[]): VideoTextCue[] {
  return [...captions, ...ocr].sort((a, b) => a.startSec - b.startSec || a.text.localeCompare(b.text));
}

export function uniqueCueTexts(cues: VideoTextCue[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const cue of cues) {
    const key = normalizeForCompare(cue.text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(cue.text);
  }
  return out;
}

export function mergedTranscript(ocrCues: VideoTextCue[], captionText: string): string {
  const captions = captionText.replace(/\s+/g, " ").trim();
  const ocrLines = uniqueCueTexts(ocrCues.filter((cue) => cue.source === "ocr"));
  return [captions, ocrLines.join("\n")].filter(Boolean).join("\n");
}

export function parseStepMarker(text: string): { index: number; label: string } | null {
  const match = text.match(STEP_MARKER);
  if (!match) return null;
  const index = Number(match[1]);
  if (!Number.isFinite(index) || index < 1 || index > 20) return null;
  return { index, label: (match[2] ?? "").replace(/\s+/g, " ").trim() };
}

export function parseDurationHint(text: string): number | null {
  const match = text.match(/\b(\d{1,3})\s*(?:sekunden|sekunde|sek|sec|s)\b/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value < 2 || value > 180) return null;
  return value;
}

export function looksLikeTitle(text: string): boolean {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length < 3 || trimmed.length > 60) return false;
  if (parseStepMarker(trimmed) && !parseStepMarker(trimmed)?.label) return false;
  if (/^\d+([:.,]\d+)*$/.test(trimmed)) return false;
  if (/^https?:/i.test(trimmed)) return false;
  const words = trimmed.split(" ").filter(Boolean);
  if (words.length > 12) return false;
  return /[\p{L}]{2,}/u.test(trimmed);
}

export function clusterOverlayCues(cues: VideoTextCue[], minHoldSec = VIDEO_TEXT_MIN_HOLD_SEC): OverlaySegment[] {
  const ocr = cues.filter((cue) => cue.source === "ocr").sort((a, b) => a.startSec - b.startSec);
  if (ocr.length === 0) return [];
  const segments: OverlaySegment[] = [];
  let current: OverlaySegment = {
    startSec: ocr[0].startSec,
    endSec: ocr[0].startSec + (ocr[0].holdSec ?? 0),
    text: ocr[0].text,
    samples: 1,
  };
  for (let i = 1; i < ocr.length; i++) {
    const cue = ocr[i];
    if (similarText(current.text, cue.text)) {
      current.endSec = Math.max(current.endSec, cue.startSec + (cue.holdSec ?? 0));
      current.samples += 1;
      if (cue.text.length > current.text.length) current.text = cue.text;
    } else {
      segments.push(current);
      current = {
        startSec: cue.startSec,
        endSec: cue.startSec + (cue.holdSec ?? 0),
        text: cue.text,
        samples: 1,
      };
    }
  }
  segments.push(current);
  return segments.filter((segment) => {
    const hold = Math.max(0, segment.endSec - segment.startSec);
    if (parseStepMarker(segment.text)) return true;
    return hold >= minHoldSec || segment.samples >= 2;
  });
}

export function motionFromTrack(track: PoseTrack): number[] {
  const frames = track.frames;
  if (frames.length === 0) return [];
  const motion: number[] = [0];
  for (let i = 1; i < frames.length; i++) {
    let sum = 0;
    const prev = frames[i - 1];
    const next = frames[i];
    const n = Math.min(prev.length, next.length);
    for (let j = 0; j < n; j++) sum += Math.abs(next[j] - prev[j]);
    motion.push(sum);
  }
  return motion;
}

export function pauseResumeTimes(motion: number[], fps: number, minPauseSec = 2.5): number[] {
  if (motion.length < 4 || fps <= 0) return [];
  const sorted = [...motion].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const threshold = Math.max(8, median * 0.28);
  const minFrames = Math.max(2, Math.round(minPauseSec * fps));
  const times: number[] = [];
  let lowRun = 0;
  for (let i = 0; i < motion.length; i++) {
    if (motion[i] <= threshold) {
      lowRun += 1;
      continue;
    }
    if (lowRun >= minFrames) {
      times.push(Number((i / fps).toFixed(2)));
    }
    lowRun = 0;
  }
  return times;
}

export function suggestFromVideoText(input: {
  ocrCues: VideoTextCue[];
  captions?: string;
  captionCues?: TimedCaptionCue[];
  existingTitle?: string;
  existingSummary?: string;
  durationSec: number;
  pauseTimes?: number[];
}): VideoTextSuggestion {
  const ocrCues = input.ocrCues.filter((cue) => !isWeakOcrCue(cue.text));
  const captionText = (input.captions ?? "").trim();
  const captionCues = captionCuesToVideoCues(input.captionCues);
  const captionAsCues = captionCues.length > 0 ? captionCues : captionsToVideoCues(captionText);
  const merged = mergeVideoCues(ocrCues, captionAsCues);
  const transcript = mergedTranscript(ocrCues, captionText);
  const overlays = clusterOverlayCues(ocrCues);
  const foundText = transcript.length > 0 || overlays.length > 0;
  if (!foundText) {
    return { foundText: false, ocrText: "", captionText };
  }

  const ocrText = uniqueCueTexts(ocrCues).join("\n");
  const title = pickTitle(input.existingTitle ?? "", overlays);
  const summary = pickSummary(input.existingSummary ?? "", captionText, overlays, ocrText);
  const blob = [title, transcript].filter(Boolean).join("\n");
  const boundaries = detectStepBoundaries({
    cues: merged,
    overlays,
    captions: captionText,
    durationSec: input.durationSec,
    pauseTimes: input.pauseTimes ?? [],
  });
  const steps =
    boundaries.length >= 2
      ? boundariesToSteps(boundaries, blob, input.durationSec)
      : undefined;

  return {
    foundText: true,
    title,
    summary,
    steps,
    kind: guessKind(blob),
    categoryIds: guessCategoryIds(blob),
    complaintIds: guessComplaintIds(blob),
    defaultDurationSec: Math.max(15, Math.round(input.durationSec || 0) || 90),
    ocrText,
    captionText,
  };
}

export function applyVideoTextToDraft(draft: DraftExercise, suggestion: VideoTextSuggestion): DraftExercise {
  if (!suggestion.foundText) return draft;
  return {
    ...draft,
    title: suggestion.title?.trim() || draft.title,
    summary: suggestion.summary?.trim() || draft.summary,
    steps: suggestion.steps && suggestion.steps.length > 0 ? suggestion.steps : draft.steps,
    kind: suggestion.kind ?? draft.kind,
    categoryIds: suggestion.categoryIds ?? draft.categoryIds,
    complaintIds: suggestion.complaintIds ?? draft.complaintIds,
    defaultDurationSec: suggestion.defaultDurationSec ?? draft.defaultDurationSec,
  };
}

export function applyAnalysisToDraft(
  draft: DraftExercise,
  track: DraftExercise["poseTrack"],
  suggestion?: VideoTextSuggestion,
): DraftExercise {
  const next = { ...draft, poseTrack: track };
  if (!track || !suggestion?.foundText) return next;
  return applyVideoTextToDraft(next, suggestion);
}

function pickTitle(existing: string, overlays: OverlaySegment[]): string {
  const overlayTitle = overlays.map((segment) => segment.text).find((text) => looksLikeTitle(text) && !parseStepMarker(text));
  const trimmed = existing.trim();
  if (!trimmed) return (overlayTitle ?? "").slice(0, 80);
  if (overlayTitle && overlayTitle.length >= 8) {
    const existingNorm = normalizeForCompare(trimmed);
    const overlayNorm = normalizeForCompare(overlayTitle);
    if (overlayNorm.includes(existingNorm) || existingNorm.includes(overlayNorm)) {
      return overlayTitle.slice(0, 80);
    }
  }
  return trimmed.slice(0, 80);
}

function pickSummary(existing: string, captions: string, overlays: OverlaySegment[], ocrText: string): string {
  const overlayBits = overlays
    .map((segment) => segment.text)
    .filter((text) => looksLikeTitle(text) || parseStepMarker(text) || parseDurationHint(text) || /\b(links|rechts|left|right)\b/i.test(text))
    .slice(0, 6);
  const captionSlice = (captions.replace(/\s+/g, " ").trim() || existing.replace(/\s+/g, " ").trim()).slice(0, 140);
  const ocrSlice = (overlayBits.join(" · ") || ocrText.replace(/\s+/g, " ").trim()).slice(0, 80);
  if (captionSlice && ocrSlice && !normalizeForCompare(captionSlice).includes(normalizeForCompare(ocrSlice).slice(0, 24))) {
    return `${captionSlice} Text im Bild: ${ocrSlice}`.slice(0, 200);
  }
  if (captionSlice) return captionSlice.slice(0, 160);
  if (ocrSlice) return `Im Video gelesen: ${ocrSlice}`.slice(0, 160);
  return existing.slice(0, 160);
}

function detectStepBoundaries(input: {
  cues: VideoTextCue[];
  overlays: OverlaySegment[];
  captions: string;
  durationSec: number;
  pauseTimes: number[];
}): Array<{ startSec: number; text: string }> {
  const fromMarkers = stepMarkersFromCues(input.cues);
  if (fromMarkers.length >= 2) return fromMarkers.slice(0, VIDEO_TEXT_MAX_STEPS);

  const fromLists = numberedItemsWithTimes(input.captions, input.cues);
  if (fromLists.length >= 2) return fromLists.slice(0, VIDEO_TEXT_MAX_STEPS);

  const fromOverlays = overlayTitleChanges(input.overlays);
  if (fromOverlays.length >= 2) {
    return maybeAddPauses(fromOverlays, input.pauseTimes, input.cues, input.durationSec).slice(
      0,
      VIDEO_TEXT_MAX_STEPS,
    );
  }
  return [];
}

function stepMarkersFromCues(cues: VideoTextCue[]): Array<{ startSec: number; text: string }> {
  const byIndex = new Map<number, { startSec: number; text: string }>();
  for (const cue of cues) {
    const marker = parseStepMarker(cue.text);
    if (!marker) continue;
    if (byIndex.has(marker.index)) continue;
    const label = marker.label || cue.text.replace(/\s+/g, " ").trim();
    byIndex.set(marker.index, {
      startSec: cue.startSec,
      text: label || `Schritt ${marker.index}`,
    });
  }
  return [...byIndex.values()]
    .sort((a, b) => a.startSec - b.startSec)
    .filter((item, index, list) => index === 0 || item.startSec - list[index - 1].startSec >= VIDEO_TEXT_MIN_GAP_SEC - 0.4);
}

function numberedItemsWithTimes(captions: string, cues: VideoTextCue[]): Array<{ startSec: number; text: string }> {
  const items = extractNumberedItems(captions);
  if (items.length < 2) return [];
  const found = items.map((item) => {
    const time = timeOfItem(item, cues);
    return { startSec: time ?? Number.NaN, text: item };
  });
  const timedCount = found.filter((item) => Number.isFinite(item.startSec)).length;
  if (timedCount >= 2) {
    let last = 0;
    return found.map((item, index) => {
      if (Number.isFinite(item.startSec)) {
        last = item.startSec;
        return item;
      }
      const nextTimed = found.find((entry, i) => i > index && Number.isFinite(entry.startSec));
      const nextTime = nextTimed ? nextTimed.startSec : last + VIDEO_TEXT_MIN_GAP_SEC;
      const inferred = last + Math.max(VIDEO_TEXT_MIN_GAP_SEC, (nextTime - last) / 2);
      last = inferred;
      return { startSec: inferred, text: item.text };
    });
  }
  // Numbered list is a split signal, but without timestamps we do not invent start times.
  return items.map((item, index) => ({ startSec: index === 0 ? 0 : Number.NaN, text: item }));
}

function overlayTitleChanges(overlays: OverlaySegment[]): Array<{ startSec: number; text: string }> {
  const titles = overlays.filter((segment) => looksLikeTitle(segment.text) || parseStepMarker(segment.text));
  if (titles.length < 2) return [];
  const out: Array<{ startSec: number; text: string }> = [];
  for (const segment of titles) {
    const prev = out[out.length - 1];
    if (prev && similarText(prev.text, segment.text)) continue;
    if (prev && segment.startSec - prev.startSec < VIDEO_TEXT_MIN_GAP_SEC) continue;
    out.push({ startSec: segment.startSec, text: segment.text });
  }
  return out;
}

function maybeAddPauses(
  steps: Array<{ startSec: number; text: string }>,
  pauseTimes: number[],
  cues: VideoTextCue[],
  durationSec: number,
): Array<{ startSec: number; text: string }> {
  if (steps.length === 0 || pauseTimes.length === 0) return steps;
  const out = [...steps];
  for (const time of pauseTimes) {
    if (out.length >= VIDEO_TEXT_MAX_STEPS) break;
    if (time < VIDEO_TEXT_MIN_GAP_SEC || time > durationSec - 2) continue;
    if (out.some((step) => Math.abs(step.startSec - time) < VIDEO_TEXT_MIN_GAP_SEC)) continue;
    const nearby = cues.find(
      (cue) => cue.startSec >= time && cue.startSec <= time + 4 && cue.text.trim().length > 3,
    );
    if (!nearby) continue;
    out.push({ startSec: time, text: nearby.text });
  }
  return out.sort((a, b) => a.startSec - b.startSec);
}

function boundariesToSteps(
  boundaries: Array<{ startSec: number; text: string }>,
  blob: string,
  durationSec: number,
): ExerciseStep[] {
  const timed = boundaries.every((item) => Number.isFinite(item.startSec));
  const starts = timed
    ? boundaries.map((item) => Math.max(0, item.startSec))
    : boundaries.map((_, index) => (index / Math.max(1, boundaries.length)) * Math.max(durationSec, 1));
  return boundaries.slice(0, VIDEO_TEXT_MAX_STEPS).map((item, index) => {
    const startSec = timed ? starts[index] : undefined;
    const nextStart = timed
      ? (starts[index + 1] ?? Math.max(durationSec, starts[index] + 8))
      : undefined;
    const fromHint = parseDurationHint(item.text);
    const duration =
      fromHint ??
      (nextStart !== undefined ? Math.max(2, Math.round(nextStart - (startSec ?? 0))) : 8);
    const poses = guessPoses(item.text, blob);
    const pose: PoseId = poses[0] ?? "stand";
    const sideNote = /\b(links|linke[rsn]?|left)\b/i.test(item.text)
      ? " links"
      : /\b(rechts|rechte[rsn]?|right)\b/i.test(item.text)
        ? " rechts"
        : "";
    return {
      pose,
      text: `${item.text}${sideNote && !item.text.toLowerCase().includes(sideNote.trim()) ? ` (${sideNote.trim()})` : ""}`.slice(0, 180),
      durationSec: duration,
      ...(startSec !== undefined ? { startSec: Number(startSec.toFixed(2)) } : {}),
    };
  });
}

function timeOfItem(item: string, cues: VideoTextCue[]): number | null {
  const needle = normalizeForCompare(item).slice(0, 40);
  if (!needle) return null;
  for (const cue of cues) {
    const hay = normalizeForCompare(cue.text);
    if (hay.includes(needle) || needle.includes(hay.slice(0, 40))) return cue.startSec;
  }
  return null;
}

export function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function similarText(a: string, b: string): boolean {
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = new Set(na.split(" ").filter(Boolean));
  const tb = nb.split(" ").filter(Boolean);
  if (ta.size === 0 || tb.length === 0) return false;
  const overlap = tb.filter((token) => ta.has(token)).length;
  return overlap >= Math.max(1, Math.min(ta.size, tb.length) * 0.7);
}

function isWeakOcrCue(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 3) return true;
  if (/^\d+([:.,]\d+)*$/.test(trimmed)) return true;
  if (/^(www\.|https?:)/i.test(trimmed)) return true;
  const letters = trimmed.match(/\p{L}/gu) ?? [];
  return letters.length < 2;
}
