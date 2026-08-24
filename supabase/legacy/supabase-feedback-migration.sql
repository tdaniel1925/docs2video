CREATE TABLE IF NOT EXISTS public.slide_feedback (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  video_id UUID,
  slide_index INTEGER NOT NULL,
  style_id TEXT,
  slide_prompt TEXT,
  rating TEXT CHECK (rating IN ('approve', 'redo', 'thumbs_up', 'thumbs_down')),
  feedback_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.slide_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own feedback" ON public.slide_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own feedback" ON public.slide_feedback FOR SELECT USING (auth.uid() = user_id);

-- Brand memory table
CREATE TABLE IF NOT EXISTS public.brand_memory (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  preference_type TEXT NOT NULL,
  preference_key TEXT NOT NULL,
  preference_value TEXT,
  confidence FLOAT DEFAULT 0.5,
  sample_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, preference_type, preference_key)
);

ALTER TABLE public.brand_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage brand memory" ON public.brand_memory FOR ALL USING (
  EXISTS (SELECT 1 FROM public.brands WHERE brands.id = brand_memory.brand_id AND brands.user_id = auth.uid())
);
