ALTER TABLE videos ADD COLUMN IF NOT EXISTS prompt_versions JSONB DEFAULT '{}'::jsonb;
-- DOWN: ALTER TABLE videos DROP COLUMN IF EXISTS prompt_versions;
