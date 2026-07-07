import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '../../_lib/supabase/server'
import { checkCredits, deductCredits, CREDIT_COSTS } from '../../_lib/credits'
import { rateLimit, getRateLimitKey, LIMITS } from '../../_lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

let _claude: Anthropic | null = null
function getClaude() {
  if (!_claude) _claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
  return _claude
}

/**
 * POST /api/scene-edit — per-scene AI editing for the script step.
 * The user chats an instruction ("make this shorter", "drop the fee numbers",
 * "more upbeat") about ONE scene; the AI rewrites that scene's narration +
 * slide content and returns the updated scene. Grounded ONLY in the scene +
 * optional source data — never invents figures.
 *
 * Body: { scene, instruction, sourceData?, history?, outputType? }
 * Returns: { scene: <updated>, reply: string }
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const rl = rateLimit(getRateLimitKey(user.id, 'scene-edit'), LIMITS.generation.limit, LIMITS.generation.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please wait a bit before generating again.' }, { status: 429 })
  }

  const COST = CREDIT_COSTS['scene-edit']
  const credit = await checkCredits(user.id, COST)
  if (!credit.allowed) {
    return NextResponse.json({ error: `Not enough credits. Need ${COST}, have ${credit.remaining}.` }, { status: 402 })
  }
  if (!(await deductCredits(user.id, COST, 'scene-edit'))) {
    return NextResponse.json({ error: 'Failed to deduct credits.' }, { status: 402 })
  }

  const { scene, instruction, sourceData, history, outputType } = await request.json() as {
    scene: any
    instruction: string
    sourceData?: unknown
    history?: { role: 'user' | 'assistant'; text: string }[]
    outputType?: string
  }

  if (!scene || !instruction?.trim()) {
    return NextResponse.json({ error: 'Missing scene or instruction' }, { status: 400 })
  }

  const role = scene._role as 'cover' | 'closing' | undefined
  const isBookend = role === 'cover' || role === 'closing'
  const sourceRef = sourceData ? JSON.stringify(sourceData).slice(0, 8000) : ''

  const system = `You are editing ONE scene of a ${outputType === 'pptx' ? 'slide deck' : outputType === 'pdf' ? 'PDF' : 'narrated video'} script for the user.

Apply the user's instruction to THIS SCENE ONLY and return the full updated scene as JSON.

The scene shape is:
{
  "title": string,                       // short scene title
  "narration": string,                   // ${outputType === 'pptx' ? 'speaker notes' : 'spoken narration'} for this scene
  "slideData": {
    "headline": string,                  // on-slide headline
    ${isBookend ? '"cta": string,                       // closing call-to-action (closing scene only)' : '"stats": [{ "value": string, "label": string }],   // key figures shown on the slide\n    "bullets": string[]                  // on-slide bullet points'}
  }
}

RULES:
- Return ONLY the JSON object for the updated scene. No markdown, no commentary, no code fences.
- Preserve any field the instruction does not ask to change.
- GROUND every number/fact in the existing scene${sourceRef ? ' or the SOURCE DATA below' : ''}. NEVER invent figures, names, prices, or claims.
${isBookend ? '- This is a ' + role + ' (bookend) slide: keep it a clean title card. Do NOT add stats or bullets.' : '- Keep stats as real label/value pairs; keep bullets concise (one idea each).'}
- Keep narration natural and spoken-sounding; match the requested tone.
${sourceRef ? `\nSOURCE DATA (ground truth — do not contradict):\n${sourceRef}` : ''}`

  let response
  try {
    response = await getClaude().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system,
      messages: [
        ...((history || []).map(h => ({ role: h.role, content: h.text }))),
        { role: 'user' as const, content: `Current scene:\n${JSON.stringify(scene, null, 2)}\n\nInstruction: ${instruction}` },
      ],
    })
  } catch (err) {
    console.error('[scene-edit] Claude error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'AI request failed' }, { status: 502 })
  }

  const text = (response.content[0]?.type === 'text' ? response.content[0].text : '').trim()
  const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')

  let updated: any
  try {
    updated = JSON.parse(cleaned.slice(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1))
  } catch {
    return NextResponse.json({ error: 'Could not parse the edit. Try rephrasing.' }, { status: 422 })
  }

  // Merge defensively: keep original fields/flags, overlay the AI's changes, and
  // never let the model strip structural metadata (scene number, _role).
  const mergedSlide = { ...(scene.slideData || {}), ...(updated.slideData || {}) }
  const merged = {
    ...scene,
    title: typeof updated.title === 'string' ? updated.title : scene.title,
    narration: typeof updated.narration === 'string' ? updated.narration : scene.narration,
    slideData: mergedSlide,
    scene: scene.scene,
    _role: scene._role,
  }
  // Bookends never carry stats/bullets.
  if (isBookend) { delete merged.slideData.stats; delete merged.slideData.bullets }

  return NextResponse.json({ scene: merged, reply: 'Done — applied your edit to this scene.' })
}
