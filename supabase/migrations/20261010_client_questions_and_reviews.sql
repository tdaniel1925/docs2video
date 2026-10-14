-- CLIENT QUESTIONS (AI answers the agent approves) + ANNUAL REVIEWS
-- (built 2026-10-10).
--
-- MUST BE RUN BY HAND IN PRODUCTION (Supabase SQL editor) BEFORE THE APP IS
-- DEPLOYED. Until it runs, the code fails safe:
--   * questions: the share page's "Ask a question" keeps working the old way
--     (it emails the agent), no AI draft is made, the Questions screens say
--     "not switched on yet", and the owner gets ONE alert email to run this.
--   * reviews: the policy date field, "Review due" chips, Prepare review and
--     the Reviews box stay hidden, the daily reviews cron does nothing, and
--     the owner gets an alert email to run this.
--
-- Safe to run twice (every statement is IF NOT EXISTS / OR REPLACE).
-- Service role only: RLS on and no policies — the app reads and writes these
-- through the service-role client after checking who owns the row.

-- ── 1. Questions a client asked on the share page ──────────────────────────
create table if not exists public.client_questions (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  -- The agent who owns the video (who must approve any answer).
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  question text not null check (char_length(question) between 1 and 2000),
  asker_name text check (asker_name is null or char_length(asker_name) <= 120),
  asker_email text check (asker_email is null or char_length(asker_email) <= 200),
  -- new → drafted (AI draft waiting) / needs_reply (no draft: AI unsure, over
  -- the free limit, or failed) → approved | calling | later
  status text not null default 'new'
    check (status in ('new', 'drafted', 'needs_reply', 'approved', 'calling', 'later')),
  ai_draft text,
  ai_unsure boolean,
  -- [{ "source": "S2", "label": "Section “Death benefit”", "quote": "..." }]
  ai_citations jsonb not null default '[]'::jsonb,
  ai_model text,
  ai_cost_usd numeric(10, 6),
  ai_note text,
  ai_drafted_at timestamptz,
  final_answer text check (final_answer is null or char_length(final_answer) <= 4000),
  -- Shown on the share page only when status = 'approved' AND published.
  published boolean not null default false,
  answered_at timestamptz,
  client_emailed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_questions_user_idx on public.client_questions (user_id, created_at desc);
create index if not exists client_questions_video_idx on public.client_questions (video_id, created_at desc);
create index if not exists client_questions_public_idx on public.client_questions (video_id) where status = 'approved' and published;

alter table public.client_questions enable row level security;
revoke all on public.client_questions from anon, authenticated;

-- ── 2. The audit log: every step of every question, never edited ──────────
create table if not exists public.client_question_events (
  id bigint generated always as identity primary key,
  question_id uuid not null references public.client_questions(id) on delete cascade,
  user_id uuid not null,
  -- who did it: the client, the AI, the agent, or the system
  actor text not null check (actor in ('client', 'ai', 'agent', 'system')),
  -- asked, agent_notified, ai_drafted, ai_unsure, ai_skipped, ai_failed,
  -- edited, approved, unpublished, calling, later, client_emailed,
  -- client_email_failed, …
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists client_question_events_q_idx on public.client_question_events (question_id, created_at);

alter table public.client_question_events enable row level security;
revoke all on public.client_question_events from anon, authenticated;

-- Append-only: the log can be added to, never changed or deleted (a deleted
-- account still cascades through the question row).
create or replace function public.client_question_events_append_only()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'client_question_events is append-only';
  end if;
  -- DELETE is allowed only as part of deleting the question itself.
  if tg_op = 'DELETE' and exists (select 1 from public.client_questions q where q.id = old.question_id) then
    raise exception 'client_question_events is append-only';
  end if;
  return old;
end $$;

drop trigger if exists client_question_events_append_only on public.client_question_events;
create trigger client_question_events_append_only
  before update or delete on public.client_question_events
  for each row execute function public.client_question_events_append_only();

-- ── 3. A client's policy anniversary ───────────────────────────────────────
alter table public.clients add column if not exists anniversary_date date;
-- 'agent' (typed) or 'document' (read from the policy's issue date)
alter table public.clients add column if not exists anniversary_source text;
-- A date read from a document is only a suggestion until the agent confirms it.
alter table public.clients add column if not exists anniversary_confirmed boolean not null default false;
-- The agent's time zone when they set it (IANA, e.g. America/Chicago), so
-- "due in 30 days" flips at THEIR midnight, not the server's.
alter table public.clients add column if not exists anniversary_tz text;

-- ── 4. One annual review per client per anniversary ────────────────────────
create table if not exists public.client_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  -- The anniversary this review is for. UNIQUE with client_id: the daily job
  -- can run twice and still makes one review per client per year.
  cycle_date date not null,
  status text not null default 'due'
    check (status in ('due', 'prepared', 'scheduled', 'sending', 'sent', 'skipped', 'send_failed')),
  video_id uuid references public.videos(id) on delete set null,
  prior_video_id uuid references public.videos(id) on delete set null,
  send_on date,
  send_to text,
  send_tz text,
  send_attempts int not null default 0,
  last_error text,
  sent_at timestamptz,
  reminded_30_at timestamptz,
  reminded_7_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, cycle_date)
);

create index if not exists client_reviews_user_idx on public.client_reviews (user_id, cycle_date);
create index if not exists client_reviews_sched_idx on public.client_reviews (send_on) where status = 'scheduled';

alter table public.client_reviews enable row level security;
revoke all on public.client_reviews from anon, authenticated;

-- Check it worked (each should return 0 rows, not an error):
--   select * from public.client_questions limit 1;
--   select * from public.client_question_events limit 1;
--   select * from public.client_reviews limit 1;
--   select anniversary_date, anniversary_confirmed, anniversary_tz from public.clients limit 1;
