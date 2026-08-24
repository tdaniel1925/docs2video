-- clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  company TEXT,
  phone TEXT,
  industry TEXT,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'email', 'import', 'website')),
  status TEXT DEFAULT 'lead' CHECK (status IN ('lead', 'active', 'engaged', 'converted', 'inactive')),
  total_videos_sent INT DEFAULT 0,
  total_views INT DEFAULT 0,
  total_revenue INT DEFAULT 0,
  first_contact_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, email)
);

-- client_activities table (unified timeline)
CREATE TABLE IF NOT EXISTS client_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('email_sent', 'video_viewed', 'video_played', 'chat_message', 'meeting_booked', 'payment_received', 'follow_up', 'note_added', 'client_created', 'quote_sent')),
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add client_id to videos for assignment
ALTER TABLE videos ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clients_user ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(user_id, email);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(user_id, status);
CREATE INDEX IF NOT EXISTS idx_client_activities_client ON client_activities(client_id);
CREATE INDEX IF NOT EXISTS idx_client_activities_type ON client_activities(client_id, type);
CREATE INDEX IF NOT EXISTS idx_videos_client ON videos(client_id);

-- RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own clients" ON clients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service manages clients" ON clients FOR ALL USING (true);
CREATE POLICY "Users view own activities" ON client_activities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service manages activities" ON client_activities FOR ALL USING (true);
