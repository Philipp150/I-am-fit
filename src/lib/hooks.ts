"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { getDb } from "@/lib/db";
import { isCloudEnabled } from "@/lib/env";
import { subscribeData } from "@/lib/notify";
import {
  currentUser,
  getExercise,
  getPlan,
  getProfile,
  listActivePlanItems,
  listCategories,
  listComplaints,
  listCompletions,
  listExercises,
  listPendingInvites,
  listPlanItemsForPlan,
  listPlans,
  type SessionUser,
} from "@/lib/repository";
import type { Category, Complaint, Completion, Exercise, PlanInvite, PlanItem, Profile, TrainingPlan } from "@/lib/types";

const EMPTY_EXERCISES: Exercise[] = [];
const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_COMPLAINTS: Complaint[] = [];
const EMPTY_PLAN: PlanItem[] = [];
const EMPTY_PLANS: TrainingPlan[] = [];
const EMPTY_INVITES: PlanInvite[] = [];
const EMPTY_COMPLETIONS: Completion[] = [];

function useCloudQuery<T>(loader: () => Promise<T>, fallback: T, deps: unknown[]): T {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    if (!isCloudEnabled()) return;
    let active = true;
    const load = () => {
      loader()
        .then((next) => {
          if (active) setValue(next);
        })
        .catch(() => {
          if (active) setValue(fallback);
        });
    };
    load();
    const unsubscribe = subscribeData(load);
    return () => {
      active = false;
      unsubscribe();
    };
    // loader/fallback are stable enough when callers pass module functions or wrap id in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

export function useSession(): SessionUser | null | undefined {
  const remote = useCloudQuery(currentUser, null, []);
  if (!isCloudEnabled()) return { id: "solo" };
  return remote;
}

export function useExercises(): Exercise[] {
  const local =
    useLiveQuery(() => (isCloudEnabled() ? Promise.resolve(EMPTY_EXERCISES) : getDb().exercises.orderBy("title").toArray()), []) ??
    EMPTY_EXERCISES;
  const remote = useCloudQuery(listExercises, EMPTY_EXERCISES, []);
  return isCloudEnabled() ? remote : local;
}

export function useExercise(id: string | undefined): Exercise | undefined {
  const local = useLiveQuery(() => (isCloudEnabled() || !id ? undefined : getDb().exercises.get(id)), [id]);
  const remote = useCloudQuery(() => (id ? getExercise(id) : Promise.resolve(undefined)), undefined, [id]);
  return isCloudEnabled() ? remote : local;
}

export function useCategories(): Category[] {
  const local =
    useLiveQuery(() => (isCloudEnabled() ? Promise.resolve(EMPTY_CATEGORIES) : getDb().categories.toArray()), []) ?? EMPTY_CATEGORIES;
  const remote = useCloudQuery(listCategories, EMPTY_CATEGORIES, []);
  return isCloudEnabled() ? remote : local;
}

export function useComplaints(): Complaint[] {
  const local =
    useLiveQuery(() => (isCloudEnabled() ? Promise.resolve(EMPTY_COMPLAINTS) : getDb().complaints.toArray()), []) ?? EMPTY_COMPLAINTS;
  const remote = useCloudQuery(listComplaints, EMPTY_COMPLAINTS, []);
  return isCloudEnabled() ? remote : local;
}

export function usePlans(): TrainingPlan[] {
  const local = useLiveQuery(() => (isCloudEnabled() ? Promise.resolve(EMPTY_PLANS) : getDb().plans.toArray()), []) ?? EMPTY_PLANS;
  const remote = useCloudQuery(listPlans, EMPTY_PLANS, []);
  return isCloudEnabled() ? remote : local;
}

export function usePlan(id: string | undefined): TrainingPlan | undefined {
  const local = useLiveQuery(() => (isCloudEnabled() || !id ? undefined : getDb().plans.get(id)), [id]);
  const remote = useCloudQuery(() => (id ? getPlan(id) : Promise.resolve(undefined)), undefined, [id]);
  return isCloudEnabled() ? remote : local;
}

export function usePlanItemsFor(planId: string | undefined): PlanItem[] {
  const local =
    useLiveQuery(
      () => (isCloudEnabled() || !planId ? Promise.resolve(EMPTY_PLAN) : getDb().planItems.where("planId").equals(planId).toArray()),
      [planId],
    ) ?? EMPTY_PLAN;
  const remote = useCloudQuery(() => (planId ? listPlanItemsForPlan(planId) : Promise.resolve(EMPTY_PLAN)), EMPTY_PLAN, [planId]);
  return isCloudEnabled() ? remote : local;
}

export function usePlanItems(): PlanItem[] {
  const local =
    useLiveQuery(async () => {
      if (isCloudEnabled()) return EMPTY_PLAN;
      const db = getDb();
      const profile = await db.profile.get("solo");
      if (!profile?.activePlanId) return db.planItems.toArray();
      return db.planItems.where("planId").equals(profile.activePlanId).toArray();
    }, []) ?? EMPTY_PLAN;
  const remote = useCloudQuery(listActivePlanItems, EMPTY_PLAN, []);
  return isCloudEnabled() ? remote : local;
}

export function usePendingInvites(): PlanInvite[] {
  const remote = useCloudQuery(listPendingInvites, EMPTY_INVITES, []);
  return isCloudEnabled() ? remote : EMPTY_INVITES;
}

export function useCompletions(): Completion[] {
  const local =
    useLiveQuery(
      () => (isCloudEnabled() ? Promise.resolve(EMPTY_COMPLETIONS) : getDb().completions.orderBy("completedAt").reverse().toArray()),
      [],
    ) ?? EMPTY_COMPLETIONS;
  const remote = useCloudQuery(listCompletions, EMPTY_COMPLETIONS, []);
  return isCloudEnabled() ? remote : local;
}

export function useProfile(): Profile | undefined {
  const local = useLiveQuery(() => (isCloudEnabled() ? undefined : getDb().profile.get("solo")), []);
  const remote = useCloudQuery(getProfile, undefined, []);
  return isCloudEnabled() ? remote : local;
}

export function useActivePlan(): TrainingPlan | undefined {
  const plans = usePlans();
  const profile = useProfile();
  return plans.find((plan) => plan.id === profile?.activePlanId && !plan.archived);
}
