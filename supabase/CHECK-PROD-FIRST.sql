-- ============================================================================
-- RUN THIS FIRST. It reads; it changes nothing.
--
-- Paste into the Supabase SQL editor for PRODUCTION and read the answers.
-- It tells you which of the audit's schema findings are real on your
-- database, so you are not fixing things that are already fine or assuming
-- things that are not.
--
-- Everything here is a SELECT. There is no ALTER, no DROP, no UPDATE.
-- ============================================================================


-- ── 1. THE EXPENSIVE ONE ───────────────────────────────────────────────────
-- videos.slide_urls is named in the stuck-video cron's .select(). If it is
-- missing, that query 400s entirely and returns nothing — and it is the only
-- path that refunds a render that died on the VPS. Missing means every failed
-- render stays charged while the screen says the credits came back.
--
-- WANT: one row saying 'slide_urls'. No rows = customers are being charged
-- for failed renders right now.
select
  'slide_urls' as looking_for,
  count(*)     as found,
  case when count(*) = 0
       then 'MISSING — failed renders are not being refunded'
       else 'present — the refund cron can run' end as verdict
from information_schema.columns
where table_schema = 'public' and table_name = 'videos' and column_name = 'slide_urls';


-- ── 2. The Fix-a-Scene columns ─────────────────────────────────────────────
-- Missing means the Fix-a-Scene control never appears, and the preview-voice
-- spinner never resolves — with no error anywhere, because supabase-js
-- returns the failure as a value rather than throwing.
--
-- WANT: three rows.
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'videos'
  and column_name in ('slide_plan_url', 'scene_preview_url', 'total_scenes')
order by column_name;


-- ── 3. Can "ban user" actually ban anybody? ────────────────────────────────
-- The admin action writes subscription_status = 'banned'. If that value is
-- not in the CHECK constraint, Postgres rejects the write, the route does not
-- look at the error, and the screen says it worked. The account carries on
-- generating videos on your API spend.
--
-- WANT: the printed constraint to contain the word 'banned'.
select
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition,
  case when pg_get_constraintdef(oid) like '%banned%'
       then 'ok — bans take effect'
       else 'BROKEN — the ban silently does nothing' end as verdict
from pg_constraint
where conrelid = 'public.profiles'::regclass
  and conname like '%subscription_status%';


-- ── 4. What can the PUBLIC key read? ───────────────────────────────────────
-- The anon key ships in the browser bundle, so treat it as public. A policy
-- with a `true` expression means anyone can read that table across every
-- customer. Postgres ORs permissive policies, so ONE of these undoes any
-- correct owner-scoped policy sitting beside it.
--
-- WANT: no rows.
select
  tablename,
  policyname,
  cmd,
  qual as using_expression
from pg_policies
where schemaname = 'public'
  and (qual = 'true' or qual is null)
  and tablename in (
    'jobs', 'notifications', 'prospect_demos', 'try_demos',
    'social_campaigns', 'social_campaign_posts', 'chat_messages', 'videos'
  )
order by tablename, policyname;


-- ── 5. Customer tables with row-level security switched OFF ────────────────
-- RLS off is not "no policy" — it is no protection at all. Anything listed
-- here is readable with the public key by anyone who views source.
--
-- WANT: no rows, or only tables you know hold nothing private.
select
  c.relname as table_name,
  'RLS IS OFF' as verdict
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity = false
  and c.relname in (
    'videos', 'profiles', 'jobs', 'notifications', 'clients',
    'daily_user_spend', 'prospect_demos', 'try_demos',
    'chat_messages', 'social_campaigns', 'social_campaign_posts',
    'api_keys', 'credit_ledger', 'affiliate_commissions'
  )
order by c.relname;


-- ── 6. How much money is this actually about? ─────────────────────────────
-- Videos that failed and still carry an outstanding charge. If question 1
-- said MISSING, these are the customers who paid for nothing.
--
-- Safe to run even if the columns differ — it only reads.
select
  count(*)                         as failed_videos_still_charged,
  coalesce(sum(deducted_cost), 0)  as credits_owed_back
from public.videos
where status = 'failed'
  and coalesce(deducted_cost, 0) > 0;
