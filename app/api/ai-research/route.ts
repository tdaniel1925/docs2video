import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { GoogleGenAI } from '@google/genai'

export const runtime = 'nodejs'
export const maxDuration = 60

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { topic, depth } = await request.json() as {
    topic: string
    depth?: 'quick' | 'detailed'
  }

  if (!topic?.trim()) {
    return NextResponse.json({ error: 'Please provide a topic to research' }, { status: 400 })
  }

  try {
    const depthInstruction = depth === 'detailed'
      ? 'Provide a COMPREHENSIVE deep dive with extensive data, multiple perspectives, case studies, and actionable insights. Include 8-12 key metrics/stats.'
      : 'Provide a focused overview with the most important data points, key stats, and main takeaways. Include 4-6 key metrics/stats.'

    const response = await genai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [{
        role: 'user',
        parts: [{ text: `You are a senior research analyst. Research the following topic thoroughly and return structured data ready for a video explainer.

TOPIC: "${topic}"

${depthInstruction}

Return ONLY valid JSON (no markdown, no code fences):
{
  "title": "Clear, compelling title for the video",
  "subtitle": "One-line subtitle or tagline",
  "source": "Research compiled from industry data",
  "keyMetrics": [
    { "label": "Metric Name", "value": "Value with unit", "highlight": true/false }
  ],
  "sections": [
    { "title": "Section Title", "content": "2-3 sentences of key information" }
  ],
  "bulletPoints": ["Key takeaway 1", "Key takeaway 2"],
  "suggestedSlides": [
    { "title": "Slide title", "description": "What this slide should cover" }
  ]
}

RULES:
- Use REAL, current data and statistics where possible
- Include specific numbers, percentages, and dollar amounts
- Make metrics compelling and visual-friendly (round numbers, clear labels)
- Sections should flow logically as a narrative
- suggestedSlides should outline 4-6 slides for a video
- Keep everything factual — no speculation or opinions
- If the topic is about a specific company, include their actual data` }],
      }],
    })

    const text = response.text?.trim() ?? ''
    const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')

    try {
      const data = JSON.parse(cleaned)
      return NextResponse.json({ research: data })
    } catch {
      // If JSON parse fails, return as structured text
      return NextResponse.json({
        research: {
          title: topic,
          subtitle: 'AI-researched content',
          source: 'AI Research',
          keyMetrics: [],
          sections: [{ title: 'Research', content: text.slice(0, 2000) }],
          bulletPoints: [],
          suggestedSlides: [],
        }
      })
    }
  } catch (err) {
    console.error('[ai-research] Error:', err)
    return NextResponse.json({ error: 'Research failed. Please try again.' }, { status: 500 })
  }
}
