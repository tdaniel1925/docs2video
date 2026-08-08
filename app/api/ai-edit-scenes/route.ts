import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '../../_lib/supabase/server'
import type { PresentationScene } from '../../_lib/presentation'

// =============================================================================
// AI slide editing — the brain behind "tell it what you want changed".
//
// Used in two places: the wizard's script step (before generation) and the
// post-generation editor (after). Both send the CURRENT scenes plus a plain-
// English instruction; this returns revised scenes in the same shape.
//
// It edits, it does not author. The system prompt forbids inventing figures,
// names or claims that aren't in the existing scenes or the instruction —
// the wizard's script generator already did the authoring from real source
// material, and an editor that quietly adds facts is worse than no editor.
//
// Compliance is NOT enforced here, deliberately: generation re-scrubs the
// final scenes unconditionally (P4.4), so a scrub here would double-maintain
// the same rules. What a user types into the editor is their draft; what
// ships is what the scrub lets through.
// =============================================================================

export const runtime = 'nodejs'
export const maxDuration = 60

let _claude: Anthropic | null = null
function getClaude() {
  if (!_claude) _claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
  return _claude
}

const MAX_SCENES = 30
const MAX_INSTRUCTION = 1200

function isScene(s: unknown): s is PresentationScene {
  if (!s || typeof s !== 'object') return false
  const o = s as Record<string, unknown>
  return typeof o.narration === 'string' && o.narration.length > 0
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await req.json().catch(() => null) as {
    scenes?: PresentationScene[]
    instruction?: string
    targetIndex?: number
  } | null

  const scenes = Array.isArray(body?.scenes) ? body!.scenes.filter(isScene) : []
  const instruction = String(body?.instruction ?? '').trim().slice(0, MAX_INSTRUCTION)
  const targetIndex = Number.isInteger(body?.targetIndex) ? (body!.targetIndex as number) : null

  if (!scenes.length) return NextResponse.json({ error: 'No slides to edit' }, { status: 400 })
  if (scenes.length > MAX_SCENES) return NextResponse.json({ error: 'Too many slides' }, { status: 400 })
  if (!instruction) return NextResponse.json({ error: 'Tell the editor what to change' }, { status: 400 })

  const scope = targetIndex !== null && targetIndex >= 0 && targetIndex < scenes.length
    ? `Apply the instruction ONLY to slide ${targetIndex + 1} ("${scenes[targetIndex].title || scenes[targetIndex].slideData?.headline || 'untitled'}"). Return ALL slides, with the others byte-identical.`
    : 'The instruction may affect any slide, add slides, remove slides, or reorder them.'

  const system = `You edit slide presentations. You receive the current slides as JSON and one instruction from the presentation's owner.

Rules:
- Each slide: { "title"?: string, "narration": string, "_role"?: "cover"|"closing", "slideData"?: { "headline"?, "stats"?: [{label,value}], "bullets"?: string[], "cta"? } }.
- "narration" is what the voice SAYS (conversational, complete sentences). "slideData" is what the slide SHOWS (short, punchy). Keep that separation.
- ${scope}
- Never invent figures, statistics, names, prices or claims that are not already in the slides or in the instruction. If the instruction asks for a new slide, build it from what is already there plus the instruction's own words.
- Keep any slide with "_role" of "cover" or "closing" in its position and role unless the instruction explicitly targets it.
- Slides count must stay between 3 and ${MAX_SCENES}.
- Respond with ONLY a JSON array of slides. No commentary, no markdown fence.`

  try {
    const msg = await getClaude().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system,
      messages: [{
        role: 'user',
        content: `Current slides:\n${JSON.stringify(scenes, null, 1)}\n\nInstruction: ${instruction}`,
      }],
    })

    const text = msg.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('')
    const start = text.indexOf('[')
    const end = text.lastIndexOf(']')
    if (start < 0 || end <= start) throw new Error('editor returned no slide list')
    const revised = JSON.parse(text.slice(start, end + 1)) as unknown[]

    const clean = revised.filter(isScene)
    if (clean.length < 3 || clean.length > MAX_SCENES) throw new Error('edit produced an invalid number of slides')
    // A whole-deck wipe is never a plausible edit — refuse rather than let one
    // bad model response destroy a user's script with no undo on the server.
    if (clean.length < Math.ceil(scenes.length / 3)) throw new Error('edit removed most of the deck — rejected')

    return NextResponse.json({ scenes: clean })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Edit failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
