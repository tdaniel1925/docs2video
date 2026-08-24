-- Add company_context column to videos table for chatbot knowledge
-- Run this in your Supabase SQL editor

ALTER TABLE videos ADD COLUMN IF NOT EXISTS company_context text;

COMMENT ON COLUMN videos.company_context IS 'Scraped company website content for the share page AI chatbot. Not used in video content.';
