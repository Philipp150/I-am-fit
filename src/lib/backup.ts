import { addCompletion, getProfile, listCompletions, listExercises, listPlanItems, saveExercise, savePlanItem, saveProfile } from "./repository";
import type { Completion, Exercise, PlanItem, Profile } from "./types";

export const BACKUP_VERSION = 1 as const;

export type AppBackup = {
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  exercises: Exercise[];
  planItems: PlanItem[];
  completions: Completion[];
  profile?: Profile;
};

export function userExercisesOnly(exercises: Exercise[]): Exercise[] {
  return exercises.filter((exercise) => !exercise.isSystem);
}

export function backupFilename(date: Date): string {
  return `i-am-fit-backup-${date.toISOString().slice(0, 10)}.json`;
}

export function buildBackup(
  exercises: Exercise[],
  planItems: PlanItem[],
  completions: Completion[],
  profile: Profile | undefined,
  exportedAt = new Date().toISOString(),
): AppBackup {
  return {
    version: BACKUP_VERSION,
    exportedAt,
    exercises: userExercisesOnly(exercises),
    planItems,
    completions,
    profile,
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
  if (obj.version !== BACKUP_VERSION) {
    throw new Error("Diese Backup-Version wird nicht unterstützt.");
  }
  if (!Array.isArray(obj.exercises) || !Array.isArray(obj.planItems) || !Array.isArray(obj.completions)) {
    throw new Error("Im Backup fehlen Plan, eigene Übungen oder Verlauf.");
  }
  return {
    version: BACKUP_VERSION,
    exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : new Date().toISOString(),
    exercises: obj.exercises as Exercise[],
    planItems: obj.planItems as PlanItem[],
    completions: obj.completions as Completion[],
    profile: obj.profile as Profile | undefined,
  };
}

export async function exportCurrentBackup(): Promise<AppBackup> {
  const [exercises, planItems, completions, profile] = await Promise.all([
    listExercises(),
    listPlanItems(),
    listCompletions(),
    getProfile(),
  ]);
  return buildBackup(exercises, planItems, completions, profile);
}

export async function restoreBackup(backup: AppBackup): Promise<{ exercises: number; planItems: number; completions: number }> {
  const exercises = userExercisesOnly(backup.exercises);
  for (const exercise of exercises) {
    await saveExercise({ ...exercise, isSystem: false });
  }
  for (const item of backup.planItems) {
    await savePlanItem(item);
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
