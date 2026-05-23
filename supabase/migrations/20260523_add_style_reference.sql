ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS style_reference_url TEXT;
-- DOWN: ALTER TABLE public.videos DROP COLUMN IF EXISTS style_reference_url;
