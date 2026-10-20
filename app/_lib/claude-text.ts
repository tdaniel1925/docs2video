import Anthropic from '@anthropic-ai/sdk'

/**
 * SHORT TEXT JOBS ON CLAUDE (2026-10-19).
 *
 * Social posts, campaign emails and the auto-demo's website read used OpenAI
 * gpt-4o-mini until its account ran out of credits. They now run on Claude
 * Haiku — the same small, fast tier — through the Anthropic SDK the rest of
 * the app already uses.
 */
export const CLAUDE_FAST_MODEL = process.env.CLAUDE_MODEL_CHEAP || 'claude-haiku-4-5'

let _client: Anthropic | null = null
const client = () => (_client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' }))

export async function claudeText(o: { system?: string; user: string; temperature?: number; maxTokens?: number; model?: string }): Promise<string> {
  const res = await client().messages.create({
    model: o.model || CLAUDE_FAST_MODEL,
    max_tokens: o.maxTokens ?? 2000,
    ...(o.temperature != null ? { temperature: Math.min(1, Math.max(0, o.temperature)) } : {}),
    ...(o.system ? { system: o.system } : {}),
    messages: [{ role: 'user', content: o.user }],
  })
  return res.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
}

/**
 * The JSON object inside a reply — code fences and any words around it taken
 * off. (OpenAI's json_object mode guaranteed bare JSON; Claude is asked for
 * it and this makes sure.) Returns '{}' when there is no object at all.
 */
export function jsonObjectText(raw: string): string {
  const s = String(raw || '').replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')
  const a = s.indexOf('{')
  const b = s.lastIndexOf('}')
  return a >= 0 && b > a ? s.slice(a, b + 1) : '{}'
}
