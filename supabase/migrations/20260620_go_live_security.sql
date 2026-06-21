-- Go-live hardening: privilege-escalation, webhook double-grant, refund races,
-- and non-atomic credit ledger. Apply with `supabase db push` (or paste into the
-- SQL editor). Safe to run once; uses IF NOT EXISTS / CREATE OR REPLACE.

-- ============================================================
-- B1 — Lock down the profiles UPDATE policy so a user cannot self-grant
-- admin/beta/subscription/stripe fields from the browser anon client.
-- The old policy was `USING (auth.uid() = id)` with NO WITH CHECK and no
-- column guard, letting `update({ is_admin: true })` through.
-- ============================================================

-- Re-assert the row-scope policy WITH a check clause (a user may only touch
-- their own row). Column-level protection is enforced by the trigger below.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Reject changes to privileged columns unless the caller is the service role
-- (server-side admin client). auth.role() = 'service_role' bypasses RLS but
-- still fires triggers, so we whitelist it explicitly.
CREATE OR REPLACE FUNCTION public.guard_privileged_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role'
     OR auth.role() = 'service_role' THEN
    RETURN NEW; -- trusted server-side write
  END IF;

  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin
     OR NEW.is_beta IS DISTINCT FROM OLD.is_beta
     OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
     OR NEW.stripe_user_id IS DISTINCT FROM OLD.stripe_user_id
     OR NEW.stripe_access_token IS DISTINCT FROM OLD.stripe_access_token
     OR NEW.free_videos_remaining IS DISTINCT FROM OLD.free_videos_remaining
     OR NEW.card_on_file IS DISTINCT FROM OLD.card_on_file THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile columns';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_privileged_profile_columns ON public.profiles;
CREATE TRIGGER trg_guard_privileged_profile_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_privileged_profile_columns();

-- ============================================================
-- B5 — Atomic Stripe webhook idempotency. A dedicated table with the event id
-- as PRIMARY KEY; INSERT ... ON CONFLICT DO NOTHING is the gate (replaces the
-- non-atomic LIKE-scan over credit_transactions.description).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.processed_stripe_events (
  event_id    text PRIMARY KEY,
  event_type  text,
  processed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;
-- No policies = only the service role (webhook) can touch it. Good.

-- ============================================================
-- H4 — Idempotent refund marker. A real UNIQUE constraint so the refund insert
-- itself is the gate (no check-then-act). One refund per (user, video).
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uniq_refund_marker_per_video
  ON public.credit_transactions (user_id, video_id)
  WHERE action = 'refund_video';

-- ============================================================
-- B5/H5 — Atomic credit mutations: balance change + ledger row in ONE
-- transaction (a Postgres function). Callers use supabase.rpc(...).
-- ============================================================

-- Add top-up (paid pack / refund) atomically, keyed on an idempotency marker so
-- a duplicate Stripe delivery or a double-fired refund handler is a no-op.
CREATE OR REPLACE FUNCTION public.add_topup_atomic(
  p_user_id   uuid,
  p_amount    integer,
  p_action    text,
  p_description text,
  p_video_id  uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS boolean   -- true if applied, false if it was a duplicate / no-op
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_topup integer;
  v_balance   integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN false;
  END IF;

  -- Idempotency gate: if a marker key is given and already recorded, stop.
  IF p_idempotency_key IS NOT NULL THEN
    BEGIN
      INSERT INTO public.processed_stripe_events (event_id, event_type)
      VALUES (p_idempotency_key, p_action);
    EXCEPTION WHEN unique_violation THEN
      RETURN false; -- already processed
    END;
  END IF;

  -- Lock the wallet row, increment topup atomically.
  UPDATE public.credit_balances
     SET topup_balance = topup_balance + p_amount,
         updated_at = now()
   WHERE user_id = p_user_id
  RETURNING topup_balance, balance INTO v_new_topup, v_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no credit_balances row for user %', p_user_id;
  END IF;

  INSERT INTO public.credit_transactions
    (user_id, amount, balance_after, action, video_id, description)
  VALUES
    (p_user_id, p_amount, v_balance + v_new_topup, p_action, p_video_id, p_description);

  RETURN true;
END;
$$;

-- Revoke (claw back) credits on refund/chargeback of a credit pack, idempotent
-- on the charge/refund id. Clamps topup_balance at 0.
CREATE OR REPLACE FUNCTION public.revoke_topup_atomic(
  p_user_id   uuid,
  p_amount    integer,
  p_description text,
  p_idempotency_key text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_topup integer;
  v_balance   integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_idempotency_key IS NULL THEN
    RETURN false;
  END IF;

  BEGIN
    INSERT INTO public.processed_stripe_events (event_id, event_type)
    VALUES (p_idempotency_key, 'revoke');
  EXCEPTION WHEN unique_violation THEN
    RETURN false;
  END;

  UPDATE public.credit_balances
     SET topup_balance = GREATEST(0, topup_balance - p_amount),
         updated_at = now()
   WHERE user_id = p_user_id
  RETURNING topup_balance, balance INTO v_new_topup, v_balance;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.credit_transactions
    (user_id, amount, balance_after, action, description)
  VALUES
    (p_user_id, -p_amount, v_balance + v_new_topup, 'refund_revoke', p_description);

  RETURN true;
END;
$$;
