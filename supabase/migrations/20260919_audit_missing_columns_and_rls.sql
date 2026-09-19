-- ============================================================================
-- FROM THE FULL-CODEBASE AUDIT — the schema half.
--
-- Every statement here is IF NOT EXISTS / IF EXISTS and can be run more than
-- once safely. If prod already has these, this is a no-op that costs nothing;
-- if it does not, this is the difference between a working refund path and a
-- silent one.
--
-- WHY THIS FILE EXISTS AT ALL. Production does not run `supabase db push`, so
-- committed migrations land in the repo and not in the database. The code then
-- references columns that are not there, and supabase-js returns the failure
-- as a VALUE rather than throwing — so a try/catch never fires and the app
-- carries on as if the query worked.
-- ============================================================================


-- ── 1. videos.slide_urls — the one that can cost customers money ────────────
--
-- Written by about eight routes and read by the public API. The dangerous
-- reader is the stuck-video cron, which names it in a .select():
--
--   app/api/cron/fix-stuck-videos/route.ts:128
--
-- A .select() naming a column that does not exist does not return partial
-- data — it 400s the WHOLE query and returns no rows. That cron is the only
-- path that refunds a render which died on the VPS (the VPS acknowledges the
-- job early, then writes status:'failed' itself, so nothing else sweeps it).
--
-- So if this column is missing in prod, every customer whose render fails
-- stays charged while the screen tells them their credits were refunded.
--
-- This repo has hit the same shape before, documented in the watch route: "a
-- .select() naming a column absent in prod 400s the whole query, so every
-- share link is dead."
--
-- It is very likely present from the hand-run era. That is exactly why it is
-- worth one idempotent statement rather than an assumption.
alter table if exists public.videos
  add column if not exists slide_urls jsonb;

comment on column public.videos.slide_urls is
  'Slide-deck videos: the rendered slide images, in order. Read by the stuck-video refund cron and the public API.';


-- ── 2. The Fix-a-Scene columns, which were written but never tracked ────────
--
-- These lived in supabase/20260710_slide_plan_url.sql — a file OUTSIDE
-- migrations/, whose own header says to apply it by hand. Re-stated here so a
-- fresh `db push` builds a schema the app can actually write to.
--
-- What breaks while they are missing: the Fix-a-Scene control is gated on
-- slide_plan_url, so it never appears for any slide-deck video. The
-- preview-voiceover poll is wrapped in try/catch, but supabase-js returns
-- errors as values rather than throwing — so the catch never fires and the
-- customer watches a spinner that can never resolve.
alter table if exists public.videos
  add column if not exists slide_plan_url text,
  add column if not exists scene_preview_url text,
  add column if not exists total_scenes int;

comment on column public.videos.slide_plan_url is
  'URL to the stored slide-deck plan JSON (plan + sceneMeta + per-scene VO refs) for single-scene re-render.';
comment on column public.videos.scene_preview_url is
  'Fix-a-Scene: URL of the most recent preview voiceover clip, before a scene re-render is committed.';


-- ── 3. "Banned" was never a status the database would accept ───────────────
--
-- The admin "ban user" action writes subscription_status = 'banned', and the
-- CHECK constraint does not list it. Postgres rejects the update; the route
-- does not check the error it gets back; the admin screen reports success.
--
-- So an account you believe you banned keeps generating videos on your API
-- spend, and the enforcement check in credits.ts that reads 'banned' is
-- unreachable code.
--
-- The constraint is rebuilt rather than edited because Postgres has no
-- "add a value to a CHECK" — and it is dropped by name first so re-running
-- this file is safe.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then
    alter table public.profiles
      drop constraint if exists profiles_subscription_status_check;

    alter table public.profiles
      add constraint profiles_subscription_status_check
      check (subscription_status in (
        'trial', 'active', 'past_due', 'canceled', 'inactive',
        'starter', 'pro', 'business', 'enterprise',
        'banned'
      ));
  end if;
end $$;


-- ── 4. Tables left readable by anyone holding the public key ───────────────
--
-- NEXT_PUBLIC_SUPABASE_ANON_KEY ships inside the browser bundle, so it is not
-- a secret — anyone can read it from the page and query the REST endpoint
-- directly. These tables carry `FOR ALL USING (true)` policies from the
-- legacy SQL files, which means that key can read them across every customer.
--
-- The hardening migration added correct owner-scoped policies for jobs and
-- notifications, but never dropped the permissive ones by name. Postgres ORs
-- permissive policies together, so the good policy is decorative while the
-- old one stands. (videos WAS cleaned up correctly in the same file, so this
-- is an oversight in one place rather than a design failure.)
--
-- Each drop is guarded by a table-exists check so this runs on any subset of
-- the schema.
do $$
declare
  t text;
  p text;
begin
  for t, p in
    select * from (values
      ('jobs',                  'Users can view their own jobs'),
      ('jobs',                  'Enable all access for authenticated users'),
      ('notifications',         'Enable all access for authenticated users'),
      ('prospect_demos',        'Enable all access for authenticated users'),
      ('try_demos',             'Enable all access for authenticated users'),
      ('social_campaigns',      'Enable all access for authenticated users'),
      ('social_campaign_posts', 'Enable all access for authenticated users'),
      ('chat_messages',         'Enable all access for authenticated users')
    ) as x(t, p)
  loop
    if exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = p
    ) then
      execute format('drop policy %I on public.%I', p, t);
      raise notice 'dropped permissive policy % on %', p, t;
    end if;
  end loop;
end $$;


-- ── 5. daily_user_spend had no row-level security at all ──────────────────
--
-- Created twice across the legacy files and never locked down. With RLS off,
-- the public key reads per-customer, per-day spend for the whole customer
-- base. Likely empty unless cost ceilings are switched on — which is a reason
-- to fix it now rather than a reason to leave it.
--
-- Enabled with no policy, which denies everyone. The only reader is the
-- server using the service-role key, and that bypasses RLS by design.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'daily_user_spend'
  ) then
    alter table public.daily_user_spend enable row level security;
  end if;
end $$;
