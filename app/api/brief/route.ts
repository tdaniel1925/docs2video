import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import type { WizardDraft } from '../../_lib/types'
import { isRegulated, productTokens, complianceLeaks, COMPLIANCE_CLAUSE } from '../../_lib/compliance'
import { logError } from '../../_lib/error-logger'
// Shared brief-generation core (also used by the key-authed /api/v1/brief).
import { briefClaude as claude, parseBrief, describeSource, buildBriefSystemPrompt as buildSystemPrompt } from '../../_lib/brief-core'

export const runtime = 'nodejs'
export const maxDuration = 45

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { videoId, regenerate, answers } = (await request.json().catch(() => ({}))) as {
    videoId?: string; regenerate?: boolean; answers?: Record<string, string>
  }
  if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 })
  // Submitting answers always re-grounds the brief with them.
  const hasAnswers = answers && Object.keys(answers).length > 0

  // Load the draft (must belong to this user).
  const { data: video } = await supabase
    .from('videos')
    .select('id, user_id, draft_data')
    .eq('id', videoId)
    .eq('user_id', user.id)
    .single()
  if (!video) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })

  const draft = (video.draft_data as WizardDraft) || ({} as WizardDraft)

  // Idempotent: return the existing brief unless explicitly regenerating or
  // submitting clarifying answers.
  if (draft.brief && !regenerate && !hasAnswers) return NextResponse.json({ brief: draft.brief })

  const extracted = (draft.extractedData as any) || {}
  const classification = (draft.classification as any) || extracted.classification || {}
  // Identify the input source so the brief calls a scanned website a "website",
  // pasted text "content", etc. — never blindly "this document".
  const src = describeSource((draft as any).contentMethod)

  // Pull what we ALREADY know about who's presenting (brand/presenter), so the
  // AI doesn't ask "whose video is this" when the answer is already on record.
  // For URL scans extract-url auto-creates a brand; inlineBrand may also exist.
  let knownIdentity = ''
  const inline = (draft as any).inlineBrand
  let brand: any = null
  if ((draft as any).brandId) {
    const { data } = await supabase
      .from('brands')
      .select('name, profile_type, person_role, tagline, company_name')
      .eq('id', (draft as any).brandId)
      .maybeSingle()
    brand = data
  }
  const idName = brand?.name || inline?.name
  if (idName) {
    const kind = brand?.profile_type === 'person'
      ? `a PERSON presenting (${brand?.person_role ? brand.person_role + ', ' : ''}${idName})`
      : `the COMPANY "${idName}"`
    knownIdentity = `KNOWN PRESENTER/BRAND (already selected by the user — treat as authoritative; this video is FROM ${idName} to its audience, do NOT ask who it's from): ${kind}${brand?.tagline ? ` — tagline: "${brand.tagline}"` : ''}.`
  }

  // Compact, grounded input for the model.
  const input = [
    knownIdentity,
    `TITLE: ${extracted.title || classification.title || '(untitled)'}`,
    classification.documentType ? `DETECTED TYPE: ${classification.documentType} (${classification.category || ''})` : '',
    classification.keyQuestion ? `KEY QUESTION: ${classification.keyQuestion}` : '',
    classification.tone ? `SUGGESTED TONE: ${classification.tone}` : '',
    Array.isArray(extracted.bulletPoints) && extracted.bulletPoints.length ? `POINTS:\n- ${extracted.bulletPoints.slice(0, 12).join('\n- ')}` : '',
    Array.isArray(extracted.keyMetrics) && extracted.keyMetrics.length ? `METRICS:\n${extracted.keyMetrics.slice(0, 12).map((m: any) => `${m.label}: ${m.value}`).join('\n')}` : '',
    draft.purpose ? `USER PURPOSE: ${draft.purpose}` : '',
    // The user's answers to the prior clarifying questions — now AUTHORITATIVE.
    hasAnswers
      ? `USER ANSWERS (authoritative — bake these into angle/audience/tone/emphasis and DO NOT ask them again):\n${
          (draft.brief?.clarifyingQuestions || [])
            .map((q) => (answers![q.id] ? `- ${q.question} → ${answers![q.id]}` : null))
            .filter(Boolean)
            .join('\n') ||
          Object.entries(answers!).map(([k, v]) => `- ${k}: ${v}`).join('\n')
        }`
      : '',
  ].filter(Boolean).join('\n\n')

  // COMPLIANCE: detect a regulated insurance/financial illustration from the
  // extracted content + classification, so the brief preview NEVER shows the
  // carrier/product name (the leak the video already scrubbed, but the PREVIEW
  // — the foundation the user builds from — did not). Figures stay.
  const regulated = isRegulated(input, classification?.documentType, classification?.category, extracted?.title)
  const sys = buildSystemPrompt(src) + (regulated ? COMPLIANCE_CLAUSE : '')
  // product-name tokens from the extracted source for the code-level scrub net
  const tokens = regulated
    ? productTokens(extracted?.title, classification?.title, classification?.documentType,
        ...(Array.isArray(extracted?.bulletPoints) ? extracted.bulletPoints : []),
        ...(Array.isArray(extracted?.keyMetrics) ? extracted.keyMetrics.map((m: any) => m?.label) : []))
    : []

  try {
    const resp = await claude().messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 1500, system: sys,
      messages: [{ role: 'user', content: `${src.dataLabel}:\n\n${input || '(no structured data extracted)'}` }],
    })
    const text = resp.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('')
    const brief = parseBrief(text, regulated, tokens)
    if (!brief) return NextResponse.json({ error: 'Could not build a brief' }, { status: 502 })
    // audit: log if any blocklisted term survived (should never happen)
    if (regulated) {
      const leaks = complianceLeaks(brief.angle, brief.summary, ...(brief.keyPoints || []), ...(brief.figures || []).map((f) => f.label))
      if (leaks.length) logError('brief', new Error('compliance leak: ' + leaks.join(', ')), { videoId, userId: user?.id })
    }

    // When the user just answered questions, record those answers on the brief
    // and clear any that were resolved so they aren't re-asked.
    if (hasAnswers) {
      // The user just answered the AI's questions. Do NOT re-interrogate them:
      // the model tends to re-emit the same questions with fresh ids on each
      // re-ground (so id-based dedup never matched and they kept reappearing).
      // Once answered, clear questions entirely — any further tweaks go through
      // the free-form "Want changes? Tell me" box.
      const answered = (draft.brief?.clarifyingQuestions || []).map((q) => ({ ...q, answer: answers![q.id] || q.answer }))
      brief.clarifyingQuestions = []
      ;(brief as any).answeredQuestions = answered.filter((q) => q.answer)
    }

    const merged: WizardDraft = { ...draft, brief }
    await supabase.from('videos').update({ draft_data: merged }).eq('id', videoId).eq('user_id', user.id)
    return NextResponse.json({ brief })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to build brief'
    logError('brief', err, { videoId, userId: user?.id })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
