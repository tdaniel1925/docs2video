-- SECURITY FIX (pre-launch audit, critical): remove over-permissive RLS that
-- exposed customer PII to the public anon key. The service-role admin client
-- bypasses RLS, so server code using createAdminClient() is unaffected — these
-- DROPs only close the anon-key read/write/delete hole.
--
-- Run in the Supabase SQL editor. After running, the public pages that read
-- these tables MUST go through server endpoints (createAdminClient), which this
-- release does.

-- 1. campaigns / campaign_contacts — were FOR ALL USING(true) (anon could
--    dump + tamper every prospect's PII across all campaigns).
DROP POLICY IF EXISTS "Admin full access campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Admin full access contacts" ON public.campaign_contacts;
-- No replacement policy = no anon/auth access at all (RLS default deny).
-- Server code reaches them via the service role.

-- 2. clients / client_activities — a permissive FOR ALL USING(true) sat
--    alongside the correct per-user SELECT and defeated it.
DROP POLICY IF EXISTS "Service manages clients" ON public.clients;
DROP POLICY IF EXISTS "Service manages activities" ON public.client_activities;
-- Keep the per-user SELECT policies ("Users view own clients/activities") so a
-- logged-in user can still read their own rows via the anon client; all writes
-- go through server routes (service role).

-- 3. quotes — "Anyone can view sent quotes" USING(status != 'draft') let anon
--    enumerate every non-draft quote platform-wide.
DROP POLICY IF EXISTS "Anyone can view sent quotes" ON public.quotes;
-- The public watch page now reads the quote via a server endpoint
-- (createAdminClient, scoped to the video's quote). Owner access is preserved
-- by "Users can manage own quotes" (auth.uid() = user_id).
