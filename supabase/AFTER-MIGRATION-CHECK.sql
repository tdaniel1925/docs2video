-- ============================================================================
-- RUN THIS AFTER THE MIGRATION. It reads; it changes nothing.
--
-- The migration fixed the schema going forward. These questions are about
-- what happened BEFORE it ran — specifically whether customers were charged
-- for video renders that failed, while the refund job was broken.
--
-- Every statement is a SELECT. Nothing here alters anything.
-- ============================================================================


-- ── 1. Did the migration actually land? ────────────────────────────────────
-- Four columns and one constraint. Anything marked MISSING means that part of
-- the migration did not apply, and the matching fault is still live.
--
-- WANT: four rows, all 'ok'.
select
  want.column_name,
  case when c.column_name is null then 'MISSING' else 'ok' end as status,
  want.what_breaks_without_it
from (values
  ('slide_urls',        'Failed renders are never refunded'),
  ('slide_plan_url',    'Fix-a-Scene never appears'),
  ('scene_preview_url', 'The preview-voice spinner never resolves'),
  ('total_scenes',      'Scene counts read as null')
) as want(column_name, what_breaks_without_it)
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name   = 'videos'
 and c.column_name  = want.column_name
order by status desc, want.column_name;


-- ── 2. Can "ban user" ban anybody now? ─────────────────────────────────────
-- WANT: 'ok — bans take effect'.
select
  case when pg_get_constraintdef(oid) like '%banned%'
       then 'ok — bans take effect'
       else 'STILL BROKEN — the ban silently does nothing' end as verdict,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.profiles'::regclass
  and conname like '%subscription_status%';


-- ── 3. Is anything still readable with the public key? ─────────────────────
-- The anon key ships in your page source, so treat it as public. A policy
-- whose condition is `true` lets that key read the table across every
-- customer. Postgres ORs permissive policies together, so one of these
-- undoes any correct owner-scoped policy sitting beside it.
--
-- WANT: no rows.
select
  tablename,
  policyname,
  cmd,
  qual as still_permissive
from pg_policies
where schemaname = 'public'
  and (qual = 'true' or qual is null)
order by tablename, policyname;


-- ── 4. THE MONEY QUESTION ─────────────────────────────────────────────────
-- Videos that failed and still carry an outstanding charge.
--
-- While slide_urls was missing, the stuck-video cron's whole query failed, so
-- nothing swept these. Each row is a customer who paid for a render that
-- never arrived — and who was told on screen that their credits came back.
--
-- The migration stops this happening again. It does NOT refund the ones that
-- already happened; that is question 5.
--
-- WANT: zero. Any other number is money owed.
select
  count(*)                        as failed_videos_still_charged,
  coalesce(sum(deducted_cost), 0) as credits_owed_back,
  min(created_at)                 as oldest,
  max(created_at)                 as newest
from public.videos
where status = 'failed'
  and coalesce(deducted_cost, 0) > 0;


-- ── 5. Who, exactly, and how much each ────────────────────────────────────
-- The list to act on if question 4 came back non-zero. One row per customer.
--
-- Deliberately NOT a refund script. Refunding automatically from a query is
-- how you double-refund somebody who was already made whole by hand — and
-- addTopupCredits has an idempotency key for exactly this reason. Read the
-- list first, then decide.
select
  v.user_id,
  p.email,
  count(*)                          as failed_videos,
  coalesce(sum(v.deducted_cost), 0) as credits_owed,
  max(v.created_at)                 as most_recent
from public.videos v
left join public.profiles p on p.id = v.user_id
where v.status = 'failed'
  and coalesce(v.deducted_cost, 0) > 0
group by v.user_id, p.email
order by credits_owed desc
limit 50;


-- ── 6. Is the cron working now? ───────────────────────────────────────────
-- The stuck-video cron runs every two minutes and refunds renders that died.
-- With the column back it should be finding and clearing these on its own.
--
-- Run question 4 again in ten minutes. If the number is falling, the cron is
-- doing its job and you need do nothing further. If it is static, the refunds
-- need a hand.
--
-- This shows what the cron is looking at right now.
select
  status,
  count(*) as videos,
  count(*) filter (where coalesce(deducted_cost, 0) > 0) as still_charged
from public.videos
where created_at > now() - interval '30 days'
group by status
order by videos desc;
