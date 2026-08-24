-- DB-backed app settings / feature flags (2026-06-18).
-- The app previously had NO settings table — flags were env vars (USE_PIPELINE_V2),
-- which can't be toggled from the admin UI without a redeploy. This key/value
-- table is read at request time so an admin toggle takes effect immediately.
--
-- Values are stored as text; the lib coerces (e.g. 'true'/'false' -> boolean).

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Seed the V3 video-engine flag, OFF by default (current pipeline keeps running).
INSERT INTO app_settings (key, value)
VALUES ('video_engine_v3', 'false')
ON CONFLICT (key) DO NOTHING;

-- Service-role only (admin client). No public RLS policies — never client-readable.
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
