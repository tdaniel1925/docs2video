-- ============================================================================
-- HOT-CLIENT ALERTS + SEND BY TEXT (2026-10-10)
--
-- Every statement is IF NOT EXISTS and safe to run more than once.
-- NOT applied automatically — production migrations are run by hand.
-- RUN THIS BEFORE DEPLOYING the texting code.
--
-- WHAT THE CODE DOES WHILE THIS IS MISSING (it fails safe):
--   * Settings → Email & sending shows "Tell me when a client is ready" as
--     "not switched on yet" — nothing can be saved, no alert is sent.
--   * The result page's send panel shows only the Email tab (no Text tab).
--   * The send-by-text and alert routes answer 503 and send nothing.
--   * The owner gets ONE email (alertOps) saying to run this file.
--   * The existing "someone watched" emails keep working exactly as before.
--
-- All five tables are written only by the server (service role). RLS is on;
-- owners may READ their own rows, nobody may write through the public API.
-- ============================================================================


-- ── 1. The agent's alert settings + their own verified mobile number ───────
create table if not exists public.agent_alert_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  -- How hot-client alerts reach the agent.
  channel text not null default 'off' check (channel in ('off', 'text', 'email', 'both')),
  -- Which moments count as "ready".
  on_finished boolean not null default true,  -- watched to the end
  on_twice boolean not null default true,     -- came back and opened it again
  on_pdf boolean not null default true,       -- opened (downloaded) the PDF
  on_booking boolean not null default true,   -- pressed Book a call
  -- The agent's mobile, only usable once a code sent to it was typed back.
  phone text,
  phone_verified_at timestamptz,
  pending_phone text,
  code_hash text,
  code_expires_at timestamptz,
  code_tries int not null default 0,
  -- IANA zone from the agent's browser (e.g. America/Chicago), for quiet hours.
  time_zone text,
  updated_at timestamptz not null default now()
);
alter table public.agent_alert_settings enable row level security;
drop policy if exists agent_alert_settings_owner_select on public.agent_alert_settings;
create policy agent_alert_settings_owner_select on public.agent_alert_settings
  for select using (auth.uid() = user_id);


-- ── 2. One row per alert. The UNIQUE key IS the rate limit: one alert per
--      client (viewer) per video per trigger per day (agent's own calendar
--      day). Quiet-hours alerts wait here as 'queued' until send_after.
create table if not exists public.hot_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  viewer_key text not null,
  trigger text not null check (trigger in ('finished', 'twice', 'pdf', 'booking')),
  day date not null,
  channel text not null check (channel in ('text', 'email', 'both')),
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'skipped')),
  send_after timestamptz not null default now(),
  message text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (user_id, video_id, viewer_key, trigger, day)
);
create index if not exists idx_hot_alerts_queued on public.hot_alerts (send_after) where status = 'queued';
alter table public.hot_alerts enable row level security;
drop policy if exists hot_alerts_owner_select on public.hot_alerts;
create policy hot_alerts_owner_select on public.hot_alerts
  for select using (auth.uid() = user_id);


-- ── 3. "This client agreed to get texts from me" — once per agent + number.
create table if not exists public.client_text_consent (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  phone text not null,
  client_id uuid references public.clients(id) on delete set null,
  client_name text,
  agreed_at timestamptz not null default now(),
  unique (user_id, phone)
);
alter table public.client_text_consent enable row level security;
drop policy if exists client_text_consent_owner_select on public.client_text_consent;
create policy client_text_consent_owner_select on public.client_text_consent
  for select using (auth.uid() = user_id);


-- ── 4. The do-not-text list. All agents share ONE sending number, so a STOP
--      from a person stops texts from every agent (the carrier does the same).
--      START flips it back; the row stays for history.
create table if not exists public.sms_opt_outs (
  phone text primary key,
  opted_out boolean not null default true,
  keyword text,
  updated_at timestamptz not null default now()
);
alter table public.sms_opt_outs enable row level security;


-- ── 5. Every text in or out: client sends (kind 'client'), alerts to the
--      agent ('alert'), verify codes ('code'), and client replies ('reply').
--      sent_email_id links a client text to its sent_emails row (the ?s= tag
--      in the link), so "Who watched" and Home count texts like emails.
create table if not exists public.text_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  video_id uuid references public.videos(id) on delete set null,
  sent_email_id uuid references public.sent_emails(id) on delete set null,
  direction text not null check (direction in ('out', 'in')),
  kind text not null check (kind in ('client', 'alert', 'code', 'reply', 'keyword')),
  phone text not null,
  body text,
  media_url text,
  twilio_sid text unique,
  status text,
  error_code text,
  error text,
  credits int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_text_messages_user_time on public.text_messages (user_id, created_at desc);
create index if not exists idx_text_messages_phone_time on public.text_messages (phone, created_at desc);
create index if not exists idx_text_messages_video on public.text_messages (video_id, created_at desc);
alter table public.text_messages enable row level security;
drop policy if exists text_messages_owner_select on public.text_messages;
create policy text_messages_owner_select on public.text_messages
  for select using (auth.uid() = user_id);
