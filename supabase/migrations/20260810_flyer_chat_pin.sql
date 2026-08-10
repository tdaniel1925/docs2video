-- Pin a chat to the top of the sidebar.
--
-- The list is ordered by "most recently touched", which is right until you have
-- a job you come back to every week. Then it sinks under a dozen one-offs and
-- you scroll for it every time.

ALTER TABLE public.flyer_chats
  ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false;

-- Pinned first, then most recent. Matches exactly how the sidebar reads them,
-- so the ordering never has to be done in memory.
CREATE INDEX IF NOT EXISTS flyer_chats_user_pinned_idx
  ON public.flyer_chats (user_id, pinned DESC, updated_at DESC);

-- DOWN:
-- DROP INDEX IF EXISTS public.flyer_chats_user_pinned_idx;
-- ALTER TABLE public.flyer_chats DROP COLUMN IF EXISTS pinned;
