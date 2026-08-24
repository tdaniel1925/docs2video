-- PrismGraphs Email Integration Migration
-- Run this in Supabase SQL Editor

-- ============================================
-- EMAIL CONNECTIONS (OAuth tokens for Gmail/Outlook)
-- ============================================

CREATE TABLE IF NOT EXISTS public.email_connections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft', 'smtp')),
  email_address TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_user TEXT,
  smtp_pass TEXT,
  imap_host TEXT,
  imap_port INTEGER,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.email_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own email connections" ON public.email_connections;
DROP POLICY IF EXISTS "Users can insert own email connections" ON public.email_connections;
DROP POLICY IF EXISTS "Users can update own email connections" ON public.email_connections;
DROP POLICY IF EXISTS "Users can delete own email connections" ON public.email_connections;

CREATE POLICY "Users can view own email connections" ON public.email_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own email connections" ON public.email_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own email connections" ON public.email_connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own email connections" ON public.email_connections FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- SENT EMAILS LOG
-- ============================================

CREATE TABLE IF NOT EXISTS public.sent_emails (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,
  infographic_id UUID REFERENCES public.infographics(id) ON DELETE SET NULL,
  connection_id UUID REFERENCES public.email_connections(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  to_name TEXT,
  subject TEXT NOT NULL,
  opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sent_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sent emails" ON public.sent_emails;
DROP POLICY IF EXISTS "Users can insert own sent emails" ON public.sent_emails;

CREATE POLICY "Users can view own sent emails" ON public.sent_emails FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sent emails" ON public.sent_emails FOR INSERT WITH CHECK (auth.uid() = user_id);
