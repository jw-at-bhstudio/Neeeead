-- Enable required extension for UUID generation.
create extension if not exists "pgcrypto";

-- 1) Enum: creature visibility / lifecycle status.
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'creature_status'
      and n.nspname = 'public'
  ) then
    create type public.creature_status as enum ('private_draft', 'public_pool', 'archived');
  end if;
end $$;

-- 2) Profiles: app-level extension on top of auth.users.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) Creatures: core table.
create table if not exists public.creatures (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '未命名捏物',
  status public.creature_status not null default 'private_draft',
  seed double precision not null,
  params jsonb not null default '{}'::jsonb,
  shape jsonb not null default '{}'::jsonb,
  eyes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4) Common indexes.
create index if not exists idx_creatures_creator_id on public.creatures (creator_id);
create index if not exists idx_creatures_owner_id on public.creatures (owner_id);
create index if not exists idx_creatures_status on public.creatures (status);
create index if not exists idx_creatures_created_at_desc on public.creatures (created_at desc);

-- 5) updated_at trigger helper.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_creatures_set_updated_at on public.creatures;
create trigger trg_creatures_set_updated_at
before update on public.creatures
for each row execute function public.set_updated_at();

-- 6) RLS.
alter table public.profiles enable row level security;
alter table public.creatures enable row level security;

-- Profiles: readable by authenticated users, mutable only by self.
drop policy if exists "profiles_read_authenticated" on public.profiles;
create policy "profiles_read_authenticated"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Creatures: public_pool readable by anyone; owners can read/write their own.
drop policy if exists "creatures_public_read" on public.creatures;
create policy "creatures_public_read"
on public.creatures
for select
to anon, authenticated
using (
  status = 'public_pool'
  or auth.uid() = owner_id
  or auth.uid() = creator_id
);

drop policy if exists "creatures_insert_self" on public.creatures;
create policy "creatures_insert_self"
on public.creatures
for insert
to authenticated
with check (
  auth.uid() = creator_id
  and auth.uid() = owner_id
);

drop policy if exists "creatures_update_self" on public.creatures;
create policy "creatures_update_self"
on public.creatures
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "creatures_delete_self" on public.creatures;
create policy "creatures_delete_self"
on public.creatures
for delete
to authenticated
using (auth.uid() = owner_id);
