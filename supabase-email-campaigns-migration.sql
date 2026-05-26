-- Email Campaign System — extends existing campaigns/campaign_contacts tables
-- Run this AFTER supabase-campaigns-migration.sql

-- Add email campaign columns to campaigns table
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS industry text;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS sub_industry text;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS subject_template text;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS body_template text;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS cta_text text DEFAULT 'Try It Free';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS cta_url text;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS campaign_type text DEFAULT 'email' CHECK (campaign_type IN ('email', 'discount', 'nurture'));
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS total_contacts int DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS sent_count int DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS failed_count int DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS opened_count int DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS clicked_count int DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Update status check to include 'sending' and 'cancelled'
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_status_check
  CHECK (status IN ('draft', 'active', 'sending', 'paused', 'completed', 'cancelled'));

-- Add email tracking columns to campaign_contacts
ALTER TABLE campaign_contacts ADD COLUMN IF NOT EXISTS send_status text DEFAULT 'pending' CHECK (send_status IN ('pending', 'sent', 'failed', 'skipped'));
ALTER TABLE campaign_contacts ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE campaign_contacts ADD COLUMN IF NOT EXISTS opened_at timestamptz;
ALTER TABLE campaign_contacts ADD COLUMN IF NOT EXISTS clicked_at timestamptz;

-- Indexes for campaign sending
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON campaigns(campaign_type);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_send_status ON campaign_contacts(campaign_id, send_status);
