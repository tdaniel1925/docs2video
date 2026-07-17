import { NextResponse } from 'next/server'
import { authenticateApiKey } from '../../../_lib/api-auth'
import { isRegulated, productTokens, COMPLIANCE_CLAUSE } from '../../../_lib/compliance'
import { briefClaude, parseBrief, describeSource, buildBriefSystemPrompt } from '../../../_lib/brief-core'

export const runtime = 'nodejs'
export const maxDuration = 45

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://docs2video.com').replace(/\/$/, '')
const INTERNAL_SECRET = (process.env.INTERNAL_API_SECRET || '').trim()

/** Server-to-server internal call acting as the resolved owner (same pattern as
 *  POST /api/v1/videos). */
async function callInternal(path: string, userId: string, body: unknown): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-internal-service': INTERNAL_SECRET, 'x-internal-user-id': userId },
    body: JSON.stringify(body),
  })
}

interface Body {
  input?: { type: 'text' | 'url' | 'idea'; text?: string; url?: string; topic?: string; audience?: string; tone?: string }
  purpose?: string
}

/**
 * POST /api/v1/brief
 * Stateless brief preview for API/MCP clients — the same "what will the video
 * cover?" the wizard shows on its Review step, without creating a draft. The
 * client shows it to the user, edits per feedback, then passes the approved brief
 * into POST /api/v1/videos. Auth: Bearer key. No charge.
 * Body: { input: { type, text|url|topic }, purpose }.
 * Returns: { brief: { docType, summary, keyPoints, figures, angle, tone, clarifyingQuestions } }.
 */
export async function POST(request: Request) {
  if (!INTERNAL_SECRET) return NextResponse.json({ error: 'API not configured' }, { status: 503 })
  const caller = await authenticateApiKey(request)
  if (!caller) return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })

  let body: Body
  try { body = (await request.json()) as Body } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  const input = body.input
  if (!input?.type) return NextResponse.json({ error: 'input.type is required (text|url|idea)' }, { status: 400 })

  // 1) Extract the source into structured data (reuse the internal extract routes).
  let extracted: any
  let contentMethod: 'text' | 'url' | 'ai'
  try {
    if (input.type === 'text') {
      if (!input.text?.trim()) return NextResponse.json({ error: 'input.text is required for type "text"' }, { status: 400 })
      const r = await callInternal('/api/extract-text', caller.userId, { text: input.text })
      if (!r.ok) return NextResponse.json({ error: 'Extraction failed' }, { status: 502 })
      extracted = await r.json(); contentMethod = 'text'
    } else if (input.type === 'url') {
      if (!input.url?.trim()) return NextResponse.json({ error: 'input.url is required for type "url"' }, { status: 400 })
      const r = await callInternal('/api/extract-url', caller.userId, { url: input.url })
      if (!r.ok) { const m = await r.json().catch(() => ({})); return NextResponse.json({ error: m.error || 'URL extraction failed' }, { status: r.status === 400 ? 400 : 502 }) }
      extracted = await r.json(); contentMethod = 'url'
    } else if (input.type === 'idea') {
      if (!input.topic?.trim()) return NextResponse.json({ error: 'input.topic is required for type "idea"' }, { status: 400 })
      const r = await callInternal('/api/generate-from-idea', caller.userId, { topic: input.topic, audience: input.audience || 'general audience', tone: input.tone || 'professional' })
      if (!r.ok) return NextResponse.json({ error: 'Idea generation failed' }, { status: 502 })
      extracted = await r.json(); contentMethod = 'ai'
    } else {
      return NextResponse.json({ error: 'Unsupported input.type for brief (use text|url|idea; upload a file via the app for now)' }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Extraction error' }, { status: 502 })
  }

  // 2) Build the grounded input + generate the brief (shared brief-core; same as
  //    the wizard's Review step). Regulated → compliance clause + name scrub.
  const src = describeSource(contentMethod)
  const classification = (extracted?.classification as any) || {}
  const compactInput = [
    body.purpose ? `USER PURPOSE: ${body.purpose}` : '',
    `TITLE: ${extracted?.title || classification.title || '(untitled)'}`,
    classification.documentType ? `DETECTED TYPE: ${classification.documentType} (${classification.category || ''})` : '',
    Array.isArray(extracted?.bulletPoints) && extracted.bulletPoints.length ? `POINTS:\n- ${extracted.bulletPoints.slice(0, 12).join('\n- ')}` : '',
    Array.isArray(extracted?.keyMetrics) && extracted.keyMetrics.length ? `METRICS:\n${extracted.keyMetrics.slice(0, 12).map((m: any) => `${m.label}: ${m.value}`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n')

  const regulated = isRegulated(compactInput, classification?.documentType)
  const sys = buildBriefSystemPrompt(src) + (regulated ? COMPLIANCE_CLAUSE : '')
  const tokens = regulated ? productTokens(extracted?.title, classification?.documentType, ...(Array.isArray(extracted?.bulletPoints) ? extracted.bulletPoints : [])) : []

  try {
    const resp = await briefClaude().messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 1500, system: sys,
      messages: [{ role: 'user', content: `${src.dataLabel}:\n\n${compactInput || '(no structured data extracted)'}` }],
    })
    const text = resp.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('')
    const brief = parseBrief(text, regulated, tokens)
    if (!brief) return NextResponse.json({ error: 'Could not build a brief' }, { status: 502 })
    return NextResponse.json({ brief, extracted })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to build brief' }, { status: 500 })
  }
}
