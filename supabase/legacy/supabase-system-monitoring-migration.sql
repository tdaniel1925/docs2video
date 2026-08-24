-- System monitoring: central error log + health-check history.
-- Powers the admin System Status panel, the Logs/fix-advisor view, and the
-- 6-hourly automated spot-test cron. Service-role only (admin-facing).

-- ── error_logs ──────────────────────────────────────────────────────────────
-- One row per *distinct* error signature (errors are deduped: repeats bump
-- count + last_seen instead of inserting a new row). Feeds the admin Logs view.
CREATE TABLE IF NOT EXISTS error_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source           text NOT NULL,                 -- 'vercel' | 'vps' | 'app'
  severity         text NOT NULL DEFAULT 'error', -- 'error' | 'warning' | 'critical'
  error_signature  text NOT NULL,                 -- normalized message (ids/numbers stripped) for grouping
  message          text NOT NULL,                 -- representative full message
  detail           text,                          -- stack trace / extra detail
  endpoint         text,                          -- route/source location if known
  video_id         uuid,
  user_id          uuid,
  count            integer NOT NULL DEFAULT 1,    -- how many times this signature occurred
  first_seen       timestamptz NOT NULL DEFAULT now(),
  last_seen        timestamptz NOT NULL DEFAULT now(),
  resolved         boolean NOT NULL DEFAULT false,
  recommended_fix  text,                          -- from KB or AI advisor
  fix_source       text,                          -- 'kb' | 'ai' | null
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Dedupe key: same signature + source = same logical error.
CREATE UNIQUE INDEX IF NOT EXISTS error_logs_sig_source_uniq
  ON error_logs (error_signature, source);
CREATE INDEX IF NOT EXISTS error_logs_last_seen_idx ON error_logs (last_seen DESC);
CREATE INDEX IF NOT EXISTS error_logs_resolved_idx  ON error_logs (resolved);

-- ── system_checks ───────────────────────────────────────────────────────────
-- One row per spot-test run (cron or manual). results = per-subsystem outcomes.
CREATE TABLE IF NOT EXISTS system_checks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at       timestamptz NOT NULL DEFAULT now(),
  trigger      text NOT NULL DEFAULT 'cron',      -- 'cron' | 'manual'
  overall_ok   boolean NOT NULL,
  results      jsonb NOT NULL,                    -- [{ name, ok, ms, error? }, ...]
  duration_ms  integer
);
CREATE INDEX IF NOT EXISTS system_checks_run_at_idx ON system_checks (run_at DESC);

-- RLS: these are admin/service-role only. Enable RLS with NO public policies so
-- the anon/auth roles can't read them; the service-role client bypasses RLS.
ALTER TABLE error_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_checks ENABLE ROW LEVEL SECURITY;
