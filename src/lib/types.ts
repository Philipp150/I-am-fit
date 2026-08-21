import type { PoseTrack } from "./pose-track";

export type ExerciseKind = "movement" | "breath" | "mantra" | "mind" | "other";

export type PoseId =
  | "stand"
  | "reachUp"
  | "fold"
  | "squat"
  | "lunge"
  | "plank"
  | "cobra"
  | "child"
  | "cat"
  | "cow"
  | "twist"
  | "sit"
  | "breathe"
  | "neckTilt"
  | "lie"
  | "warrior"
  | "tree"
  | "hipOpen"
  | "chestOpen"
  | "heart"
  | "neckLeft"
  | "neckRight"
  | "shrug"
  | "shouldersDown"
  | "jawSoft"
  | "gazeFar"
  | "kneesUp"
  | "pelvicTuck"
  | "pelvicArch"
  | "walkLeft"
  | "walkRight"
  | "wristsFlex"
  | "wristsExtend"
  | "shakeOut"
  | "twistOther"
  | "treeOther"
  | "lungeOther"
  | "breatheIn"
  | "breatheOut"
  | "neckForward"
  | "neckBack"
  | "jawLeft"
  | "jawRight"
  | "warriorOther"
  | "hipOpenOther"
  | "calfWall"
  | "calfWallOther"
  | "shoulderForward"
  | "standInhale"
  | "standExhale"
  | "lieInhale"
  | "lieHold"
  | "lieExhale";

export type RhythmKind = "daily" | "weekdays" | "weekends" | "days" | "every_n_days";

export type SuggestedRhythm = {
  kind: RhythmKind;
  daysOfWeek?: number[];
  everyNDays?: number;
  timesPerWeek?: number;
  recommendedWeeks?: number | null;
  note: string;
};

export type ExerciseStep = {
  pose: PoseId;
  text: string;
  durationSec: number;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  description: string;
  isSystem: boolean;
};

export type Complaint = {
  id: string;
  name: string;
  summary: string;
  hint: string;
};

export type Exercise = {
  id: string;
  title: string;
  summary: string;
  kind: ExerciseKind;
  categoryIds: string[];
  complaintIds: string[];
  steps: ExerciseStep[];
  defaultDurationSec: number;
  defaultReps?: number;
  suggestedRhythm: SuggestedRhythm;
  source: {
    type: "catalog" | "user" | "import";
    url?: string;
    label?: string;
    provider?: "youtube" | "instagram" | "web";
    thumbnailUrl?: string;
  };
  /** Compact mannequin timeline from a one-time clip analysis. Optional; PoseIds remain the fallback. */
  poseTrack?: PoseTrack | null;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PlanSource = "self" | "received";

export type TrainingPlan = {
  id: string;
  title: string;
  createdById: string;
  createdByName: string;
  createdByEmail: string;
  source: PlanSource;
  acceptedFromInviteId: string | null;
  archived: boolean;
  createdAt: string;
};

export type PlanItem = {
  id: string;
  planId: string;
  exerciseId: string;
  enabled: boolean;
  rhythm: {
    kind: RhythmKind;
    daysOfWeek?: number[];
    everyNDays?: number;
    startDate: string;
  };
  durationSec?: number;
  reps?: number;
  reminderTime?: string;
  keepUntil?: string | null;
  createdAt: string;
};

export type PlanInviteStatus = "pending" | "accepted" | "declined";

export type PlanSnapshotItem = {
  exerciseId: string;
  enabled: boolean;
  rhythm: PlanItem["rhythm"];
  durationSec?: number;
  reps?: number;
  reminderTime?: string;
  keepUntil?: string | null;
};

export type PlanSnapshot = {
  title: string;
  items: PlanSnapshotItem[];
  exercises: Exercise[];
};

export type PlanInvite = {
  id: string;
  fromUserId: string;
  fromName: string;
  fromEmail: string;
  toEmail: string;
  toUserId: string | null;
  sourcePlanId: string | null;
  planSnapshot: PlanSnapshot;
  status: PlanInviteStatus;
  createdAt: string;
};

export type Completion = {
  id: string;
  exerciseId: string;
  planItemId?: string;
  completedAt: string;
  durationSec?: number;
  skipped?: boolean;
};

export type Profile = {
  id: string;
  displayName: string;
  reminderEnabled: boolean;
  reminderTime: string;
  activePlanId: string | null;
  createdAt: string;
};

export type DraftExercise = Omit<Exercise, "id" | "createdAt" | "updatedAt">;
