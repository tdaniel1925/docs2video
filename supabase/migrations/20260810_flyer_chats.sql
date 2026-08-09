-- Project chats for the Custom Graphics maker.
--
-- Until now every design a customer ever made sat in ONE endless thread. That
-- is fine for an afternoon and useless after a month: a flyer for the summer
-- party and a client's business cards are separate jobs and should not share a
-- scrollback. A chat is one job, listed in the sidebar, reopenable.

CREATE TABLE IF NOT EXISTS public.flyer_chats (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Taken from the first thing they asked for, so the list reads like the work
  -- rather than "Chat 3".
  title      TEXT NOT NULL DEFAULT 'New chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.flyer_rounds
  ADD COLUMN IF NOT EXISTS chat_id UUID REFERENCES public.flyer_chats(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS flyer_chats_user_updated_idx
  ON public.flyer_chats (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS flyer_rounds_chat_idx
  ON public.flyer_rounds (chat_id, created_at);

-- Everything made before today goes into one chat per person, so nobody's work
-- vanishes from the sidebar the day this ships.
DO $$
DECLARE u RECORD; new_chat UUID;
BEGIN
  FOR u IN SELECT DISTINCT user_id FROM public.flyer_rounds WHERE chat_id IS NULL LOOP
    INSERT INTO public.flyer_chats (user_id, title, created_at, updated_at)
    VALUES (
      u.user_id, 'Earlier work',
      (SELECT MIN(created_at) FROM public.flyer_rounds WHERE user_id = u.user_id),
      (SELECT MAX(created_at) FROM public.flyer_rounds WHERE user_id = u.user_id)
    )
    RETURNING id INTO new_chat;
    UPDATE public.flyer_rounds SET chat_id = new_chat
     WHERE user_id = u.user_id AND chat_id IS NULL;
  END LOOP;
END $$;

ALTER TABLE public.flyer_chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS flyer_chats_owner_select ON public.flyer_chats;
CREATE POLICY flyer_chats_owner_select ON public.flyer_chats
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS flyer_chats_owner_insert ON public.flyer_chats;
CREATE POLICY flyer_chats_owner_insert ON public.flyer_chats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS flyer_chats_owner_update ON public.flyer_chats;
CREATE POLICY flyer_chats_owner_update ON public.flyer_chats
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS flyer_chats_owner_delete ON public.flyer_chats;
CREATE POLICY flyer_chats_owner_delete ON public.flyer_chats
  FOR DELETE USING (auth.uid() = user_id);

-- DOWN:
-- ALTER TABLE public.flyer_rounds DROP COLUMN IF EXISTS chat_id;
-- DROP TABLE IF EXISTS public.flyer_chats;
