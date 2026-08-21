import { addDays, isoDate, isPlanItemDueOn } from "./schedule";
import { newId, listPlanItems, savePlanItem, addCompletion } from "./repository";
import type { Completion, Exercise, PlanItem, RhythmKind } from "./types";

export function todayOverview(planItems: PlanItem[], completions: Completion[], date: Date) {
  const todayIso = isoDate(date);
  const due = planItems.filter((item) => isPlanItemDueOn(item, date));
  const doneIds = new Set(
    completions
      .filter((item) => item.completedAt.slice(0, 10) === todayIso && !item.skipped)
      .map((item) => item.exerciseId),
  );
  const remaining = due.filter((item) => !doneIds.has(item.exerciseId));
  return {
    todayIso,
    due,
    remaining,
    doneCount: due.filter((item) => doneIds.has(item.exerciseId)).length,
    allDone: due.length > 0 && remaining.length === 0,
  };
}

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
      reminderTime: existing.reminderTime,
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
