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

  const { message, scenes, purpose } = await request.json()

  if (!message || !scenes) {
    return NextResponse.json({ error: 'Missing message or scenes' }, { status: 400 })
  }

  const sceneSummary = scenes.map((s: any, i: number) =>
    `Scene ${i + 1}: "${s.title}" — ${s.narration?.slice(0, 100)}...`
  ).join('\n')

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a script editor assistant. The user has a video script with ${scenes.length} scenes. Their video purpose is: "${purpose || 'informational video'}".

When the user asks for changes, return the COMPLETE updated scenes array as JSON.

RULES:
- Return ONLY a valid JSON array of scenes — no explanation, no markdown
- Each scene must have: scene (number), title (string), narration (string), slideData (object with headline, stats array, bullets array), slidePrompt (string), duration (number)
- Keep all existing fields intact unless the user specifically asks to change them
- If adding a new scene, renumber all scenes
- If deleting a scene, renumber all scenes
- If the user asks a question (not a change), respond with a JSON object: { "reply": "your answer here" } instead of scenes
- NEVER invent contact info, phone numbers, URLs, or emails`,
      },
      {
        role: 'user',
        content: `Current script:\n${JSON.stringify(scenes, null, 2)}\n\nUser request: ${message}`,
      },
    ],
    temperature: 0.5,
  })

  const text = response.choices[0]?.message?.content?.trim() ?? ''
  const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')

  try {
    const parsed = JSON.parse(cleaned)

    // Check if it's a reply (question) or updated scenes
    if (parsed.reply) {
      return NextResponse.json({ reply: parsed.reply })
    }

    if (Array.isArray(parsed)) {
      return NextResponse.json({ scenes: parsed })
    }

    return NextResponse.json({ reply: 'I couldn\'t process that change. Try being more specific.' })
  } catch {
    // If JSON parse fails, treat it as a text reply
    return NextResponse.json({ reply: cleaned.slice(0, 500) })
  }
}
