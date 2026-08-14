# Security audit — the prompt to run

Paste this to a fresh agent. It is written to find real holes, not to reassure.
Work read-only until the final report; change nothing without calling it out.

---

**You are doing a complete security audit of this app (Docs2Video / Text2Art,
one Next.js codebase, two storefronts) and its Supabase backend. Assume nothing
is safe until you have checked it. Your job is to find the ways a stranger, a
logged-in customer, or a leaked key could reach data or actions they should not.
Read the code before you judge it — never assume a protection exists because it
"should". Produce a written report ranked by real-world severity, with the exact
file and line for each finding and a concrete fix. Do not change anything except
where a fix is trivial and you flag it separately.**

## 1. Secrets — what is exposed and what must rotate
- Search the whole repo (including git history) for hard-coded keys, tokens,
  passwords, connection strings, and `SUPABASE_SERVICE_ROLE_KEY`. Any secret
  that has ever been committed must be listed as "ROTATE" even if later removed.
- Confirm nothing secret is shipped to the browser: every `NEXT_PUBLIC_*` var,
  and anything imported into a client component. The service-role key must NEVER
  appear in client code or in an API response.
- Check `.env*` files are gitignored and not tracked. List every env var the app
  reads and mark which are safe-public vs must-stay-secret.

## 2. Supabase — the row-level security is the whole game
- For EVERY table: is RLS enabled, and is there an actual policy? A table with
  RLS on and no policy, or RLS off, is open. List each table with its state.
- Read each policy and ask: can user A read or write user B's rows? Look
  specifically at the flyer/design tables, `videos`, `brands`, `clients`,
  `api_keys`, any billing/credit tables, and anything with per-user data.
- Find every use of the **service-role** client (bypasses RLS). Each one must be
  server-only AND must re-check ownership itself, because RLS is not protecting
  it. List them and say whether each verifies the caller owns the data.
- Storage buckets: list them, their public/private setting, and their policies.
  Can someone guess or enumerate another customer's uploaded logo, PDF, or
  rendered design? Are signed URLs used where they should be, with sane expiry?
- Check for the migration-drift trap known in this repo: policies or columns
  that exist in committed migrations but were never applied to prod. A policy
  that only exists in a file protects nothing.

## 3. API routes and auth — who can call what
- List every route under `app/api/**`. For each: does it verify a logged-in user
  (or a valid API key) BEFORE doing work, and does it check that the user owns
  the thing they are acting on? Flag any route that trusts an id from the body
  without an ownership check (the classic "change ?id= to someone else's").
- The public/v1 API and MCP surface: how is the API key authenticated, is it
  hashed at rest, is it rate-limited, and can a key spend or read beyond its
  owner? Confirm credit spend can't go negative or be replayed.
- Webhooks (Stripe, Apex, any inbound): is the signature verified with the right
  secret before the payload is trusted? An unverified webhook = anyone can grant
  themselves credits or a plan.
- Look for SSRF: any route that fetches a URL the user supplied (brand scraper,
  "paste your website", document/URL import). Can it be pointed at internal
  addresses or file://? Is there an allowlist?

## 4. Injection, input, and file handling
- Any raw SQL or string-built queries? Any `.rpc()` passing unsanitised input?
- Uploads: is type/size checked, and can a file path be traversed
  (`../`)? Where do uploaded files land and who can read them?
- Prompt-injection into the AI chat that could make it leak system context,
  another user's data, or call a tool it shouldn't. Note the existing
  no-false-claims / compliance scrubs and whether they can be bypassed.

## 5. The boring-but-fatal
- Are error messages leaking stack traces, table names, or keys to the client?
- Is `proxy.ts` (this repo's middleware) actually gating the routes it should,
  and does the host-based storefront split leak one brand's data on the other?
- CORS: any route with `Access-Control-Allow-Origin: *` that returns private data?
- Dependencies: run the audit and list any high/critical known-vuln packages.
- Auth session: cookie flags (httpOnly, secure, sameSite), and whether password
  reset / email change / logout invalidate correctly.

## Rules of engagement
- READ-ONLY on prod data. Do not run destructive SQL. If you need to prove a hole
  is real, describe the exact request that would exploit it — do not exploit it.
- Prove each finding: cite the file:line, and for RLS/route holes state the exact
  call that bypasses the check. A finding you cannot point at is a guess — mark
  it as "needs manual check", not "confirmed".
- Verify with the tools this repo already uses (Playwright signed-in checks,
  live REST calls against the API) where a claim can be tested, the same way the
  UX checks prove they can fail before trusting a pass.
- Rank findings: Critical (anyone reaches anyone's data / money) → High → Medium
  → Low. For each: what breaks, who can do it, the one-line fix, and whether it
  needs a prod migration or a key rotation.
- Anything that needs a secret rotated or prod SQL run: put it in a short
  "DO THIS NOW" list at the top, because those are the ones that don't fix
  themselves by merging code.
```
