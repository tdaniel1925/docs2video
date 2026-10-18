/**
 * The ONLY columns admin screens may ask for from the tables that hold
 * secrets. `profiles` carries Stripe Connect tokens (stripe_access_token,
 * stripe_user_id) and social posting keys (ayrshare_profile_key,
 * zernio_profile_id); `email_connections` carries mail tokens. None of that
 * may ever reach the browser, so admin routes list columns from here instead
 * of `select('*')` (guard: tests/admin-fixes.test.ts).
 */
export const ADMIN_USER_COLUMNS =
  'id, email, full_name, company_name, subscription_status, is_admin, is_beta, card_on_file, created_at'

export const ADMIN_USER_DETAIL_COLUMNS =
  'id, email, full_name, company_name, phone, subscription_status, stripe_customer_id, stripe_subscription_id, card_on_file, referral_code, referred_by, is_admin, is_beta, social_addon_active, created_at, updated_at'

export const ADMIN_VIDEO_COLUMNS =
  'id, user_id, title, status, output_type, error_message, progress_detail, progress_pct, thumbnail_url, created_at, updated_at'

export const ADMIN_EMAIL_CONNECTION_COLUMNS = 'id, provider, email_address, is_default, created_at'

export const ADMIN_QUOTE_COLUMNS = 'id, client_name, client_email, total, status, created_at'

/** Column names that must never appear in an admin select. */
export const SECRET_COLUMNS = [
  'stripe_access_token', 'stripe_user_id', 'ayrshare_profile_key', 'zernio_profile_id',
  'access_token', 'refresh_token', 'key_hash', 'smtp_password', 'password',
]
