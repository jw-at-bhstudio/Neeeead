<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1qndsNd-0_WYd2DNbEtWBT4ueI51XF_YA

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Copy environment template and fill Supabase values:
   `cp .env.local.example .env.local`
3. Run the app:
   `npm run dev`

## Supabase Phase 1 (Local + DB Schema + RLS)

### Option A: Supabase CLI

1. Install/check CLI:
   `npx supabase --version`
2. Init in project root:
   `npx supabase init`
3. Login and link project:
   `npx supabase login`
   `npx supabase link --project-ref <your-project-ref>`
4. Push schema:
   `npx supabase db push`

### Option B: Built-in migration runner (no Supabase CLI)

1. Copy migrate env template:
   `cp .env.migrate.example .env.migrate`
2. Set real `DATABASE_URL` in `.env.migrate`
3. Run migrations:
   `npm run db:migrate`

This repo already includes the first migration:
`supabase/migrations/20260422150000_init_users_creatures_rls.sql`

### What the migration contains

- `profiles` table (extends `auth.users`)
- `creatures` core table
- `creature_status` enum (`private_draft`, `public_pool`, `archived`)
- RLS policies:
  - users can write only their own records
  - `public_pool` creatures are publicly readable
- indexes:
  - `creator_id`, `owner_id`, `status`, `created_at`

## Frontend Supabase files

- browser client: `lib/supabase/client.ts`
- DB typing: `lib/supabase/database.types.ts`
- minimal data access:
  - `getCurrentUser()`
  - `saveMyCreatureDraft()`
  - `listPublicCreatures()`
  - file: `lib/supabase/creatures.ts`

## Migration runner details

- runner file: `scripts/migrate.mjs`
- migration source: `supabase/migrations/*.sql`
- tracking table: `public.schema_migrations`
- safety:
  - migration checksum validation
  - per-migration transaction
  - advisory lock to avoid parallel execution

## Phase 1 verification checklist

1. Unauthenticated user check (should be `null`):
   - call `getCurrentUser()`
2. Insert one draft creature when logged in:
   - call `saveMyCreatureDraft({ seed: Math.random(), params: {}, shape: {}, eyes: [] })`
3. Query public pool:
   - call `listPublicCreatures()`
