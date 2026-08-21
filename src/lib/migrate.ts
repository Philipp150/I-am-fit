import { getDb } from "./db";
import { isCloudEnabled } from "./env";
import { addCompletion, currentUser, getProfile, saveExercise, savePlanItem, saveProfile } from "./repository";
import type { Completion, Exercise, PlanItem, Profile } from "./types";

export type LocalUserState = {
  exercises: Exercise[];
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
  const [exercises, planItems, completions, profile] = await Promise.all([
    db.exercises.toArray(),
    db.planItems.toArray(),
    db.completions.toArray(),
    db.profile.get("solo"),
  ]);
  return {
    exercises: exercises.filter((exercise) => !exercise.isSystem),
    planItems,
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
