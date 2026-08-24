-- Public Video-Generation API (v1)
-- API-key auth, a metered API credit pool (separate from UI credit_balances),
-- and a usage/audit log. Run in the Supabase SQL editor.

-- ── API keys ───────────────────────────────────────────────
-- Raw keys are never stored — only their SHA-256 hash. key_prefix is the
-- first chars (e.g. "d2v_live_ab12") for display in the admin list.
CREATE TABLE IF NOT EXISTS public.api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  key_hash     TEXT NOT NULL UNIQUE,
  key_prefix   TEXT NOT NULL,
  name         TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys (key_hash) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON public.api_keys (user_id);

-- ── Metered API credit pool (separate from credit_balances) ──
CREATE TABLE IF NOT EXISTS public.api_credit_balances (
  user_id    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance    INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Usage / audit log (also backs rate limiting) ────────────
CREATE TABLE IF NOT EXISTS public.api_usage_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id      UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  user_id         UUID NOT NULL,
  endpoint        TEXT NOT NULL,
  video_id        UUID,
  credits_charged INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'ok',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_usage_key_time ON public.api_usage_log (api_key_id, created_at DESC);

-- These tables are accessed only via the service-role admin client in API
-- routes (never directly from the browser), so no RLS policies are needed.
-- Enable RLS with no policies to deny all anon/auth access by default.
ALTER TABLE public.api_keys            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_log       ENABLE ROW LEVEL SECURITY;
