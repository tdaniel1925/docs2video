import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 30

const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY || ''

const CARTESIA_VOICES: Record<string, string> = {
  nova: 'f9fc912e-52f0-448a-8bfa-47e9ca75f25a',     // Marilyn - smooth supportive female narrator
  shimmer: '58fbaf73-d7de-4e82-a6b3-118180e7057c',   // Janet - bright warm female
  onyx: '8d110413-2f14-44a2-8203-2104db4340e9',      // Darren - deep friendly baritone male
  echo: 'd46abd1d-2d02-43e8-819f-51fb652c1c61',      // Grant - reliable clear American male
  alloy: 'cc00e582-ed66-4004-8336-0175b85c85f6',     // Dana - balanced neutral female
  fable: 'ab109683-f31f-40d7-b264-9ec3e26fb85e',     // Russell - friendly deep mentor male
  ash: '820a3788-2b37-4d21-847a-b65d8a68c99a',       // Tyler - direct confident male
  coral: '829ccd10-f8b3-43cd-b8a0-4aeaa81f3b30',     // Linda - clear confident mature female
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
