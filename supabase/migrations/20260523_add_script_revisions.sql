CREATE TABLE IF NOT EXISTS public.script_revisions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE NOT NULL,
  revision_number INTEGER NOT NULL DEFAULT 1,
  scenes JSONB NOT NULL,
  prompt_versions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_script_revisions_video ON public.script_revisions(video_id, revision_number);

ALTER TABLE public.script_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own script revisions" ON public.script_revisions;
CREATE POLICY "Users can view own script revisions" ON public.script_revisions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.videos WHERE videos.id = script_revisions.video_id AND videos.user_id = auth.uid())
);
DROP POLICY IF EXISTS "Users can insert own script revisions" ON public.script_revisions;
CREATE POLICY "Users can insert own script revisions" ON public.script_revisions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.videos WHERE videos.id = script_revisions.video_id AND videos.user_id = auth.uid())
);
-- DOWN: DROP TABLE IF EXISTS public.script_revisions;
