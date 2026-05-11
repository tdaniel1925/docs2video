import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { createClient } from '../../_lib/supabase/server'

export const runtime = 'nodejs'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const SYSTEM_PROMPT = `You are a professional presentation designer helping a user describe their ideal slide template style.

Your job is to:
1. Understand what they want (colors, mood, typography, layout)
2. Ask 1-2 clarifying questions if needed
3. Suggest specific hex colors and design elements
4. When you have enough detail, include a [STYLE_PROMPT] section with the full detailed prompt

Keep responses short (2-3 sentences). Be friendly and opinionated — suggest specific choices.

If the user's description is already detailed enough, immediately provide the style prompt without asking more questions.

When you have a complete style description, end your response with:
[STYLE_PROMPT]
{detailed style prompt here}
[/STYLE_PROMPT]`

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const { messages, referenceImageBase64 } = body as {
    messages: { role: string; content: string }[]
    referenceImageBase64?: string
  }

  if (!messages || !messages.length) {
    return NextResponse.json({ error: 'Messages required' }, { status: 400 })
  }

  try {
    // Build Gemini conversation
    const geminiContents: any[] = [
      { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
      { role: 'model', parts: [{ text: "Hi! I'm ready to help you design your ideal slide template. Tell me about the look and feel you're going for — colors, mood, typography, or even share a reference image. What style speaks to you?" }] },
    ]

    for (const msg of messages) {
      const parts: any[] = [{ text: msg.content }]

      // Attach reference image to the first user message if provided
      if (msg.role === 'user' && referenceImageBase64 && msg === messages[0]) {
        parts.push({
          inlineData: { mimeType: 'image/png', data: referenceImageBase64 },
        })
      }

      geminiContents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts,
      })
    }

    const response = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: geminiContents,
    })

    const reply = response.text?.trim() ?? 'Sorry, I could not generate a response.'

    // Extract style prompt if present
    let stylePrompt: string | undefined
    const match = reply.match(/\[STYLE_PROMPT\]\s*([\s\S]*?)\s*\[\/STYLE_PROMPT\]/)
    if (match) {
      stylePrompt = match[1].trim()
    }

    // Clean the reply — remove the [STYLE_PROMPT] block from the displayed message
    const cleanReply = reply
      .replace(/\[STYLE_PROMPT\][\s\S]*?\[\/STYLE_PROMPT\]/, '')
      .trim()

    return NextResponse.json({ reply: cleanReply, stylePrompt })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Chat failed'
    console.error('[template-chat] Error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
