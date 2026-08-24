-- Campaign marketing system tables

CREATE TABLE campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  discount_code text NOT NULL,
  discount_pct integer DEFAULT 25,
  discount_months integer DEFAULT 3,
  status text DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE campaign_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  company text,
  industry text,
  phone text,
  video_id uuid REFERENCES videos(id),
  video_status text DEFAULT 'pending' CHECK (video_status IN ('pending','generating','review','approved','skipped','sent')),
  email_sent_at timestamptz,
  video_watched_at timestamptz,
  signed_up_at timestamptz,
  nurture_stage integer DEFAULT 0,
  next_nurture_at timestamptz,
  unsubscribed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, email)
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access campaigns" ON campaigns FOR ALL USING (true);
CREATE POLICY "Admin full access contacts" ON campaign_contacts FOR ALL USING (true);
