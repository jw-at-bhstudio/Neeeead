-- 1) owner_id needs to be nullable to support "Release" (放生) feature
alter table public.creatures alter column owner_id drop not null;

-- 2) Update RLS policies to handle null owner_id
drop policy if exists "creatures_update_self" on public.creatures;
create policy "creatures_update_self"
on public.creatures
for update
to authenticated
using (auth.uid() = owner_id)
with check (
  auth.uid() = owner_id or owner_id is null
);

-- 3) Add sound mimic column (for "发出声音")
alter table public.creatures add column if not exists sound_mimic text not null default '哇呜';

-- 4) Make title globally unique. First, deduplicate existing titles.
update public.creatures 
set title = title || '-' || substr(id::text, 1, 4)
where id in (
  select id from (
    select id, row_number() over (partition by title order by created_at) as rn
    from public.creatures
  ) t where rn > 1
);

alter table public.creatures drop constraint if exists uq_creatures_title;
alter table public.creatures add constraint uq_creatures_title unique (title);

-- 5) Add a unique index for the generation parameters to prevent exact duplicates
-- Deduplicate existing rows on the target uniqueness key before creating the index.
-- Keep the earliest row unchanged and slightly perturb later rows' seed.
with ranked as (
  select
    id,
    row_number() over (
      partition by
        seed,
        (params->>'numPoints'),
        (params->>'irregularity'),
        (params->>'complexity'),
        (params->>'roundness'),
        (params->>'strokeOffset')
      order by created_at, id
    ) as rn
  from public.creatures
)
update public.creatures c
set seed = c.seed + (ranked.rn - 1) * 0.000001
from ranked
where c.id = ranked.id
  and ranked.rn > 1;

drop index if exists idx_creatures_unique_params;
create unique index idx_creatures_unique_params 
on public.creatures (
  seed, 
  (params->>'numPoints'), 
  (params->>'irregularity'), 
  (params->>'complexity'), 
  (params->>'roundness'), 
  (params->>'strokeOffset')
);
