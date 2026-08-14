# Supabase security runbook — YOU run these (I don't touch the live DB)

Run in the Supabase dashboard → SQL Editor (or Storage UI where noted). Do them
in order. Each is safe and reversible. Nothing here deletes customer data.

Exact names were read from your committed migrations, so they match your schema.

---

## STEP 0 — First, see what's actually live (read-only, changes nothing)

Because prod applies SQL by hand, some security rules may only exist in files.
Run these two and skim the output before changing anything:

```sql
-- Which tables have row-level security ON?  (relrowsecurity = true means ON)
SELECT relname AS table_name, relrowsecurity AS rls_on
FROM pg_class
WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
ORDER BY relname;

-- Every policy that exists, and its rule:
SELECT tablename, policyname, cmd, qual AS using_rule, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

**What to confirm in the output:**
- `brands`, `videos`, `jobs`, `notifications`, `credit_balances`,
  `credit_transactions`, `flyer_rounds`, `flyer_designs`, `flyer_chats`,
  `clients` → `rls_on = true`, and their policy rule mentions
  `auth.uid() = user_id` (owner-scoped).
- **NO** policy named `"Anyone can view completed videos"` on `videos`. If it's
  still there, an old migration was the last to run — drop it (Step 3).
- `api_keys`, `api_credit_balances`, `api_usage_log` → `rls_on = true`.

If any expected table shows `rls_on = false`, that table is wide open — the
migration that secures it never ran. Find it in supabase/migrations and paste
it in.

---

## STEP 1 — Make the flyer-design bucket PRIVATE  (the #1 fix)

Right now `creation-assets` is public, so anyone with a file path can pull a
flyer (which can carry a client's name/address/phone), bypassing the signed-URL
+ ownership checks the app already does. Flip it private and drop the public
read policy.

```sql
-- 1. Bucket → private
UPDATE storage.buckets SET public = false WHERE id = 'creation-assets';

-- 2. Remove the "anyone can read it" policy (uploads/owner policies stay)
DROP POLICY IF EXISTS "Anyone can view creation assets" ON storage.objects;
```

**Then test in the app:** open a saved flyer / re-download one. The app serves
these through a signed-URL route (`/api/flyer-file/[id]`, which checks
ownership), so it should keep working. If a flyer image 404s, tell me — it means
a spot still used a public URL and I'll switch it to a signed one.

---

## STEP 2 — Review the other public buckets

`videos`, `logos`, `infographics`, `brand-assets` are all public. Decide per
bucket. `videos` probably needs public share links (leave it), but the others
hold source art that shouldn't be enumerable.

```sql
-- See them:
SELECT id, public FROM storage.buckets ORDER BY id;

-- Lock down the ones that don't need public links (example — logos):
UPDATE storage.buckets SET public = false WHERE id IN ('logos','brand-assets');
DROP POLICY IF EXISTS "Anyone can view logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view brand assets" ON storage.objects;
```

⚠️ Before flipping `infographics` private: email-signature previews and some
share features serve from it with public URLs. If you lock it, those need
signed URLs first — tell me and I'll wire that up. Safe order: do `logos` /
`brand-assets` now; leave `videos` and `infographics` until we've swapped their
delivery to signed URLs.

---

## STEP 3 — Close the anon holes on affiliates / referrals

These two tables have a rule that lets ANY anonymous caller read/write/delete
every row (payout + referral data). The service role bypasses RLS, so it doesn't
need this policy at all.

```sql
DROP POLICY IF EXISTS "Service can manage affiliates" ON affiliates;
DROP POLICY IF EXISTS "Service can manage referrals" ON referrals;
```

After dropping, `affiliates`/`referrals` will be RLS-on with no policy = deny
all to the anon/user clients, service-role still full access. That's what you
want. (If the app reads these via the anon client anywhere, it'll start getting
empty results — it shouldn't, since these are server/admin-managed, but test the
affiliate dashboard once.)

---

## STEP 4 — Kill the stale "anyone can view completed videos" policy (if Step 0 found it)

Only if Step 0's output still shows it on `videos`:

```sql
DROP POLICY IF EXISTS "Anyone can view completed videos" ON public.videos;
```

Your `videos` table is already owner-scoped by a later migration; this old
policy (if it lingered) let every logged-in user read every completed video.

---

## STEP 5 — Tighten share-page chat (optional, medium)

`chat_messages` allows anyone to read every share-page chat across all videos.
If that's not intended, we scope it through a server route instead. This one I'd
do together — tell me if you want it locked, and I'll add a server endpoint that
returns only the messages for a given video id, then drop the blanket policy.

---

## After you run Steps 1–4

Re-run STEP 0's two queries and confirm:
- `creation-assets` (and any you locked) show `public = false`.
- No `"Anyone can view creation assets"`, `"Service can manage affiliates/
  referrals"`, or `"Anyone can view completed videos"` policies remain.
- Every per-user table is `rls_on = true`.

Then smoke-test the app: make a flyer, open a saved one, load the affiliate page.
If anything 404s or empties out, it's a delivery path that needs a signed URL —
send it to me and I'll fix the code side.
