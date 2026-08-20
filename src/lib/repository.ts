import { ensureSeeded, getDb, newId } from "./db";
import { isCloudEnabled } from "./env";
import {
  completionFromRow,
  exerciseFromRow,
  exerciseToRow,
  planFromRow,
  planToRow,
  profileFromRow,
  type CompletionRow,
  type ExerciseRow,
  type PlanRow,
  type ProfileRow,
} from "./mappers";
import { notifyData } from "./notify";
import { createBrowserSupabase } from "./supabase/client";
import type { Category, Complaint, Completion, Exercise, PlanItem, Profile } from "./types";

export { newId };

export type SessionUser = { id: string; email?: string };

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  description: string;
  is_system: boolean;
};

type ComplaintRow = {
  id: string;
  name: string;
  summary: string;
  hint: string;
};

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function currentUser(): Promise<SessionUser | null> {
  if (!isCloudEnabled()) return { id: "solo" };
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase.auth.getUser();
  throwIfError(error);
  if (!data.user) return null;
  return { id: data.user.id, email: data.user.email };
}

export async function bootstrap(): Promise<void> {
  if (isCloudEnabled()) return;
  await ensureSeeded();
}

export async function listCategories(): Promise<Category[]> {
  if (!isCloudEnabled()) return getDb().categories.toArray();
  const { data, error } = await createBrowserSupabase().from("categories").select("*").order("name");
  throwIfError(error);
  return ((data ?? []) as CategoryRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    parentId: row.parent_id,
    description: row.description,
    isSystem: row.is_system,
  }));
}

export async function listComplaints(): Promise<Complaint[]> {
  if (!isCloudEnabled()) return getDb().complaints.toArray();
  const { data, error } = await createBrowserSupabase().from("complaints").select("*").order("name");
  throwIfError(error);
  return ((data ?? []) as ComplaintRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    summary: row.summary,
    hint: row.hint,
  }));
}

export async function listExercises(): Promise<Exercise[]> {
  if (!isCloudEnabled()) return getDb().exercises.orderBy("title").toArray();
  const { data, error } = await createBrowserSupabase().from("exercises").select("*").order("title");
  throwIfError(error);
  return ((data ?? []) as ExerciseRow[]).map(exerciseFromRow);
}

export async function getExercise(id: string): Promise<Exercise | undefined> {
  if (!isCloudEnabled()) return getDb().exercises.get(id);
  const { data, error } = await createBrowserSupabase().from("exercises").select("*").eq("id", id).maybeSingle();
  throwIfError(error);
  return data ? exerciseFromRow(data as ExerciseRow) : undefined;
}

export async function saveExercise(exercise: Exercise): Promise<void> {
  if (!isCloudEnabled()) {
    await getDb().exercises.put(exercise);
    notifyData();
    return;
  }
  const user = await currentUser();
  if (!user) throw new Error("Bitte zuerst anmelden, um eigene Übungen zu speichern.");
  const { error } = await createBrowserSupabase().from("exercises").upsert(exerciseToRow(exercise, user.id));
  throwIfError(error);
  notifyData();
}

export async function deleteExercise(id: string): Promise<void> {
  if (!isCloudEnabled()) {
    const db = getDb();
    await db.exercises.delete(id);
    const related = await db.planItems.where("exerciseId").equals(id).toArray();
    await db.planItems.bulkDelete(related.map((item) => item.id));
    notifyData();
    return;
  }
  const { error } = await createBrowserSupabase().from("exercises").delete().eq("id", id);
  throwIfError(error);
  notifyData();
}

export async function listPlanItems(): Promise<PlanItem[]> {
  if (!isCloudEnabled()) return getDb().planItems.toArray();
  const user = await currentUser();
  if (!user) return [];
  const { data, error } = await createBrowserSupabase().from("plan_items").select("*").order("created_at");
  throwIfError(error);
  return ((data ?? []) as PlanRow[]).map(planFromRow);
}

export async function savePlanItem(item: PlanItem): Promise<void> {
  if (!isCloudEnabled()) {
    await getDb().planItems.put(item);
    notifyData();
    return;
  }
  const user = await currentUser();
  if (!user) throw new Error("Bitte zuerst anmelden, um den Plan zu speichern.");
  const { error } = await createBrowserSupabase().from("plan_items").upsert(planToRow(item, user.id));
  throwIfError(error);
  notifyData();
}

export async function deletePlanItem(id: string): Promise<void> {
  if (!isCloudEnabled()) {
    await getDb().planItems.delete(id);
    notifyData();
    return;
  }
  const { error } = await createBrowserSupabase().from("plan_items").delete().eq("id", id);
  throwIfError(error);
  notifyData();
}

export async function listCompletions(): Promise<Completion[]> {
  if (!isCloudEnabled()) return getDb().completions.orderBy("completedAt").reverse().toArray();
  const user = await currentUser();
  if (!user) return [];
  const { data, error } = await createBrowserSupabase()
    .from("completions")
    .select("*")
    .order("completed_at", { ascending: false });
  throwIfError(error);
  return ((data ?? []) as CompletionRow[]).map(completionFromRow);
}

export async function addCompletion(item: Completion): Promise<void> {
  if (!isCloudEnabled()) {
    await getDb().completions.add(item);
    notifyData();
    return;
  }
  const user = await currentUser();
  if (!user) throw new Error("Bitte zuerst anmelden.");
  const { error } = await createBrowserSupabase().from("completions").insert({
    id: item.id,
    owner_id: user.id,
    exercise_id: item.exerciseId,
    plan_item_id: item.planItemId ?? null,
    completed_at: item.completedAt,
    duration_sec: item.durationSec ?? null,
    skipped: Boolean(item.skipped),
  });
  throwIfError(error);
  notifyData();
}

export async function getProfile(): Promise<Profile | undefined> {
  if (!isCloudEnabled()) return getDb().profile.get("solo");
  const user = await currentUser();
  if (!user) return undefined;
  const { data, error } = await createBrowserSupabase().from("profiles").select("*").eq("id", user.id).maybeSingle();
  throwIfError(error);
  return data ? profileFromRow(data as ProfileRow) : undefined;
}

export async function saveProfile(profile: Profile): Promise<void> {
  if (!isCloudEnabled()) {
    await getDb().profile.put(profile);
    notifyData();
    return;
  }
  const user = await currentUser();
  if (!user) throw new Error("Bitte zuerst anmelden.");
  const { error } = await createBrowserSupabase().from("profiles").upsert({
    id: user.id,
    display_name: profile.displayName,
    reminder_enabled: profile.reminderEnabled,
    reminder_time: profile.reminderTime,
    created_at: profile.createdAt,
  });
  throwIfError(error);
  notifyData();
}

export async function requestMagicLink(email: string): Promise<void> {
  const supabase = createBrowserSupabase();
  const origin = typeof window !== "undefined" ? window.location.origin : siteOrigin();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
  throwIfError(error);
}

export async function signOut(): Promise<void> {
  if (!isCloudEnabled()) return;
  const { error } = await createBrowserSupabase().auth.signOut();
  throwIfError(error);
  notifyData();
}

function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}
