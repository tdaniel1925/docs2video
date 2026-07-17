-- Records when a video was rendered in a DIFFERENT style than the user chose
-- (the render fell back because the chosen engine was temporarily unavailable),
-- so the video detail page can tell the user WHY the look differs — instead of
-- silently swapping styles.
--
-- ⚠ Run in prod before the code that selects it deploys (same rule as other
-- videos-column additions).

ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS render_note TEXT;

-- DOWN:
-- ALTER TABLE public.videos DROP COLUMN IF EXISTS render_note;
