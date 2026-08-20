import type { DraftExercise, ExerciseKind, PoseId, SuggestedRhythm } from "./types";

export type ImportMeta = {
  url: string;
  provider: "youtube" | "instagram" | "web";
  title: string;
  description: string;
  author?: string;
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
  { pose: "neckTilt", pattern: /nacken/i },
  { pose: "lie", pattern: /liegen|savasana|leichen/i },
  { pose: "warrior", pattern: /krieger|warrior/i },
  { pose: "tree", pattern: /baum|tree pose/i },
  { pose: "hipOpen", pattern: /hüfte|pigeon|taube/i },
  { pose: "chestOpen", pattern: /brust|chest/i },
  { pose: "heart", pattern: /mantra|herz|affirmation/i },
  { pose: "reachUp", pattern: /strecken|reach|arme hoch/i },
];

export function detectProvider(url: string): ImportMeta["provider"] {
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/instagram\.com/i.test(url)) return "instagram";
  return "web";
}

export function isSupportedSourceUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
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
  return numbered;
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
    if (kind === "breath") return ["sit", "breathe", "sit"];
    if (kind === "mind") return ["sit", "breathe", "lie"];
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

function toSteps(title: string, description: string, poses: PoseId[]) {
  const snippet = description.replace(/\s+/g, " ").trim().slice(0, 180);
  return poses.map((pose, index) => ({
    pose,
    durationSec: 8,
    text:
      index === 0
        ? `${title}. ${snippet || "Bewege dich langsam und in deinem Tempo."}`
        : `Schritt ${index + 1}: Haltung halten, atmen, nicht das Originalvideo kopieren – nur die Bewegung in der einheitlichen Figur.`,
  }));
}

export function deriveExercisesFromMeta(meta: ImportMeta): DraftExercise[] {
  const blob = `${meta.title}\n${meta.description}`;
  const numbered = extractNumberedItems(meta.description);
  const countMatch = meta.title.match(/(\d+)\s*(übungen|exercises|moves|asana)/i);
  const wanted = numbered.length || (countMatch ? Math.min(8, Number(countMatch[1])) : 1);
  const items =
    numbered.length > 0
      ? numbered.slice(0, wanted)
      : wanted > 1
        ? Array.from({ length: wanted }, (_, index) => `${meta.title} – Teil ${index + 1}`)
        : [meta.title];

  return items.map((itemTitle) => {
    const text = `${itemTitle}\n${blob}`;
    const kind = guessKind(text);
    const poses = guessPoses(text);
    return {
      title: itemTitle.slice(0, 80),
      summary:
        meta.description.replace(/\s+/g, " ").trim().slice(0, 160) ||
        `Aus ${meta.provider === "youtube" ? "YouTube" : meta.provider === "instagram" ? "Instagram" : "dem Link"} abgeleitet und als Strichfigur neu gezeichnet.`,
      kind,
      categoryIds: guessCategoryIds(text),
      complaintIds: guessComplaintIds(text),
      steps: toSteps(itemTitle, meta.description, poses),
      defaultDurationSec: Math.max(45, poses.length * 12),
      suggestedRhythm: suggestedRhythmFor(kind, text),
      source: {
        type: "import",
        url: meta.url,
        label: meta.author ? `${meta.title} · ${meta.author}` : meta.title,
      },
      isSystem: false,
    } satisfies DraftExercise;
  });
}
