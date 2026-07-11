-- Slide-deck videos persist their dir-plan.json (structured plan + per-scene VO)
-- so a single scene can be re-recorded/re-rendered later (Fix-a-Scene) without
-- redoing the whole video. slide_plan_url points at that stored JSON asset.
--
-- NOTE: prod does not run `supabase db push` — apply this SQL manually in the
-- Supabase SQL editor. Until then, the VPS writes it best-effort (its absence is
-- swallowed, so nothing breaks; the Fix-a-Scene UI just won't have the plan URL).

alter table if exists public.videos
  add column if not exists slide_plan_url text;

comment on column public.videos.slide_plan_url is
  'URL to the stored slide-deck plan JSON (plan + sceneMeta + per-scene VO refs) for single-scene re-render.';
