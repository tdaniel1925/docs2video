-- PrismGraphs Onboarding Migration
-- Run this in Supabase SQL Editor

-- ============================================
-- PROFILE EXTENSIONS
-- ============================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_style TEXT DEFAULT 'corporate';

-- ============================================
-- BRAND EXTENSIONS
-- ============================================

ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS logo_file_url TEXT;

-- ============================================
-- AGENT PHOTOS STORAGE BUCKET
-- ============================================

INSERT INTO storage.buckets (id, name, public) VALUES ('agent-photos', 'agent-photos', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload agent photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view agent photos" ON storage.objects;

CREATE POLICY "Users can upload agent photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'agent-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Anyone can view agent photos" ON storage.objects FOR SELECT USING (bucket_id = 'agent-photos');
