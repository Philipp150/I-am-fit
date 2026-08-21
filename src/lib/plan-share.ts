import type {
  Exercise,
  PlanInvite,
  PlanItem,
  PlanSnapshot,
  PlanSnapshotItem,
  TrainingPlan,
} from "./types";

export const LOCAL_DEFAULT_PLAN_ID = "plan-local-default";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function cloudDefaultPlanId(ownerId: string): string {
  return `plan-default-${ownerId}`;
}

export function defaultPersonalPlan(
  ownerId: string,
  createdAt: string,
  createdByName = "",
  createdByEmail = "",
): TrainingPlan {
  return {
    id: ownerId === "solo" ? LOCAL_DEFAULT_PLAN_ID : cloudDefaultPlanId(ownerId),
    title: "Mein Plan",
    createdById: ownerId,
    createdByName,
    createdByEmail,
    source: "self",
    acceptedFromInviteId: null,
    archived: false,
    createdAt,
  };
}

export function creatorAttribution(plan: Pick<TrainingPlan, "createdByName" | "createdByEmail" | "source">): string {
  const name = plan.createdByName.trim();
  const email = plan.createdByEmail.trim();
  if (name && email && name !== email) return `von ${name} (${email})`;
  if (name) return `von ${name}`;
  if (email) return `von ${email}`;
  return plan.source === "received" ? "von jemand anderem" : "von dir";
}

export function snapshotItemFromPlanItem(item: PlanItem): PlanSnapshotItem {
  return {
    exerciseId: item.exerciseId,
    enabled: item.enabled,
    rhythm: item.rhythm,
    durationSec: item.durationSec,
    reps: item.reps,
    reminderTime: item.reminderTime,
    keepUntil: item.keepUntil ?? null,
  };
}

export function snapshotFromPlan(plan: Pick<TrainingPlan, "title">, items: PlanItem[], exercises: Exercise[]): PlanSnapshot {
  const usedIds = new Set(items.map((item) => item.exerciseId));
  return {
    title: plan.title.trim() || "Übungsplan",
    items: items.map(snapshotItemFromPlanItem),
    exercises: exercises.filter((exercise) => usedIds.has(exercise.id) && !exercise.isSystem),
  };
}

export type AcceptInviteInput = {
  invite: Pick<PlanInvite, "id" | "fromUserId" | "fromName" | "fromEmail" | "planSnapshot">;
  recipientId: string;
  existingPlanIds: string[];
  existingExerciseIds: string[];
  now: string;
  createId: (prefix: string) => string;
};

export type AcceptInviteResult = {
  plan: TrainingPlan;
  items: PlanItem[];
  exercisesToSave: Exercise[];
  exerciseIdMap: Record<string, string>;
};

function nextUniqueId(prefix: string, taken: Set<string>, createId: (prefix: string) => string): string {
  let id = createId(prefix);
  while (taken.has(id)) id = createId(prefix);
  taken.add(id);
  return id;
}

export function acceptInviteToNewPlan(input: AcceptInviteInput): AcceptInviteResult {
  const takenPlanIds = new Set(input.existingPlanIds);
  const takenExerciseIds = new Set(input.existingExerciseIds);
  const exerciseIdMap: Record<string, string> = {};
  const exercisesToSave: Exercise[] = [];

  for (const exercise of input.invite.planSnapshot.exercises) {
    const newId = nextUniqueId("ex", takenExerciseIds, input.createId);
    exerciseIdMap[exercise.id] = newId;
    exercisesToSave.push({
      ...exercise,
      id: newId,
      isSystem: false,
      source: exercise.source?.type === "catalog" ? { type: "user", label: exercise.source.label } : exercise.source,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  const planId = nextUniqueId("plan", takenPlanIds, input.createId);
  const title = input.invite.planSnapshot.title.trim() || "Empfangener Plan";
  const plan: TrainingPlan = {
    id: planId,
    title,
    createdById: input.invite.fromUserId,
    createdByName: input.invite.fromName,
    createdByEmail: input.invite.fromEmail,
    source: "received",
    acceptedFromInviteId: input.invite.id,
    archived: false,
    createdAt: input.now,
  };

  const takenItemIds = new Set<string>();
  const items: PlanItem[] = input.invite.planSnapshot.items.map((item) => ({
    id: nextUniqueId("planitem", takenItemIds, input.createId),
    planId,
    exerciseId: exerciseIdMap[item.exerciseId] ?? item.exerciseId,
    enabled: item.enabled,
    rhythm: item.rhythm,
    durationSec: item.durationSec,
    reps: item.reps,
    reminderTime: item.reminderTime,
    keepUntil: item.keepUntil ?? null,
    createdAt: input.now,
  }));

  return { plan, items, exercisesToSave, exerciseIdMap };
}

export function otherPlansUntouched(existingPlanIds: string[], createdPlanId: string): boolean {
  return existingPlanIds.every((id) => id !== createdPlanId);
}
