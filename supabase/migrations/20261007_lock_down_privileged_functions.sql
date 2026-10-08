-- Lock down privileged functions the public key could call.
--
-- Supabase's security check (2026-10-07) found these SECURITY DEFINER
-- functions executable by the anon key, with no check inside on who is
-- calling: anyone holding the public key could grant themselves credits
-- (add_topup_atomic, increment_api_credits), claw credits back from any user
-- (revoke_topup_atomic), inflate client revenue, or burn other people's rate
-- limits. revoke_credits_atomic (20260926) was already locked this way; these
-- predate it.
--
-- Every call in app/ goes through createAdminClient() (the service role), and
-- no RLS policy, view or cron job references them.

REVOKE EXECUTE ON FUNCTION public.add_topup_atomic(p_user_id uuid, p_amount integer, p_action text, p_description text, p_video_id uuid, p_idempotency_key text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_topup_atomic(p_user_id uuid, p_amount integer, p_action text, p_description text, p_video_id uuid, p_idempotency_key text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.increment_api_credits(p_user_id uuid, p_amount integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_api_credits(p_user_id uuid, p_amount integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.increment_client_revenue(p_client_id uuid, p_user_id uuid, p_client_email text, p_amount_cents integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_client_revenue(p_client_id uuid, p_user_id uuid, p_client_email text, p_amount_cents integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.rate_limit_hit(p_key text, p_max integer, p_window_secs integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(p_key text, p_max integer, p_window_secs integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.revoke_topup_atomic(p_user_id uuid, p_amount integer, p_description text, p_idempotency_key text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_topup_atomic(p_user_id uuid, p_amount integer, p_description text, p_idempotency_key text) TO service_role;
