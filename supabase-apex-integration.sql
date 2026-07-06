-- Apex (reachtheapex.net) integration — Path B (spec 2026-07-05)
-- Affiliates whose compensation flows through the Apex MLM comp plan are
-- flagged payout_via='apex': D2V records their commissions for audit but
-- never pays them locally (export-csv / mark-paid exclude them).
--
-- NOTE: prod does not run `supabase db push` — run this SQL manually in the
-- Supabase SQL editor (see feedback_migration_drift).

ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS payout_via TEXT NOT NULL DEFAULT 'direct';

ALTER TABLE public.affiliates DROP CONSTRAINT IF EXISTS affiliates_payout_via_check;
ALTER TABLE public.affiliates
  ADD CONSTRAINT affiliates_payout_via_check CHECK (payout_via IN ('direct', 'apex'));

CREATE INDEX IF NOT EXISTS idx_affiliates_payout_via ON public.affiliates (payout_via)
  WHERE payout_via <> 'direct';
