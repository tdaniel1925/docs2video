/**
 * Curated background music tracks from royalty-free sources.
 * These URLs point to direct-download MP3 files from Pixabay's CDN.
 * All tracks are royalty-free and safe for commercial use.
 *
 * To add more tracks: go to pixabay.com/music, find a track,
 * right-click the download button → copy link address.
 */

export interface MusicTrack {
  id: string
  name: string
  mood: string
  description: string
  duration: string
  genre: string
  /** Direct download URL — fetched at video assembly time */
  url: string
}

// NOTE: These URLs are placeholders. In production, you should:
// 1. Download tracks from pixabay.com/music (royalty-free)
// 2. Upload them to your Supabase storage bucket
// 3. Replace these URLs with your Supabase storage URLs
//
// Alternatively, use the Supabase-hosted tracks below if they've been uploaded.

const SUPABASE_MUSIC_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/music`
  : ''

export const MUSIC_TRACKS: MusicTrack[] = [
  {
    id: 'none',
    name: 'No Music',
    mood: 'silent',
    description: 'Video with narration only, no background music',
    duration: '—',
    genre: 'none',
    url: '',
  },
  {
    id: 'corporate-gentle',
    name: 'Gentle Corporate',
    mood: 'warm',
    description: 'Soft piano with light strings — warm and professional',
    duration: '3:00',
    genre: 'Corporate',
    url: `${SUPABASE_MUSIC_BASE}/corporate-gentle.mp3`,
  },
  {
    id: 'modern-ambient',
    name: 'Modern Ambient',
    mood: 'calm',
    description: 'Clean synth pads with subtle rhythm — modern and sophisticated',
    duration: '2:30',
    genre: 'Ambient',
    url: `${SUPABASE_MUSIC_BASE}/modern-ambient.mp3`,
  },
  {
    id: 'upbeat-positive',
    name: 'Upbeat Positive',
    mood: 'energetic',
    description: 'Light acoustic guitar with uplifting feel — friendly and motivating',
    duration: '2:45',
    genre: 'Acoustic',
    url: `${SUPABASE_MUSIC_BASE}/upbeat-positive.mp3`,
  },
  {
    id: 'tech-innovation',
    name: 'Tech Innovation',
    mood: 'futuristic',
    description: 'Electronic ambient with clean beats — tech-forward and innovative',
    duration: '3:15',
    genre: 'Electronic',
    url: `${SUPABASE_MUSIC_BASE}/tech-innovation.mp3`,
  },
  {
    id: 'elegant-piano',
    name: 'Elegant Piano',
    mood: 'refined',
    description: 'Solo piano with emotional depth — elegant and trustworthy',
    duration: '2:50',
    genre: 'Classical',
    url: `${SUPABASE_MUSIC_BASE}/elegant-piano.mp3`,
  },
  {
    id: 'inspiring-strings',
    name: 'Inspiring Strings',
    mood: 'inspiring',
    description: 'Orchestral strings building to a crescendo — inspiring and confident',
    duration: '3:30',
    genre: 'Cinematic',
    url: `${SUPABASE_MUSIC_BASE}/inspiring-strings.mp3`,
  },
]

/** Get tracks filtered by mood */
export function getTracksByMood(mood: string): MusicTrack[] {
  if (!mood || mood === 'all') return MUSIC_TRACKS
  return MUSIC_TRACKS.filter(t => t.mood === mood || t.id === 'none')
}

/** Auto-select a track based on content */
export function autoSelectTrack(contentText: string): MusicTrack {
  const text = contentText.toLowerCase()

  if (text.includes('tech') || text.includes('software') || text.includes('digital') || text.includes('ai')) {
    return MUSIC_TRACKS.find(t => t.id === 'tech-innovation') ?? MUSIC_TRACKS[1]
  }
  if (text.includes('financ') || text.includes('invest') || text.includes('insurance') || text.includes('policy')) {
    return MUSIC_TRACKS.find(t => t.id === 'elegant-piano') ?? MUSIC_TRACKS[1]
  }
  if (text.includes('educat') || text.includes('learn') || text.includes('training')) {
    return MUSIC_TRACKS.find(t => t.id === 'upbeat-positive') ?? MUSIC_TRACKS[1]
  }
  if (text.includes('luxury') || text.includes('premium') || text.includes('executive')) {
    return MUSIC_TRACKS.find(t => t.id === 'inspiring-strings') ?? MUSIC_TRACKS[1]
  }

  // Default: gentle corporate
  return MUSIC_TRACKS.find(t => t.id === 'corporate-gentle') ?? MUSIC_TRACKS[1]
}
