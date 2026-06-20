-- Profiles: unify Brand → Profile (Person | Company) (2026-06-19).
-- The `brands` table is kept as-is (FKs from videos/infographics depend on it);
-- we just extend it so a row can be a PERSON (a presenter — name, role, photo,
-- intro line) or a COMPANY (the existing brand: name, logo, colors, contact).
-- Existing rows default to profile_type = 'company', so nothing changes for them.
-- This is the data layer for the personalization feature: a selected profile
-- drives the spoken opening, the closing card, and a style-aware presenter photo.

-- Person vs Company. Existing brands are companies.
ALTER TABLE brands ADD COLUMN IF NOT EXISTS profile_type text NOT NULL DEFAULT 'company';

-- PERSON fields ------------------------------------------------------------
-- The presenter's role/title shown beside their name (e.g. "Registered Nurse").
ALTER TABLE brands ADD COLUMN IF NOT EXISTS person_role text;
-- Headshot (stored in the agent-photos bucket). Rendered per style.
ALTER TABLE brands ADD COLUMN IF NOT EXISTS photo_url text;
-- User-authored "how should I be introduced?" line, spoken on the opening.
ALTER TABLE brands ADD COLUMN IF NOT EXISTS intro_line text;
-- Person: drive brandName / cover masthead with the person's name, or let the
-- document title lead (name still appears in the spoken intro + closing card).
ALTER TABLE brands ADD COLUMN IF NOT EXISTS show_name_on_slides boolean NOT NULL DEFAULT true;

-- COMPANY / shared fields --------------------------------------------------
-- Explicit logo on/off. Fixes the "logo sometimes shows / sometimes not"
-- confusion — the renderer respects this instead of guessing from variants.
ALTER TABLE brands ADD COLUMN IF NOT EXISTS show_logo boolean NOT NULL DEFAULT true;

-- Where a presenter PHOTO appears. 'auto' lets the chosen video style decide
-- (cinematic vs editorial place it differently); the others force placement.
-- One of: auto | cover | closing | both | none.
ALTER TABLE brands ADD COLUMN IF NOT EXISTS photo_placement text DEFAULT 'auto';
