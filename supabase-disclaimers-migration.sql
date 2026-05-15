-- Add disclaimers column to videos table for storing extracted insurance disclaimers
ALTER TABLE videos ADD COLUMN IF NOT EXISTS disclaimers jsonb;
