import { NextResponse } from 'next/server'
import { authenticateApiKey } from '../../../_lib/api-auth'
import { VOICE_OPTIONS } from '../../../_lib/types'

export const runtime = 'nodejs'

// The user-selectable explainer looks (kept in sync with the wizard's Theme step).
const VIDEO_STYLES = [
  { id: 'slides', name: 'Slide Deck', description: 'Animated explainer deck — headings, bullets, data cards, charts synced to the voice. Recommended.' },
  { id: 'aurora', name: 'Aurora', description: 'Modern motion graphics — one flowing branded backdrop, kinetic type, no stock imagery.' },
  { id: 'cinematic', name: 'Cinematic', description: 'Film-style imagery with kinetic text and motion. Best for story-led videos.' },
  { id: 'editorial', name: 'Editorial', description: 'Clean, warm magazine layout with refined serif typography on your brand color.' },
  { id: 'explainer', name: 'Explainer', description: 'Friendly modern deck — navy + color accents, big rounded cards. Great for how-it-works.' },
]

const OUTPUT_TYPES = [
  { id: 'video', name: 'Narrated video (MP4)' },
  { id: 'pptx', name: 'PowerPoint deck' },
  { id: 'pdf', name: 'PDF slides' },
]

const DETAIL_LEVELS = [
  { id: 'quick', name: 'Quick (~1 min)' },
  { id: 'standard', name: 'Standard (~2-3 min)' },
  { id: 'detailed', name: 'Detailed (~5-7 min)' },
]

/**
 * GET /api/v1/options
 * Static reference an API/MCP client uses to present valid choices (voices,
 * styles, output types, detail levels) without hardcoding. Auth: Bearer key.
 */
export async function GET(request: Request) {
  const caller = await authenticateApiKey(request)
  if (!caller) return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })

  return NextResponse.json({
    voices: VOICE_OPTIONS.map((v) => ({ id: v.id, name: v.name, gender: v.gender, description: v.description })),
    styles: VIDEO_STYLES,
    output_types: OUTPUT_TYPES,
    detail_levels: DETAIL_LEVELS,
  })
}
