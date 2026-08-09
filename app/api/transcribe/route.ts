import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'

// =============================================================================
// Dictation fallback: the client records audio, we turn it into words.
//
// The browser's own Web Speech API is the fast path, but it is missing or
// unreliable in plenty of places — iOS Safari, installed web apps, some
// locked-down work laptops. Without this route those people press the mic and
// nothing happens, which is exactly what was reported.
//
// Lifted from the same approach already proven in the Jordyn app.
// =============================================================================

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'Dictation is not set up on this server.' }, { status: 500 })
  }

  const form = await req.formData().catch(() => null)
  const file = form?.get('audio')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No audio was sent.' }, { status: 400 })
  }
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: 'That recording is too long — keep it under a couple of minutes.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const mime = file.type || 'audio/webm'

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mime, data: buffer.toString('base64') } },
            {
              // VERBATIM. This is someone dictating the words that will be
              // printed on a flyer — a helpfully "tidied up" venue name or
              // price is worse than useless.
              text: 'Transcribe this dictation VERBATIM as plain text. No speaker labels, no timestamps, no notes, no quotation marks around the whole thing — just the words the person said, with natural punctuation. If it is silent or unintelligible, reply with exactly: [no speech detected]',
            },
          ],
        }],
        generationConfig: { maxOutputTokens: 2000 },
      }),
    },
  ).catch(() => null)

  const data = (await res?.json().catch(() => ({}))) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
    error?: { message?: string }
  }
  if (!res?.ok) {
    console.error('[transcribe] failed:', data?.error?.message)
    return NextResponse.json({ error: data?.error?.message ?? 'Could not make out the recording.' }, { status: 500 })
  }

  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? '')
    .join('')
    .trim()

  // Say nothing rather than passing "[no speech detected]" through as if the
  // customer had said it.
  if (!text || /^\[no speech detected\]$/i.test(text)) return NextResponse.json({ text: '' })
  return NextResponse.json({ text })
}
