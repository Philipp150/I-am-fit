import { ensureCatalogSeeded, ensureSeeded, getDb, newId } from "./db";
import { isCloudEnabled } from "./env";
import {
  completionFromRow,
  exerciseFromRow,
  exerciseToRow,
  planFromRow,
  planInviteFromRow,
  planInviteToRow,
  planToRow,
  profileFromRow,
  trainingPlanFromRow,
  trainingPlanToRow,
  type CompletionRow,
  type ExerciseRow,
  type PlanInviteRow,
  type PlanRow,
  type ProfileRow,
  type TrainingPlanRow,
} from "./mappers";
import { notifyData } from "./notify";
import {
  acceptInviteToNewPlan,
  defaultPersonalPlan,
  isValidEmail,
  LOCAL_DEFAULT_PLAN_ID,
  normalizeEmail,
  snapshotFromPlan,
} from "./plan-share";
import { createBrowserSupabase } from "./supabase/client";
import type { Category, Complaint, Completion, Exercise, PlanInvite, PlanItem, Profile, TrainingPlan } from "./types";

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

function safeNextPath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  return path;
}

export async function currentUser(): Promise<SessionUser | null> {
  if (!isCloudEnabled()) return { id: "solo" };
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase.auth.getUser();
  throwIfError(error);
  if (!data.user) return null;
  return { id: data.user.id, email: data.user.email };
}

function remember(write: () => Promise<unknown>): void {
  if (typeof window === "undefined") return;
  void write().catch(() => undefined);
}

export async function bootstrap(): Promise<void> {
  if (!isCloudEnabled()) {
    await ensureSeeded();
    return;
  }
  await ensureCatalogSeeded();
  await hydrateOfflineFromCloud();
}

async function hydrateOfflineFromCloud(): Promise<void> {
  try {
    await Promise.all([listCategories(), listComplaints(), listExercises()]);
  } catch {
    // Catalog seed in Dexie is enough to practice offline.
  }
  try {
    const user = await currentUser();
    if (!user) return;
    await Promise.all([listPlans(), listAllPlanItems(), listCompletions(), getProfile()]);
  } catch {
    // Plan/Heute fall back to the last Dexie snapshot.
  }
}

export async function listCategories(): Promise<Category[]> {
  if (!isCloudEnabled()) return getDb().categories.toArray();
  const { data, error } = await createBrowserSupabase().from("categories").select("*").order("name");
  throwIfError(error);
  const items = ((data ?? []) as CategoryRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    parentId: row.parent_id,
    description: row.description,
    isSystem: row.is_system,
  }));
  if (items.length > 0) remember(() => getDb().categories.bulkPut(items));
  return items;
}

export async function listComplaints(): Promise<Complaint[]> {
  if (!isCloudEnabled()) return getDb().complaints.toArray();
  const { data, error } = await createBrowserSupabase().from("complaints").select("*").order("name");
  throwIfError(error);
  const items = ((data ?? []) as ComplaintRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    summary: row.summary,
    hint: row.hint,
  }));
  if (items.length > 0) remember(() => getDb().complaints.bulkPut(items));
  return items;
}

export async function listExercises(): Promise<Exercise[]> {
  if (!isCloudEnabled()) return getDb().exercises.orderBy("title").toArray();
  const { data, error } = await createBrowserSupabase().from("exercises").select("*").order("title");
  throwIfError(error);
  const items = ((data ?? []) as ExerciseRow[]).map(exerciseFromRow);
  if (items.length > 0) remember(() => getDb().exercises.bulkPut(items));
  return items;
}

export async function getExercise(id: string): Promise<Exercise | undefined> {
  if (!isCloudEnabled()) return getDb().exercises.get(id);
  const { data, error } = await createBrowserSupabase().from("exercises").select("*").eq("id", id).maybeSingle();
  throwIfError(error);
  const exercise = data ? exerciseFromRow(data as ExerciseRow) : undefined;
  if (exercise) remember(() => getDb().exercises.put(exercise));
  return exercise;
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
  remember(() => getDb().exercises.put(exercise));
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
  remember(() => getDb().exercises.delete(id));
  notifyData();
}

export async function listPlans(): Promise<TrainingPlan[]> {
  if (!isCloudEnabled()) {
    await ensureSeeded();
    const plans = await getDb().plans.toArray();
    return plans.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const user = await currentUser();
  if (!user) return [];
  const { data, error } = await createBrowserSupabase().from("plans").select("*").order("created_at", { ascending: false });
  throwIfError(error);
  const items = ((data ?? []) as TrainingPlanRow[]).map(trainingPlanFromRow);
  if (items.length > 0) remember(() => getDb().plans.bulkPut(items));
  return items;
}

export async function getPlan(id: string): Promise<TrainingPlan | undefined> {
  if (!isCloudEnabled()) return getDb().plans.get(id);
  const user = await currentUser();
  if (!user) return undefined;
  const { data, error } = await createBrowserSupabase().from("plans").select("*").eq("id", id).maybeSingle();
  throwIfError(error);
  const plan = data ? trainingPlanFromRow(data as TrainingPlanRow) : undefined;
  if (plan) remember(() => getDb().plans.put(plan));
  return plan;
}

export async function savePlan(plan: TrainingPlan): Promise<void> {
  if (!isCloudEnabled()) {
    await getDb().plans.put(plan);
    notifyData();
    return;
  }
  const user = await currentUser();
  if (!user) throw new Error("Bitte zuerst anmelden, um Pläne zu speichern.");
  const { error } = await createBrowserSupabase().from("plans").upsert(trainingPlanToRow(plan, user.id));
  throwIfError(error);
  remember(() => getDb().plans.put(plan));
  notifyData();
}

async function creatorFields(user: SessionUser): Promise<{ createdById: string; createdByName: string; createdByEmail: string }> {
  const profile = await getProfile();
  return {
    createdById: user.id,
    createdByName: profile?.displayName?.trim() || "",
    createdByEmail: user.email ?? "",
  };
}

export async function createPlan(title: string, activate = false): Promise<TrainingPlan> {
  const user = await currentUser();
  if (isCloudEnabled() && !user) throw new Error("Bitte zuerst anmelden, um einen Plan anzulegen.");
  const creator = user ? await creatorFields(user) : { createdById: "solo", createdByName: "", createdByEmail: "" };
  const plan: TrainingPlan = {
    id: newId("plan"),
    title: title.trim() || "Neuer Plan",
    ...creator,
    source: "self",
    acceptedFromInviteId: null,
    archived: false,
    createdAt: new Date().toISOString(),
  };
  await savePlan(plan);
  if (activate) await setActivePlan(plan.id);
  else {
    const profile = await getProfile();
    if (!profile?.activePlanId) await setActivePlan(plan.id);
  }
  return plan;
}

export async function archivePlan(id: string): Promise<void> {
  const plan = await getPlan(id);
  if (!plan) return;
  await savePlan({ ...plan, archived: true });
  const profile = await getProfile();
  if (profile?.activePlanId === id) {
    const next = (await listPlans()).find((item) => item.id !== id && !item.archived);
    await setActivePlan(next?.id ?? null);
  }
}

export async function deletePlan(id: string): Promise<void> {
  if (!isCloudEnabled()) {
    const db = getDb();
    const related = await db.planItems.where("planId").equals(id).toArray();
    await db.planItems.bulkDelete(related.map((item) => item.id));
    await db.plans.delete(id);
    const profile = await db.profile.get("solo");
    if (profile?.activePlanId === id) {
      const next = (await db.plans.toArray()).find((item) => !item.archived);
      await db.profile.put({ ...profile, activePlanId: next?.id ?? null });
    }
    notifyData();
    return;
  }
  const profile = await getProfile();
  const { error } = await createBrowserSupabase().from("plans").delete().eq("id", id);
  throwIfError(error);
  remember(async () => {
    const db = getDb();
    const related = await db.planItems.where("planId").equals(id).toArray();
    await db.planItems.bulkDelete(related.map((item) => item.id));
    await db.plans.delete(id);
  });
  if (profile?.activePlanId === id) {
    const next = (await listPlans()).find((item) => item.id !== id && !item.archived);
    await setActivePlan(next?.id ?? null);
  } else {
    notifyData();
  }
}

export async function setActivePlan(planId: string | null): Promise<void> {
  const user = await currentUser();
  const existing = await getProfile();
  const profile: Profile = existing ?? {
    id: user?.id ?? "solo",
    displayName: "",
    reminderEnabled: true,
    reminderTime: "08:30",
    activePlanId: planId,
    createdAt: new Date().toISOString(),
  };
  await saveProfile({ ...profile, activePlanId: planId });
}

export async function ensureActivePlan(): Promise<TrainingPlan> {
  const user = await currentUser();
  if (isCloudEnabled() && !user) {
    throw new Error("Bitte zuerst anmelden, um einen Plan zu nutzen.");
  }
  const plans = await listPlans();
  const profile = await getProfile();
  const active = plans.find((plan) => plan.id === profile?.activePlanId && !plan.archived);
  if (active) return active;
  const fallback = plans.find((plan) => !plan.archived);
  if (fallback) {
    await setActivePlan(fallback.id);
    return fallback;
  }
  const ownerId = user?.id ?? "solo";
  const creator = user ? await creatorFields(user) : { createdById: "solo", createdByName: "", createdByEmail: "" };
  const created: TrainingPlan = {
    ...defaultPersonalPlan(ownerId, new Date().toISOString(), creator.createdByName, creator.createdByEmail),
    id: ownerId === "solo" ? LOCAL_DEFAULT_PLAN_ID : newId("plan"),
  };
  await savePlan(created);
  await setActivePlan(created.id);
  return created;
}

export async function listAllPlanItems(): Promise<PlanItem[]> {
  if (!isCloudEnabled()) return getDb().planItems.toArray();
  const user = await currentUser();
  if (!user) return [];
  const { data, error } = await createBrowserSupabase().from("plan_items").select("*").order("created_at");
  throwIfError(error);
  const items = ((data ?? []) as PlanRow[]).map(planFromRow);
  if (items.length > 0) remember(() => getDb().planItems.bulkPut(items));
  return items;
}

export async function listPlanItemsForPlan(planId: string): Promise<PlanItem[]> {
  if (!isCloudEnabled()) return getDb().planItems.where("planId").equals(planId).toArray();
  const user = await currentUser();
  if (!user) return [];
  const { data, error } = await createBrowserSupabase()
    .from("plan_items")
    .select("*")
    .eq("plan_id", planId)
    .order("created_at");
  throwIfError(error);
  const items = ((data ?? []) as PlanRow[]).map(planFromRow);
  if (items.length > 0) remember(() => getDb().planItems.bulkPut(items));
  return items;
}

export async function listActivePlanItems(): Promise<PlanItem[]> {
  try {
    const plan = await ensureActivePlan();
    return listPlanItemsForPlan(plan.id);
  } catch {
    return [];
  }
}

export async function listPlanItems(): Promise<PlanItem[]> {
  return listAllPlanItems();
}

export async function savePlanItem(item: PlanItem): Promise<void> {
  if (!item.planId) throw new Error("Plan-Eintrag braucht einen Plan.");
  if (!isCloudEnabled()) {
    await getDb().planItems.put(item);
    notifyData();
    return;
  }
  const user = await currentUser();
  if (!user) throw new Error("Bitte zuerst anmelden, um den Plan zu speichern.");
  const { error } = await createBrowserSupabase().from("plan_items").upsert(planToRow(item, user.id));
  throwIfError(error);
  remember(() => getDb().planItems.put(item));
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
  remember(() => getDb().planItems.delete(id));
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
  const items = ((data ?? []) as CompletionRow[]).map(completionFromRow);
  if (items.length > 0) remember(() => getDb().completions.bulkPut(items));
  return items;
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
  remember(() => getDb().completions.put(item));
  notifyData();
  if (!isCloudEnabled()) return getDb().profile.get("solo");
  const user = await currentUser();
  if (!user) return undefined;
  const { data, error } = await createBrowserSupabase().from("profiles").select("*").eq("id", user.id).maybeSingle();
  throwIfError(error);
  const profile = data ? profileFromRow(data as ProfileRow) : undefined;
  if (profile) remember(() => getDb().profile.put(profile));
  return profile;
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
    active_plan_id: profile.activePlanId,
    created_at: profile.createdAt,
  });
  throwIfError(error);
  remember(() => getDb().profile.put({ ...profile, id: user.id }));
  notifyData();
}

export async function listPendingInvites(): Promise<PlanInvite[]> {
  if (!isCloudEnabled()) return [];
  const user = await currentUser();
  if (!user?.email) return [];
  const email = normalizeEmail(user.email);
  const { data, error } = await createBrowserSupabase()
    .from("plan_invites")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  throwIfError(error);
  return ((data ?? []) as PlanInviteRow[])
    .map(planInviteFromRow)
    .filter((invite) => invite.fromUserId !== user.id)
    .filter((invite) => invite.toUserId === user.id || normalizeEmail(invite.toEmail) === email);
}

export async function sendPlanInvite(planId: string, toEmail: string): Promise<{ inviteId: string; magicLinkSent: boolean }> {
  if (!isCloudEnabled()) {
    throw new Error("Zum Senden per E-Mail braucht es ein Supabase-Konto.");
  }
  const user = await currentUser();
  if (!user || user.id === "solo") {
    throw new Error("Bitte zuerst anmelden, um einen Plan zu senden.");
  }
  const email = normalizeEmail(toEmail);
  if (!isValidEmail(email)) {
    throw new Error("Bitte eine gültige E-Mail-Adresse angeben.");
  }
  if (user.email && normalizeEmail(user.email) === email) {
    throw new Error("Das ist deine eigene Adresse. Eine andere Person eintragen.");
  }
  const plan = await getPlan(planId);
  if (!plan) throw new Error("Plan nicht gefunden.");
  const [items, exercises, profile] = await Promise.all([listPlanItemsForPlan(planId), listExercises(), getProfile()]);
  const snapshot = snapshotFromPlan(plan, items, exercises);
  const fromName = profile?.displayName?.trim() || "";
  const fromEmail = user.email ?? "";
  const supabase = createBrowserSupabase();
  const { data: existing, error: existingError } = await supabase
    .from("plan_invites")
    .select("id")
    .eq("from_user_id", user.id)
    .eq("to_email", email)
    .eq("source_plan_id", planId)
    .eq("status", "pending")
    .maybeSingle();
  throwIfError(existingError);
  const invite: PlanInvite = {
    id: (existing?.id as string | undefined) ?? newId("invite"),
    fromUserId: user.id,
    fromName,
    fromEmail,
    toEmail: email,
    toUserId: null,
    sourcePlanId: planId,
    planSnapshot: snapshot,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  const { error } = await supabase.from("plan_invites").upsert(planInviteToRow(invite));
  throwIfError(error);
  let magicLinkSent = false;
  try {
    await requestMagicLink(email, "/plan");
    magicLinkSent = true;
  } catch {
    magicLinkSent = false;
  }
  notifyData();
  return { inviteId: invite.id, magicLinkSent };
}

export async function acceptPlanInvite(inviteId: string): Promise<TrainingPlan> {
  if (!isCloudEnabled()) {
    throw new Error("Einladungen gibt es nur mit einem Supabase-Konto.");
  }
  const user = await currentUser();
  if (!user) throw new Error("Bitte zuerst anmelden, um eine Einladung anzunehmen.");
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase.from("plan_invites").select("*").eq("id", inviteId).maybeSingle();
  throwIfError(error);
  if (!data) throw new Error("Einladung nicht gefunden.");
  const invite = planInviteFromRow(data as PlanInviteRow);
  const plans = await listPlans();
  const already = plans.find((plan) => plan.acceptedFromInviteId === invite.id);
  if (already) {
    if (invite.status === "pending") {
      const { error: statusError } = await supabase
        .from("plan_invites")
        .update({ status: "accepted", to_user_id: user.id })
        .eq("id", invite.id);
      throwIfError(statusError);
      notifyData();
    }
    return already;
  }
  if (invite.status === "declined") {
    throw new Error("Diese Einladung wurde schon abgelehnt.");
  }
  const exercises = await listExercises();
  const result = acceptInviteToNewPlan({
    invite,
    recipientId: user.id,
    existingPlanIds: plans.map((plan) => plan.id),
    existingExerciseIds: exercises.map((exercise) => exercise.id),
    now: new Date().toISOString(),
    createId: newId,
  });
  for (const exercise of result.exercisesToSave) {
    await saveExercise(exercise);
  }
  await savePlan(result.plan);
  for (const item of result.items) {
    await savePlanItem(item);
  }
  const { error: statusError } = await supabase
    .from("plan_invites")
    .update({ status: "accepted", to_user_id: user.id })
    .eq("id", invite.id);
  throwIfError(statusError);
  notifyData();
  return result.plan;
}

export async function declinePlanInvite(inviteId: string): Promise<void> {
  if (!isCloudEnabled()) return;
  const user = await currentUser();
  if (!user) throw new Error("Bitte zuerst anmelden.");
  const { error } = await createBrowserSupabase()
    .from("plan_invites")
    .update({ status: "declined", to_user_id: user.id })
    .eq("id", inviteId);
  throwIfError(error);
  notifyData();
}

export async function requestMagicLink(email: string, nextPath = "/"): Promise<void> {
  const supabase = createBrowserSupabase();
  const origin = typeof window !== "undefined" ? window.location.origin : siteOrigin();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNextPath(nextPath))}`,
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
