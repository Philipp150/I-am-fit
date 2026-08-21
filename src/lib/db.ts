import Dexie, { type Table } from "dexie";
import { CATALOG_EXERCISES, CATEGORIES, COMPLAINTS, DEFAULT_PROFILE } from "./catalog";
import { defaultPersonalPlan, LOCAL_DEFAULT_PLAN_ID } from "./plan-share";
import type { Category, Complaint, Completion, Exercise, PlanInvite, PlanItem, Profile, TrainingPlan } from "./types";

export class FitDatabase extends Dexie {
  categories!: Table<Category, string>;
  complaints!: Table<Complaint, string>;
  exercises!: Table<Exercise, string>;
  plans!: Table<TrainingPlan, string>;
  planItems!: Table<PlanItem, string>;
  planInvites!: Table<PlanInvite, string>;
  completions!: Table<Completion, string>;
  profile!: Table<Profile, string>;

  constructor() {
    super("i-am-fit");
    this.version(1).stores({
      categories: "id, parentId, slug",
      complaints: "id",
      exercises: "id, kind, isSystem, updatedAt",
      planItems: "id, exerciseId, enabled",
      completions: "id, exerciseId, completedAt",
      profile: "id",
    });
    this.version(2)
      .stores({
        categories: "id, parentId, slug",
        complaints: "id",
        exercises: "id, kind, isSystem, updatedAt",
        plans: "id, source, archived, createdAt",
        planItems: "id, planId, exerciseId, enabled",
        planInvites: "id, toEmail, status, createdAt",
        completions: "id, exerciseId, completedAt",
        profile: "id",
      })
      .upgrade(async (trans) => {
        const now = new Date().toISOString();
        const profileTable = trans.table("profile");
        const planItemsTable = trans.table("planItems");
        const plansTable = trans.table("plans");
        const profile = (await profileTable.get("solo")) as Profile | undefined;
        const plan = defaultPersonalPlan("solo", now, profile?.displayName ?? "", "");
        await plansTable.put(plan);
        const items = (await planItemsTable.toArray()) as Array<PlanItem & { planId?: string }>;
        for (const item of items) {
          if (!item.planId) {
            await planItemsTable.put({ ...item, planId: LOCAL_DEFAULT_PLAN_ID });
          }
        }
        if (profile && !profile.activePlanId) {
          await profileTable.put({ ...profile, activePlanId: LOCAL_DEFAULT_PLAN_ID });
        }
      });
  }
}

let db: FitDatabase | null = null;

export function getDb(): FitDatabase {
  if (typeof window === "undefined") {
    throw new Error("Datenbank nur im Browser");
  }
  if (!db) db = new FitDatabase();
  return db;
}

export async function ensureSeeded(): Promise<void> {
  const database = getDb();
  await database.transaction(
    "rw",
    [database.categories, database.complaints, database.exercises, database.plans, database.profile],
    async () => {
      const categoryCount = await database.categories.count();
      if (categoryCount === 0) {
        await database.categories.bulkAdd(CATEGORIES);
      } else {
        for (const category of CATEGORIES) {
          const existing = await database.categories.get(category.id);
          if (!existing) await database.categories.add(category);
        }
      }

      const complaintCount = await database.complaints.count();
      if (complaintCount === 0) {
        await database.complaints.bulkAdd(COMPLAINTS);
      } else {
        for (const complaint of COMPLAINTS) {
          const existing = await database.complaints.get(complaint.id);
          if (!existing) await database.complaints.add(complaint);
        }
      }

      for (const exercise of CATALOG_EXERCISES) {
        const existing = await database.exercises.get(exercise.id);
        if (!existing) {
          await database.exercises.add(exercise);
        } else if (existing.isSystem) {
          await database.exercises.put({
            ...exercise,
            createdAt: existing.createdAt,
            updatedAt: exercise.updatedAt,
          });
        }
      }

      const planCount = await database.plans.count();
      if (planCount === 0) {
        await database.plans.add(defaultPersonalPlan("solo", DEFAULT_PROFILE.createdAt));
      }

      const profile = await database.profile.get("solo");
      if (!profile) {
        await database.profile.add(DEFAULT_PROFILE);
      } else if (!profile.activePlanId) {
        const fallback = (await database.plans.toArray())[0];
        if (fallback) {
          await database.profile.put({ ...profile, activePlanId: fallback.id });
        }
      }
    },
  );
}

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
