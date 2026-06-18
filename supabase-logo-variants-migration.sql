-- Logo variants for video rendering (2026-06-18).
-- brands.logo_url already holds the original upload. The video renderer needs a
-- transparent LIGHT variant (reads on dark themes) and DARK variant (reads on
-- light themes), produced by the upload pipeline (Sharp knockout, optional rembg).
-- logo_chip = true when the logo is complex/multi-color and should render on a
-- frosted chip instead of being recolored.

ALTER TABLE brands ADD COLUMN IF NOT EXISTS logo_light_url text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS logo_dark_url text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS logo_chip boolean NOT NULL DEFAULT false;
