import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'

export const runtime = 'nodejs'

const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY || ''

const CARTESIA_VOICES: Record<string, string> = {
  nova: 'b7d50908-b17c-442d-ad8d-7c56c5d11b2f',     // American female, warm narrator
  shimmer: '71a7ad14-091c-4e8e-a314-022ece01c121',   // American female, professional
  onyx: '98a34ef2-2140-4c28-9c71-663dc4dd7022',      // American male, deep authoritative
  echo: 'fb26447f-308b-471e-8b00-8e9f04284eb5',      // American male, conversational
  alloy: 'daf747c6-6bc2-4083-bd59-aa94dce23571',     // American neutral, clear
  fable: 'a3520a8f-226a-428d-9fcd-b0f44571f6e2',     // American male, storyteller
  ash: '63ff761f-c1e8-414b-b969-a1cb962bbc72',        // American male, professional
  coral: 'c2ac25f9-ecc4-4f56-9095-651354df60c0',     // American female, engaging
}

async function cartesiaPreview(text: string, voiceId: string): Promise<Buffer> {
  const cVoiceId = CARTESIA_VOICES[voiceId] || CARTESIA_VOICES['nova']
  const res = await fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: {
      'Cartesia-Version': '2024-06-10',
      'X-API-Key': CARTESIA_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_id: 'sonic-2',
      transcript: text.slice(0, 500),
      voice: { id: cVoiceId },
      output_format: { container: 'mp3', bit_rate: 128000, sample_rate: 44100 },
      speed: 'normal',
    }),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`Cartesia error ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { text, voiceId } = await request.json()
  if (!voiceId) return NextResponse.json({ error: 'Missing voiceId' }, { status: 400 })

  try {
    const audioBuffer = await cartesiaPreview(text || 'Hello, this is a voice preview.', voiceId)
    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' },
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Preview failed' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const voiceId = searchParams.get('voice')
  const customText = searchParams.get('text')
  if (!voiceId) return NextResponse.json({ error: 'Missing voice parameter' }, { status: 400 })

  try {
    const audioBuffer = await cartesiaPreview(customText || 'Hello, this is a voice preview.', voiceId)
    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' },
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Preview failed' }, { status: 500 })
  }
}
