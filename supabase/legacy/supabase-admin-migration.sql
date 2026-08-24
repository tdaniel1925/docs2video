-- Add admin and beta flags to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_beta BOOLEAN DEFAULT false;

-- Set admins
UPDATE public.profiles SET is_admin = true WHERE email IN ('trenttdaniel@gmail.com', 'tdaniel@botmakers.ai', 'phil@valorfs.com');

-- Set beta users (unlimited, no admin access)
UPDATE public.profiles SET is_beta = true WHERE email IN ('darrell.wolfe@3mark.com', 'Johnathon.Bunch@3mark.com');

-- Audit log table
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  admin_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  target_user_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view audit log" ON public.admin_audit_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Admins can insert audit log" ON public.admin_audit_log FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);
