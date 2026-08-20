import { writeFileSync } from "node:fs";
import { CATALOG_EXERCISES, CATEGORIES, COMPLAINTS } from "../src/lib/catalog";

function sqlStr(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlJson(value: unknown): string {
  return `${sqlStr(JSON.stringify(value))}::jsonb`;
}

function sqlTextArray(values: string[]): string {
  if (values.length === 0) return `'{}'::text[]`;
  return `array[${values.map(sqlStr).join(", ")}]::text[]`;
}

const categorySql = CATEGORIES.map(
  (category) =>
    `(${sqlStr(category.id)}, ${sqlStr(category.name)}, ${sqlStr(category.slug)}, ${category.parentId ? sqlStr(category.parentId) : "null"}, ${sqlStr(category.description)}, ${category.isSystem})`,
).join(",\n");

const complaintSql = COMPLAINTS.map(
  (complaint) =>
    `(${sqlStr(complaint.id)}, ${sqlStr(complaint.name)}, ${sqlStr(complaint.summary)}, ${sqlStr(complaint.hint)})`,
).join(",\n");

const exerciseSql = CATALOG_EXERCISES.map(
  (exercise) =>
    `(${sqlStr(exercise.id)}, null, ${sqlStr(exercise.title)}, ${sqlStr(exercise.summary)}, ${sqlStr(exercise.kind)}, ${sqlTextArray(exercise.categoryIds)}, ${sqlTextArray(exercise.complaintIds)}, ${sqlJson(exercise.steps)}, ${exercise.defaultDurationSec}, ${exercise.defaultReps ?? "null"}, ${sqlJson(exercise.suggestedRhythm)}, ${sqlJson(exercise.source)}, true, ${sqlStr(exercise.createdAt)}, ${sqlStr(exercise.updatedAt)})`,
).join(",\n");

const body = `-- Generated catalog seed. Re-run: npx tsx scripts/generate-seed.ts

insert into public.categories (id, name, slug, parent_id, description, is_system)
values
${categorySql}
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  parent_id = excluded.parent_id,
  description = excluded.description,
  is_system = excluded.is_system;

insert into public.complaints (id, name, summary, hint)
values
${complaintSql}
on conflict (id) do update set
  name = excluded.name,
  summary = excluded.summary,
  hint = excluded.hint;

insert into public.exercises (
  id, owner_id, title, summary, kind, category_ids, complaint_ids, steps,
  default_duration_sec, default_reps, suggested_rhythm, source, is_system, created_at, updated_at
)
values
${exerciseSql}
on conflict (id) do update set
  title = excluded.title,
  summary = excluded.summary,
  kind = excluded.kind,
  category_ids = excluded.category_ids,
  complaint_ids = excluded.complaint_ids,
  steps = excluded.steps,
  default_duration_sec = excluded.default_duration_sec,
  default_reps = excluded.default_reps,
  suggested_rhythm = excluded.suggested_rhythm,
  source = excluded.source,
  is_system = excluded.is_system,
  updated_at = excluded.updated_at;
`;

writeFileSync(new URL("../supabase/seed.sql", import.meta.url), body);
console.log("Wrote supabase/seed.sql");
