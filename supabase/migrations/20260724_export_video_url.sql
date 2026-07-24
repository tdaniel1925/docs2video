-- MP4 exports derived from interactive presentations (VPS capture+mux).
-- Additive only. MUST be run in prod before the export button ships live —
-- the app reads this column defensively (separate try-wrapped query) so
-- share links cannot 404 if it is missing, but exports won't persist.
alter table videos add column if not exists export_video_url text;
