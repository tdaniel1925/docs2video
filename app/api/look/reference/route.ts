import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { aiDailyGate } from '../../../_lib/cardless-prep'
import { readReference, isVideoLink, REFERENCE_MAX_BYTES, VIDEO_LINK_MESSAGE, type ReadInput } from '../../../_lib/look-reference'
import { referenceDeps } from '../../../_lib/look-reference-deps'

// =============================================================================
// POST /api/look/reference — "Something I like" on the look screen.
//
// Body: a picture or PDF (multipart, field "file"), or JSON { url } for a
// website. Answers { ok: true, look, palette, read, fontLabel, cached } or
// { ok: false, fallback: 'brand', code, message } — the screen then starts
// from the brand and shows the message. Never charges credits. About 0.05¢
// a read (Gemini 2.5 Flash), cached per file, 20 a day per account.
// =============================================================================

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })

  let input: ReadInput
  const type = request.headers.get('content-type') || ''
  try {
    if (type.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('file')
      if (!(file instanceof File)) return NextResponse.json({ ok: false, fallback: 'brand', code: 'unreadable', message: 'No file came through. Please try again.' })
      if (file.size > REFERENCE_MAX_BYTES) return NextResponse.json({ ok: false, fallback: 'brand', code: 'too_big', message: 'That file is too big (15 MB at most). We started from your brand instead.' })
      const bytes = Buffer.from(await file.arrayBuffer())
      const name = file.name.toLowerCase()
      if (/^video\//.test(file.type) || /\.(mp4|mov|webm|m4v|avi)$/.test(name)) {
        return NextResponse.json({ ok: false, fallback: 'brand', code: 'video_link', message: VIDEO_LINK_MESSAGE })
      }
      const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf') || bytes.subarray(0, 5).toString('latin1') === '%PDF-'
      input = { kind: isPdf ? 'pdf' : 'image', bytes }
    } else {
      const body = await request.json().catch(() => ({})) as { url?: unknown }
      const url = typeof body.url === 'string' ? body.url : ''
      if (url && isVideoLink(url)) return NextResponse.json({ ok: false, fallback: 'brand', code: 'video_link', message: VIDEO_LINK_MESSAGE })
      input = { kind: 'website', url }
    }
  } catch {
    return NextResponse.json({ ok: false, fallback: 'brand', code: 'unreadable', message: 'We couldn’t read that one, so we started from your brand instead.' })
  }

  const deps = referenceDeps(user.id)
  const result = await readReference(input, {
    ...deps,
    // Every free AI step also counts toward the account's daily AI ceiling
    // (cardless accounts: their smaller one). Cache hits never get here.
    countRead: async () => {
      const gate = await aiDailyGate(user.id)
      if (gate) return gate.status === 429 ? 'over' : 'error'
      return deps.countRead()
    },
  })
  return NextResponse.json(result)
}
