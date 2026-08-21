import type { DraftExercise, Exercise, ExerciseKind, ExerciseStep, PoseId, SuggestedRhythm } from "./types";

export const emptyStep = (): ExerciseStep => ({ pose: "stand", text: "", durationSec: 8 });

const DEFAULT_NOTE = "Täglich, so lange es sich richtig anfühlt.";

export function emptyCustomDraft(): DraftExercise {
  return {
    title: "",
    summary: "",
    kind: "movement",
    categoryIds: ["cat-body"],
    complaintIds: [],
    steps: [emptyStep()],
    defaultDurationSec: 90,
    suggestedRhythm: {
      kind: "daily",
      recommendedWeeks: null,
      note: DEFAULT_NOTE,
    },
    source: { type: "user" },
    isSystem: false,
  };
}

export function exerciseToDraft(exercise: Exercise): DraftExercise {
  return {
    title: exercise.title,
    summary: exercise.summary,
    kind: exercise.kind,
    categoryIds: [...exercise.categoryIds],
    complaintIds: [...exercise.complaintIds],
    steps: exercise.steps.map((step) => ({ ...step })),
    defaultDurationSec: exercise.defaultDurationSec,
    defaultReps: exercise.defaultReps,
    suggestedRhythm: { ...exercise.suggestedRhythm, daysOfWeek: exercise.suggestedRhythm.daysOfWeek?.slice() },
    source: { ...exercise.source },
    poseTrack: exercise.poseTrack ?? undefined,
    isSystem: false,
  };
}

export function patchDraft(draft: DraftExercise, patch: Partial<DraftExercise>): DraftExercise {
  return { ...draft, ...patch };
}

export function applyPoseOverride(steps: ExerciseStep[], index: number, pose: PoseId): ExerciseStep[] {
  if (index < 0 || index >= steps.length) return steps.map((step) => ({ ...step }));
  return steps.map((step, i) => (i === index ? { ...step, pose } : { ...step }));
}

export function applyStepPatch(steps: ExerciseStep[], index: number, patch: Partial<ExerciseStep>): ExerciseStep[] {
  if (index < 0 || index >= steps.length) return steps.map((step) => ({ ...step }));
  return steps.map((step, i) => (i === index ? { ...step, ...patch } : { ...step }));
}

export function canSaveDraft(draft: DraftExercise): boolean {
  return draft.title.trim().length > 0;
}

function sanitizeDraft(draft: DraftExercise): DraftExercise {
  const title = draft.title.trim();
  const steps = (draft.steps.length > 0 ? draft.steps : [emptyStep()]).map((step) => {
    const startSec =
      typeof step.startSec === "number" && Number.isFinite(step.startSec) ? Math.max(0, step.startSec) : undefined;
    return {
      ...step,
      text: step.text.trim() || title,
      durationSec: Number.isFinite(step.durationSec) ? Math.max(2, step.durationSec) : 8,
      ...(startSec !== undefined ? { startSec: Math.round(startSec * 10) / 10 } : {}),
    };
  });
  const suggestedRhythm: SuggestedRhythm = {
    ...draft.suggestedRhythm,
    note: draft.suggestedRhythm.note.trim() || DEFAULT_NOTE,
  };
  return {
    ...draft,
    title,
    summary: draft.summary.trim() || (draft.source.type === "user" ? "Eigene Übung." : draft.summary),
    steps,
    defaultDurationSec: Number.isFinite(draft.defaultDurationSec) ? Math.max(15, draft.defaultDurationSec) : 90,
    suggestedRhythm,
    isSystem: false,
  };
}

function resolvedSource(draft: DraftExercise, existing?: Exercise): DraftExercise["source"] {
  const url = draft.source.url || existing?.source.url;
  const fromCatalog = draft.source.type === "catalog" || existing?.source.type === "catalog";
  if (url) {
    return {
      ...existing?.source,
      ...draft.source,
      url,
      type: fromCatalog || draft.source.type === "import" ? "import" : draft.source.type,
    };
  }
  return {
    ...existing?.source,
    ...draft.source,
    type: fromCatalog ? "user" : draft.source.type,
    url: undefined,
  };
}

export function prepareImportedSave(input: {
  draft: DraftExercise;
  existing?: Exercise;
  now: string;
  newId: string;
}): Exercise {
  const draft = sanitizeDraft(input.draft);
  if (input.existing) {
    return {
      ...draft,
      id: input.existing.id,
      createdAt: input.existing.createdAt,
      updatedAt: input.now,
      isSystem: false,
      source: resolvedSource(draft, input.existing),
    };
  }
  return {
    ...draft,
    id: input.newId,
    createdAt: input.now,
    updatedAt: input.now,
    isSystem: false,
    source: resolvedSource(draft),
  };
}

export function createCustomExercise(input: {
  id: string;
  now: string;
  title: string;
  summary?: string;
  kind?: ExerciseKind;
  categoryIds?: string[];
  complaintIds?: string[];
  steps?: ExerciseStep[];
  poseTrack?: Exercise["poseTrack"];
  defaultDurationSec?: number;
  note?: string;
}): Exercise {
  const draft = patchDraft(emptyCustomDraft(), {
    title: input.title,
    summary: input.summary ?? "",
    kind: input.kind ?? "movement",
    categoryIds: input.categoryIds ?? ["cat-body"],
    complaintIds: input.complaintIds ?? [],
    steps: input.steps ?? [emptyStep()],
    poseTrack: input.poseTrack,
    defaultDurationSec: input.defaultDurationSec ?? 90,
    suggestedRhythm: {
      kind: "daily",
      recommendedWeeks: null,
      note: input.note ?? DEFAULT_NOTE,
    },
    source: { type: "user" },
    isSystem: false,
  });
  return prepareImportedSave({ draft, now: input.now, newId: input.id });
}
