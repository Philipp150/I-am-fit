import { addExerciseToPlan } from "./plan";
import { createPlan, ensureActivePlan, listPlanItemsForPlan } from "./repository";
import { isoDate } from "./schedule";
import { suggestExercisesForComplaints } from "./suggestions";
import type { Complaint, Exercise, PlanItem, TrainingPlan } from "./types";

export const ONBOARDING_DISMISS_KEY = "iamfit-onboarding-dismissed";
export const ONBOARDING_REMINDER_KEY = "iamfit-onboarding-reminder-done";
export const ONBOARDING_REMINDER_PENDING_KEY = "iamfit-onboarding-reminder-pending";
export const FIRST_RUN_DURATION_SEC = 60;

export type OnboardingGate = "flow" | "cta" | "hidden";

export type OnboardingThemeKind = "körperregion" | "ziel" | "thema";

export type OnboardingTheme = {
  id: string;
  label: string;
  kind: OnboardingThemeKind;
  starterId: string;
  detail: string;
};

/** First-run chips: Körperregion, Ziel, Thema – never a diagnosis. */
export const ONBOARDING_THEMES: OnboardingTheme[] = [
  {
    id: "comp-neck",
    label: "Nacken",
    kind: "körperregion",
    starterId: "ex-neck-circles",
    detail: "Kleine Bewegungen für Hals und Schultergürtel.",
  },
  {
    id: "comp-back",
    label: "Rücken",
    kind: "körperregion",
    starterId: "ex-cat-cow",
    detail: "Sanft beugen und strecken.",
  },
  {
    id: "comp-belly",
    label: "Bauch",
    kind: "ziel",
    starterId: "ex-belly-wake",
    detail: "Mitte anschalten – Kraft, keine Diagnose.",
  },
  {
    id: "comp-mobility",
    label: "Beweglichkeit",
    kind: "ziel",
    starterId: "ex-morning-reach",
    detail: "Länge und Fließen, eine Minute.",
  },
  {
    id: "comp-office",
    label: "Büro",
    kind: "thema",
    starterId: "ex-desk-break",
    detail: "Zwischendurch am Schreibtisch.",
  },
];

export function enabledPlanItems(items: PlanItem[]): PlanItem[] {
  return items.filter((item) => item.enabled);
}

export function shouldShowOnboarding(planItems: PlanItem[], dismissed: boolean): OnboardingGate {
  if (enabledPlanItems(planItems).length > 0) return "hidden";
  return dismissed ? "cta" : "flow";
}

function storageFlagFrom(storage: Pick<Storage, "getItem"> | null | undefined, key: string): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function onboardingDismissedFrom(storage: Pick<Storage, "getItem"> | null | undefined): boolean {
  return storageFlagFrom(storage, ONBOARDING_DISMISS_KEY);
}

export function reminderAffordanceDoneFrom(storage: Pick<Storage, "getItem"> | null | undefined): boolean {
  return storageFlagFrom(storage, ONBOARDING_REMINDER_KEY);
}

export function reminderAffordancePendingFrom(storage: Pick<Storage, "getItem"> | null | undefined): boolean {
  return storageFlagFrom(storage, ONBOARDING_REMINDER_PENDING_KEY);
}

export function writeStorageFlag(storage: Pick<Storage, "setItem"> | null | undefined, key: string): void {
  if (!storage) return;
  try {
    storage.setItem(key, "1");
  } catch {
    // Private mode or missing storage – the UI still works for this session.
  }
}

export function clearStorageFlag(storage: Pick<Storage, "removeItem"> | null | undefined, key: string): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
}

export function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function pickFirstRunExercise(themeId: string, exercises: Exercise[]): Exercise | undefined {
  const theme = ONBOARDING_THEMES.find((item) => item.id === themeId);
  if (theme) {
    const starter = exercises.find((exercise) => exercise.id === theme.starterId);
    if (starter) return starter;
  }
  return suggestExercisesForComplaints([themeId], exercises)[0];
}

export function firstRunPlanOverrides(now = new Date()) {
  return {
    durationSec: FIRST_RUN_DURATION_SEC,
    keepUntil: null as null,
    rhythm: { kind: "daily" as const, startDate: isoDate(now) },
  };
}

export function orderedThemes(complaints: Complaint[]): Complaint[] {
  const featured = ONBOARDING_THEMES.map((theme) => theme.id);
  const byId = new Map(complaints.map((item) => [item.id, item]));
  const first = featured.map((id) => byId.get(id)).filter((item): item is Complaint => Boolean(item));
  const rest = complaints.filter((item) => !featured.includes(item.id));
  return [...first, ...rest];
}

export type SeedOnboardingResult =
  | { seeded: true; exerciseIds: string[]; itemIds: string[] }
  | { seeded: false; reason: "existing-plan"; exerciseIds: string[] };

export type SeedOnboardingDeps = {
  ensureActivePlan: () => Promise<TrainingPlan>;
  listItemsForPlan: (planId: string) => Promise<PlanItem[]>;
  createPlan: (title: string, activate?: boolean) => Promise<TrainingPlan>;
  addToPlan: typeof addExerciseToPlan;
  today?: Date;
};

const defaultSeedDeps: SeedOnboardingDeps = {
  ensureActivePlan,
  listItemsForPlan: listPlanItemsForPlan,
  createPlan,
  addToPlan: addExerciseToPlan,
};

export async function seedOnboardingPlan(
  exercises: Exercise[],
  deps: SeedOnboardingDeps = defaultSeedDeps,
): Promise<SeedOnboardingResult> {
  const plan = await deps.ensureActivePlan();
  const existing = enabledPlanItems(await deps.listItemsForPlan(plan.id));
  if (existing.length > 0) {
    return {
      seeded: false,
      reason: "existing-plan",
      exerciseIds: existing.map((item) => item.exerciseId),
    };
  }

  let planId = plan.id;
  if (plan.source === "received") {
    const writable = await deps.createPlan("Mein Plan", true);
    planId = writable.id;
  }

  const overrides = firstRunPlanOverrides(deps.today ?? new Date());
  const itemIds: string[] = [];
  for (const exercise of exercises) {
    const id = await deps.addToPlan(exercise, {
      planId,
      ...overrides,
    });
    itemIds.push(id);
  }
  return { seeded: true, exerciseIds: exercises.map((exercise) => exercise.id), itemIds };
}
