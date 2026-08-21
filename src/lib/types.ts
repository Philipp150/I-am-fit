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
  | "breatheOut";

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
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PlanItem = {
  id: string;
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
  createdAt: string;
};

export type DraftExercise = Omit<Exercise, "id" | "createdAt" | "updatedAt">;
