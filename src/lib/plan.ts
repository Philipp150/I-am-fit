import { addDays, isoDate } from "./schedule";
import { newId, listPlanItems, savePlanItem, addCompletion } from "./repository";
import type { Exercise, PlanItem, RhythmKind } from "./types";

export async function addExerciseToPlan(
  exercise: Exercise,
  overrides?: Partial<Pick<PlanItem, "rhythm" | "durationSec" | "keepUntil">>,
): Promise<string> {
  const existing = (await listPlanItems()).find((item) => item.exerciseId === exercise.id);
  const keepUntil =
    overrides?.keepUntil !== undefined
      ? overrides.keepUntil
      : exercise.suggestedRhythm.recommendedWeeks
        ? isoDate(addDays(new Date(), exercise.suggestedRhythm.recommendedWeeks * 7))
        : null;
  const rhythm = overrides?.rhythm ?? {
    kind: exercise.suggestedRhythm.kind as RhythmKind,
    daysOfWeek: exercise.suggestedRhythm.daysOfWeek,
    everyNDays: exercise.suggestedRhythm.everyNDays,
    startDate: isoDate(new Date()),
  };
  if (existing) {
    await savePlanItem({
      ...existing,
      enabled: true,
      rhythm,
      durationSec: overrides?.durationSec ?? exercise.defaultDurationSec,
      keepUntil,
    });
    return existing.id;
  }
  const id = newId("plan");
  await savePlanItem({
    id,
    exerciseId: exercise.id,
    enabled: true,
    rhythm,
    durationSec: overrides?.durationSec ?? exercise.defaultDurationSec,
    keepUntil,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function markComplete(exerciseId: string, planItemId?: string, durationSec?: number) {
  await addCompletion({
    id: newId("done"),
    exerciseId,
    planItemId,
    completedAt: new Date().toISOString(),
    durationSec,
  });
}

export async function markSkipped(exerciseId: string, planItemId?: string) {
  await addCompletion({
    id: newId("skip"),
    exerciseId,
    planItemId,
    completedAt: new Date().toISOString(),
    skipped: true,
  });
}
