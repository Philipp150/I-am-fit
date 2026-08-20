"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { getDb } from "@/lib/db";
import { isCloudEnabled } from "@/lib/env";
import { subscribeData } from "@/lib/notify";
import {
  currentUser,
  getExercise,
  getProfile,
  listCategories,
  listComplaints,
  listCompletions,
  listExercises,
  listPlanItems,
  type SessionUser,
} from "@/lib/repository";
import type { Category, Complaint, Completion, Exercise, PlanItem, Profile } from "@/lib/types";

const EMPTY_EXERCISES: Exercise[] = [];
const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_COMPLAINTS: Complaint[] = [];
const EMPTY_PLAN: PlanItem[] = [];
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

export function usePlanItems(): PlanItem[] {
  const local = useLiveQuery(() => (isCloudEnabled() ? Promise.resolve(EMPTY_PLAN) : getDb().planItems.toArray()), []) ?? EMPTY_PLAN;
  const remote = useCloudQuery(listPlanItems, EMPTY_PLAN, []);
  return isCloudEnabled() ? remote : local;
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
