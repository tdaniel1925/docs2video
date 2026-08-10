import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { planDeck, MIN_SLIDES, MAX_SLIDES } from '../../_lib/deck-plan'

// =============================================================================
// Plan a deck — the running order only, no pictures yet.
//
// FREE ON PURPOSE. Drawing twelve slides costs real money and several minutes,
// and the commonest way to waste both is to generate a running order nobody
// read. This returns the plan as text so it can be corrected first: change a
// headline, drop a slide, fix a figure. Only then is anything drawn.
// =============================================================================

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await req.json().catch(() => null) as { brief?: string; slides?: number } | null
  const brief = String(body?.brief ?? '').trim()
  if (brief.length < 10) {
    return NextResponse.json({ error: 'Tell me a bit more about the deck first.' }, { status: 400 })
  }

  const count = Number(body?.slides)
  const slides = Number.isFinite(count)
    ? Math.max(MIN_SLIDES, Math.min(MAX_SLIDES, Math.round(count)))
    : 8

  try {
    const plan = await planDeck(brief, slides)
    return NextResponse.json(plan)
  } catch (e) {
    // Say what went wrong. A silent failure here reads as "the button is
    // broken" and the customer tries again into the same wall.
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[flyer-deck] planning failed:', msg)
    return NextResponse.json(
      { error: 'Could not plan that deck. Try describing it in a sentence or two — what it is about and who it is for.' },
      { status: 502 },
    )
  }
}
