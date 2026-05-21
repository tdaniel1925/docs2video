import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '../../_lib/supabase/server'

export const runtime = 'nodejs'

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  return _openai
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { message, scenes, purpose, sourceData, history } = await request.json()

  if (!message || !scenes) {
    return NextResponse.json({ error: 'Missing message or scenes' }, { status: 400 })
  }

  // Build source reference for the AI
  const sourceRef = sourceData ? JSON.stringify(sourceData).slice(0, 15000) : ''

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a professional script editor assistant. The user has a video script with ${scenes.length} scenes. Video purpose: "${purpose || 'informational video'}".

${sourceRef ? `ORIGINAL SOURCE DATA (use this to verify facts, correct errors, and find missing information):
${sourceRef}

When the user says something is wrong or asks for corrections, LOOK UP the correct information from the source data above. Do not guess — use the exact facts from the source.` : ''}

You MUST respond with a JSON object in one of these formats:

FORMAT 1 — When you make changes:
{
  "scenes": [/* complete updated scenes array */],
  "summary": "Brief description of what you changed — be specific about which scenes and what changed",
  "suggestion": "Optional follow-up suggestion, or null"
}

FORMAT 2 — When you need clarification:
{
  "reply": "Your question to the user — be specific about what you need to know",
  "options": ["Option A", "Option B", "Option C"]
}

FORMAT 3 — When answering a question:
{
  "reply": "Your answer"
}

BEHAVIOR RULES:
- If the request is clear, make the changes and explain what you did in "summary"
- If the request is vague (e.g. "make it better", "fix it"), ask ONE clarifying question with specific options
- After making changes, include a proactive "suggestion" if you notice something that could be improved
- Always preserve scene structure: scene (number), title, narration, slideData, slidePrompt, duration
- Renumber scenes if adding or deleting
- NEVER invent contact info, phone numbers, URLs, or emails
- Keep the summary under 2 sentences — concise and specific

CONTEXT AWARENESS (CRITICAL):
- Read the FULL conversation history above. When the user says "yes", "do it", "specific", "that one" — they are responding to YOUR previous message. Look at what you last suggested and act on it.
- NEVER ask "what would you like to change?" if you just suggested something and they agreed. Just do it.
- If user picked an option you offered, execute that option immediately — don't ask again.
- You have access to the original source data. Use it to find real facts, pricing, competitors, features.
- If user asks about competitors or market info that's not in the source, say what you know and suggest they verify, but provide useful content.`,
      },
      // Include conversation history for context
      ...((history || []) as { role: string; text: string }[]).map((h: { role: string; text: string }) => ({
        role: h.role as 'user' | 'assistant',
        content: h.text,
      })),
      {
        role: 'user' as const,
        content: `Current script:\n${JSON.stringify(scenes, null, 2)}\n\nUser request: ${message}`,
      },
    ],
    temperature: 0.5,
  })

  const text = response.choices[0]?.message?.content?.trim() ?? ''
  const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')

  try {
    const parsed = JSON.parse(cleaned)

    // Format 1: Changes made with summary
    if (parsed.scenes && Array.isArray(parsed.scenes)) {
      return NextResponse.json({
        scenes: parsed.scenes,
        reply: parsed.summary || `Updated ${parsed.scenes.length} scenes.`,
        suggestion: parsed.suggestion || null,
        options: parsed.options || null,
      })
    }

    // Format 2/3: Reply with optional options
    if (parsed.reply) {
      return NextResponse.json({
        reply: parsed.reply,
        options: parsed.options || null,
      })
    }

    // Legacy: raw array
    if (Array.isArray(parsed)) {
      return NextResponse.json({ scenes: parsed, reply: `Updated ${parsed.length} scenes.` })
    }

    return NextResponse.json({ reply: 'I couldn\'t process that. Try being more specific about what you want to change.' })
  } catch {
    // If JSON parse fails, treat it as a text reply
    return NextResponse.json({ reply: cleaned.slice(0, 500) })
  }
}
