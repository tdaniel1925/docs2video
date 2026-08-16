import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '../../_lib/supabase/server'
import { extractPptxSlides, buildDeckSplit, MAX_DECK_SLIDES, type DeckSplit } from '../../_lib/deck-split'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * PARSE AN UPLOADED DECK INTO SEPARATE SLIDES — read only, no drawing, no charge.
 *
 * PPTX: split in-app (deck-split.extractPptxSlides keeps empty slides so an
 * image-only slide is counted + flagged, not lost).
 * PDF: ask Claude for one entry PER PAGE — { slides: [{ heading, bullets }] } —
 * then normalise through the same buildDeckSplit so both formats produce one
 * shape (ordered, capped, image-only flagged).
 *
 * Returns the slide list for the user to confirm BEFORE they spend anything.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const form = await request.formData().catch(() => null)
  const file = form?.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  if (file.size > 40 * 1024 * 1024) return NextResponse.json({ error: 'That file is over 40MB — try a smaller one.' }, { status: 400 })

  const name = file.name?.toLowerCase() || ''
  const isPptx = name.endsWith('.pptx') || name.endsWith('.ppt')
  const isPdf = name.endsWith('.pdf') || file.type === 'application/pdf'
  if (!isPptx && !isPdf) {
    return NextResponse.json({ error: 'Upload a PowerPoint (.pptx) or PDF deck.' }, { status: 400 })
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer())
    let split: DeckSplit

    if (isPptx) {
      const rawSlides = await extractPptxSlides(buf)
      split = buildDeckSplit(rawSlides)
    } else {
      // PDF → per-page slides via Claude's native PDF support.
      const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
      const res = await claude.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: 'You split a slide deck / PDF into its individual slides, in order. For EACH page or slide, return its title and its bullet points as written. Do not merge slides, do not summarise, do not invent. If a page is only a picture with no readable text, return it with an empty heading and empty bullets so it is still counted.',
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } },
            { type: 'text', text: 'Return ONLY valid JSON, no markdown fences: {"slides":[{"heading":string,"bullets":string[]}]} — one entry per page/slide, in order.' },
          ],
        }],
      })
      const rawText = res.content[0]?.type === 'text' ? res.content[0].text : '{}'
      const parsed = JSON.parse(rawText.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()) as { slides?: { heading?: string; bullets?: string[] }[] }
      // Rebuild each slide's raw text ("heading\nbullet\nbullet") and feed the
      // SAME normaliser the PPTX path uses, so image-only detection + cap match.
      const rawSlides = (parsed.slides ?? []).map((s) =>
        [s.heading ?? '', ...(s.bullets ?? [])].filter(Boolean).join('\n'))
      split = buildDeckSplit(rawSlides)
    }

    if (!split.slides.length) {
      return NextResponse.json({ error: 'We could not read any slides from that file. Is it a real deck?' }, { status: 422 })
    }

    return NextResponse.json({
      name: file.name,
      slides: split.slides,
      found: split.found,
      truncated: split.truncated,
      imageOnlySlides: split.imageOnlySlides,
      cap: MAX_DECK_SLIDES,
    })
  } catch (e) {
    // Say what went wrong plainly; never leak a stack.
    const msg = e instanceof Error && /no slides/i.test(e.message)
      ? 'That file has no slides we can read.'
      : 'We could not read that deck. Try exporting it again as a .pptx or PDF.'
    console.error('[deck-parse] failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
