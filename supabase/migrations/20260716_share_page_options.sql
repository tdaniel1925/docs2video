-- Share-page enhancements: let the agent optionally offer the client a download
-- of the ORIGINAL source PDF, attach a short personal note, and record the
-- client (recipient) name for the personalized welcome banner.
--
-- ⚠ RUN THIS IN PROD *BEFORE* deploying the code that adds these columns to the
-- share page's VIDEO_COLS select. A column absent in prod 400s the whole query
-- and 404s EVERY share link (see app/api/public/watch/[id]/route.ts).

ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS allow_source_download BOOLEAN DEFAULT FALSE;
-- storage PATH (not a URL) inside the private 'creation-assets' bucket, e.g.
-- '{userId}/doc-uploads/{uuid}.pdf'. The share page fetches it via a short-lived
-- signed URL so the bucket stays private.
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS source_pdf_path TEXT;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS source_pdf_name TEXT;
-- optional short note the agent writes to the client (shown on the share page).
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS agent_note TEXT;
-- the client this video was prepared for — drives the "Hi {name}" welcome banner
-- (mirrors the personalized video cover).
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS recipient_name TEXT;

-- DOWN (rollback):
-- ALTER TABLE public.videos DROP COLUMN IF EXISTS allow_source_download;
-- ALTER TABLE public.videos DROP COLUMN IF EXISTS source_pdf_path;
-- ALTER TABLE public.videos DROP COLUMN IF EXISTS source_pdf_name;
-- ALTER TABLE public.videos DROP COLUMN IF EXISTS agent_note;
-- ALTER TABLE public.videos DROP COLUMN IF EXISTS recipient_name;
