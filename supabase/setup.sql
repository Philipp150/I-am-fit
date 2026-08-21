-- I am fit: Schema, RLS and catalog seed.
-- Paste this entire file into the Supabase SQL editor and run it once.
-- Re-running is safe: tables use IF NOT EXISTS, policies are dropped/recreated,
-- and existing plan_items are wrapped into a default personal plan.

create table if not exists public.categories (
  id text primary key,
  name text not null,
  slug text not null,
  parent_id text references public.categories(id) on delete set null,
  description text not null default '',
  is_system boolean not null default true
);

create table if not exists public.complaints (
  id text primary key,
  name text not null,
  summary text not null,
  hint text not null default ''
);

create table if not exists public.exercises (
  id text primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  title text not null,
  summary text not null default '',
  kind text not null,
  category_ids text[] not null default '{}',
  complaint_ids text[] not null default '{}',
  steps jsonb not null default '[]'::jsonb,
  pose_track jsonb,
  default_duration_sec integer not null default 60,
  default_reps integer,
  suggested_rhythm jsonb not null default '{}'::jsonb,
  source jsonb not null default '{"type":"catalog"}'::jsonb,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plans (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Mein Plan',
  created_by_id uuid,
  created_by_name text not null default '',
  created_by_email text not null default '',
  source text not null default 'self',
  accepted_from_invite_id text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.plan_items (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan_id text references public.plans(id) on delete cascade,
  exercise_id text not null references public.exercises(id) on delete cascade,
  enabled boolean not null default true,
  rhythm jsonb not null,
  duration_sec integer,
  reps integer,
  reminder_time text,
  keep_until date,
  created_at timestamptz not null default now()
);

create table if not exists public.completions (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null,
  plan_item_id text,
  completed_at timestamptz not null default now(),
  duration_sec integer,
  skipped boolean not null default false
);

create table if not exists public.plan_invites (
  id text primary key,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  from_name text not null default '',
  from_email text not null default '',
  to_email text not null,
  to_user_id uuid references auth.users(id) on delete set null,
  source_plan_id text,
  plan_snapshot jsonb not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  reminder_enabled boolean not null default true,
  reminder_time text not null default '08:30',
  active_plan_id text references public.plans(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Existing databases created before named plans: add missing columns.
alter table public.plan_items add column if not exists plan_id text references public.plans(id) on delete cascade;
alter table public.profiles add column if not exists active_plan_id text references public.plans(id) on delete set null;
alter table public.exercises add column if not exists pose_track jsonb;

insert into public.plans (id, owner_id, title, created_by_id, created_by_name, source)
select
  'plan-default-' || p.id::text,
  p.id,
  'Mein Plan',
  p.id,
  coalesce(p.display_name, ''),
  'self'
from public.profiles p
on conflict (id) do nothing;

insert into public.plans (id, owner_id, title, created_by_id, source)
select
  'plan-default-' || pi.owner_id::text,
  pi.owner_id,
  'Mein Plan',
  pi.owner_id,
  'self'
from (select distinct owner_id from public.plan_items) pi
on conflict (id) do nothing;

update public.plan_items
set plan_id = 'plan-default-' || owner_id::text
where plan_id is null;

update public.profiles
set active_plan_id = 'plan-default-' || id::text
where active_plan_id is null
  and exists (select 1 from public.plans pl where pl.id = 'plan-default-' || public.profiles.id::text);

create index if not exists plans_owner_idx on public.plans (owner_id);
create index if not exists plan_items_plan_idx on public.plan_items (plan_id);
create index if not exists plan_invites_to_email_idx on public.plan_invites (to_email);
create index if not exists plan_invites_from_user_idx on public.plan_invites (from_user_id);

alter table public.categories enable row level security;
alter table public.complaints enable row level security;
alter table public.exercises enable row level security;
alter table public.plans enable row level security;
alter table public.plan_items enable row level security;
alter table public.completions enable row level security;
alter table public.plan_invites enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "categories_read" on public.categories;
create policy "categories_read" on public.categories for select using (true);

drop policy if exists "complaints_read" on public.complaints;
create policy "complaints_read" on public.complaints for select using (true);

drop policy if exists "exercises_read" on public.exercises;
create policy "exercises_read" on public.exercises
  for select using (is_system or owner_id = auth.uid());

drop policy if exists "exercises_insert" on public.exercises;
create policy "exercises_insert" on public.exercises
  for insert with check (auth.uid() is not null and owner_id = auth.uid() and is_system = false);

drop policy if exists "exercises_update" on public.exercises;
create policy "exercises_update" on public.exercises
  for update using (owner_id = auth.uid() and is_system = false);

drop policy if exists "exercises_delete" on public.exercises;
create policy "exercises_delete" on public.exercises
  for delete using (owner_id = auth.uid() and is_system = false);

drop policy if exists "plans_owner" on public.plans;
create policy "plans_owner" on public.plans
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "plan_owner" on public.plan_items;
create policy "plan_owner" on public.plan_items
  for all using (owner_id = auth.uid()) with check (
    owner_id = auth.uid()
    and (
      plan_id is null
      or exists (
        select 1 from public.plans
        where public.plans.id = plan_id and public.plans.owner_id = auth.uid()
      )
    )
  );

drop policy if exists "completions_owner" on public.completions;
create policy "completions_owner" on public.completions
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "profiles_owner" on public.profiles;
create policy "profiles_owner" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "invites_select" on public.plan_invites;
create policy "invites_select" on public.plan_invites
  for select using (
    from_user_id = auth.uid()
    or to_user_id = auth.uid()
    or lower(to_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "invites_insert" on public.plan_invites;
create policy "invites_insert" on public.plan_invites
  for insert with check (from_user_id = auth.uid());

drop policy if exists "invites_update" on public.plan_invites;
create policy "invites_update" on public.plan_invites
  for update using (
    from_user_id = auth.uid()
    or to_user_id = auth.uid()
    or lower(to_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.plans (id, owner_id, title, created_by_id, created_by_name, created_by_email, source)
  values (
    'plan-default-' || new.id::text,
    new.id,
    'Mein Plan',
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', ''),
    coalesce(new.email, ''),
    'self'
  )
  on conflict (id) do nothing;

  insert into public.profiles (id, display_name, active_plan_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', ''),
    'plan-default-' || new.id::text
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
-- Generated catalog seed. Re-run: npx tsx scripts/generate-seed.ts

insert into public.categories (id, name, slug, parent_id, description, is_system)
values
('cat-body', 'Körper', 'koerper', null, 'Bewegung, Kraft, Haltung.', true),
('cat-mind', 'Geist', 'geist', null, 'Mantras, Meditation, Aufmerksamkeit.', true),
('cat-daily', 'Alltag', 'alltag', null, 'Kurze Rituale für Morgen, Pause und Abend.', true),
('cat-mobility', 'Beweglichkeit', 'beweglichkeit', 'cat-body', 'Sanftes Öffnen und Fließen.', true),
('cat-strength', 'Kraft', 'kraft', 'cat-body', 'Stabile, einfache Kraftreize.', true),
('cat-posture', 'Haltung', 'haltung', 'cat-body', 'Aufrichten ohne Verkrampfen.', true),
('cat-breath', 'Atmung', 'atmung', 'cat-body', 'Atem als Übung, nicht nur Beiwerk.', true),
('cat-neck', 'Nacken', 'nacken', 'cat-body', 'Nacken und Halswirbelsäule.', true),
('cat-shoulders', 'Schultern', 'schultern', 'cat-body', 'Schultergürtel und Brustkorb.', true),
('cat-back', 'Rücken', 'ruecken', 'cat-body', 'Lenden- und Brustwirbelsäule.', true),
('cat-hips', 'Hüfte', 'huefte', 'cat-body', 'Becken, Hüftbeuger, Gesäß.', true),
('cat-knees', 'Knie', 'knie', 'cat-body', 'Kniegelenke und Beinachsen.', true),
('cat-mantras', 'Mantras', 'mantras', 'cat-mind', 'Sätze, die du regelmäßig sagst oder denkst.', true),
('cat-meditation', 'Meditation', 'meditation', 'cat-mind', 'Stille, Scan, Sitzen.', true),
('cat-mindfulness', 'Achtsamkeit', 'achtsamkeit', 'cat-mind', 'Kurze Anker im Alltag.', true),
('cat-morning', 'Morgen', 'morgen', 'cat-daily', 'Sanfter Start.', true),
('cat-pause', 'Pause', 'pause', 'cat-daily', 'Zwischendurch, oft am Schreibtisch.', true),
('cat-evening', 'Abend', 'abend', 'cat-daily', 'Runterkommen vor dem Schlaf.', true)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  parent_id = excluded.parent_id,
  description = excluded.description,
  is_system = excluded.is_system;

insert into public.complaints (id, name, summary, hint)
values
('comp-neck', 'Nackensteifheit', 'Verspannter Nacken, Kopf fühlt sich schwer an.', 'Kleine Bewegungen, oft, statt einmal hart zu dehnen.'),
('comp-shoulders', 'Hängende Schultern', 'Schultern nach vorn, Brustkorb eng.', 'Öffnen und absenken, nicht nur nach hinten ziehen.'),
('comp-back', 'Rückenschmerzen', 'Untere oder mittlere Wirbelsäule protestiert.', 'Wechsel aus Beugen und Strecken, nie in den Schmerz hinein.'),
('comp-hips', 'Enge Hüfte', 'Langes Sitzen, Hüftbeuger kurz.', 'Täglich kurz öffnen wirkt oft besser als selten lang.'),
('comp-knees', 'Knieunruhe', 'Knie fühlen sich unbequem oder instabil an.', 'Kraft um das Gelenk, kein übertriebenes Dehnen.'),
('comp-stress', 'Stress & Unruhe', 'Gedanken rasen, Körper ist an.', 'Atem und Mantra zuerst, Bewegung nur so viel, wie der Tag noch trägt.'),
('comp-sleep', 'Schwer einschlafen', 'Der Tag geht im Kopf weiter.', 'Atem und Mantra vor dem Liegen, kein Training spätabends.'),
('comp-focus', 'Zerstreutheit', 'Du fängst vieles an und verlierst den Faden.', 'Kurze Anker, die du wirklich schaffst.')
on conflict (id) do update set
  name = excluded.name,
  summary = excluded.summary,
  hint = excluded.hint;

insert into public.exercises (
  id, owner_id, title, summary, kind, category_ids, complaint_ids, steps,
  default_duration_sec, default_reps, suggested_rhythm, source, is_system, created_at, updated_at
)
values
('ex-neck-circles', null, 'Nacken langsam kreisen', 'Kleine Kreise, die den Nacken erinnern, dass er sich bewegen darf.', 'movement', array['cat-body', 'cat-neck', 'cat-mobility', 'cat-pause']::text[], array['comp-neck', 'comp-shoulders']::text[], '[{"pose":"stand","text":"Stell dich oder setz dich aufrecht hin. Schultern schwer, Kiefer locker.","durationSec":8},{"pose":"neckLeft","text":"Neige das linke Ohr zur Schulter. Nicht ziehen, nur nachgeben.","durationSec":8},{"pose":"neckForward","text":"Kinn leicht zur Brust – der vordere Teil des Kreises.","durationSec":8},{"pose":"neckRight","text":"Rechtes Ohr zur Schulter. Kleiner als du denkst.","durationSec":8},{"pose":"neckBack","text":"Blick ein wenig heben, Nacken lang, nicht knicken.","durationSec":8},{"pose":"stand","text":"Komm zur Mitte zurück. Spüre, ob der Kopf leichter sitzt.","durationSec":8}]'::jsonb, 90, null, '{"kind":"daily","recommendedWeeks":null,"note":"Jeden Tag 1–2 Minuten, besonders nach Bildschirmarbeit. Das darf dauerhaft im Plan bleiben."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-shoulder-rolls', null, 'Schulterkreisen', 'Die Schultern nach hinten-unten schicken, statt sie am Ohr zu parken.', 'movement', array['cat-body', 'cat-shoulders', 'cat-posture', 'cat-pause']::text[], array['comp-shoulders', 'comp-neck']::text[], '[{"pose":"stand","text":"Arme hängen lassen. Spüre das Gewicht der Hände.","durationSec":8},{"pose":"shoulderForward","text":"Schultern nach vorn runden, als würdest du etwas umarmen.","durationSec":8},{"pose":"shrug","text":"Weiter hoch, Richtung Ohren – die Arme bleiben schwer.","durationSec":8},{"pose":"chestOpen","text":"Hinten öffnen, Schulterblätter zur Gesäßtasche.","durationSec":8},{"pose":"shouldersDown","text":"Unten ankommen lassen. Dann die Kreise langsam weiter.","durationSec":10},{"pose":"stand","text":"Prüfe: Sind die Schultern näher an den Hüften als am Kiefer?","durationSec":8}]'::jsonb, 80, null, '{"kind":"daily","recommendedWeeks":null,"note":"Unter der Woche mehrmals kurz, nicht einmal lang."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-cat-cow', null, 'Katze und Kuh', 'Die Wirbelsäule wellen, statt sie starr zu halten.', 'movement', array['cat-body', 'cat-back', 'cat-mobility', 'cat-morning']::text[], array['comp-back', 'comp-hips']::text[], '[{"pose":"cat","text":"Vierfüßler: Hände unter Schultern, Knie unter Hüften. Rund den Rücken, Blick zum Bauch.","durationSec":10},{"pose":"cow","text":"Mit der Einatmung Brustbein nach vorn, Steißbein nach oben, Blick leicht heben.","durationSec":10},{"pose":"cat","text":"Mit der Ausatmung wieder runden. Bewege dich im Atem, nicht gegen ihn.","durationSec":16},{"pose":"child","text":"Setz dich zu den Fersen, wenn du fertig bist, und ruhe kurz.","durationSec":8}]'::jsonb, 120, null, '{"kind":"daily","recommendedWeeks":6,"note":"Sechs Wochen täglich, danach mindestens an Bürotagen behalten."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-cobra', null, 'Sanfte Cobra', 'Eine kleine Rückbeuge, die den oberen Rücken weckt.', 'movement', array['cat-body', 'cat-back', 'cat-posture', 'cat-mobility']::text[], array['comp-back', 'comp-shoulders']::text[], '[{"pose":"lie","text":"Bauchlage, Stirn kurz abgelegt, Hände neben der Brust.","durationSec":8},{"pose":"cobra","text":"Zieh die Brust nach vorn-oben. Die Unterarme dürfen bleiben. Nacken lang.","durationSec":16},{"pose":"lie","text":"Senke dich ab und spüre die Länge der Vorderseite.","durationSec":8}]'::jsonb, 90, null, '{"kind":"days","daysOfWeek":[1,3,5,0],"timesPerWeek":4,"recommendedWeeks":8,"note":"Vier Mal pro Woche. Am Abend weicher halten als am Morgen."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-child', null, 'Kindeshaltung', 'Eine Pause in Form einer Haltung.', 'movement', array['cat-body', 'cat-back', 'cat-evening', 'cat-mobility']::text[], array['comp-back', 'comp-stress']::text[], '[{"pose":"sit","text":"Knie weit oder eng, wie es für deine Hüfte freundlich ist.","durationSec":8},{"pose":"child","text":"Gesäß zu den Fersen, Arme nach vorn oder neben dem Körper. Atme in den Rücken.","durationSec":30},{"pose":"sit","text":"Rolle dich langsam auf, Kopf zuletzt.","durationSec":8}]'::jsonb, 90, null, '{"kind":"daily","recommendedWeeks":null,"note":"Immer dann, wenn der Tag zu voll wurde. Auch 45 Sekunden zählen."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-forward-fold', null, 'Stehende Vorbeuge', 'Der Oberkörper darf schwer werden, die Beine tragen.', 'movement', array['cat-body', 'cat-mobility', 'cat-back', 'cat-morning']::text[], array['comp-back', 'comp-stress']::text[], '[{"pose":"stand","text":"Füße hüftbreit. Einatmen, Länge im Rücken.","durationSec":8},{"pose":"fold","text":"Ausatmen, Oberkörper hängen lassen. Kopf schwer, Knie gebeugt ist richtig.","durationSec":20},{"pose":"reachUp","text":"Mit leichtem Schwung wieder aufrichten, Arme mitnehmen.","durationSec":8},{"pose":"stand","text":"Stehen bleiben und nachspüren.","durationSec":8}]'::jsonb, 70, null, '{"kind":"weekdays","recommendedWeeks":4,"note":"Unter der Woche nach dem Aufstehen. Knie dürfen weich bleiben."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-squat', null, 'Langsame Kniebeuge', 'Kraft für Beine und eine klarere Beinachse.', 'movement', array['cat-body', 'cat-strength', 'cat-knees']::text[], array['comp-knees', 'comp-hips']::text[], '[{"pose":"stand","text":"Füße etwas breiter als die Hüfte, Fußspitzen leicht außen.","durationSec":8},{"pose":"squat","text":"Senke dich ab, als würdest du dich auf einen Stuhl setzen. Knie zeigen über die Füße.","durationSec":12},{"pose":"stand","text":"Drück dich über die ganze Fußsohle wieder hoch.","durationSec":8},{"pose":"squat","text":"Noch einmal runter – Qualität vor Tiefe.","durationSec":12},{"pose":"stand","text":"Aufrichten. Acht ruhige Wiederholungen reichen.","durationSec":8}]'::jsonb, 100, 8, '{"kind":"days","daysOfWeek":[1,3,5],"timesPerWeek":3,"recommendedWeeks":8,"note":"Drei Mal pro Woche. Qualität vor Tiefe."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-lunge', null, 'Ausfallschritt zum Hüftbeuger', 'Das Gegenmittel zum Sitzen: vordere Hüfte lang.', 'movement', array['cat-body', 'cat-hips', 'cat-mobility', 'cat-pause']::text[], array['comp-hips', 'comp-back']::text[], '[{"pose":"stand","text":"Großer Schritt nach hinten mit dem rechten Fuß.","durationSec":8},{"pose":"lunge","text":"Hintere Ferse hebt, vordere Hüfte sinkt. Schambein leicht nach vorn-oben.","durationSec":16},{"pose":"stand","text":"Zurück zur Mitte.","durationSec":8},{"pose":"lungeOther","text":"Andere Seite, gleich lang bleiben.","durationSec":16},{"pose":"stand","text":"Aufrichten und nachspüren.","durationSec":8}]'::jsonb, 120, null, '{"kind":"daily","recommendedWeeks":4,"note":"Vier Wochen täglich je Seite, danach an Sitz-Tagen behalten."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-hip-open', null, 'Sitzender Hüftöffner', 'Eine Seite der Hüfte nach der anderen weich machen.', 'movement', array['cat-body', 'cat-hips', 'cat-evening', 'cat-mobility']::text[], array['comp-hips', 'comp-back']::text[], '[{"pose":"sit","text":"Aufrecht sitzen, ein Fuß vor dem anderen oder Fußgelenk auf dem Oberschenkel, wenn das Knie einverstanden ist.","durationSec":8},{"pose":"hipOpen","text":"Rechte Hüfte: Becken leicht nach vorn kippen. Atme in die Leiste.","durationSec":24},{"pose":"sit","text":"Wechsel die Seite. Nicht ziehen, nur bleiben.","durationSec":8},{"pose":"hipOpenOther","text":"Linke Hüfte, gleiche Dauer. Nicht ziehen, nur bleiben.","durationSec":24},{"pose":"sit","text":"Beide Sitzebeinhöcker wieder gleichmäßig aufsetzen.","durationSec":8}]'::jsonb, 150, null, '{"kind":"daily","recommendedWeeks":6,"note":"Abends 2 Minuten. Sechs Wochen sind ein guter erster Block."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-plank', null, 'Stütze auf den Unterarmen', 'Mitte anschalten, ohne den Atem anzuhalten.', 'movement', array['cat-body', 'cat-strength', 'cat-posture']::text[], array['comp-back']::text[], '[{"pose":"plank","text":"Unterarme parallel, Becken weder durchhängen noch spitz nach oben. Schau auf den Boden.","durationSec":20},{"pose":"child","text":"Knie ab, kurz in die Kindeshaltung und nachspüren.","durationSec":8}]'::jsonb, 40, null, '{"kind":"days","daysOfWeek":[2,4,6],"timesPerWeek":3,"recommendedWeeks":8,"note":"Drei Mal pro Woche, 20–40 Sekunden. Länger nur, wenn die Form bleibt."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-tree', null, 'Baum', 'Eine Minute Balance, die den Tag sammelt.', 'movement', array['cat-body', 'cat-strength', 'cat-mindfulness', 'cat-morning']::text[], array['comp-focus', 'comp-knees']::text[], '[{"pose":"stand","text":"Finde einen Punkt zum Anschauen. Gewicht auf den linken Fuß.","durationSec":8},{"pose":"tree","text":"Rechte Fußsohle an Waden oder Oberschenkel, nie gegen das Knie.","durationSec":16},{"pose":"stand","text":"Beide Füße, kurz sammeln.","durationSec":8},{"pose":"treeOther","text":"Andere Seite. Wenn du fällst, bist du mittendrin, nicht draußen.","durationSec":16},{"pose":"stand","text":"Wieder auf beiden Füßen.","durationSec":8}]'::jsonb, 80, null, '{"kind":"daily","recommendedWeeks":null,"note":"Morgens je Seite 20–30 Sekunden. Immer erlaubt, die Zehen am Boden zu lassen."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-warrior', null, 'Kriegerlicht', 'Standfestigkeit mit Länge in den Armen.', 'movement', array['cat-body', 'cat-strength', 'cat-hips', 'cat-morning']::text[], array['comp-hips', 'comp-focus']::text[], '[{"pose":"stand","text":"Weiter Ausfallschritt, hintere Ferse verankert, soweit es geht.","durationSec":8},{"pose":"warrior","text":"Rechtes Bein vorn, Knie über dem Fuß, Arme hoch. Atme in die Breite der Brust.","durationSec":20},{"pose":"stand","text":"Aufrichten, Seitenwechsel.","durationSec":8},{"pose":"warriorOther","text":"Linkes Bein vorn, gleiche Länge in den Armen.","durationSec":20},{"pose":"stand","text":"Wieder mittig stehen und nachspüren.","durationSec":8}]'::jsonb, 90, null, '{"kind":"days","daysOfWeek":[1,3,5],"timesPerWeek":3,"recommendedWeeks":4,"note":"Drei Mal pro Woche als Mini-Kraft und Fokus."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-chest-open', null, 'Brustöffner an der Tür', 'Den vorderen Schultergürtel erinnern, dass er länger sein darf.', 'movement', array['cat-body', 'cat-shoulders', 'cat-posture', 'cat-pause']::text[], array['comp-shoulders', 'comp-neck']::text[], '[{"pose":"stand","text":"Stell dich in einen Türrahmen oder verschränke die Hände hinter dem Rücken.","durationSec":8},{"pose":"chestOpen","text":"Brustbein hebt sich, Schulterblätter gleiten zur Gesäßtasche. Nacken bleibt lang.","durationSec":20},{"pose":"stand","text":"Lass los und schüttle die Arme aus.","durationSec":8}]'::jsonb, 70, null, '{"kind":"weekdays","recommendedWeeks":null,"note":"An Bürotagen, nach längeren Calls. Dauerhaft sinnvoll."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-twist', null, 'Sitzende Drehung', 'Eine ruhige Rotation für die Brustwirbelsäule.', 'movement', array['cat-body', 'cat-back', 'cat-mobility', 'cat-pause']::text[], array['comp-back']::text[], '[{"pose":"sit","text":"Sitzbeinhöcker geerdet, Wirbelsäule lang.","durationSec":8},{"pose":"twist","text":"Drehe dich nach einer Seite aus der Taille, nicht aus dem Kiefer.","durationSec":12},{"pose":"sit","text":"Mitte.","durationSec":8},{"pose":"twistOther","text":"Andere Seite, gleiche Dauer. Blick folgt zuletzt.","durationSec":12},{"pose":"sit","text":"Wieder zur Mitte.","durationSec":8}]'::jsonb, 80, null, '{"kind":"daily","recommendedWeeks":4,"note":"Täglich je Seite ein Atemfenster von 20 Sekunden."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-box-breath', null, 'Boxatmung', 'Vier Seiten, ein klarer Rhythmus.', 'breath', array['cat-body', 'cat-breath', 'cat-mind', 'cat-pause']::text[], array['comp-stress', 'comp-focus']::text[], '[{"pose":"sit","text":"Sitz oder Stand. Schultern schwer.","durationSec":8},{"pose":"breatheIn","text":"Vier Sekunden ein.","durationSec":4},{"pose":"breathe","text":"Vier Sekunden halten.","durationSec":4},{"pose":"breatheOut","text":"Vier Sekunden aus.","durationSec":4},{"pose":"sit","text":"Vier Sekunden Pause, dann die Runde wiederholen.","durationSec":4}]'::jsonb, 120, null, '{"kind":"daily","recommendedWeeks":null,"note":"Immer, wenn Unruhe kommt – und einmal geplant am Tag, damit du es nicht vergisst."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-478', null, '4-7-8 Atmung', 'Ein längeres Ausatmen, das das Nervensystem bremst.', 'breath', array['cat-body', 'cat-breath', 'cat-evening']::text[], array['comp-sleep', 'comp-stress']::text[], '[{"pose":"lie","text":"Liegen oder sitzen. Zungenspitze darf hinter den Schneidezähnen ruhen.","durationSec":8},{"pose":"lieInhale","text":"Einatmen, vier.","durationSec":4},{"pose":"lieHold","text":"Halten, sieben.","durationSec":7},{"pose":"lieExhale","text":"Ausatmen, acht. Vier Runden reichen.","durationSec":8},{"pose":"lie","text":"Danach nichts weiter tun. Einfach liegen bleiben.","durationSec":8}]'::jsonb, 100, null, '{"kind":"daily","recommendedWeeks":null,"note":"Abends im Bett oder davor. Dauerhaft im Plan lassen."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-coherent', null, 'Kohärentes Atmen', 'Etwa sechs Atemzüge pro Minute, ohne Technik-Theater.', 'breath', array['cat-body', 'cat-breath', 'cat-mindfulness']::text[], array['comp-stress', 'comp-focus']::text[], '[{"pose":"sit","text":"Bequem sitzen. Eine Hand am Bauch, wenn es hilft.","durationSec":8},{"pose":"breatheIn","text":"Fünf Sekunden ein, weich, durch die Nase wenn möglich.","durationSec":5},{"pose":"breatheOut","text":"Fünf Sekunden aus.","durationSec":5},{"pose":"sit","text":"Öffne die Augen, wenn sie zu waren, und nimm den Raum wieder wahr.","durationSec":8}]'::jsonb, 180, null, '{"kind":"daily","recommendedWeeks":8,"note":"Drei Minuten täglich für acht Wochen, danach nach Bedarf."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-mantra-here', null, 'Mantra: Ich bin hier', 'Ein Satz, der dich aus dem Vorher und Nachher holt.', 'mantra', array['cat-mind', 'cat-mantras', 'cat-mindfulness', 'cat-pause']::text[], array['comp-focus', 'comp-stress']::text[], '[{"pose":"heart","text":"Hand aufs Brustbein. Einatmen.","durationSec":8},{"pose":"heart","text":"Leise oder innerlich: „Ich bin hier.“ Ausatmen: „Genau jetzt.“","durationSec":20},{"pose":"stand","text":"Augen auf. Einen Gegenstand im Raum benennen.","durationSec":8}]'::jsonb, 60, null, '{"kind":"daily","recommendedWeeks":null,"note":"Morgens einmal bewusst, und jederzeit, wenn du merkst, dass du nur noch im Kopf bist."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-mantra-fit', null, 'Mantra: I am fit', 'Nicht als Behauptung über den Körper, sondern als Richtung.', 'mantra', array['cat-mind', 'cat-mantras', 'cat-morning']::text[], array['comp-focus']::text[], '[{"pose":"stand","text":"Zwei Fußsohlen auf dem Boden. Aufrecht, nicht militärisch.","durationSec":8},{"pose":"heart","text":"Sag langsam: „I am fit.“ Fit im Sinn von: ich bleibe in Verbindung mit dem, was mir guttut.","durationSec":24},{"pose":"reachUp","text":"Einmal strecken, als würdest du den Satz in den Tag heben.","durationSec":8},{"pose":"stand","text":"Fertig. Kein Extra-Beweis nötig.","durationSec":8}]'::jsonb, 75, null, '{"kind":"daily","recommendedWeeks":null,"note":"Täglich am Morgen, bevor das Handy die Stimmung setzt."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-gratitude', null, 'Drei Dankbarkeiten', 'Drei konkrete Dinge, nicht drei Slogans.', 'mind', array['cat-mind', 'cat-mindfulness', 'cat-evening']::text[], array['comp-sleep', 'comp-stress']::text[], '[{"pose":"sit","text":"Setz dich oder lieg. Kein Journal nötig, Stimme reicht.","durationSec":8},{"pose":"heart","text":"Nenne drei Dinge von heute. So konkret wie „das warme Wasser“ statt „mein Leben“.","durationSec":30},{"pose":"sit","text":"Einen Atemzug länger bleiben als du willst, dann aufhören.","durationSec":8}]'::jsonb, 90, null, '{"kind":"daily","recommendedWeeks":null,"note":"Abends. Immer. Es ist kurz genug, dass Vergessen die einzige Hürde ist."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-body-scan', null, 'Mini-Bodyscan', 'Vom Fuß bis zum Kiefer, ohne etwas zu reparieren.', 'mind', array['cat-mind', 'cat-meditation', 'cat-evening']::text[], array['comp-sleep', 'comp-stress']::text[], '[{"pose":"lie","text":"Liegen, Arme neben dem Körper, Füße fallen lassen.","durationSec":8},{"pose":"lieHold","text":"Wandere mit der Aufmerksamkeit: Füße, Knie, Becken, Rücken, Schultern, Kiefer.","durationSec":40},{"pose":"lie","text":"Wenn Gedanken kommen, zurück zum nächsten Körperteil. Fertig ist, wenn du bei den Augenlidern bist.","durationSec":8}]'::jsonb, 180, null, '{"kind":"daily","recommendedWeeks":4,"note":"Vier Wochen abends. Danach mindestens an unruhigen Tagen."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-54321', null, '5-4-3-2-1 Anker', 'Fünf Dinge sehen, vier berühren, drei hören, zwei riechen, eins schmecken.', 'mind', array['cat-mind', 'cat-mindfulness', 'cat-pause']::text[], array['comp-stress', 'comp-focus']::text[], '[{"pose":"stand","text":"Bleib, wo du bist. Kein Extra-Ort.","durationSec":8},{"pose":"heart","text":"5 Dinge, die du siehst. 4, die du fühlst. 3 Geräusche. 2 Gerüche. 1 Geschmack.","durationSec":30},{"pose":"stand","text":"Ein normaler Atemzug. Weiter mit dem, was als Nächstes da ist.","durationSec":8}]'::jsonb, 90, null, '{"kind":"every_n_days","everyNDays":1,"recommendedWeeks":null,"note":"Nicht starr planen: aufheben für Momente, in denen es kippt – und einmal pro Woche üben, damit der Weg bekannt ist."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-morning-reach', null, 'Morgenstrecken im Stand', 'Drei Atemzüge Länge, bevor der Tag dich übernimmt.', 'movement', array['cat-body', 'cat-morning', 'cat-mobility', 'cat-daily']::text[], array['comp-back', 'comp-shoulders']::text[], '[{"pose":"stand","text":"Noch im Schlafanzug ist erlaubt.","durationSec":8},{"pose":"reachUp","text":"Arme heben, seitlich lang werden, in die Fersen sinken.","durationSec":16},{"pose":"fold","text":"Einmal schwer hängen lassen.","durationSec":8},{"pose":"stand","text":"Aufrichten. Tag darf beginnen.","durationSec":8}]'::jsonb, 60, null, '{"kind":"daily","recommendedWeeks":null,"note":"Jeden Morgen, noch bevor Mails. Immer behalten."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-desk-break', null, 'Zwei-Minuten-Bildschirmpause', 'Nacken, Schultern, Atem – das, was du zwischen zwei Tasks vergisst.', 'movement', array['cat-daily', 'cat-pause', 'cat-neck', 'cat-shoulders']::text[], array['comp-neck', 'comp-shoulders', 'comp-focus']::text[], '[{"pose":"stand","text":"Steh auf. Ja, wirklich aufstehen.","durationSec":8},{"pose":"neckLeft","text":"Nacken zur einen Seite neigen.","durationSec":8},{"pose":"neckRight","text":"Zur anderen Seite.","durationSec":8},{"pose":"shrug","text":"Schultern einmal hoch – Arme bleiben hängen.","durationSec":6},{"pose":"chestOpen","text":"Brust öffnen, Schultern hinten-unten.","durationSec":8},{"pose":"standInhale","text":"Ein ruhiger Atemzug im Stand.","durationSec":4},{"pose":"standExhale","text":"Und aus, Schultern schwer.","durationSec":4}]'::jsonb, 120, null, '{"kind":"weekdays","recommendedWeeks":null,"note":"An Arbeitstagen, idealerweise zweimal. Der Plan erinnert dich an eine Runde; die zweite ist Bonus."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-jaw-release', null, 'Kiefer locker lassen', 'Zunge, Zähne und Schläfen erinnern, dass sie nicht arbeiten müssen.', 'movement', array['cat-body', 'cat-neck', 'cat-pause', 'cat-daily']::text[], array['comp-neck', 'comp-stress']::text[], '[{"pose":"sit","text":"Lippen geschlossen, Zähne nicht. Zunge hinter den Schneidezähnen ablegen.","durationSec":8},{"pose":"jawSoft","text":"Kiefer sinken lassen, Mund ganz leicht auf. Kein Dehnen.","durationSec":8},{"pose":"jawLeft","text":"Kiefer ein Stück nach links gleiten lassen.","durationSec":8},{"pose":"jawRight","text":"Und nach rechts. Nur Loslassen, nicht ziehen.","durationSec":8},{"pose":"shouldersDown","text":"Ein Atemzug in die Schläfen. Schultern dürfen mitfallen.","durationSec":8}]'::jsonb, 70, null, '{"kind":"weekdays","recommendedWeeks":null,"note":"An Arbeitstagen, sobald du merkst, dass die Zähne aufeinanderliegen."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-wrist-circles', null, 'Handgelenke kreisen', 'Zwei Kreise gegen das starre Tippen.', 'movement', array['cat-daily', 'cat-pause', 'cat-mobility']::text[], array['comp-shoulders', 'comp-focus']::text[], '[{"pose":"stand","text":"Arme vor dem Körper, Finger locker.","durationSec":8},{"pose":"wristsFlex","text":"Handgelenke nach vorn kippen.","durationSec":6},{"pose":"wristsExtend","text":"Und nach hinten. Langsam kreisen, dann die andere Richtung.","durationSec":8},{"pose":"shakeOut","text":"Hände ausschütteln, als wären sie nass.","durationSec":8}]'::jsonb, 60, null, '{"kind":"weekdays","recommendedWeeks":null,"note":"Unter der Woche zwischen zwei Schreibblöcken. Kurz genug, um es wirklich zu tun."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-eye-rest', null, 'Blick in die Ferne', 'Zwanzig Sekunden weit schauen, damit die Augen nicht nur den Bildschirm kennen.', 'mind', array['cat-daily', 'cat-pause', 'cat-mindfulness']::text[], array['comp-focus', 'comp-stress']::text[], '[{"pose":"sit","text":"Vom Schirm wegdrehen. Schultern schwer.","durationSec":8},{"pose":"gazeFar","text":"Einen Punkt in der Ferne wählen und 20 ruhige Sekunden dort bleiben.","durationSec":20},{"pose":"sit","text":"Blinzeln. Danach darf der Bildschirm wieder da sein.","durationSec":8}]'::jsonb, 50, null, '{"kind":"weekdays","recommendedWeeks":null,"note":"An Bildschirmtagen oft. Der Plan erinnert an eine Runde; weitere sind freiwillig."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-pelvic-tilt', null, 'Beckenkippen im Liegen', 'Kleine Bewegung für den unteren Rücken, ohne ihn zu verbiegen.', 'movement', array['cat-body', 'cat-back', 'cat-hips', 'cat-evening']::text[], array['comp-back', 'comp-hips']::text[], '[{"pose":"kneesUp","text":"Rückenlage, Knie aufgestellt, Füße am Boden.","durationSec":8},{"pose":"pelvicTuck","text":"Becken kippen: Lendenwirbel kurz zum Boden.","durationSec":10},{"pose":"pelvicArch","text":"Dann die natürliche Kurve wieder erlauben.","durationSec":10},{"pose":"kneesUp","text":"Still liegen und den Kontakt zum Boden spüren.","durationSec":8}]'::jsonb, 90, null, '{"kind":"daily","recommendedWeeks":4,"note":"Vier Wochen abends, danach an Tagen mit viel Sitzen behalten."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-calf-stretch', null, 'Waden an der Wand', 'Eine Seite nach der anderen lang machen, ohne zu federn.', 'movement', array['cat-body', 'cat-knees', 'cat-mobility', 'cat-daily']::text[], array['comp-knees', 'comp-hips']::text[], '[{"pose":"stand","text":"Hände an die Wand, ein Fuß weit hinten, hintere Ferse bleibt am Boden.","durationSec":8},{"pose":"calfWall","text":"Rechtes Bein vorn gebeugt, linke Wade lang. Hintere Ferse bleibt am Boden.","durationSec":16},{"pose":"stand","text":"Seite wechseln.","durationSec":8},{"pose":"calfWallOther","text":"Linkes Bein vorn, rechte Wade lang. Gleiche Länge.","durationSec":16},{"pose":"shakeOut","text":"Ausschütteln. Waden dürfen warm sein, nicht brennen.","durationSec":8}]'::jsonb, 80, null, '{"kind":"days","daysOfWeek":[1,3,5],"timesPerWeek":3,"recommendedWeeks":4,"note":"Drei Mal pro Woche, besonders nach langem Stehen oder Gehen in starren Schuhen."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-shoulder-dump', null, 'Schultern abladen', 'Ein Abendritual: hochziehen, fallen lassen, fertig.', 'movement', array['cat-daily', 'cat-evening', 'cat-shoulders']::text[], array['comp-shoulders', 'comp-stress', 'comp-sleep']::text[], '[{"pose":"stand","text":"Stehen oder sitzen. Einatmen, Schultern zu den Ohren.","durationSec":8},{"pose":"shrug","text":"Hochziehen.","durationSec":6},{"pose":"shouldersDown","text":"Ausatmen und die Schultern fallen lassen, schwerer als du denkst.","durationSec":10},{"pose":"shrug","text":"Noch einmal hoch.","durationSec":6},{"pose":"shouldersDown","text":"Wieder fallen lassen. Drei Runden reichen.","durationSec":10}]'::jsonb, 70, null, '{"kind":"daily","recommendedWeeks":null,"note":"Abends, wenn der Tag noch in den Schultern hängt. Dauerhaft sinnvoll."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z'),
('ex-walk-attention', null, 'Zwei Minuten gehen', 'Nur gehen und merken, dass die Füße den Boden treffen.', 'mind', array['cat-daily', 'cat-mindfulness', 'cat-pause']::text[], array['comp-focus', 'comp-stress']::text[], '[{"pose":"stand","text":"Aufstehen. Kein Ziel, nur ein paar Meter.","durationSec":8},{"pose":"walkLeft","text":"Langsam gehen. Linker Fuß nach vorn: Ferse, Fußballen, Zehen.","durationSec":8},{"pose":"walkRight","text":"Rechter Fuß. Gleich langsam.","durationSec":8},{"pose":"walkLeft","text":"Weiter: merken, dass der linke Fuß den Boden trifft.","durationSec":8},{"pose":"walkRight","text":"Und der rechte. Kein Trainingsspaziergang.","durationSec":8},{"pose":"stand","text":"Stehen bleiben. Einen Atemzug, dann zurück zu dem, was als Nächstes da ist.","durationSec":8}]'::jsonb, 120, null, '{"kind":"every_n_days","everyNDays":2,"recommendedWeeks":null,"note":"Alle zwei Tage, oder immer wenn der Kopf zu voll ist. Kein Trainingsspaziergang."}'::jsonb, '{"type":"catalog"}'::jsonb, true, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z')
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
