-- Per-slide clip durations (seconds), one entry per slide_url, in order.
-- The video preview/watch pages use this to map each slide thumbnail to its
-- exact timestamp in the rendered video. Without it the UI falls back to equal
-- division (total_duration / slide_count), which is always wrong because
-- narration lengths differ per slide — the source of slide-desync and the
-- "last thumbnail won't jump/show" bug.
--
-- Stored as jsonb (a JSON array of numbers, e.g. [4.2, 12.8, 6.1]).

ALTER TABLE videos ADD COLUMN IF NOT EXISTS slide_durations jsonb;

COMMENT ON COLUMN videos.slide_durations IS
  'Per-slide clip durations in seconds (JSON array), one per slide_urls entry, in order. Used to sync thumbnails to video timestamps.';
