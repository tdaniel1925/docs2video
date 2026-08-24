-- Expanded brand guide fields for comprehensive brand analysis
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS tagline TEXT;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS tone TEXT;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS target_audience TEXT;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS fonts JSONB DEFAULT '[]';
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS brand_values JSONB DEFAULT '[]';
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS services JSONB DEFAULT '[]';
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS content_themes JSONB DEFAULT '[]';
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS competitor_notes TEXT;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS unique_selling_points JSONB DEFAULT '[]';
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS brand_guide_data JSONB;
