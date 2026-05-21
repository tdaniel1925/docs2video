import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'

export const runtime = 'nodejs'

const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY || ''

const CARTESIA_VOICES: Record<string, string> = {
  nova: '79a125e8-cd45-4c13-8a67-188112f4dd22',
  shimmer: 'a0e99841-438c-4a64-b679-ae501e7d6091',
  onyx: '41534e16-2966-4c6b-9670-111411def906',
  echo: '726d5ae5-055f-4c3d-8355-d9677de68571',
  alloy: 'f9836c6e-a0bd-460e-9d3c-f7299fa60f94',
  fable: 'c45bc5ec-dc68-4feb-8829-6e6b2748095d',
  ash: '87748186-691e-4e9d-a995-98ccefb1c7f4',
  coral: '00a77add-48d5-4ef6-8157-71e5580b7a4f',
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
