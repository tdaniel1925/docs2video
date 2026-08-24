-- Campaigns Phase 4: allow 'failed' video_status so a contact whose video
-- generation errors is visible + retryable (was silently reset to 'pending').
-- Run once in the Supabase SQL editor. Idempotent.
-- Drop ANY existing check constraint that references video_status (name may have
-- been auto-generated), so re-adding doesn't conflict.
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT con.conname FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = 'public' AND rel.relname = 'campaign_contacts'
      AND con.contype = 'c' AND pg_get_constraintdef(con.oid) ILIKE '%video_status%'
  LOOP
    EXECUTE format('ALTER TABLE public.campaign_contacts DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.campaign_contacts
  ADD CONSTRAINT campaign_contacts_video_status_check CHECK (video_status IN (
    'pending','generating','review','approved','skipped','sent','failed'
  ));
