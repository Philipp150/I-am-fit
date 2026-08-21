"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { getDb, listLocalExercises } from "@/lib/db";
import { isCloudEnabled } from "@/lib/env";
import { pickCachedList, pickCachedOne } from "@/lib/offline";
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

type QueryStatus = "pending" | "ok" | "error";

function useCloudQuery<T>(loader: () => Promise<T>, fallback: T, deps: unknown[]): { data: T; status: QueryStatus } {
  const [data, setData] = useState<T>(fallback);
  const [status, setStatus] = useState<QueryStatus>(() => (isCloudEnabled() ? "pending" : "ok"));
  useEffect(() => {
    if (!isCloudEnabled()) return;
    let active = true;
    const load = () => {
      loader()
        .then((next) => {
          if (active) {
            setData(next);
            setStatus("ok");
          }
        })
        .catch(() => {
          if (active) setStatus((prev) => (prev === "ok" ? "ok" : "error"));
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
  return { data, status };
}

function useSafeLiveQuery<T>(query: () => Promise<T> | T, fallback: T, deps: unknown[]): T {
  return (
    useLiveQuery(async () => {
      try {
        return await query();
      } catch {
        return fallback;
      }
    }, deps) ?? fallback
  );
}

function pickList<T>(remote: { data: T[]; status: QueryStatus }, local: T[]): T[] {
  return pickCachedList(isCloudEnabled(), remote, local);
}

function pickOne<T>(remote: { data: T | undefined; status: QueryStatus }, local: T | undefined): T | undefined {
  return pickCachedOne(isCloudEnabled(), remote, local);
}

export function useSession(): SessionUser | null | undefined {
  const remote = useCloudQuery(currentUser, null, []);
  if (!isCloudEnabled()) return { id: "solo" };
  return remote.data;
}

export function useExercises(): Exercise[] {
  const local = useSafeLiveQuery(
    () => (typeof window === "undefined" ? EMPTY_EXERCISES : listLocalExercises()),
    EMPTY_EXERCISES,
    [],
  );
  const remote = useCloudQuery(listExercises, EMPTY_EXERCISES, []);
  return pickList(remote, local);
}

export function useExercise(id: string | undefined): Exercise | undefined {
  const local = useSafeLiveQuery(
    () => (typeof window === "undefined" || !id ? undefined : getDb().exercises.get(id)),
    undefined,
    [id],
  );
  const remote = useCloudQuery(() => (id ? getExercise(id) : Promise.resolve(undefined)), undefined, [id]);
  return pickOne(remote, local);
}

export function useCategories(): Category[] {
  const local = useSafeLiveQuery(
    () => (typeof window === "undefined" ? EMPTY_CATEGORIES : getDb().categories.toArray()),
    EMPTY_CATEGORIES,
    [],
  );
  const remote = useCloudQuery(listCategories, EMPTY_CATEGORIES, []);
  return pickList(remote, local);
}

export function useComplaints(): Complaint[] {
  const local = useSafeLiveQuery(
    () => (typeof window === "undefined" ? EMPTY_COMPLAINTS : getDb().complaints.toArray()),
    EMPTY_COMPLAINTS,
    [],
  );
  const remote = useCloudQuery(listComplaints, EMPTY_COMPLAINTS, []);
  return pickList(remote, local);
}

export function usePlans(): TrainingPlan[] {
  const local = useSafeLiveQuery(
    () => (typeof window === "undefined" ? EMPTY_PLANS : getDb().plans.toArray()),
    EMPTY_PLANS,
    [],
  );
  const remote = useCloudQuery(listPlans, EMPTY_PLANS, []);
  return pickList(remote, local);
}

export function usePlan(id: string | undefined): TrainingPlan | undefined {
  const local = useSafeLiveQuery(
    () => (typeof window === "undefined" || !id ? undefined : getDb().plans.get(id)),
    undefined,
    [id],
  );
  const remote = useCloudQuery(() => (id ? getPlan(id) : Promise.resolve(undefined)), undefined, [id]);
  return pickOne(remote, local);
}

export function usePlanItemsFor(planId: string | undefined): PlanItem[] {
  const local = useSafeLiveQuery(
    () =>
      typeof window === "undefined" || !planId
        ? Promise.resolve(EMPTY_PLAN)
        : getDb().planItems.where("planId").equals(planId).toArray(),
    EMPTY_PLAN,
    [planId],
  );
  const remote = useCloudQuery(() => (planId ? listPlanItemsForPlan(planId) : Promise.resolve(EMPTY_PLAN)), EMPTY_PLAN, [planId]);
  return pickList(remote, local);
}

export function usePlanItems(): PlanItem[] {
  const local = useSafeLiveQuery(
    async () => {
      if (typeof window === "undefined") return EMPTY_PLAN;
      const db = getDb();
      const profiles = await db.profile.toArray();
      const profile = profiles.find((item) => item.activePlanId) ?? profiles[0];
      if (!profile?.activePlanId) return db.planItems.toArray();
      return db.planItems.where("planId").equals(profile.activePlanId).toArray();
    },
    EMPTY_PLAN,
    [],
  );
  const remote = useCloudQuery(listActivePlanItems, EMPTY_PLAN, []);
  return pickList(remote, local);
}

export function usePendingInvites(): PlanInvite[] {
  const remote = useCloudQuery(listPendingInvites, EMPTY_INVITES, []);
  return isCloudEnabled() ? remote.data : EMPTY_INVITES;
}

export function useCompletions(): Completion[] {
  const local = useSafeLiveQuery(
    () =>
      typeof window === "undefined"
        ? EMPTY_COMPLETIONS
        : getDb().completions.orderBy("completedAt").reverse().toArray(),
    EMPTY_COMPLETIONS,
    [],
  );
  const remote = useCloudQuery(listCompletions, EMPTY_COMPLETIONS, []);
  return pickList(remote, local);
}

export function useProfile(): Profile | undefined {
  const local = useSafeLiveQuery(
    async () => {
      if (typeof window === "undefined") return undefined;
      const db = getDb();
      const profiles = await db.profile.toArray();
      if (!isCloudEnabled()) return db.profile.get("solo");
      return profiles.find((item) => item.id !== "solo") ?? profiles[0];
    },
    undefined,
    [],
  );
  const remote = useCloudQuery(getProfile, undefined, []);
  return pickOne(remote, local);
}

export function useActivePlan(): TrainingPlan | undefined {
  const plans = usePlans();
  const profile = useProfile();
  return plans.find((plan) => plan.id === profile?.activePlanId && !plan.archived);
}
