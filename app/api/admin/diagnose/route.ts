import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { isAdminRequest } from '../../../_lib/admin'
import { matchKnownIssue } from '../../../_lib/known-issues'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/admin/diagnose  { errorId }
 * Admin-only. Produces a recommended fix for an error_logs row:
 *   1. Known-issue KB match → instant, proven fix (fix_source='kb').
 *   2. Otherwise Claude analyzes the error, GROUNDED — it must tie any fix to the
 *      actual evidence or answer "Needs investigation" rather than guess.
 * Result is cached onto the error_logs row so it's computed once.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!(await isAdminRequest(user))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { errorId?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body.errorId) return NextResponse.json({ error: 'errorId required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('error_logs')
    .select('id, source, message, detail, endpoint')
    .eq('id', body.errorId)
    .single()
  if (!row) return NextResponse.json({ error: 'Error not found' }, { status: 404 })

  const errorText = `${row.message}\n\n${row.detail || ''}`

  // 1. Known-issue KB first — deterministic, proven.
  const known = matchKnownIssue(errorText)
  if (known) {
    const fix = `**${known.title}**\n\n${known.fix}${known.docs ? `\n\nSee: ${known.docs}` : ''}`
    await admin.from('error_logs').update({ recommended_fix: fix, fix_source: 'kb' }).eq('id', row.id)
    return NextResponse.json({ fix, source: 'kb' })
  }

  // 2. AI fallback — grounded, no guessing.
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI diagnosis unavailable (ANTHROPIC_API_KEY not set)' }, { status: 503 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const system = [
    'You are a senior engineer diagnosing a production error in the Docs2Video app',
    '(Next.js on Vercel + a Node/FFmpeg video render service on a Hetzner VPS + Supabase + Gemini image gen + OpenAI TTS + Stripe + Resend).',
    'Given an error, recommend a fix.',
    'CRITICAL RULE: Only recommend a fix you can directly justify from the provided error text and stack.',
    'Do NOT invent file names, env vars, or causes you cannot infer from the evidence.',
    'If the evidence is insufficient to determine the cause, respond exactly with "Needs investigation" followed by a short, concrete checklist of what to inspect (logs, env vars, specific files). Never fabricate a confident fix.',
    'Be concise. Use short markdown. Lead with the most likely cause.',
  ].join(' ')

  try {
    const resp = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 900,
      thinking: { type: 'adaptive' },
      system,
      messages: [{
        role: 'user',
        content: `Source: ${row.source}\nEndpoint/context: ${row.endpoint || 'unknown'}\n\nError:\n${errorText.slice(0, 6000)}`,
      }],
    })
    const fix = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim() || 'Needs investigation — the model returned no analysis.'

    await admin.from('error_logs').update({ recommended_fix: fix, fix_source: 'ai' }).eq('id', row.id)
    return NextResponse.json({ fix, source: 'ai' })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Diagnosis failed' }, { status: 500 })
  }
}
