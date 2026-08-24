# SOC 2 Readiness — Docs2Video

*Scope chosen: Security + Confidentiality + Availability + Privacy.*
*Path: compliance platform (Vanta/Drata/Secureframe) + CPA audit firm.*
*Order: get ready → Type 1 (snapshot) → run 3–12 months → Type 2 (proof over time).*

This file tracks the **technical** gap-scan findings and the **process** work.
Code fixes reduce audit friction; the process work is what actually earns the
report. Do both, but buy the platform first — it generates the definitive gap list.

---

## 0. Do these FIRST (not code)

1. **Buy a compliance platform** (Vanta / Drata / Secureframe). Connect Supabase,
   Vercel, GitHub, Hetzner, Stripe, Google Workspace. It auto-collects evidence.
2. **Turn on MFA everywhere** — GitHub, Supabase, Vercel, Google, Stripe, domain
   registrar. Non-negotiable; auditors check this day one.
3. **Rotate every secret** flagged below and in CODE-REVIEW-2026-07-01.md, and make
   the CI secret-scanner *block* (gitleaks already runs on commit locally).
4. **Write the policies** (platform gives templates): InfoSec, Access Control,
   Incident Response, Vendor Mgmt, Change Mgmt, Business Continuity/DR, Data
   Retention & Privacy, Acceptable Use.
5. **Vendor list (subprocessors)** — Supabase, Vercel, Hetzner, Stripe, Resend,
   OpenAI, Anthropic, Gemini, Twilio, ElevenLabs, Kie.ai. Collect each one's SOC 2
   / DPA. Publish a subprocessor list (Confidentiality/Privacy needs this).
6. **Access reviews + offboarding** — quarterly "who has access to what," and a
   checklist to kill access when someone leaves.
7. **Background checks + annual security training** for anyone with prod access.

---

## 1. Code fixes — HIGH (before Type 1)

- [ ] **SSRF: unguarded logo fetch.** `app/api/extract-url/route.ts:331` fetches a
      logo URL parsed from attacker-controlled HTML with a raw `fetch()`. An
      injected private/metadata IP would be fetched. **Fix:** route it through
      `isSafePublicUrl()` + `safeFetch()` like the other scrapers do.
- [ ] **Permissive RLS on social tables.** `supabase-social-campaigns-migration.sql`
      has `USING (true)` on `social_campaigns` / `social_campaign_posts` — any row,
      any user. **Fix:** replace with `USING (auth.uid() = user_id)` and confirm in
      prod. (App routes already do ownership checks, but the DB policy must too.)
- [ ] **Missing CSP + HSTS headers.** `next.config.ts` has X-Frame-Options etc. but
      no Content-Security-Policy and no Strict-Transport-Security. **Fix:** add both
      to the headers array (HSTS `max-age=31536000; includeSubDomains; preload`).
- [ ] **Raw error messages leaked to clients.** e.g. `app/api/deck-builder/route.ts:36`,
      `app/api/brands/photo/route.ts:51`, `app/api/email-connections/route.ts:64`
      return `err.message`. **Fix:** generic client error + log full detail
      server-side (the `flyer-chat` route is the good pattern).
- [ ] **Rotate the VPS API_SECRET** (old fallback `docs2video-assembly-secret-2026`
      was in code history) and confirm the new value is only in the VPS env.

## 2. Code / config fixes — MEDIUM (before Type 2)

- [ ] **Audit-log the sensitive events that aren't logged yet.** `admin_audit_log`
      exists and covers impersonation/create-user/etc., but NOT: account deletion
      (`/api/account/delete`), client data export (`/api/clients/export`), auth
      callbacks. SOC 2 requires logging auth events, permission changes, and data
      exports. **Fix:** add `logAdminAction()` calls to those routes.
- [ ] **Impersonation cookie** (`app/api/admin/impersonate/route.ts`) lacks an
      explicit `secure` flag. **Fix:** `secure: process.env.NODE_ENV === 'production'`.
- [ ] **Verify fetched slide images are images** in `download-pdf`/`download-pptx`
      before embedding (content-type check).
- [ ] **OAuth redirect URIs** (`app/api/mcp/oauth/approve`) — add scheme/https +
      domain validation on top of the DB allowlist.

## 3. Database / process debt (audit-fatal if unaddressed)

- [ ] **Migration drift.** ~62 loose `supabase-*.sql` files at repo root are applied
      by hand; the canonical `supabase/migrations/` is separate. Auditors want a
      controlled change process. **Fix:** consolidate into `supabase/migrations/`,
      keep an `APPLIED.md` ledger (or adopt `supabase db push` via PR review).
- [ ] **Independently verify prod RLS.** Run `SELECT * FROM pg_policies` in prod and
      confirm every user-data table has RLS **enabled** with an owner-scoping policy
      (videos, brands, profiles, clients, credits, sent_emails, presentations,
      flyer_designs, social_*, affiliates, etc.). Committed migrations ≠ what's live.

---

## What's already good (assets for the audit)

- Ownership checks on brand/video/campaign fetches (defense-in-depth `.eq('user_id')`).
- RLS enabled + owner-scoped on the major tables (videos, jobs, notifications,
  brands, flyer_designs/chats, script_revisions, sent_emails, email_connections).
- Profile privilege-escalation guard trigger (`guard_privileged_profile_columns`).
- Atomic credit RPCs (no double-charge), Stripe webhook signature verification.
- Centralized `requireAdmin()` on admin routes; `admin_audit_log` framework.
- SSRF guard (`isSafePublicUrl`/`safeFetch`, re-checks redirects) on 5 scraper routes.
- Logo upload hardened: SVG blocked, 5 MB cap, MIME-checked, user-scoped path.
- Deck upload: type/size validated. Security header baseline present.
- Error logging deduped into `error_logs`. `.env.local` gitignored; no secrets in source.

---

## Rough timeline

1. **Weeks 0–2:** buy platform, MFA everywhere, rotate secrets, start policies.
2. **Weeks 2–8:** close HIGH code fixes, verify prod RLS, migration hygiene, vendor
   docs, access reviews, training. Engage the audit firm.
3. **Type 1 audit** (snapshot) once the platform shows controls green.
4. **3–12 month observation window** — platform collects evidence automatically;
   keep controls running (this is where MEDIUM fixes + logging matter).
5. **Type 2 audit** at the end of the window.
