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
