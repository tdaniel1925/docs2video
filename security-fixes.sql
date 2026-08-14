-- ============================================================================
-- SECURITY FIXES — run in Supabase → SQL Editor. Plain SQL, no markdown.
-- Run section by section, in order. Read STEP 0 output before changing things.
-- Everything here is reversible; nothing deletes customer data.
-- ============================================================================


-- ─── STEP 0 · SEE WHAT'S LIVE (read-only, changes nothing) ──────────────────
-- Run these two first and skim the results.

-- Which tables have row-level security ON? (rls_on = true means protected)
SELECT relname AS table_name, relrowsecurity AS rls_on
FROM pg_class
WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
ORDER BY relname;

-- Every policy that exists, and its rule:
SELECT tablename, policyname, cmd, qual AS using_rule, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- What to confirm in the output:
--  * brands, videos, jobs, notifications, credit_balances, credit_transactions,
--    flyer_rounds, flyer_designs, flyer_chats, clients  -> rls_on = true, and
--    their rule mentions auth.uid() = user_id (owner-scoped).
--  * NO policy named "Anyone can view completed videos" on videos (if present,
--    run STEP 4).
--  * api_keys, api_credit_balances, api_usage_log -> rls_on = true.
-- If an expected table shows rls_on = false, its securing migration never ran.


-- ─── STEP 1 · MAKE THE FLYER-DESIGN BUCKET PRIVATE (the #1 fix) ─────────────
-- creation-assets is public, so anyone with a path can pull a flyer that may
-- carry a client's name/address/phone. The app already serves these via signed
-- URLs with an ownership check, so this should be transparent.

UPDATE storage.buckets SET public = false WHERE id = 'creation-assets';
DROP POLICY IF EXISTS "Anyone can view creation assets" ON storage.objects;

-- After running: open/re-download a saved flyer in the app. If an image 404s,
-- a spot still used a public URL — tell Claude to switch it to a signed one.


-- ─── STEP 2 · SKIP — decided to leave logo/brand buckets public ────────────
-- DO NOT RUN THE UPDATE/DROP BELOW. Decision (2026): leave logos and
-- brand-assets public. Reasons: the app serves them via getPublicUrl in
-- several places (upload-logo, templates, brand page, template-demo,
-- logo-styler) and SAVES those long-lived URLs onto brands/videos — flipping
-- the bucket private would break every saved logo across the app and in
-- generated designs. A company's own logo is low-sensitivity (already public
-- on their site), and paths are scoped under each user's id. Not worth a
-- signed-URL rewrite. videos + infographics stay public for the same reason
-- (share links).
--
-- If you ever DO want these private, ask Claude to switch the reads to signed
-- URLs FIRST, then run:
--   UPDATE storage.buckets SET public = false WHERE id IN ('logos','brand-assets');
--   DROP POLICY IF EXISTS "Anyone can view logos" ON storage.objects;
--   DROP POLICY IF EXISTS "Anyone can view brand assets" ON storage.objects;
--
-- (Harmless to run — just shows the buckets:)
SELECT id, public FROM storage.buckets ORDER BY id;


-- ─── STEP 3 · CLOSE THE ANON HOLES ON affiliates / referrals ───────────────
-- These let ANY anonymous caller read/write/delete every row. The service role
-- bypasses RLS, so it does not need this policy at all.

DROP POLICY IF EXISTS "Service can manage affiliates" ON affiliates;
DROP POLICY IF EXISTS "Service can manage referrals" ON referrals;

-- After: these tables are RLS-on with no policy = deny-all to anon/user,
-- service-role still full. Test the affiliate dashboard once.


-- ─── STEP 4 · KILL STALE "anyone can view completed videos" (only if STEP 0
--             showed it on videos) ─────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can view completed videos" ON public.videos;


-- ─── STEP 5 · LOCK chat_messages (share-page chat) ─────────────────────────
-- These two policies let ANYONE read every share-page chat across all videos,
-- and post to any. The app never needs them: /api/chat does all reads/writes
-- with the service role (which bypasses RLS), scoped to one videoId. Dropping
-- them makes chat_messages RLS-on with no anon/user policy = deny-all to the
-- public, service-role still full. Nothing in the app breaks.

DROP POLICY IF EXISTS "Anyone can view chat messages for a video" ON chat_messages;
DROP POLICY IF EXISTS "Anyone can insert chat messages" ON chat_messages;

-- After: open a share/watch page and use the chat. It still works (server-side
-- via /api/chat). If it stops, tell Claude — but it shouldn't, verified in code.


-- ─── AFTER STEPS 1–5 · RE-CHECK ────────────────────────────────────────────
-- Re-run STEP 0's two queries. Confirm:
--  * creation-assets (and any you locked) show public = false
--  * none of these policies remain: "Anyone can view creation assets",
--    "Service can manage affiliates", "Service can manage referrals",
--    "Anyone can view completed videos"
--  * every per-user table is rls_on = true
-- Then smoke-test: make a flyer, open a saved one, load the affiliate page.
