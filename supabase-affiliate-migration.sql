-- Affiliate Program v1
-- Recurring (lifetime) 20% commission, manual payouts, Stripe promo-code tracking.
-- Builds on the EXISTING `affiliates` and `referrals` tables (the affiliate
-- variant: affiliate_id, referred_user_id, status, commission_amount,
-- commission_paid). Run in the Supabase SQL editor.

-- ── Extend affiliates with Stripe promo-code linkage ──────────
ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS stripe_coupon_id     TEXT,
  ADD COLUMN IF NOT EXISTS stripe_promo_code_id TEXT,
  ADD COLUMN IF NOT EXISTS promo_code           TEXT;  -- human-facing code, e.g. "JANE15"

CREATE INDEX IF NOT EXISTS idx_affiliates_promo_code ON public.affiliates (promo_code);

-- ── Recurring commission ledger ───────────────────────────────
-- One row PER qualifying payment (not per referred user) — required for
-- lifetime recurring commissions. stripe_invoice_id (or session id for the
-- first payment) gives idempotency so a retried webhook can't double-pay.
CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id      UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referral_id       UUID REFERENCES public.referrals(id) ON DELETE SET NULL,
  referred_user_id  UUID,
  stripe_invoice_id TEXT NOT NULL UNIQUE,   -- invoice id, or "session:{id}" for first payment
  amount_cents      INTEGER NOT NULL DEFAULT 0,   -- the payment the customer made
  commission_cents  INTEGER NOT NULL DEFAULT 0,   -- what the affiliate earns
  rate              NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'approved', 'paid', 'clawed_back')),
  approved_at       TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  payout_batch      TEXT,                    -- set when included in a payout CSV
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aff_comm_affiliate ON public.affiliate_commissions (affiliate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aff_comm_status    ON public.affiliate_commissions (status);

-- ── Click tracking (optional cookie-attribution funnel) ───────
-- Lets the /affiliate dashboard show clicks → signups → paying.
CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aff_clicks_affiliate ON public.affiliate_clicks (affiliate_id, created_at DESC);

-- Accessed only via the service-role admin client in API routes — deny all
-- direct anon/auth access (enable RLS with no policies).
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_clicks      ENABLE ROW LEVEL SECURITY;
