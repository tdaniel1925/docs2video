-- Apex (reachtheapex.net) integration — Path B.
-- Affiliates owned by Apex reps are payout_via='apex': D2V records their
-- commissions for audit but never pays them (compensation flows through the
-- Apex comp plan via the signed integration webhook instead).
-- NOTE: applied to the live DB out-of-band on 2026-07-05; this file versions it.
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS payout_via TEXT NOT NULL DEFAULT 'direct'
  CHECK (payout_via IN ('direct', 'apex'));
CREATE INDEX IF NOT EXISTS idx_affiliates_payout_via ON affiliates (payout_via) WHERE payout_via <> 'direct';
