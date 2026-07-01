-- ============================================================
-- Review S3 — Row Level Security on brands.
-- No RLS policy for brands existed anywhere in the repo, and prod migrations
-- are applied by hand — so session-client reads like
--   .from('brands').select('*').eq('id', brandId)
-- may have allowed ANY authenticated user to read ANY brand (contact info,
-- logo URLs, colors) by guessing/enumerating ids. App code now also scopes
-- every brand fetch with .eq('user_id', ...) as defense-in-depth; this makes
-- the database enforce it regardless.
--
-- Service-role (admin client) access bypasses RLS as before — public watch
-- pages and internal jobs are unaffected.
--
-- MUST BE RUN MANUALLY IN PROD (Supabase SQL editor) — prod does not run
-- `supabase db push`.
-- ============================================================

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brands_owner_select ON public.brands;
CREATE POLICY brands_owner_select ON public.brands
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS brands_owner_insert ON public.brands;
CREATE POLICY brands_owner_insert ON public.brands
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS brands_owner_update ON public.brands;
CREATE POLICY brands_owner_update ON public.brands
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS brands_owner_delete ON public.brands;
CREATE POLICY brands_owner_delete ON public.brands
  FOR DELETE USING (auth.uid() = user_id);
