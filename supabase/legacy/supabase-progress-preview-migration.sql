-- Progress preview support (2026-06-18).
-- Lets the generating UI show a filmstrip of scene thumbnails that fill in as the
-- pipeline builds them, plus a known scene count so the strip has the right size.
--
-- preview_thumbs: array of { idx: int, url: text } appended as each scene's
--   image/slide is rendered (both V3 and classic pipelines).
-- total_scenes: how many scenes the final video will have (set early), so the
--   UI can render N placeholder slots and fill them in.

ALTER TABLE videos ADD COLUMN IF NOT EXISTS preview_thumbs jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS total_scenes int;
