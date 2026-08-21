import {
  addCompletion,
  getProfile,
  listAllPlanItems,
  listCompletions,
  listExercises,
  listPlans,
  saveExercise,
  savePlan,
  savePlanItem,
  saveProfile,
} from "./repository";
import { defaultPersonalPlan, LOCAL_DEFAULT_PLAN_ID } from "./plan-share";
import type { Completion, Exercise, PlanItem, Profile, TrainingPlan } from "./types";

export const BACKUP_VERSION = 2 as const;

export type AppBackup = {
  version: 1 | typeof BACKUP_VERSION;
  exportedAt: string;
  exercises: Exercise[];
  planItems: PlanItem[];
  completions: Completion[];
  profile?: Profile;
  plans?: TrainingPlan[];
};

export function userExercisesOnly(exercises: Exercise[]): Exercise[] {
  return exercises.filter((exercise) => !exercise.isSystem);
}

export function backupFilename(date: Date): string {
  return `i-am-fit-backup-${date.toISOString().slice(0, 10)}.json`;
}

function wrapLegacyItems(planItems: PlanItem[], profile: Profile | undefined): { plans: TrainingPlan[]; planItems: PlanItem[] } {
  const plans: TrainingPlan[] = [
    defaultPersonalPlan(profile?.id ?? "solo", profile?.createdAt ?? new Date().toISOString(), profile?.displayName ?? ""),
  ];
  return {
    plans,
    planItems: planItems.map((item) => ({ ...item, planId: item.planId || LOCAL_DEFAULT_PLAN_ID })),
  };
}

export function buildBackup(
  exercises: Exercise[],
  planItems: PlanItem[],
  completions: Completion[],
  profile: Profile | undefined,
  exportedAt = new Date().toISOString(),
  plans: TrainingPlan[] = [],
): AppBackup {
  return {
    version: BACKUP_VERSION,
    exportedAt,
    exercises: userExercisesOnly(exercises),
    planItems,
    completions,
    profile,
    plans,
  };
}

export function parseBackup(raw: string): AppBackup {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Die Datei ist kein gültiges JSON.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Das Backup hat ein unerwartetes Format.");
  }
  const obj = data as Record<string, unknown>;
  if (obj.version !== 1 && obj.version !== BACKUP_VERSION) {
    throw new Error("Diese Backup-Version wird nicht unterstützt.");
  }
  if (!Array.isArray(obj.exercises) || !Array.isArray(obj.planItems) || !Array.isArray(obj.completions)) {
    throw new Error("Im Backup fehlen Plan, eigene Übungen oder Verlauf.");
  }
  const planItems = obj.planItems as PlanItem[];
  const profile = obj.profile as Profile | undefined;
  const plans = Array.isArray(obj.plans) ? (obj.plans as TrainingPlan[]) : undefined;
  const wrapped = plans && plans.length > 0 ? { plans, planItems } : wrapLegacyItems(planItems, profile);
  return {
    version: obj.version === 1 ? 1 : BACKUP_VERSION,
    exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : new Date().toISOString(),
    exercises: obj.exercises as Exercise[],
    planItems: wrapped.planItems,
    completions: obj.completions as Completion[],
    profile: profile
      ? { ...profile, activePlanId: profile.activePlanId ?? wrapped.plans[0]?.id ?? LOCAL_DEFAULT_PLAN_ID }
      : undefined,
    plans: wrapped.plans,
  };
}

export async function exportCurrentBackup(): Promise<AppBackup> {
  const [exercises, planItems, completions, profile, plans] = await Promise.all([
    listExercises(),
    listAllPlanItems(),
    listCompletions(),
    getProfile(),
    listPlans(),
  ]);
  return buildBackup(exercises, planItems, completions, profile, undefined, plans);
}

export async function restoreBackup(backup: AppBackup): Promise<{ exercises: number; planItems: number; completions: number }> {
  const exercises = userExercisesOnly(backup.exercises);
  for (const exercise of exercises) {
    await saveExercise({ ...exercise, isSystem: false });
  }
  const plans = backup.plans && backup.plans.length > 0 ? backup.plans : wrapLegacyItems(backup.planItems, backup.profile).plans;
  for (const plan of plans) {
    await savePlan(plan);
  }
  for (const item of backup.planItems) {
    await savePlanItem({ ...item, planId: item.planId || plans[0]?.id || LOCAL_DEFAULT_PLAN_ID });
  }
  for (const completion of backup.completions) {
    try {
      await addCompletion(completion);
    } catch {
      // Duplicate ids from a previous restore are ignored.
    }
  }
  if (backup.profile) {
    const existing = await getProfile();
    await saveProfile({
      id: existing?.id ?? backup.profile.id,
      displayName: backup.profile.displayName || existing?.displayName || "",
      reminderEnabled: backup.profile.reminderEnabled,
      reminderTime: backup.profile.reminderTime,
      activePlanId: backup.profile.activePlanId ?? existing?.activePlanId ?? plans[0]?.id ?? null,
      createdAt: existing?.createdAt ?? backup.profile.createdAt,
    });
  }
  return {
    exercises: exercises.length,
    planItems: backup.planItems.length,
    completions: backup.completions.length,
  };
}

export function downloadBackupFile(backup: AppBackup): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = backupFilename(new Date(backup.exportedAt));
  anchor.click();
  URL.revokeObjectURL(url);
}
