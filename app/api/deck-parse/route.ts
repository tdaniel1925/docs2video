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

  const buf = Buffer.from(await file.arrayBuffer())
  let split: DeckSplit

  if (isPptx) {
    // PPTX: split in-app. A corrupt/old .ppt or a non-pptx zip throws here.
    try {
      const rawSlides = await extractPptxSlides(buf)
      split = buildDeckSplit(rawSlides)
    } catch (e) {
      console.error('[deck-parse] pptx extract failed:', e instanceof Error ? e.message : e)
      // .ppt (old binary format) isn't a zip → JSZip fails. Tell the user precisely.
      const isOldPpt = (file.name || '').toLowerCase().endsWith('.ppt')
      return NextResponse.json({
        error: isOldPpt
          ? 'That looks like an old-format .ppt. Open it in PowerPoint and "Save As" a modern .pptx, then upload again.'
          : 'That PowerPoint could not be read. Re-save it as .pptx (or export it as a PDF) and try again.',
      }, { status: 422 })
    }
  } else {
    // PDF → per-page slides via Claude's native PDF support.
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('[deck-parse] no ANTHROPIC_API_KEY set')
      return NextResponse.json({ error: 'PDF reading is temporarily unavailable. Try a .pptx instead.' }, { status: 503 })
    }
    let rawText = '{}'
    try {
      const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const res = await claude.messages.create({
        model: 'claude-sonnet-4-6',
        // Bigger budget: a long deck's JSON was getting cut off mid-array at
        // 4096, which then failed to parse and read as "couldn't make sense".
        max_tokens: 8192,
        system: 'You split a slide deck / PDF into its individual slides, in order. For EACH page or slide, return its title and its bullet points as written. Do not merge slides, do not summarise, do not invent. If a page is only a picture with no readable text, return it with an empty heading and empty bullets so it is still counted. Reply with ONLY the JSON object — no explanation, no markdown fences, nothing before or after it.',
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } },
            { type: 'text', text: 'Return ONLY valid JSON, no markdown fences: {"slides":[{"heading":string,"bullets":string[]}]} — one entry per page/slide, in order.' },
          ],
        }],
      })
      rawText = res.content.filter((c) => c.type === 'text').map((c) => (c as { text: string }).text).join('')
    } catch (e) {
      // Anthropic API error (rate limit, credit, PDF too big/unsupported).
      console.error('[deck-parse] anthropic PDF read failed:', e instanceof Error ? e.message : e)
      return NextResponse.json({ error: 'We could not read that PDF. It may be too large or scanned — try a .pptx, or a text-based PDF.' }, { status: 422 })
    }
    let parsed: { slides?: { heading?: string; bullets?: string[] }[] }
    try {
      // ROBUST EXTRACTION. The model sometimes wraps JSON in a sentence or a
      // fence, or trails off. Take the widest {...} span and parse that; only
      // give up if there's genuinely no object in the reply.
      const a = rawText.indexOf('{'), b = rawText.lastIndexOf('}')
      const slice = a >= 0 && b > a ? rawText.slice(a, b + 1) : rawText.trim()
      parsed = JSON.parse(slice)
    } catch (e) {
      console.error('[deck-parse] PDF JSON parse failed. rawText head:', rawText.slice(0, 200))
      return NextResponse.json({ error: 'We could not make sense of that PDF. Try re-exporting it as a .pptx, which reads most reliably.' }, { status: 422 })
    }
    const rawSlides = (parsed.slides ?? []).map((s) =>
      [s.heading ?? '', ...(s.bullets ?? [])].filter(Boolean).join('\n'))
    split = buildDeckSplit(rawSlides)
  }

  try {
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
