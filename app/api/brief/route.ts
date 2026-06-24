import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '../../_lib/supabase/server'
import type { VideoBrief, WizardDraft, ClarifyingQuestion } from '../../_lib/types'
import { scrubPlaceholderNamesInText } from '../../_lib/text-format'
import { logError } from '../../_lib/error-logger'

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
      docType: String(b.docType || 'Source'),
      summary: s(String(b.summary || '')),
      keyPoints: Array.isArray(b.keyPoints) ? b.keyPoints.map((x: any) => s(String(x))).slice(0, 8) : [],
      figures: Array.isArray(b.figures) ? b.figures.filter((f: any) => f?.label && f?.value).map((f: any) => ({ label: s(String(f.label)), value: String(f.value) })).slice(0, 8) : [],
      angle: s(String(b.angle || '')),
      tone: b.tone ? String(b.tone) : undefined,
      emphasis: Array.isArray(b.emphasis) ? b.emphasis.map((x: any) => s(String(x))) : undefined,
      avoid: Array.isArray(b.avoid) ? b.avoid.map((x: any) => s(String(x))) : undefined,
      clarifyingQuestions: Array.isArray(b.clarifyingQuestions)
        ? b.clarifyingQuestions
            .filter((q: any) => q?.question)
            .slice(0, 3)
            .map((q: any, i: number): ClarifyingQuestion => ({
              id: String(q.id || `q${i}`),
              question: s(String(q.question)),
              why: q.why ? s(String(q.why)) : undefined,
              options: Array.isArray(q.options) ? q.options.map((o: any) => String(o)).slice(0, 5) : undefined,
            }))
        : undefined,
    }
  } catch { return null }
}

/**
 * Describe the input source in plain words based on how it was provided, so the
 * brief never calls a scanned website "this document". `contentMethod`:
 *   url  → a website that was scanned
 *   file → an uploaded document
 *   text → pasted content
 *   ai   → an idea/topic the user described
 */
function describeSource(contentMethod?: string): {
  noun: string            // "website" | "document" | "content" | "topic"
  dataLabel: string       // header for the input block
  docTypeHint: string     // what docType should describe
} {
  switch (contentMethod) {
    case 'url':
      return {
        noun: 'website',
        dataLabel: 'SCANNED WEBSITE CONTENT',
        docTypeHint: "what this website is (e.g. 'Company website — financial advisory firm')",
      }
    case 'text':
      return {
        noun: 'content',
        dataLabel: 'PASTED CONTENT',
        docTypeHint: "what this content is (e.g. 'Product description', 'Service overview')",
      }
    case 'ai':
      return {
        noun: 'topic',
        dataLabel: 'TOPIC / IDEA',
        docTypeHint: "what this is about (e.g. 'Explainer on retirement planning')",
      }
    case 'file':
    default:
      return {
        noun: 'document',
        dataLabel: 'DOCUMENT DATA',
        docTypeHint: "what kind of document this is (e.g. 'Life insurance illustration')",
      }
  }
}

function buildSystemPrompt(src: ReturnType<typeof describeSource>): string {
  const { noun, docTypeHint } = src
  return `You are a video producer reviewing a source ${noun} before scripting an explainer video. Produce a BRIEF: a plain-language statement of what the ${noun} is and what the video will cover.

STRICT GROUNDING: use ONLY facts, names, and numbers present in the provided ${noun} data. Invent NOTHING — no figures, no claims, no contact info that isn't there.

CORRECTLY IDENTIFY THE SOURCE: this input came from ${noun === 'website' ? 'a WEBSITE that was scanned — refer to it as "this website" / "the site", never "this document"' : noun === 'content' ? 'PASTED content — refer to it as "this content", never "this document" unless the content clearly is one' : noun === 'topic' ? 'a TOPIC the user described — frame the brief around that topic' : 'an uploaded document'}.

NEVER use a placeholder or sample name. If the source refers to the person as "Mr. Client", "Valued Client", "the insured", "John Doe", or any generic stand-in, DO NOT repeat it — address the reader as "you" / "your" instead (e.g. "This policy gives you lifelong protection"). Only use a real person's name if one is genuinely present.

BE INTELLIGENT — ASK ONLY WHEN GENUINELY UNSURE. Before finalizing, judge your CONFIDENCE on the dimensions that actually change the script:
  • WHO/FROM: whose video is this — is it FROM a company/person TO a prospect, or ABOUT them? (e.g. a company name appearing throughout usually means it's that company's video for their prospects).
  • AUDIENCE: who watches (new prospect, existing client, internal team)?
  • GOAL/CTA: what should the viewer do after (book a call, sign, just understand)?
  • EMPHASIS: if the source weights several topics heavily, which should lead?
  • TONE: reassuring/plain vs. polished/corporate.
For each dimension you are CONFIDENT about, just reflect it in the brief (do NOT ask). ONLY for dimensions that are genuinely ambiguous or where critical info is missing, add a short clarifying question (max 3 total, most-impactful first). If everything is clear, return an EMPTY clarifyingQuestions array. Do not ask about things the source already answers. Questions must be specific to THIS source (reference the real company/person/topic by name), not generic.

Return ONLY a JSON object:
{
  "docType": "${docTypeHint}",
  "summary": "1-2 friendly sentences: what this is and who it's for",
  "keyPoints": ["the 3-6 most important points the video should make"],
  "figures": [{"label":"...","value":"..."}],  // the real numbers worth featuring (exact units)
  "angle": "the single intended takeaway / how the video should be framed",
  "tone": "the right tone for this audience (e.g. 'reassuring, plain-language')",
  "clarifyingQuestions": [   // 0-3 items, ONLY where you are genuinely unsure
    { "id": "audience", "question": "Who is this video for — a new prospect, or an existing client of <RealName>?", "why": "It changes the tone and CTA.", "options": ["New prospect","Existing client","Internal team"] }
  ]
}
No markdown, no commentary — just the JSON.`
}

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
  const sys = buildSystemPrompt(src)

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

  try {
    const resp = await claude().messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 1500, system: sys,
      messages: [{ role: 'user', content: `${src.dataLabel}:\n\n${input || '(no structured data extracted)'}` }],
    })
    const text = resp.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('')
    const brief = parseBrief(text)
    if (!brief) return NextResponse.json({ error: 'Could not build a brief' }, { status: 502 })

    // When the user just answered questions, record those answers on the brief
    // and clear any that were resolved so they aren't re-asked.
    if (hasAnswers) {
      const answered = (draft.brief?.clarifyingQuestions || []).map((q) => ({ ...q, answer: answers![q.id] || q.answer }))
      // Keep only NEW questions the model raised that weren't already answered.
      const newQs = (brief.clarifyingQuestions || []).filter((q) => !answers![q.id])
      brief.clarifyingQuestions = newQs
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
