import type { Completion, Exercise, PlanInvite, PlanItem, PlanSnapshot, Profile, TrainingPlan } from "./types";

export type ExerciseRow = {
  id: string;
  owner_id: string | null;
  title: string;
  summary: string;
  kind: Exercise["kind"];
  category_ids: string[];
  complaint_ids: string[];
  steps: Exercise["steps"];
  default_duration_sec: number;
  default_reps: number | null;
  suggested_rhythm: Exercise["suggestedRhythm"];
  source: Exercise["source"];
  is_system: boolean;
  created_at: string;
  updated_at: string;
};

export type PlanRow = {
  id: string;
  plan_id: string | null;
  exercise_id: string;
  enabled: boolean;
  rhythm: PlanItem["rhythm"];
  duration_sec: number | null;
  reps: number | null;
  reminder_time: string | null;
  keep_until: string | null;
  created_at: string;
};

export type TrainingPlanRow = {
  id: string;
  owner_id: string;
  title: string;
  created_by_id: string | null;
  created_by_name: string;
  created_by_email: string;
  source: TrainingPlan["source"];
  accepted_from_invite_id: string | null;
  archived: boolean;
  created_at: string;
};

export type PlanInviteRow = {
  id: string;
  from_user_id: string;
  from_name: string;
  from_email: string;
  to_email: string;
  to_user_id: string | null;
  source_plan_id: string | null;
  plan_snapshot: PlanSnapshot;
  status: PlanInvite["status"];
  created_at: string;
};

export type CompletionRow = {
  id: string;
  exercise_id: string;
  plan_item_id: string | null;
  completed_at: string;
  duration_sec: number | null;
  skipped: boolean;
};

export type ProfileRow = {
  id: string;
  display_name: string;
  reminder_enabled: boolean;
  reminder_time: string;
  active_plan_id: string | null;
  created_at: string;
};

export function exerciseFromRow(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    kind: row.kind,
    categoryIds: row.category_ids ?? [],
    complaintIds: row.complaint_ids ?? [],
    steps: row.steps ?? [],
    defaultDurationSec: row.default_duration_sec,
    defaultReps: row.default_reps ?? undefined,
    suggestedRhythm: row.suggested_rhythm,
    source: row.source,
    isSystem: row.is_system,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function exerciseToRow(exercise: Exercise, ownerId: string | null): ExerciseRow {
  return {
    id: exercise.id,
    owner_id: exercise.isSystem ? null : ownerId,
    title: exercise.title,
    summary: exercise.summary,
    kind: exercise.kind,
    category_ids: exercise.categoryIds,
    complaint_ids: exercise.complaintIds,
    steps: exercise.steps,
    default_duration_sec: exercise.defaultDurationSec,
    default_reps: exercise.defaultReps ?? null,
    suggested_rhythm: exercise.suggestedRhythm,
    source: exercise.source,
    is_system: exercise.isSystem,
    created_at: exercise.createdAt,
    updated_at: exercise.updatedAt,
  };
}

export function planFromRow(row: PlanRow): PlanItem {
  return {
    id: row.id,
    planId: row.plan_id ?? "",
    exerciseId: row.exercise_id,
    enabled: row.enabled,
    rhythm: row.rhythm,
    durationSec: row.duration_sec ?? undefined,
    reps: row.reps ?? undefined,
    reminderTime: row.reminder_time ?? undefined,
    keepUntil: row.keep_until,
    createdAt: row.created_at,
  };
}

export function planToRow(item: PlanItem, ownerId: string) {
  return {
    id: item.id,
    owner_id: ownerId,
    plan_id: item.planId,
    exercise_id: item.exerciseId,
    enabled: item.enabled,
    rhythm: item.rhythm,
    duration_sec: item.durationSec ?? null,
    reps: item.reps ?? null,
    reminder_time: item.reminderTime ?? null,
    keep_until: item.keepUntil ?? null,
    created_at: item.createdAt,
  };
}

export function trainingPlanFromRow(row: TrainingPlanRow): TrainingPlan {
  return {
    id: row.id,
    title: row.title,
    createdById: row.created_by_id ?? "",
    createdByName: row.created_by_name ?? "",
    createdByEmail: row.created_by_email ?? "",
    source: row.source === "received" ? "received" : "self",
    acceptedFromInviteId: row.accepted_from_invite_id,
    archived: Boolean(row.archived),
    createdAt: row.created_at,
  };
}

export function trainingPlanToRow(plan: TrainingPlan, ownerId: string) {
  return {
    id: plan.id,
    owner_id: ownerId,
    title: plan.title,
    created_by_id: plan.createdById || ownerId,
    created_by_name: plan.createdByName,
    created_by_email: plan.createdByEmail,
    source: plan.source,
    accepted_from_invite_id: plan.acceptedFromInviteId,
    archived: plan.archived,
    created_at: plan.createdAt,
  };
}

export function planInviteFromRow(row: PlanInviteRow): PlanInvite {
  return {
    id: row.id,
    fromUserId: row.from_user_id,
    fromName: row.from_name ?? "",
    fromEmail: row.from_email ?? "",
    toEmail: row.to_email,
    toUserId: row.to_user_id,
    sourcePlanId: row.source_plan_id,
    planSnapshot: row.plan_snapshot,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function planInviteToRow(invite: PlanInvite): PlanInviteRow {
  return {
    id: invite.id,
    from_user_id: invite.fromUserId,
    from_name: invite.fromName,
    from_email: invite.fromEmail,
    to_email: invite.toEmail,
    to_user_id: invite.toUserId,
    source_plan_id: invite.sourcePlanId,
    plan_snapshot: invite.planSnapshot,
    status: invite.status,
    created_at: invite.createdAt,
  };
}

export function completionFromRow(row: CompletionRow): Completion {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    planItemId: row.plan_item_id ?? undefined,
    completedAt: row.completed_at,
    durationSec: row.duration_sec ?? undefined,
    skipped: row.skipped,
  };
}

export function profileFromRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    reminderEnabled: row.reminder_enabled,
    reminderTime: row.reminder_time,
    activePlanId: row.active_plan_id ?? null,
    createdAt: row.created_at,
  };
}
