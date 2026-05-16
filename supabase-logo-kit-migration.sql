-- Add logo_kit column to brands table
ALTER TABLE brands ADD COLUMN IF NOT EXISTS logo_kit JSONB DEFAULT NULL;

-- Comment for clarity
COMMENT ON COLUMN brands.logo_kit IS 'Maps style IDs to styled logo URLs, e.g. {"neon-cyber": "https://...", "executive": "https://..."}';

-- Create brand-assets storage bucket (public read, authenticated write)
INSERT INTO storage.buckets (id, name, public)
VALUES ('brand-assets', 'brand-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own brand folder
CREATE POLICY "Users can upload brand assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'brand-assets');

-- Allow public read access to brand assets
CREATE POLICY "Public read brand assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'brand-assets');

-- Allow authenticated users to update/overwrite their brand assets
CREATE POLICY "Users can update brand assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'brand-assets');

-- Allow service role full access (for admin client in logo-styler)
CREATE POLICY "Service role full access brand assets"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'brand-assets');
