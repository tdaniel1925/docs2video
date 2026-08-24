-- Video Analytics tracking table
-- Tracks: view, play, chat_message, download, book_meeting events

create table if not exists video_analytics (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references videos(id) on delete cascade,
  event_type text not null,
  viewer_ip text,
  user_agent text,
  referrer text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Index for fast lookups by video
create index if not exists idx_video_analytics_video_id on video_analytics(video_id);
create index if not exists idx_video_analytics_event_type on video_analytics(event_type);
create index if not exists idx_video_analytics_created_at on video_analytics(created_at);

-- RLS policies
alter table video_analytics enable row level security;

-- Allow anonymous inserts (public viewers tracking events)
create policy "Allow anonymous insert on video_analytics"
  on video_analytics
  for insert
  to anon
  with check (true);

-- Allow authenticated users to read analytics for their own videos
create policy "Allow authenticated select on own video_analytics"
  on video_analytics
  for select
  to authenticated
  using (
    video_id in (
      select id from videos where user_id = auth.uid()
    )
  );

-- Allow service role full access (used by admin client)
create policy "Allow service role full access on video_analytics"
  on video_analytics
  for all
  to service_role
  using (true)
  with check (true);
