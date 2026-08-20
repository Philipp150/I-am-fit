"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import type { Category, Complaint, Completion, Exercise, PlanItem, Profile } from "@/lib/types";

export function useExercises(): Exercise[] {
  return useLiveQuery(() => getDb().exercises.orderBy("title").toArray(), []) ?? [];
}

export function useExercise(id: string | undefined): Exercise | undefined {
  return useLiveQuery(() => (id ? getDb().exercises.get(id) : undefined), [id]);
}

export function useCategories(): Category[] {
  return useLiveQuery(() => getDb().categories.toArray(), []) ?? [];
}

export function useComplaints(): Complaint[] {
  return useLiveQuery(() => getDb().complaints.toArray(), []) ?? [];
}

export function usePlanItems(): PlanItem[] {
  return useLiveQuery(() => getDb().planItems.toArray(), []) ?? [];
}

export function useCompletions(): Completion[] {
  return useLiveQuery(() => getDb().completions.orderBy("completedAt").reverse().toArray(), []) ?? [];
}

export function useProfile(): Profile | undefined {
  return useLiveQuery(() => getDb().profile.get("solo"), []);
}
