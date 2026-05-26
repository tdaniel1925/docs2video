import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { GoogleGenAI } from '@google/genai'
import type { ExtractedData } from '../../_lib/extract-types'

export const runtime = 'nodejs'
export const maxDuration = 60

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const SYSTEM_PROMPT = `You are a smart proposal assistant helping a professional create a client proposal. Your job is to conduct a brief interview (4-6 questions) to gather all the information needed for a complete proposal.

INTERVIEW FLOW:
1. First, ask what type of proposal this is (insurance, financial planning, real estate, consulting, legal, etc.)
2. Ask about the client (name, key details relevant to the proposal type)
3. Ask what they're recommending/proposing (the core offer)
4. Ask about pricing/terms
5. Ask about key benefits or differentiators
6. Ask if there's anything else to include

RULES:
- Ask ONE question at a time
- Keep responses short (2-3 sentences max)
- Be conversational, not robotic
- After you have enough info (usually 4-6 exchanges), generate the proposal

When you have enough information, end your response with a structured proposal in this format:

[PROPOSAL]
{
  "title": "Proposal title",
  "subtitle": "For [client name]",
  "source": "Prepared by [ask user's company if not mentioned]",
  "keyMetrics": [
    { "label": "metric name", "value": "metric value", "highlight": true/false }
  ],
  "sections": [
    { "title": "section name", "content": "section content (2-3 sentences)" }
  ],
  "bulletPoints": ["key point 1", "key point 2"],
  "additionalNotes": ["any caveats or notes"]
}
[/PROPOSAL]

The keyMetrics should include pricing, key numbers, and important figures.
The sections should cover: About the Solution, Key Benefits, What's Included, Pricing & Terms, Next Steps.`

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, is_beta, credits_remaining')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin && !profile?.is_beta && (!profile || profile.credits_remaining <= 0)) {
    return NextResponse.json({ error: 'No credits remaining' }, { status: 403 })
  }

  const body = await request.json()
  const { messages } = body as { messages: { role: string; content: string }[] }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
  }

  try {
    const contents = messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: msg.content }],
    }))

    const response = await genai.models.generateContent({
      model: 'gemini-2.5-pro',
      config: {
        systemInstruction: SYSTEM_PROMPT,
      },
      contents,
    })

    const raw = response.text?.trim() ?? ''

    // Check if the response contains a proposal block
    const proposalMatch = raw.match(/\[PROPOSAL\]\s*([\s\S]*?)\s*\[\/PROPOSAL\]/)

    let reply = raw
    let proposal: ExtractedData | undefined

    if (proposalMatch) {
      // Extract reply text (everything before [PROPOSAL])
      reply = raw.substring(0, raw.indexOf('[PROPOSAL]')).trim()

      // Parse the proposal JSON
      const proposalJson = proposalMatch[1].trim()
      const cleaned = proposalJson.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')
      try {
        proposal = JSON.parse(cleaned) as ExtractedData
      } catch {
        // If JSON parsing fails, just return the reply without proposal
        console.error('Failed to parse proposal JSON')
      }
    }

    return NextResponse.json({ reply, proposal })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proposal chat failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
