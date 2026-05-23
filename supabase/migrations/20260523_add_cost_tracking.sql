CREATE TABLE IF NOT EXISTS public.daily_user_spend (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  spend_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_cents INTEGER NOT NULL DEFAULT 0,
  video_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, spend_date)
);
-- DOWN: DROP TABLE IF EXISTS public.daily_user_spend;

ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS estimated_cost_cents INTEGER;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS actual_cost_cents INTEGER;
-- DOWN: ALTER TABLE public.videos DROP COLUMN IF EXISTS estimated_cost_cents; ALTER TABLE public.videos DROP COLUMN IF EXISTS actual_cost_cents;
