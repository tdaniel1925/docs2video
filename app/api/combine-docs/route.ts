import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '../../_lib/supabase/server'
import type { WizardDraft, VideoBrief } from '../../_lib/types'
import { scrubPlaceholderNamesInText } from '../../_lib/text-format'
import { logError } from '../../_lib/error-logger'

export const runtime = 'nodejs'
export const maxDuration = 60

function claude() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured')
  return new Anthropic({ apiKey: key })
}

/**
 * Multi-document COMBINE pass. Given several extracted documents + the user's
 * instruction ("compare these three"), produce ONE unified VideoBrief that
 * reasons ACROSS the documents — so the downstream script generator gets a
 * single, coherent plan instead of three disconnected extractions.
 *
 * Reuses the VideoBrief shape (docType/summary/keyPoints/figures/angle) so it
 * plugs straight into the existing brief → script pipeline.
 */
function parseBrief(text: string): VideoBrief | null {
  try {
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
    const b = JSON.parse(json)
    if (!b || typeof b !== 'object') return null
    const s = scrubPlaceholderNamesInText
    return {
      docType: String(b.docType || 'Multiple documents'),
      summary: s(String(b.summary || '')),
      keyPoints: Array.isArray(b.keyPoints) ? b.keyPoints.map((x: any) => s(String(x))).slice(0, 10) : [],
      figures: Array.isArray(b.figures) ? b.figures.filter((f: any) => f?.label && f?.value).map((f: any) => ({ label: s(String(f.label)), value: String(f.value) })).slice(0, 10) : [],
      angle: s(String(b.angle || '')),
      tone: b.tone ? String(b.tone) : undefined,
      emphasis: Array.isArray(b.emphasis) ? b.emphasis.map((x: any) => s(String(x))) : undefined,
      avoid: Array.isArray(b.avoid) ? b.avoid.map((x: any) => s(String(x))) : undefined,
    }
  } catch { return null }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { videoId } = (await request.json().catch(() => ({}))) as { videoId?: string }
  if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 })

  const { data: video } = await supabase
    .from('videos').select('id, user_id, draft_data')
    .eq('id', videoId).eq('user_id', user.id).single()
  if (!video) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })

  const draft = (video.draft_data as WizardDraft) || ({} as WizardDraft)
  const docs = draft.extractedDocs || []
  if (docs.length < 2) {
    // Nothing to combine — single doc flows through the normal brief path.
    return NextResponse.json({ skipped: true })
  }

  const instruction = (draft.combineInstruction || draft.purpose || '').trim()
    || 'Synthesize these documents into one clear, comparative explainer.'

  // Compact each document for the model: title + classification + a few points
  // and metrics (full JSON would blow the token budget on 5 docs).
  const docDigest = (d: { fileName?: string; data: any }, i: number): string => {
    const x = d.data || {}
    const cls = x.classification || {}
    const points = Array.isArray(x.bulletPoints) ? x.bulletPoints.slice(0, 8) : []
    const metrics = Array.isArray(x.keyMetrics) ? x.keyMetrics.slice(0, 8) : []
    return [
      `DOCUMENT ${i + 1}${d.fileName ? ` (${d.fileName})` : ''}:`,
      `  type: ${cls.documentType || x.title || 'unknown'}${cls.category ? ` / ${cls.category}` : ''}`,
      x.title ? `  title: ${x.title}` : '',
      points.length ? `  points:\n${points.map((p: any) => `    - ${p}`).join('\n')}` : '',
      metrics.length ? `  metrics:\n${metrics.map((m: any) => `    - ${m.label}: ${m.value}`).join('\n')}` : '',
    ].filter(Boolean).join('\n')
  }

  const sys = `You are a video producer preparing ONE explainer video from MULTIPLE source documents. The user's instruction tells you how to relate them.

STRICT GROUNDING: use ONLY facts, names, and numbers present in the documents. Invent nothing. Never use placeholder names ("Mr. Client", "John Doe") — address the viewer as "you".

Your job: produce a UNIFIED brief that carries out the instruction ACROSS all documents — e.g. if asked to COMPARE, surface the real side-by-side differences (the figures that differ, which option wins on what); if asked to MERGE, synthesize one overview. The keyPoints and figures must reflect the cross-document analysis, not just one file.

Return ONLY a JSON object:
{
  "docType": "what these collectively are (e.g. 'Three life-insurance illustrations, compared')",
  "summary": "1-2 sentences: what the video covers across the documents",
  "keyPoints": ["the 4-8 most important cross-document points / comparisons"],
  "figures": [{"label":"...","value":"..."}],  // the real numbers that matter for the comparison (label them so it's clear which doc/option)
  "angle": "the single takeaway the video should leave the viewer with",
  "tone": "the right tone",
  "emphasis": ["what to lead with"],
  "avoid": ["anything to keep out"]
}
No markdown, no commentary — just the JSON.`

  const input = [
    `USER INSTRUCTION (authoritative — this is what to DO with the documents): "${instruction}"`,
    `NUMBER OF DOCUMENTS: ${docs.length}`,
    '',
    docs.map(docDigest).join('\n\n'),
  ].join('\n')

  try {
    const resp = await claude().messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 2000, system: sys,
      messages: [{ role: 'user', content: input }],
    })
    const text = resp.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('')
    const brief = parseBrief(text)
    if (!brief) return NextResponse.json({ error: 'Could not combine the documents' }, { status: 502 })

    const merged: WizardDraft = { ...draft, brief }
    await supabase.from('videos').update({ draft_data: merged }).eq('id', videoId).eq('user_id', user.id)
    return NextResponse.json({ brief })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to combine documents'
    logError('combine-docs', err, { videoId, userId: user?.id })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
