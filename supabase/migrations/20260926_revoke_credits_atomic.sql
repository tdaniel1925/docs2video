-- Audit H8 (2026-09-26): take credits back after a Stripe refund or chargeback,
-- from BOTH balances. The older revoke_topup_atomic only touched the top-up
-- balance, so a refunded SUBSCRIPTION payment (whose credits live in the
-- monthly balance) kept every credit it granted.
--
-- Takes from the monthly balance first, then top-up; never below zero (credits
-- already spent can't be un-spent). Idempotent on p_idempotency_key — one key
-- per Stripe refund / dispute — using the same processed_stripe_events marker
-- table as add_topup_atomic, so a re-delivered webhook is a no-op while each
-- separate partial refund is still recorded.
--
-- Safe to run more than once. The app falls back to a slower path if this
-- function is missing, so nothing breaks before it is applied.

CREATE OR REPLACE FUNCTION public.revoke_credits_atomic(
  p_user_id         uuid,
  p_amount          integer,
  p_description     text,
  p_idempotency_key text
)
RETURNS boolean   -- true if applied, false if duplicate / nothing to do
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance      integer;
  v_topup        integer;
  v_from_monthly integer;
  v_from_topup   integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_idempotency_key IS NULL THEN
    RETURN false;
  END IF;

  BEGIN
    INSERT INTO public.processed_stripe_events (event_id, event_type)
    VALUES (p_idempotency_key, 'revoke');
  EXCEPTION WHEN unique_violation THEN
    RETURN false; -- this refund/dispute was already applied
  END;

  SELECT balance, topup_balance INTO v_balance, v_topup
    FROM public.credit_balances
   WHERE user_id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_from_monthly := LEAST(p_amount, GREATEST(0, v_balance));
  v_from_topup   := LEAST(p_amount - v_from_monthly, GREATEST(0, v_topup));

  UPDATE public.credit_balances
     SET balance = v_balance - v_from_monthly,
         topup_balance = v_topup - v_from_topup,
         updated_at = now()
   WHERE user_id = p_user_id;

  INSERT INTO public.credit_transactions
    (user_id, amount, balance_after, action, description)
  VALUES
    (p_user_id, -(v_from_monthly + v_from_topup),
     (v_balance - v_from_monthly) + (v_topup - v_from_topup),
     'refund_revoke', p_description);

  RETURN true;
END;
$$;

-- Only the server (service role) may call it — never a signed-in browser.
REVOKE ALL ON FUNCTION public.revoke_credits_atomic(uuid, integer, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_credits_atomic(uuid, integer, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_credits_atomic(uuid, integer, text, text) TO service_role;
