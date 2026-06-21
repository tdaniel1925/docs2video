-- Agent's own Stripe Payment Link (a hosted link they paste in Settings →
-- Integrations). Recipients use it to pay on the share page. Replaces the
-- OAuth-Connect button for the simple "collect a payment" use case.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payment_link_url text;
