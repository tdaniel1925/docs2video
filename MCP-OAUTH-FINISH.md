# MCP OAuth — one step left to finish

The OAuth provider is **built, deployed, and live**. Discovery + the 401 challenge
are verified working. The tables exist. The ONLY thing blocking the token flow is
Supabase's PostgREST **schema cache** — it hasn't noticed the new `mcp_oauth_*`
tables yet (a known Supabase quirk after a raw migration).

## Do this (10 seconds)

In the **Supabase dashboard → SQL Editor**, run:

```sql
NOTIFY pgrst, 'reload schema';
```

That's it. PostgREST re-reads the schema immediately and the OAuth flow works.
(Alternatively it clears on its own within ~10-15 min, or on the next migration.)

## Then verify (optional)

Ask me to "run the OAuth self-test" and I'll walk the whole flow against the live
site — register a client → mint a consented code → exchange for a token → call a
tool with that token → confirm an unauthenticated call is still challenged. All
five steps should pass.

## What's already confirmed working (no action needed)

- `/.well-known/oauth-protected-resource/api/mcp` → returns JSON ✓
- `/.well-known/oauth-authorization-server` → returns JSON (authorize/token/register) ✓
- Unauthenticated `tools/call` → 401 + `WWW-Authenticate: Bearer resource_metadata=…` ✓
- Migration tables created ✓  •  proxy allows the discovery paths ✓  •  tsc clean ✓

## And the connection itself

Once the cache reloads, a user connects from Jordyn by adding the custom MCP URL
`https://docs2video.com/api/mcp` — Jordyn detects OAuth, shows the docs2video
consent screen, and connects. Billing → house account. Revoke any connection by
setting `mcp_oauth_tokens.is_active = false`.
