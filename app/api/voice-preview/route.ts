import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { synthesizeSpeech } from '../../_lib/tts'

export const runtime = 'nodejs'

const PREVIEW_TEXT = 'Hi there. I\'m here to walk you through your life insurance policy, so you can feel confident about the protection you have in place for your family.'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const voiceId = searchParams.get('voice')
  const customText = searchParams.get('text')
  if (!voiceId) return NextResponse.json({ error: 'Missing voice parameter' }, { status: 400 })

  try {
    const audioBuffer = await synthesizeSpeech(customText || PREVIEW_TEXT, voiceId)
    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate preview'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
