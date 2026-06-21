-- Atomic client revenue increment (avoids read-then-write races). Called when a
-- client's quote is paid (via the Stripe Connect webhook). Matches by client_id
-- when present, else by the owner's client with that email.
CREATE OR REPLACE FUNCTION public.increment_client_revenue(
  p_client_id uuid,
  p_user_id uuid,
  p_client_email text,
  p_amount_cents integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RETURN;
  END IF;

  IF p_client_id IS NOT NULL THEN
    UPDATE public.clients
       SET total_revenue = COALESCE(total_revenue, 0) + p_amount_cents
     WHERE id = p_client_id;
    IF FOUND THEN RETURN; END IF;
  END IF;

  IF p_client_email IS NOT NULL AND p_user_id IS NOT NULL THEN
    UPDATE public.clients
       SET total_revenue = COALESCE(total_revenue, 0) + p_amount_cents
     WHERE user_id = p_user_id AND lower(email) = lower(p_client_email);
  END IF;
END;
$$;
