-- Saved flyer history.
--
-- Until now a design existed only in the browser tab that made it: pressing
-- Make wiped the previous batch and a refresh lost everything. Two tables so
-- the timeline can be rebuilt exactly as it happened.
--
--   flyer_rounds  — one press of Make: the brief, the style, the conversation
--   flyer_designs — one image within that press
--
-- The images themselves live in the private `creation-assets` bucket under
-- {user_id}/flyers/..., and are served through short-lived signed URLs. Only
-- the path is stored here.

CREATE TABLE IF NOT EXISTS public.flyer_rounds (
  id          UUID PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL,
  fields      JSONB NOT NULL DEFAULT '{}'::jsonb,
  note        TEXT,
  -- The chat as it stood when Make was pressed, so reopening the page reads
  -- like the conversation it was.
  messages    JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.flyer_designs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id   UUID NOT NULL REFERENCES public.flyer_rounds(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  size_id    TEXT NOT NULL,
  label      TEXT NOT NULL,
  width      INTEGER NOT NULL,
  height     INTEGER NOT NULL,
  image_path TEXT NOT NULL,
  -- What this one design actually cost, recorded at the time. Rates change and
  -- some accounts are grandfathered, so the ledger must not be re-derived from
  -- today's price list.
  credits    INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS flyer_rounds_user_created_idx
  ON public.flyer_rounds (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS flyer_designs_round_idx
  ON public.flyer_designs (round_id);

ALTER TABLE public.flyer_rounds  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flyer_designs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS flyer_rounds_owner_select ON public.flyer_rounds;
CREATE POLICY flyer_rounds_owner_select ON public.flyer_rounds
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS flyer_rounds_owner_insert ON public.flyer_rounds;
CREATE POLICY flyer_rounds_owner_insert ON public.flyer_rounds
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS flyer_rounds_owner_update ON public.flyer_rounds;
CREATE POLICY flyer_rounds_owner_update ON public.flyer_rounds
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS flyer_rounds_owner_delete ON public.flyer_rounds;
CREATE POLICY flyer_rounds_owner_delete ON public.flyer_rounds
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS flyer_designs_owner_select ON public.flyer_designs;
CREATE POLICY flyer_designs_owner_select ON public.flyer_designs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS flyer_designs_owner_insert ON public.flyer_designs;
CREATE POLICY flyer_designs_owner_insert ON public.flyer_designs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS flyer_designs_owner_delete ON public.flyer_designs;
CREATE POLICY flyer_designs_owner_delete ON public.flyer_designs
  FOR DELETE USING (auth.uid() = user_id);

-- DOWN:
-- DROP TABLE IF EXISTS public.flyer_designs;
-- DROP TABLE IF EXISTS public.flyer_rounds;
