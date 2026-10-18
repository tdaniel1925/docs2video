-- Admin video moderation (app/api/admin/moderate) reads and sets videos.flagged,
-- but the column was never created: the moderation list failed to load and
-- flag/unflag did nothing. Found by the drift scan of 2026-10-16.
-- Safe to run more than once.
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS flagged boolean NOT NULL DEFAULT false;
