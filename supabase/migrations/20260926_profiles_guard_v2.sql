-- Profiles guard v2 (audit 2026-09-26, H11). Apply by pasting into the SQL
-- editor (production does not run `supabase db push`). Safe to run more than
-- once: CREATE OR REPLACE + DROP TRIGGER IF EXISTS.
--
-- 20260620_go_live_security.sql stopped users from writing is_admin,
-- subscription_status, stripe_* and a few more from the browser. It missed the
-- columns below, each of which the server trusts for money or identity:
--
--   social_addon_active   — unlocks the $50/mo AI Social add-on
--   zernio_profile_id     — WHICH social workspace we post to (point it at
--   ayrshare_profile_key     someone else's and you post as them)
--   email                 — the Apex purchase webhook matches buyers by it;
--                           must only follow a CONFIRMED auth email change
--   referred_by           — affiliate attribution (commission)
--   pack_credits,         — legacy credit stores
--   credits_remaining,
--   credits_reset_at
--   selected_plan         — plan chosen at card entry (billing)
--
-- Deliberately NOT guarded: `role` (the user's job title, edited in Settings
-- and onboarding), `nurture_sent` (holds the user's own email opt-out and
-- default voice), and `referral_code` (the user's own share code).
--
-- Columns are compared through to_jsonb(NEW/OLD) so the function keeps working
-- even if a column in the list doesn't exist in this database (a missing
-- column compares NULL = NULL instead of erroring every profile update).
--
-- Service-role writes (server code using the admin client) are always allowed.

CREATE OR REPLACE FUNCTION public.guard_privileged_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  col text;
  n jsonb;
  o jsonb;
  link text;
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role'
     OR auth.role() = 'service_role' THEN
    RETURN NEW; -- trusted server-side write
  END IF;

  n := to_jsonb(NEW);
  o := to_jsonb(OLD);

  FOREACH col IN ARRAY ARRAY[
    -- from 20260620_go_live_security.sql
    'is_admin', 'is_beta', 'subscription_status', 'stripe_customer_id',
    'stripe_subscription_id', 'stripe_user_id', 'stripe_access_token',
    'free_videos_remaining', 'card_on_file',
    -- added here (v2)
    'social_addon_active', 'zernio_profile_id', 'ayrshare_profile_key',
    'email', 'referred_by', 'pack_credits', 'credits_remaining',
    'credits_reset_at', 'selected_plan', 'id', 'created_at'
  ]
  LOOP
    IF (n -> col) IS DISTINCT FROM (o -> col) THEN
      RAISE EXCEPTION 'Not allowed to modify privileged profile column %', col
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  -- Links shown as buttons on PUBLIC share pages: plain web links only, so a
  -- `javascript:` link can't run code in a client's browser.
  FOREACH col IN ARRAY ARRAY['calendly_url', 'payment_link_url']
  LOOP
    IF (n -> col) IS DISTINCT FROM (o -> col) THEN
      link := n ->> col;
      IF link IS NOT NULL AND link <> '' AND link !~* '^https?://[^\s/]+' THEN
        RAISE EXCEPTION 'Links must start with http:// or https:// (%)', col
          USING ERRCODE = '22023';
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_privileged_profile_columns ON public.profiles;
CREATE TRIGGER trg_guard_privileged_profile_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_privileged_profile_columns();

-- The row-scope policy from 20260620 (users may only touch their own row),
-- re-asserted in case that migration was never applied.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Clear any booking/payment link already saved that isn't a web link (e.g.
-- `javascript:`). Only runs for columns that exist here.
DO $$
DECLARE
  col text;
BEGIN
  FOREACH col IN ARRAY ARRAY['calendly_url', 'payment_link_url']
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = col) THEN
      EXECUTE format(
        'UPDATE public.profiles SET %1$I = NULL WHERE %1$I IS NOT NULL AND %1$I <> '''' AND %1$I !~* ''^https?://[^\s/]+''',
        col);
    END IF;
  END LOOP;
END $$;
