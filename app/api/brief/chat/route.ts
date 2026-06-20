import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '../../../_lib/supabase/server'
import type { VideoBrief, WizardDraft } from '../../../_lib/types'

export const runtime = 'nodejs'
export const maxDuration = 45

function claude() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured')
  return new Anthropic({ apiKey: key })
}

const SYS = `You are refining the BRIEF for an explainer video — the statement of what the video will cover and how it's framed. The user gives you direction; apply it and return the UPDATED brief.

STRICT GROUNDING: only use facts/numbers from the document data provided. Never invent figures, claims, or details. The user can re-prioritize, change tone, emphasize, or drop topics — but you cannot add facts that aren't in the document.

Return ONLY this JSON:
{
  "reply": "one friendly sentence telling the user what you changed",
  "brief": {
    "docType": "...", "summary": "...", "keyPoints": ["..."],
    "figures": [{"label":"...","value":"..."}],
    "angle": "...", "tone": "...",
    "emphasis": ["what to lean into, from the user's direction"],
    "avoid": ["what to skip, from the user's direction"]
  }
}
No markdown — just the JSON.`

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { videoId, message } = (await request.json().catch(() => ({}))) as { videoId?: string; message?: string }
  if (!videoId || !message || message.length > 1500) {
    return NextResponse.json({ error: 'videoId and message (max 1500 chars) required' }, { status: 400 })
  }

  const { data: video } = await supabase
    .from('videos').select('id, user_id, draft_data')
    .eq('id', videoId).eq('user_id', user.id).single()
  if (!video) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })

  const draft = (video.draft_data as WizardDraft) || ({} as WizardDraft)
  if (!draft.brief) return NextResponse.json({ error: 'No brief to revise yet' }, { status: 400 })

  const extracted = (draft.extractedData as any) || {}
  const grounding = [
    Array.isArray(extracted.bulletPoints) && extracted.bulletPoints.length ? `POINTS:\n- ${extracted.bulletPoints.slice(0, 12).join('\n- ')}` : '',
    Array.isArray(extracted.keyMetrics) && extracted.keyMetrics.length ? `METRICS:\n${extracted.keyMetrics.slice(0, 12).map((m: any) => `${m.label}: ${m.value}`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n')

  // Short rolling history so the model has conversational context.
  const history = (draft.briefChat || []).slice(-8).map((m) => ({ role: m.role, content: m.text }))

  try {
    const resp = await claude().messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 1500, system: SYS,
      messages: [
        { role: 'user', content: `CURRENT BRIEF:\n${JSON.stringify(draft.brief)}\n\nDOCUMENT DATA (the only allowed facts):\n${grounding || '(none)'}` },
        ...history as any,
        { role: 'user', content: message },
      ],
    })
    const text = resp.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('')
    let parsed: { reply?: string; brief?: VideoBrief } = {}
    try { parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) } catch { /* fall through */ }
    const newBrief = parsed.brief
    if (!newBrief || !Array.isArray(newBrief.keyPoints)) {
      return NextResponse.json({ error: 'Could not apply that change' }, { status: 502 })
    }
    // Preserve approval state false until the user clicks continue.
    newBrief.approved = false
    const reply = parsed.reply || 'Updated the brief.'
    const briefChat = [...(draft.briefChat || []), { role: 'user' as const, text: message }, { role: 'assistant' as const, text: reply }].slice(-20)
    const merged: WizardDraft = { ...draft, brief: newBrief, briefChat }
    await supabase.from('videos').update({ draft_data: merged }).eq('id', videoId).eq('user_id', user.id)
    return NextResponse.json({ reply, brief: newBrief })
  } catch (err) {
    const message2 = err instanceof Error ? err.message : 'Failed to revise brief'
    return NextResponse.json({ error: message2 }, { status: 500 })
  }
}
