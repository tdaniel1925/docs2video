-- Add reference_slides column to brands table for Brand Deck Builder
ALTER TABLE brands ADD COLUMN IF NOT EXISTS reference_slides text[];
ALTER TABLE brands ADD COLUMN IF NOT EXISTS deck_style_id text;
