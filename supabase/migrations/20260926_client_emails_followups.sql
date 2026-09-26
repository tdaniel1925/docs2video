-- ============================================================================
-- CLIENT EMAILS, AUTOMATIC FOLLOW-UPS, AND VIEW ALERTS (audit 2026-09-26: C5, H9)
--
-- Every statement is IF NOT EXISTS / IF EXISTS and safe to run more than once.
-- NOT applied automatically — production migrations are run by hand.
--
-- WHAT THE CODE DOES WHILE THIS IS MISSING (it must fail safe):
--   * Automatic follow-ups never send. The cron reads quotes.auto_follow_up
--     and sent_emails.quote_id; if either is missing it stops before sending
--     anything. No column, no email — never "no column, so email everyone".
--   * Share emails still send. The tracking row falls back to the original
--     columns (to_email, subject) so open-tracking keeps working.
--   * The client unsubscribe link still records the opt-out once this runs;
--     until then the unsubscribe page says it could not save and the cron
--     cannot send anyway (see the first point).
--   * View alerts keep their old behavior ("every new viewer"), rate-limited.
-- ============================================================================


-- ── 1. sent_emails: one shape for every writer ─────────────────────────────
--
-- The table was created with to_email / created_at. One writer (the share
-- email) inserted recipient / sent_at / email_type instead — columns that
-- do not exist in that definition, so its insert failed and open-tracking
-- silently broke. The code now writes to_email everywhere; these two columns
-- are the only additions it needs:
--   email_type — 'share', 'follow_up_3day', 'follow_up_7day', ...
--   quote_id   — which quote an automatic follow-up belongs to, so the cron
--                sends each stage once per quote and never repeats it.
alter table if exists public.sent_emails
  add column if not exists email_type text,
  add column if not exists quote_id uuid references public.quotes(id) on delete set null;

-- One row per quote per follow-up stage, enforced by the database. The cron
-- writes this row BEFORE it sends, so two overlapping runs cannot both send
-- the same stage: the second insert fails and that run skips the quote.
create unique index if not exists uq_sent_emails_quote_stage
  on public.sent_emails (quote_id, email_type)
  where quote_id is not null;
create index if not exists idx_sent_emails_video_type
  on public.sent_emails (video_id, email_type);


-- ── 2. quotes: automatic follow-ups are OFF unless the agent turns them on ──
--
-- The follow-up cron used to email every client with a quote still marked
-- "sent" — which was every quote, because nothing ever marked one paid. The
-- agent never asked for it. Default false, so existing quotes stay quiet.
alter table if exists public.quotes
  add column if not exists auto_follow_up boolean not null default false,
  add column if not exists accepted_at timestamptz;


-- ── 3. email_suppressions: "stop emailing me" from a client ────────────────
--
-- Scoped to ONE agent: unsubscribing from Jane's follow-ups does not stop
-- Bob's. Written only by the service role (the unsubscribe link is signed, so
-- nobody can unsubscribe someone else by editing a URL).
create table if not exists public.email_suppressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  reason text default 'unsubscribe',
  created_at timestamptz not null default now(),
  unique (user_id, email)
);

alter table public.email_suppressions enable row level security;

-- Agents can SEE who opted out (so the app can explain why no email went).
-- No insert/update/delete policy: only the service role writes here.
drop policy if exists email_suppressions_owner_select on public.email_suppressions;
create policy email_suppressions_owner_select on public.email_suppressions
  for select using (auth.uid() = user_id);


-- ── 4. profiles.view_alerts: how loud "someone watched" should be ──────────
--   'all'   — every new viewer (with a cooldown so one person is one alert)
--   'first' — only the first time each viewer opens a video
--   'off'   — no email or text; views still show in the dashboard
alter table if exists public.profiles
  add column if not exists view_alerts text not null default 'all';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_view_alerts_check'
  ) then
    alter table public.profiles
      add constraint profiles_view_alerts_check
      check (view_alerts in ('all', 'first', 'off'));
  end if;
end $$;
