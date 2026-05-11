-- PrismGraphs Custom Templates Migration
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.custom_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  prompt TEXT NOT NULL,
  preview_url TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.custom_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own templates" ON public.custom_templates;
DROP POLICY IF EXISTS "Users can insert own templates" ON public.custom_templates;
DROP POLICY IF EXISTS "Users can update own templates" ON public.custom_templates;
DROP POLICY IF EXISTS "Users can delete own templates" ON public.custom_templates;

CREATE POLICY "Users can view own templates" ON public.custom_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own templates" ON public.custom_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own templates" ON public.custom_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own templates" ON public.custom_templates FOR DELETE USING (auth.uid() = user_id);
