-- SOC 2 hardening: replace the permissive `USING (true)` policies on the social
-- tables with owner-scoped ones, so a row is only visible/writable by the user
-- who owns it. The app already does ownership checks in its API routes; this
-- makes the DATABASE enforce it too (defence in depth, and what an auditor wants).
--
-- Safe to run more than once. Run in the Supabase SQL editor on production.

-- ── social_campaigns ────────────────────────────────────────────────────────
ALTER TABLE public.social_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service can manage campaigns" ON public.social_campaigns;
DROP POLICY IF EXISTS "Users manage own campaigns"   ON public.social_campaigns;

CREATE POLICY "Users manage own campaigns"
  ON public.social_campaigns
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── social_campaign_posts ───────────────────────────────────────────────────
-- Each post carries its own user_id, so scope directly on it.
ALTER TABLE public.social_campaign_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service can manage campaign posts" ON public.social_campaign_posts;
DROP POLICY IF EXISTS "Users manage own campaign posts"   ON public.social_campaign_posts;

CREATE POLICY "Users manage own campaign posts"
  ON public.social_campaign_posts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- NOTE: the app's server routes use the service-role key, which BYPASSES RLS by
-- design — those routes already verify ownership in code (ownsCampaign()). These
-- policies protect any path that uses the user's own (anon) session.
