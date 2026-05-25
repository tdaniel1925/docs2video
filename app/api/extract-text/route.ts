import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { GoogleGenAI } from '@google/genai'
import type { ExtractedData } from '../../_lib/extract-types'
import { rateLimit, getRateLimitKey, LIMITS } from '../../_lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 120

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const EXTRACTION_PROMPT = `You are an expert content analyst. You will receive raw text that could be meeting notes, an email, bullet points, a report, an article, or any other form of written content.

Your job is to analyze the text and extract the most important information into a structured format.

Return ONLY valid JSON matching this exact structure (no markdown, no code fences):
{
  "title": "string — a clear, concise title summarizing the content",
  "subtitle": "string or null — a supporting subtitle if appropriate",
  "source": "string or null — the source or origin of the content if identifiable",
  "keyMetrics": [
    { "label": "string", "value": "string", "highlight": true/false }
  ],
  "sections": [
    { "title": "string", "content": "string" }
  ],
  "bulletPoints": ["string"],
  "additionalNotes": ["string"]
}

Rules:
- Extract any numbers, percentages, dollar amounts, dates, or quantifiable data as keyMetrics
- Mark the 2-3 most important metrics with "highlight": true
- Break the content into logical sections with clear titles
- Pull out key takeaways or action items as bulletPoints
- Include any caveats, disclaimers, or supplementary info in additionalNotes
- If the text is short, still create a meaningful structure
- Be smart about understanding context — infer the topic and purpose
- keyMetrics should have concise labels and values (e.g. label: "Revenue", value: "$1.2M")
- Aim for 3-8 keyMetrics, 2-5 sections, and 3-10 bulletPoints`

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rl = rateLimit(getRateLimitKey(user.id, 'extraction'), LIMITS.extraction.limit, LIMITS.extraction.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
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
  const { text } = body as { text: string }

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return NextResponse.json({ error: 'No text provided' }, { status: 400 })
  }

  if (text.length > 50000) {
    return NextResponse.json({ error: 'Text is too long (max 50,000 characters)' }, { status: 400 })
  }

  try {
    const response = await genai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [
        {
          role: 'user',
          parts: [
            { text: EXTRACTION_PROMPT },
            { text: `\n\nHere is the text to analyze:\n\n${text}` },
          ],
        },
      ],
    })

    const raw = response.text?.trim() ?? ''
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')

    const data: ExtractedData = JSON.parse(cleaned)
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Text extraction failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
