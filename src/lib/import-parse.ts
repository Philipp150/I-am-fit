import type { ExtractedMeta } from "./extract-meta";
import { parseYoutubeVideoId, youtubeThumbnailUrl } from "./source-video";
import type { DraftExercise, ExerciseKind, PoseId, SuggestedRhythm } from "./types";

export type ImportProvider = "youtube" | "instagram" | "web";

export type ImportMeta = {
  url: string;
  provider: ImportProvider;
  title: string;
  description: string;
  author?: string;
  thumbnailUrl?: string;
  captions?: string;
};

export type OEmbedMeta = {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
};

const KIND_KEYWORDS: Array<{ kind: ExerciseKind; pattern: RegExp }> = [
  { kind: "mantra", pattern: /mantra|affirmation|ich bin|i am /i },
  { kind: "breath", pattern: /atmung|breath|pranayama|4-7-8|box breathing/i },
  { kind: "mind", pattern: /meditat|achtsamkeit|body scan|grounding|visualis/i },
  { kind: "movement", pattern: /yoga|stretch|dehn|kraft|workout|mobility|nacken|rücken|hüfte/i },
];

const CATEGORY_KEYWORDS: Array<{ ids: string[]; pattern: RegExp }> = [
  { ids: ["cat-neck"], pattern: /nacken|hals|neck/i },
  { ids: ["cat-shoulders"], pattern: /schulter|shoulder/i },
  { ids: ["cat-back"], pattern: /rücken|back pain|lower back|wirbelsäule/i },
  { ids: ["cat-hips"], pattern: /hüfte|hip/i },
  { ids: ["cat-knees"], pattern: /knie|knee/i },
  { ids: ["cat-breath"], pattern: /atmung|breath/i },
  { ids: ["cat-mantras"], pattern: /mantra|affirmation/i },
  { ids: ["cat-meditation"], pattern: /meditat/i },
  { ids: ["cat-mindfulness"], pattern: /achtsamkeit|mindful|grounding/i },
  { ids: ["cat-morning"], pattern: /morgen|morning/i },
  { ids: ["cat-pause"], pattern: /pause|desk|büro|screen|bildschirm/i },
  { ids: ["cat-evening"], pattern: /abend|sleep|schlaf|night/i },
  { ids: ["cat-strength"], pattern: /kraft|strength|plank|squat|liegestütz/i },
  { ids: ["cat-mobility"], pattern: /beweglichkeit|mobility|dehn|stretch|yoga/i },
  { ids: ["cat-posture"], pattern: /haltung|posture|aufrecht/i },
];

const COMPLAINT_KEYWORDS: Array<{ id: string; pattern: RegExp }> = [
  { id: "comp-neck", pattern: /nacken|hals/i },
  { id: "comp-shoulders", pattern: /schulter/i },
  { id: "comp-back", pattern: /rücken|wirbelsäule/i },
  { id: "comp-hips", pattern: /hüfte/i },
  { id: "comp-knees", pattern: /knie/i },
  { id: "comp-stress", pattern: /stress|unruh|angst/i },
  { id: "comp-sleep", pattern: /schlaf|insomni/i },
  { id: "comp-focus", pattern: /fokus|konzentration|zerstreut/i },
];

const POSE_KEYWORDS: Array<{ pose: PoseId; pattern: RegExp }> = [
  { pose: "jawSoft", pattern: /kiefer|jaw|zähne|zunge|kafer/i },
  { pose: "gazeFar", pattern: /ferne|auge|blick|20-20-20|blinzeln/i },
  { pose: "wristsFlex", pattern: /handgelenk|wrist|hand kreis/i },
  { pose: "walkLeft", pattern: /gehen|laufen|walk|schritt/i },
  { pose: "shrug", pattern: /schultern hoch|shrug|schultern abladen|schultern fallen/i },
  { pose: "pelvicTuck", pattern: /beckenkipp|pelvic tilt|becken kippen/i },
  { pose: "fold", pattern: /vorbeuge|forward fold|fold/i },
  { pose: "squat", pattern: /kniebeuge|squat/i },
  { pose: "lunge", pattern: /ausfall|lunge/i },
  { pose: "plank", pattern: /plank|stütze|unterarmstütz/i },
  { pose: "cobra", pattern: /cobra|bhujang|rückbeuge/i },
  { pose: "child", pattern: /kindeshaltung|child/i },
  { pose: "cat", pattern: /katze|cat.?cow|marjary/i },
  { pose: "cow", pattern: /kuh|bitilas/i },
  { pose: "twist", pattern: /dreh|twist/i },
  { pose: "sit", pattern: /sitz|sit/i },
  { pose: "breathe", pattern: /atmung|breath/i },
  { pose: "neckLeft", pattern: /nacken/i },
  { pose: "neckTilt", pattern: /hals/i },
  { pose: "lie", pattern: /liegen|savasana|leichen/i },
  { pose: "warrior", pattern: /krieger|warrior/i },
  { pose: "tree", pattern: /baum|tree pose/i },
  { pose: "hipOpen", pattern: /hüfte|pigeon|taube/i },
  { pose: "chestOpen", pattern: /brust|chest/i },
  { pose: "heart", pattern: /mantra|herz|affirmation/i },
  { pose: "reachUp", pattern: /strecken|reach|arme hoch/i },
];

export type ImportErrorCode =
  | "empty_url"
  | "invalid_url"
  | "unsupported_protocol"
  | "fetch_failed"
  | "missing_meta";

export type ImportProblem = {
  code: ImportErrorCode;
  message: string;
};

export const IMPORT_MESSAGES: Record<ImportErrorCode, string> = {
  empty_url: "Bitte einen Link einfügen.",
  invalid_url: "Das ist kein gültiger Link. Bitte eine vollständige Adresse mit https:// einfügen.",
  unsupported_protocol: "Nur Links mit http:// oder https:// können gelesen werden.",
  fetch_failed:
    "Der Link konnte nicht gelesen werden. Prüfe, ob er öffentlich erreichbar ist, und versuche es erneut.",
  missing_meta:
    "Zu diesem Link fehlen verwertbare öffentliche Texte (Titel, Beschreibung oder Untertitel). Ein privates, geblocktes oder sehr kurzes Video lässt sich so nicht ableiten.",
};

export function providerLabel(provider: ImportProvider): string {
  if (provider === "youtube") return "YouTube";
  if (provider === "instagram") return "Instagram";
  return "dem Link";
}

export function composeImportMeta(input: {
  url: string;
  provider: ImportProvider;
  oembed?: OEmbedMeta | null;
  page?: ExtractedMeta | null;
  captions?: string;
}): ImportMeta {
  const title = (input.oembed?.title || input.page?.title || "").trim();
  const description = (input.page?.description || "").trim();
  const author = (input.oembed?.author_name || input.page?.author)?.trim() || undefined;
  const videoId = input.provider === "youtube" ? parseYoutubeVideoId(input.url) : null;
  const thumbnailUrl =
    (input.oembed?.thumbnail_url || input.page?.thumbnailUrl || (videoId ? youtubeThumbnailUrl(videoId) : "")).trim() ||
    undefined;
  const captions = input.captions?.trim() || undefined;
  return {
    url: input.url,
    provider: input.provider,
    title,
    description,
    author,
    thumbnailUrl,
    captions,
  };
}

export function detectProvider(url: string): ImportMeta["provider"] {
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/instagram\.com/i.test(url)) return "instagram";
  return "web";
}

export function validateSourceUrl(raw: string): ImportProblem | null {
  const url = raw.trim();
  if (!url) return { code: "empty_url", message: IMPORT_MESSAGES.empty_url };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { code: "invalid_url", message: IMPORT_MESSAGES.invalid_url };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { code: "unsupported_protocol", message: IMPORT_MESSAGES.unsupported_protocol };
  }
  return null;
}

export function isSupportedSourceUrl(url: string): boolean {
  return validateSourceUrl(url) === null;
}

export function looksLikeHostnameTitle(title: string, url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    const normalized = title.trim().toLowerCase();
    return !normalized || normalized === host || normalized === `www.${host}`;
  } catch {
    return !title.trim();
  }
}

export function hasUsableMeta(meta: Pick<ImportMeta, "title" | "description" | "url" | "captions">): boolean {
  const title = meta.title.trim();
  const description = meta.description.trim();
  const captions = (meta.captions ?? "").trim();
  if (title.length >= 3 && description.length >= 8) return true;
  if (title.length >= 3 && captions.length >= 8) return true;
  if (title.length >= 8 && !looksLikeHostnameTitle(title, meta.url)) return true;
  return false;
}

export function extractNumberedItems(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const numbered = lines
    .map((line) => line.match(/^(?:\d+[\).:-]|[-*•])\s+(.+)/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => match[1].replace(/\s+/g, " ").trim())
    .filter((item) => item.length > 2);
  if (numbered.length > 0) return numbered;
  const inline = [...text.matchAll(/(?:^|\s)(\d{1,2})[).]\s+(.+?)(?=(?:\s+\d{1,2}[).]\s+)|$)/g)]
    .map((match) => match[2].replace(/\s+/g, " ").trim())
    .filter((item) => item.length > 2);
  return inline.length >= 2 ? inline : [];
}

export function guessKind(text: string): ExerciseKind {
  for (const entry of KIND_KEYWORDS) {
    if (entry.pattern.test(text)) return entry.kind;
  }
  return "movement";
}

export function guessCategoryIds(text: string): string[] {
  const ids = new Set<string>(["cat-body"]);
  for (const entry of CATEGORY_KEYWORDS) {
    if (entry.pattern.test(text)) {
      for (const id of entry.ids) ids.add(id);
    }
  }
  if (ids.size === 1) ids.add("cat-mobility");
  return [...ids];
}

export function guessComplaintIds(text: string): string[] {
  return COMPLAINT_KEYWORDS.filter((entry) => entry.pattern.test(text)).map((entry) => entry.id);
}

export function guessPoses(text: string): PoseId[] {
  const poses = POSE_KEYWORDS.filter((entry) => entry.pattern.test(text)).map((entry) => entry.pose);
  const unique = [...new Set(poses)];
  if (unique.length === 0) {
    const kind = guessKind(text);
    if (kind === "mantra") return ["heart", "stand", "heart"];
    if (kind === "breath") return ["sit", "breatheIn", "breatheOut", "sit"];
    if (kind === "mind") return ["sit", "gazeFar", "sit"];
    return ["stand", "reachUp", "fold", "stand"];
  }
  if (unique.length === 1) return [unique[0], "stand", unique[0]];
  return unique.slice(0, 6);
}

export function suggestedRhythmFor(kind: ExerciseKind, text: string): SuggestedRhythm {
  if (kind === "mantra" || kind === "breath" || /nacken|pause|desk/i.test(text)) {
    return {
      kind: "daily",
      recommendedWeeks: null,
      note: "Täglich kurz halten – so bleibt es im Alltag.",
    };
  }
  if (/kraft|plank|squat|strength/i.test(text)) {
    return {
      kind: "days",
      daysOfWeek: [1, 3, 5],
      timesPerWeek: 3,
      recommendedWeeks: 8,
      note: "Drei Mal pro Woche reicht, damit der Reiz bleibt und Erholung Platz hat.",
    };
  }
  return {
    kind: "daily",
    recommendedWeeks: 4,
    note: "Vier Wochen täglich üben, danach den Rhythmus auf 3–4 Mal pro Woche senken.",
  };
}

function splitGuidance(text: string, count: number): string[] {
  if (!text.trim() || count <= 0) return [];
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 8);
  if (sentences.length === 0) return [];
  if (sentences.length <= count) {
    return Array.from({ length: count }, (_, index) => (sentences[index] ?? "").slice(0, 180));
  }
  const chunk = Math.max(1, Math.floor(sentences.length / count));
  return Array.from({ length: count }, (_, index) => {
    const start = index * chunk;
    const end = index === count - 1 ? sentences.length : start + chunk;
    return sentences.slice(start, end).join(" ").slice(0, 180);
  });
}

function toSteps(title: string, guidance: string, poses: PoseId[]) {
  const snippet = guidance.replace(/\s+/g, " ").trim().slice(0, 180);
  const extras = splitGuidance(guidance, poses.length);
  return poses.map((pose, index) => {
    const extra = extras[index]?.trim();
    return {
      pose,
      durationSec: 8,
      text:
        extra && extra.length > 2
          ? index === 0
            ? `${title}. ${extra}`
            : `Schritt ${index + 1}: ${extra}`
          : index === 0
            ? `${title}. ${snippet || "Bewege dich langsam und in deinem Tempo."}`
            : `Schritt ${index + 1}: Haltung halten, atmen, in deinem Tempo. Die Figur führt – das Originalvideo ist nur zusätzlich.`,
    };
  });
}

export function deriveExercisesFromMeta(meta: ImportMeta): DraftExercise[] {
  const blob = [meta.title, meta.description, meta.captions].filter(Boolean).join("\n");
  const numbered =
    extractNumberedItems(meta.description).length > 0
      ? extractNumberedItems(meta.description)
      : extractNumberedItems(meta.captions ?? "");
  const countMatch = meta.title.match(/(\d+)\s*(übungen|exercises|moves|asana)/i);
  const wanted = numbered.length || (countMatch ? Math.min(8, Number(countMatch[1])) : 1);
  const items =
    numbered.length > 0
      ? numbered.slice(0, wanted)
      : wanted > 1
        ? Array.from({ length: wanted }, (_, index) => `${meta.title} – Teil ${index + 1}`)
        : [meta.title];
  const guidance = [meta.description, meta.captions].filter(Boolean).join("\n");
  const origin = providerLabel(meta.provider);

  return items.map((itemTitle) => {
    const text = `${itemTitle}\n${blob}`;
    const kind = guessKind(text);
    const poses = guessPoses(text);
    return {
      title: itemTitle.slice(0, 80),
      summary:
        meta.description.replace(/\s+/g, " ").trim().slice(0, 160) ||
        (meta.captions
          ? `Aus ${origin} gelesen (Titel und öffentliche Untertitel) und als App-Figur neu gezeichnet.`
          : `Aus ${origin} gelesen (Titel und Beschreibung) und als App-Figur neu gezeichnet.`),
      kind,
      categoryIds: guessCategoryIds(text),
      complaintIds: guessComplaintIds(text),
      steps: toSteps(itemTitle, guidance, poses),
      defaultDurationSec: Math.max(45, poses.length * 12),
      suggestedRhythm: suggestedRhythmFor(kind, text),
      source: {
        type: "import",
        url: meta.url,
        label: meta.author ? `${meta.title} · ${meta.author}` : meta.title,
        provider: meta.provider,
        thumbnailUrl: meta.thumbnailUrl,
      },
      isSystem: false,
    } satisfies DraftExercise;
  });
}
