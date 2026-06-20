import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '../../_lib/supabase/server'
import type { VideoBrief, WizardDraft } from '../../_lib/types'
import { scrubPlaceholderNamesInText } from '../../_lib/text-format'

export const runtime = 'nodejs'
export const maxDuration = 45

function claude() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured')
  return new Anthropic({ apiKey: key })
}

/** Pull a JSON object out of a model response (fence/prose tolerant). */
function parseBrief(text: string): VideoBrief | null {
  try {
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
    const b = JSON.parse(json)
    if (!b || typeof b !== 'object') return null
    // Scrub placeholder/sample names ("Mr. Client", "Valued Client", "John Doe")
    // that read unprofessionally even if the source doc prints them.
    const s = scrubPlaceholderNamesInText
    return {
      docType: String(b.docType || 'Document'),
      summary: s(String(b.summary || '')),
      keyPoints: Array.isArray(b.keyPoints) ? b.keyPoints.map((x: any) => s(String(x))).slice(0, 8) : [],
      figures: Array.isArray(b.figures) ? b.figures.filter((f: any) => f?.label && f?.value).map((f: any) => ({ label: s(String(f.label)), value: String(f.value) })).slice(0, 8) : [],
      angle: s(String(b.angle || '')),
      tone: b.tone ? String(b.tone) : undefined,
      emphasis: Array.isArray(b.emphasis) ? b.emphasis.map((x: any) => s(String(x))) : undefined,
      avoid: Array.isArray(b.avoid) ? b.avoid.map((x: any) => s(String(x))) : undefined,
    }
  } catch { return null }
}

const SYS = `You are a video producer reviewing a source document before scripting an explainer video. Produce a BRIEF: a plain-language statement of what the document is and what the video will cover.

STRICT GROUNDING: use ONLY facts, names, and numbers present in the provided document data. Invent NOTHING — no figures, no claims, no contact info that isn't there.

NEVER use a placeholder or sample name. If the document refers to the person as "Mr. Client", "Valued Client", "the insured", "John Doe", or any generic stand-in, DO NOT repeat it — address the reader as "you" / "your" instead (e.g. "This policy gives you lifelong protection"). Only use a real person's name if one is genuinely present.

Return ONLY a JSON object:
{
  "docType": "what kind of document this is, in plain words (e.g. 'Life insurance illustration')",
  "summary": "1-2 friendly sentences: what this is and who it's for",
  "keyPoints": ["the 3-6 most important points the video should make"],
  "figures": [{"label":"...","value":"..."}],  // the real numbers worth featuring (exact units)
  "angle": "the single intended takeaway / how the video should be framed",
  "tone": "the right tone for this audience (e.g. 'reassuring, plain-language')"
}
No markdown, no commentary — just the JSON.`

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { videoId, regenerate } = (await request.json().catch(() => ({}))) as { videoId?: string; regenerate?: boolean }
  if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 })

  // Load the draft (must belong to this user).
  const { data: video } = await supabase
    .from('videos')
    .select('id, user_id, draft_data')
    .eq('id', videoId)
    .eq('user_id', user.id)
    .single()
  if (!video) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })

  const draft = (video.draft_data as WizardDraft) || ({} as WizardDraft)

  // Idempotent: return the existing brief unless explicitly regenerating.
  if (draft.brief && !regenerate) return NextResponse.json({ brief: draft.brief })

  const extracted = (draft.extractedData as any) || {}
  const classification = (draft.classification as any) || extracted.classification || {}

  // Compact, grounded input for the model.
  const input = [
    `TITLE: ${extracted.title || classification.title || '(untitled)'}`,
    classification.documentType ? `DETECTED TYPE: ${classification.documentType} (${classification.category || ''})` : '',
    classification.keyQuestion ? `KEY QUESTION: ${classification.keyQuestion}` : '',
    classification.tone ? `SUGGESTED TONE: ${classification.tone}` : '',
    Array.isArray(extracted.bulletPoints) && extracted.bulletPoints.length ? `POINTS:\n- ${extracted.bulletPoints.slice(0, 12).join('\n- ')}` : '',
    Array.isArray(extracted.keyMetrics) && extracted.keyMetrics.length ? `METRICS:\n${extracted.keyMetrics.slice(0, 12).map((m: any) => `${m.label}: ${m.value}`).join('\n')}` : '',
    draft.purpose ? `USER PURPOSE: ${draft.purpose}` : '',
  ].filter(Boolean).join('\n\n')

  try {
    const resp = await claude().messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 1500, system: SYS,
      messages: [{ role: 'user', content: `DOCUMENT DATA:\n\n${input || '(no structured data extracted)'}` }],
    })
    const text = resp.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('')
    const brief = parseBrief(text)
    if (!brief) return NextResponse.json({ error: 'Could not build a brief' }, { status: 502 })

    const merged: WizardDraft = { ...draft, brief }
    await supabase.from('videos').update({ draft_data: merged }).eq('id', videoId).eq('user_id', user.id)
    return NextResponse.json({ brief })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to build brief'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
