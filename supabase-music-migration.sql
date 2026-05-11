-- Music tracks for background music in Docs2Video
CREATE TABLE IF NOT EXISTS music_tracks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  mood text NOT NULL,
  file_url text NOT NULL,
  duration_seconds integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE music_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read music tracks" ON music_tracks FOR SELECT USING (true);
CREATE POLICY "Service role manages music" ON music_tracks FOR ALL USING (auth.role() = 'service_role');
