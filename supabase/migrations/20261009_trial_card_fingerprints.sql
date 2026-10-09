-- One card, one free trial (audit 2026-10-09).
--
-- /api/confirm-card records the Stripe card fingerprint of the card that
-- starts each free trial. A second account presenting the same card is
-- refused. fingerprint is the PRIMARY KEY so two accounts racing with the same
-- card can't both win.
--
-- No foreign key to auth.users on purpose: deleting the account must NOT free
-- the card for another free trial.
--
-- MUST BE RUN BY HAND IN PRODUCTION BEFORE THE APP IS DEPLOYED. Without this
-- table confirm-card refuses every NEW free trial (it fails closed and emails
-- the owner). Run in the Supabase SQL editor.

create table if not exists public.trial_card_fingerprints (
  fingerprint text primary key,
  user_id uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists trial_card_fingerprints_user_id_idx
  on public.trial_card_fingerprints (user_id);

-- Service role only: RLS on and no policies, so no signed-in user can read
-- or write it (the app uses the service-role client, which bypasses RLS).
alter table public.trial_card_fingerprints enable row level security;
revoke all on public.trial_card_fingerprints from anon, authenticated;

-- Check it exists (should return 0 rows, not an error):
--   select * from public.trial_card_fingerprints limit 1;
