-- Add music_url column to videos table for separate music playback
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS music_url TEXT;
