import { getDb } from "./db";
import { isCloudEnabled } from "./env";
import { addCompletion, currentUser, getProfile, saveExercise, savePlan, savePlanItem, saveProfile } from "./repository";
import { defaultPersonalPlan, LOCAL_DEFAULT_PLAN_ID } from "./plan-share";
import type { Completion, Exercise, PlanItem, Profile, TrainingPlan } from "./types";

export type LocalUserState = {
  exercises: Exercise[];
  plans: TrainingPlan[];
  planItems: PlanItem[];
  completions: Completion[];
  profile?: Profile;
};

export type LocalStateSummary = {
  exercises: number;
  planItems: number;
  completions: number;
  hasData: boolean;
};

export async function readLocalUserState(): Promise<LocalUserState> {
  const db = getDb();
  const [exercises, plans, planItems, completions, profile] = await Promise.all([
    db.exercises.toArray(),
    db.plans.toArray(),
    db.planItems.toArray(),
    db.completions.toArray(),
    db.profile.get("solo"),
  ]);
  const namedPlans =
    plans.length > 0
      ? plans
      : [defaultPersonalPlan("solo", profile?.createdAt ?? new Date().toISOString(), profile?.displayName ?? "")];
  return {
    exercises: exercises.filter((exercise) => !exercise.isSystem),
    plans: namedPlans,
    planItems: planItems.map((item) => ({ ...item, planId: item.planId || namedPlans[0]?.id || LOCAL_DEFAULT_PLAN_ID })),
    completions,
    profile,
  };
}

export async function localStateSummary(): Promise<LocalStateSummary> {
  const local = await readLocalUserState();
  return {
    exercises: local.exercises.length,
    planItems: local.planItems.length,
    completions: local.completions.length,
    hasData: local.exercises.length + local.planItems.length + local.completions.length > 0,
  };
}

export async function migrateLocalToCloud(): Promise<LocalStateSummary> {
  if (!isCloudEnabled()) {
    throw new Error("Cloud-Sync ist hier nicht eingerichtet.");
  }
  const user = await currentUser();
  if (!user || user.id === "solo") {
    throw new Error("Bitte zuerst in der Cloud anmelden.");
  }
  const local = await readLocalUserState();
  for (const exercise of local.exercises) {
    await saveExercise({ ...exercise, isSystem: false });
  }
  for (const plan of local.plans) {
    await savePlan({
      ...plan,
      createdById: plan.createdById === "solo" ? user.id : plan.createdById,
      createdByEmail: plan.createdByEmail || user.email || "",
    });
  }
  for (const item of local.planItems) {
    await savePlanItem(item);
  }
  for (const completion of local.completions) {
    try {
      await addCompletion(completion);
    } catch {
      // Already present in the account.
    }
  }
  if (local.profile) {
    const existing = await getProfile();
    await saveProfile({
      id: user.id,
      displayName: existing?.displayName || local.profile.displayName,
      reminderEnabled: existing?.reminderEnabled ?? local.profile.reminderEnabled,
      reminderTime: existing?.reminderTime || local.profile.reminderTime,
      activePlanId: existing?.activePlanId ?? local.profile.activePlanId ?? local.plans[0]?.id ?? null,
      createdAt: existing?.createdAt ?? local.profile.createdAt,
    });
  }
  return {
    exercises: local.exercises.length,
    planItems: local.planItems.length,
    completions: local.completions.length,
    hasData: true,
  };
}
