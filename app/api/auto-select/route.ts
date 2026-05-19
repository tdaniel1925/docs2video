import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { GoogleGenAI } from '@google/genai'
import type { ExtractedPolicyData } from '../../_lib/types'
import type { ExtractedData } from '../../_lib/extract-types'
import { rateLimit, getRateLimitKey, LIMITS } from '../../_lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 30

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const TEMPLATE_MAP = `Available templates and their best use cases:
- "executive" — Financial, insurance, corporate, serious business documents
- "steampunk" — Technical/engineering, mechanical, industrial
- "social-grid" — Marketing, social media, lifestyle content
- "blue-steps" — Educational, how-to guides, step-by-step processes
- "isometric" — Technology, SaaS, modern business, startups
- "flat-vector" — General business, professional, corporate-friendly
- "doodle" — Creative brainstorming, casual, fun topics
- "watercolor" — Artistic, wellness, beauty, gentle topics
- "neon-cyber" — Tech, cybersecurity, futuristic, gaming
- "line-art" — Professional, technical, engineering, corporate
- "vintage-craft" — Artisanal, food & drink, handmade, rustic
- "flat-cartoon" — Family, children, cheerful, engaging
- "chalkboard" — Education, teaching, lectures, academic
- "old-newspaper" — News, journalism, historical, announcements
- "vintage-editorial" — Legal, financial, bonds, certificates, prestigious
- "commercial-pro" — Sales, advertising, commercial, high-energy
- "americana-poster" — Patriotic, American, government, military
- "black-label" — Luxury, VIP, premium, exclusive
- "editorial" — Design, architecture, modern art, Swiss/Japanese aesthetic
- "cinematic-hud" — Gaming, military, tactical, sci-fi
- "timeline" — Process flows, project management, roadmaps
- "profile-resume" — Data-rich, metrics, executive reports, performance reviews
- "anime-pop" — Youth, gaming, entertainment, high-energy
- "botanical-warm" — Nature, organic, traditional, cultural
- "paper-layers" — Environmental, depth topics, educational
- "cafe-realistic" — Food, hospitality, cookbook style, warm guides
- "brick-blocks" — Playful data, children, toy/game industry
- "felt-craft" — DIY, crafts, tactile, educational for young audiences`

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const rl = rateLimit(getRateLimitKey(user.id, 'api'), LIMITS.api.limit, LIMITS.api.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
  }

  const body = await request.json()
  const { policyData } = body as {
    policyData: ExtractedPolicyData | ExtractedData
    brandId?: string
  }

  // Build a content summary for the AI to analyze
  const isInsurance = 'deathBenefit' in policyData
  let contentSummary: string

  if (isInsurance) {
    const ins = policyData as ExtractedPolicyData
    contentSummary = `Insurance document: ${ins.policyType} policy for ${ins.insuredName}. Death benefit: $${ins.deathBenefit}. Annual premium: $${ins.annualPremium}. Carrier: ${ins.carrier}.`
  } else {
    const gen = policyData as ExtractedData
    const metrics = gen.keyMetrics.slice(0, 5).map(m => `${m.label}: ${m.value}`).join(', ')
    const sections = gen.sections.slice(0, 3).map(s => s.title).join(', ')
    contentSummary = `Document: "${gen.title}"${gen.subtitle ? ` - ${gen.subtitle}` : ''}. Source: ${gen.source ?? 'Unknown'}. Key metrics: ${metrics}. Sections: ${sections}. Key points: ${gen.bulletPoints.slice(0, 3).join('; ')}`
  }

  try {
    const response = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an AI that recommends presentation settings based on document content.

Given this document content:
${contentSummary}

${TEMPLATE_MAP}

Available voices:
- "onyx" (James) — Deep, authoritative. Best for formal, financial, legal, insurance content.
- "Kore" (Sarah) — Friendly, warm. Best for educational, marketing, general content. Most popular.
- "shimmer" (Emily) — Gentle, reassuring. Best for sensitive, wellness, personal topics.
- "echo" (Michael) — Warm, conversational. Best for casual, friendly content.
- "alloy" (Alex) — Professional, balanced. Best for neutral, corporate content.
- "fable" (Oliver) — Expressive, British. Best for creative, storytelling, literary content.

Return ONLY valid JSON (no markdown, no code fences):
{
  "templateId": "string — one of the template IDs listed above",
  "voiceId": "string — one of the voice IDs listed above",
  "slideCount": number — recommended number of slides (5-12),
  "mood": "string — one of: professional, friendly, educational, creative, formal, energetic"
}

Pick the template that BEST matches the content type, industry, and tone. Pick the voice that matches the formality level.`,
    })

    const text = response.text?.trim() ?? ''
    const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')
    const parsed = JSON.parse(cleaned)

    return NextResponse.json({
      templateId: parsed.templateId || 'executive',
      voiceId: parsed.voiceId || 'Kore',
      slideCount: parsed.slideCount || 8,
      mood: parsed.mood || 'professional',
    })
  } catch (err) {
    console.error('[auto-select] Error:', err)
    // Fallback defaults
    return NextResponse.json({
      templateId: isInsurance ? 'executive' : 'flat-vector',
      voiceId: isInsurance ? 'Puck' : 'Kore',
      slideCount: 8,
      mood: 'professional',
    })
  }
}
