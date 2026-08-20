-- I am fit: Schema, RLS and catalog seed.
-- Paste this entire file into the Supabase SQL editor and run it once.

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
  default_duration_sec integer not null default 60,
  default_reps integer,
  suggested_rhythm jsonb not null default '{}'::jsonb,
  source jsonb not null default '{"type":"catalog"}'::jsonb,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plan_items (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
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

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  reminder_enabled boolean not null default true,
  reminder_time text not null default '08:30',
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;
alter table public.complaints enable row level security;
alter table public.exercises enable row level security;
alter table public.plan_items enable row level security;
alter table public.completions enable row level security;
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

drop policy if exists "plan_owner" on public.plan_items;
create policy "plan_owner" on public.plan_items
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "completions_owner" on public.completions;
create policy "completions_owner" on public.completions
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "profiles_owner" on public.profiles;
create policy "profiles_owner" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
