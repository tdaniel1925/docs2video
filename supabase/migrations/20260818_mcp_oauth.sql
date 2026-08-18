-- MCP OAuth provider tables. Lets a spec-compliant MCP client (e.g. Jordyn)
-- sign a docs2video/Text2Art user in and receive a bearer token that /api/mcp
-- accepts. Billing still runs on the house agency key — the OAuth token only
-- proves a real, consented user, and maps to their user_id for audit + revoke.
--
-- Public-client PKCE flow (no client secret): registration → authorize (login +
-- consent) → code → token. All non-destructive additive tables.

-- Dynamically-registered clients (RFC 7591). One per connector install.
CREATE TABLE IF NOT EXISTS public.mcp_oauth_clients (
  client_id      TEXT PRIMARY KEY,
  client_name    TEXT,
  redirect_uris  TEXT[] NOT NULL DEFAULT '{}',
  scopes         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Short-lived authorization codes (spent once at the token endpoint).
CREATE TABLE IF NOT EXISTS public.mcp_oauth_codes (
  code               TEXT PRIMARY KEY,
  client_id          TEXT NOT NULL,
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_uri       TEXT NOT NULL,
  code_challenge     TEXT NOT NULL,      -- PKCE S256 challenge
  resource           TEXT,               -- RFC 8707 audience the token is for
  scope              TEXT,
  expires_at         TIMESTAMPTZ NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Issued access / refresh tokens. Revoke by flipping is_active=false (the
-- "turn a connection off" control). Stored hashed, never in the clear.
CREATE TABLE IF NOT EXISTS public.mcp_oauth_tokens (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token_hash    TEXT NOT NULL UNIQUE,
  refresh_token_hash   TEXT UNIQUE,
  client_id            TEXT NOT NULL,
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope                TEXT,
  resource             TEXT,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  access_expires_at    TIMESTAMPTZ NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS mcp_oauth_codes_expires_idx ON public.mcp_oauth_codes (expires_at);
CREATE INDEX IF NOT EXISTS mcp_oauth_tokens_user_idx   ON public.mcp_oauth_tokens (user_id);

-- Service-role only (the routes use the admin client); no anon RLS policies —
-- these tables are never read from the browser.
ALTER TABLE public.mcp_oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_oauth_codes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_oauth_tokens  ENABLE ROW LEVEL SECURITY;
