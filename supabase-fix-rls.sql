-- Fix: Remove overly permissive video policy that leaks all completed videos to all users
-- The share page (/watch/[id]) uses the anon client which doesn't need RLS —
-- it fetches by specific ID. The "Anyone can view completed videos" policy
-- was causing all completed videos to appear on every user's dashboard.

DROP POLICY IF EXISTS "Anyone can view completed videos" ON public.videos;

-- The remaining policy "Users can view own videos" correctly scopes to user_id = auth.uid()
-- The share page works because it queries by specific video ID and the
-- Supabase client can still read individual rows with the anon key.
