import type { ExtractedMeta, TimedCaptionCue } from "./extract-meta";
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
  captionCues?: TimedCaptionCue[];
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
  { id: "comp-belly", pattern: /bauch|core|\babs\b|plank/i },
  { id: "comp-mobility", pattern: /beweglichkeit|mobility|dehn/i },
  { id: "comp-office", pattern: /büro|buero|schreibtisch|desk|bildschirm/i },
];

type PoseRule = {
  pose: PoseId;
  pattern: RegExp;
  exclude?: RegExp;
};

const POSE_KEYWORDS: PoseRule[] = [
  { pose: "jawSoft", pattern: /\b(kiefer|jaw|zähne|zaehne|zunge)\b/i },
  { pose: "gazeFar", pattern: /\b(ferne|auge(?:n)?|blick|blinzeln|20[-\s]?20[-\s]?20)\b/i },
  {
    pose: "wristsFlex",
    pattern: /\b(handgelenk(?:e)?|wrist(?:s)?|hände?\s+kreis|hand\s+kreis)\b/i,
  },
  {
    pose: "walkLeft",
    pattern: /\b(gehen|laufen|walking|spazier(?:gang|en)?)\b|\bwalk(?:ing)?\b/i,
    exclude: /\b(walkthrough|walk-through|walk through)\b/i,
  },
  {
    pose: "shrug",
    pattern: /\bshrug\b|schultern?\s*(hoch(?:ziehen)?|abladen|fallen\s*lassen)|schulter(?:n)?\s+zu den ohren/i,
    exclude: /nicht\s+(hoch|shrug|anheben)|don'?t\s+shrug|schultern?\s+nicht|ohne die schultern/i,
  },
  { pose: "shoulderForward", pattern: /schulterkreis|shoulder\s*roll|schultern?\s*(vorn|kreisen|rollen)/i },
  { pose: "pelvicTuck", pattern: /beckenkipp|pelvic\s*tilt|becken\s*kippen/i },
  { pose: "fold", pattern: /vorbeuge|forward\s*fold|uttanasana/i },
  { pose: "squat", pattern: /kniebeuge|\bsquat/i },
  { pose: "calfWall", pattern: /\b(wade|waden|calf|fersenstand)\b/i },
  { pose: "lunge", pattern: /ausfallschritt|\blunge\b|hüftbeuger/i },
  { pose: "plank", pattern: /\bplank\b|stütze|unterarmstütz/i },
  { pose: "cobra", pattern: /\bcobra\b|bhujang|rückbeuge/i },
  { pose: "child", pattern: /kindeshaltung|child'?s?\s*pose|balasana/i },
  { pose: "cat", pattern: /katze|cat.?cow|marjary/i },
  { pose: "cow", pattern: /\bkuh\b|bitilas/i },
  { pose: "twist", pattern: /dreh(?:ung|en)|twis[dt]/i },
  { pose: "breathe", pattern: /atmung|pranayama|boxatmung|einatmen|ausatmen|\bbreath/i },
  {
    pose: "neckLeft",
    pattern: /\b(nacken|halswirbel|neck\s*(?:stretch|roll|tilt|circle)|nackenkreis|seitneig)/i,
  },
  { pose: "lie", pattern: /liegen|savasana|leichen|rückenlage/i },
  { pose: "warrior", pattern: /krieger|\bwarrior\b/i },
  { pose: "tree", pattern: /\bbaum\b|tree\s*pose|vrksasana/i },
  { pose: "hipOpen", pattern: /hüfte|pigeon|taube|hüftöffner/i },
  { pose: "chestOpen", pattern: /brustöffner|brustkorb|chest\s*opener|schulterblatt/i },
  { pose: "heart", pattern: /mantra|herz|affirmation/i },
  { pose: "reachUp", pattern: /strecken|arme\s+hoch|reach\s*up|morgenstreck/i },
  { pose: "sit", pattern: /\b(sitzen|sitzend|im sitz|seated|sitting)\b/i },
];

type Laterality = "left" | "right" | "both" | null;

function detectLaterality(text: string): Laterality {
  const left = /\b(links|linke[rsn]?|left)\b/i.test(text);
  const right = /\b(rechts|rechte[rsn]?|right)\b/i.test(text);
  if (left && right) return "both";
  if (/beide(?:n)?\s+seiten|seitenwechsel|andere seite|other side/i.test(text)) return "both";
  if (left) return "left";
  if (right) return "right";
  return null;
}

function matchPoses(text: string): PoseId[] {
  const found: Array<{ index: number; pose: PoseId }> = [];
  for (const rule of POSE_KEYWORDS) {
    if (rule.exclude?.test(text)) continue;
    const match = text.match(rule.pattern);
    if (!match || match.index == null) continue;
    found.push({ index: match.index, pose: rule.pose });
  }
  found.sort((a, b) => a.index - b.index);
  const unique: PoseId[] = [];
  for (const item of found) {
    if (!unique.includes(item.pose)) unique.push(item.pose);
  }
  return unique;
}

function withSides(pose: PoseId, side: Laterality): PoseId[] {
  if (pose === "neckLeft" || pose === "neckRight" || pose === "neckTilt") {
    if (side === "left") return ["neckLeft"];
    if (side === "right") return ["neckRight"];
    return ["neckLeft", "neckForward", "neckRight", "neckBack"];
  }
  if (pose === "walkLeft" || pose === "walkRight") {
    return ["walkLeft", "walkRight"];
  }
  if (pose === "lunge" || pose === "lungeOther") {
    if (side === "left") return ["lungeOther"];
    if (side === "right") return ["lunge"];
    return ["lunge", "lungeOther"];
  }
  if (pose === "warrior" || pose === "warriorOther") {
    if (side === "left") return ["warriorOther"];
    if (side === "right") return ["warrior"];
    return ["warrior", "warriorOther"];
  }
  if (pose === "tree" || pose === "treeOther") {
    if (side === "left") return ["tree"];
    if (side === "right") return ["treeOther"];
    return ["tree", "treeOther"];
  }
  if (pose === "twist" || pose === "twistOther") {
    if (side === "left") return ["twist"];
    if (side === "right") return ["twistOther"];
    return ["twist", "twistOther"];
  }
  if (pose === "hipOpen" || pose === "hipOpenOther") {
    if (side === "left") return ["hipOpenOther"];
    if (side === "right") return ["hipOpen"];
    return ["hipOpen", "hipOpenOther"];
  }
  if (pose === "calfWall" || pose === "calfWallOther") {
    if (side === "left") return ["calfWallOther"];
    if (side === "right") return ["calfWall"];
    return ["calfWall", "calfWallOther"];
  }
  if (pose === "jawSoft" || pose === "jawLeft" || pose === "jawRight") {
    return ["jawSoft", "jawLeft", "jawRight"];
  }
  if (pose === "wristsFlex" || pose === "wristsExtend") {
    return ["wristsFlex", "wristsExtend", "shakeOut"];
  }
  if (pose === "shrug" || pose === "shoulderForward") {
    return ["shoulderForward", "shrug", "chestOpen", "shouldersDown"];
  }
  if (pose === "breathe" || pose === "breatheIn" || pose === "breatheOut") {
    return ["sit", "breatheIn", "breatheOut"];
  }
  return [pose];
}

function restPoseFor(pose: PoseId): PoseId {
  if (
    [
      "sit",
      "jawSoft",
      "jawLeft",
      "jawRight",
      "twist",
      "twistOther",
      "hipOpen",
      "hipOpenOther",
      "breathe",
      "breatheIn",
      "breatheOut",
      "gazeFar",
    ].includes(pose)
  ) {
    return "sit";
  }
  if (
    ["lie", "lieInhale", "lieHold", "lieExhale", "kneesUp", "pelvicTuck", "pelvicArch"].includes(pose)
  ) {
    return "lie";
  }
  return "stand";
}

function sequenceFor(poses: PoseId[], text: string): PoseId[] {
  const side = detectLaterality(text);
  if (poses.length === 0) {
    const kind = guessKind(text);
    if (kind === "mantra") return ["heart", "stand", "heart"];
    if (kind === "breath") return ["sit", "breatheIn", "breatheOut", "sit"];
    if (kind === "mind") return ["sit", "gazeFar", "sit"];
    return ["stand", "reachUp", "fold", "stand"];
  }
  if (poses.length === 1) {
    const motion = withSides(poses[0], side);
    const rest = restPoseFor(poses[0]);
    if (motion[0] === rest) return motion.slice(0, 6);
    if (["child", "plank", "cobra", "cat", "cow"].includes(poses[0])) return motion.slice(0, 6);
    return [rest, ...motion].slice(0, 8);
  }
  const expanded = poses.flatMap((pose) => {
    if (poses.length >= 3) {
      const pair = withSides(pose, side);
      return pair.length <= 2 ? pair : [pose];
    }
    return withSides(pose, side).slice(0, 2);
  });
  const unique: PoseId[] = [];
  for (const pose of expanded) {
    if (unique[unique.length - 1] !== pose) unique.push(pose);
  }
  return unique.slice(0, 8);
}

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
  captionCues?: TimedCaptionCue[];
}): ImportMeta {
  const title = (input.oembed?.title || input.page?.title || "").trim();
  const description = (input.page?.description || "").trim();
  const author = (input.oembed?.author_name || input.page?.author)?.trim() || undefined;
  const videoId = input.provider === "youtube" ? parseYoutubeVideoId(input.url) : null;
  const thumbnailUrl =
    (input.oembed?.thumbnail_url || input.page?.thumbnailUrl || (videoId ? youtubeThumbnailUrl(videoId) : "")).trim() ||
    undefined;
  const captions = input.captions?.trim() || undefined;
  const captionCues = input.captionCues && input.captionCues.length > 0 ? input.captionCues : undefined;
  return {
    url: input.url,
    provider: input.provider,
    title,
    description,
    author,
    thumbnailUrl,
    captions,
    captionCues,
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
  const fromLines = lines
    .map((line) => line.match(/^(?:\d+[\).:-]|[-*•])\s+(.+)/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => match[1].replace(/\s+/g, " ").trim())
    .filter((item) => item.length > 2);
  if (fromLines.length >= 2) return fromLines;

  const inlineSource = fromLines.length === 1 ? lines.find((line) => /^(?:\d+[\).:-]|[-*•])\s+/.test(line)) ?? text : text;
  const inline = [...inlineSource.matchAll(/(?:^|\s)(\d{1,2})[).]\s+(.+?)(?=(?:\s+\d{1,2}[).]\s+)|$)/g)]
    .map((match) => match[2].replace(/\s+/g, " ").trim())
    .filter((item) => item.length > 2);
  if (inline.length >= 2) return inline;
  return fromLines;
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

export function guessPoses(text: string, fallbackText = ""): PoseId[] {
  const fromPrimary = matchPoses(text);
  const source = fromPrimary.length > 0 ? text : `${text}\n${fallbackText}`.trim();
  return sequenceFor(matchPoses(source), source);
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
    const poses = guessPoses(itemTitle, blob);
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
