import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { GoogleGenAI } from '@google/genai'
import type { ExtractedData } from '../../_lib/extract-types'
import { rateLimit, getRateLimitKey, LIMITS } from '../../_lib/rate-limit'
import { resolveRequestUser } from '../../_lib/api-auth'

export const runtime = 'nodejs'
export const maxDuration = 300

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

function buildPrompt(topic: string, audience: string, tone: string, keyPoints?: string[]): string {
  return `You are an expert content creator and researcher. Generate comprehensive, well-structured content about a given topic that will be turned into a professional infographic or video.

TOPIC: ${topic}
TARGET AUDIENCE: ${audience}
TONE: ${tone}
${keyPoints && keyPoints.length > 0 ? `KEY POINTS TO INCLUDE:\n${keyPoints.map(p => `- ${p}`).join('\n')}` : ''}

Generate content that feels like real, researched material. Include realistic data points, statistics, and key metrics that would be relevant to this topic. If you can reference real publicly-known statistics, do so. Otherwise, create plausible and illustrative data points clearly framed as illustrative.

Return ONLY valid JSON matching this exact structure (no markdown, no code fences):
{
  "title": "string — a compelling, clear title",
  "subtitle": "string or null — a supporting subtitle",
  "source": "string or null — attribute sources if referencing real data",
  "keyMetrics": [
    { "label": "string", "value": "string", "highlight": true/false }
  ],
  "sections": [
    { "title": "string", "content": "string (2-4 sentences)" }
  ],
  "bulletPoints": ["string — key takeaways or action items"],
  "additionalNotes": ["string — any caveats or additional context"]
}

Rules:
- Create 4-8 keyMetrics with concise labels and impactful values
- Mark the 2-3 most important metrics with "highlight": true
- Create 3-5 well-structured sections that tell a coherent story
- Include 4-8 actionable or insightful bulletPoints
- The content should be tailored to the ${audience} audience
- Use a ${tone.toLowerCase()} tone throughout
- Make the title engaging and specific (not generic)
- Values in keyMetrics should include units (%, $, x, etc.) where appropriate
- Sections should flow logically and build on each other`
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const resolved = await resolveRequestUser(request, async () => (await supabase.auth.getUser()).data.user)
  if (!resolved) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const user = { id: resolved.userId }

  const rl = rateLimit(getRateLimitKey(user.id, 'generation'), LIMITS.generation.limit, LIMITS.generation.windowMs)
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
  const { topic, audience, tone, keyPoints } = body as {
    topic: string
    audience: string
    tone: string
    keyPoints?: string[]
  }

  if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
    return NextResponse.json({ error: 'Topic is required' }, { status: 400 })
  }

  if (!audience || typeof audience !== 'string' || audience.trim().length === 0) {
    return NextResponse.json({ error: 'Audience is required' }, { status: 400 })
  }

  if (!tone || typeof tone !== 'string') {
    return NextResponse.json({ error: 'Tone is required' }, { status: 400 })
  }

  try {
    const prompt = buildPrompt(topic, audience, tone, keyPoints)

    const response = await genai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
    })

    const raw = response.text?.trim() ?? ''
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')

    const data: ExtractedData = JSON.parse(cleaned)
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Content generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
