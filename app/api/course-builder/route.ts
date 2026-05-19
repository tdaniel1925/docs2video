import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { GoogleGenAI } from '@google/genai'

export const runtime = 'nodejs'
export const maxDuration = 60

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

// POST: generate course outline OR start batch generation
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { action, topic, audience, episodeCount, tone, outline } = await request.json() as {
    action: 'generate-outline' | 'start-batch'
    topic?: string
    audience?: string
    episodeCount?: number
    tone?: string
    outline?: { title: string; description: string; keyPoints: string[] }[]
  }

  // Generate course outline
  if (action === 'generate-outline') {
    if (!topic?.trim()) {
      return NextResponse.json({ error: 'Please provide a course topic' }, { status: 400 })
    }

    const count = Math.min(Math.max(episodeCount ?? 8, 3), 20)

    try {
      const response = await genai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: [{
          role: 'user',
          parts: [{ text: `You are an expert curriculum designer. Create a structured video course outline.

COURSE TOPIC: "${topic}"
TARGET AUDIENCE: "${audience || 'General professional audience'}"
NUMBER OF EPISODES: ${count}
TONE: ${tone || 'Professional and educational'}

Design a complete course curriculum with ${count} episodes. Each episode should build on the previous one, creating a logical learning progression.

Return ONLY valid JSON (no markdown, no code fences):
{
  "courseTitle": "The overall course title",
  "courseDescription": "2-3 sentence course description",
  "targetAudience": "${audience || 'General professionals'}",
  "estimatedTotalDuration": "e.g., 45-60 minutes",
  "episodes": [
    {
      "episodeNumber": 1,
      "title": "Episode title",
      "description": "2-3 sentences describing what this episode covers",
      "keyPoints": ["Point 1", "Point 2", "Point 3", "Point 4"],
      "estimatedDuration": "3-5 min"
    }
  ]
}

RULES:
- Episodes must flow logically — intro/foundations first, advanced topics later
- Each episode should be self-contained but connect to the series narrative
- Key points should be specific and actionable, not vague
- Episode 1 should always be an engaging overview/introduction
- Last episode should be a summary/next-steps/call-to-action
- Mix different content types: data, stories, comparisons, how-tos, case studies
- Titles should be compelling and click-worthy, not generic` }],
        }],
      })

      const text = response.text?.trim() ?? ''
      const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')

      try {
        const data = JSON.parse(cleaned)
        return NextResponse.json(data)
      } catch {
        return NextResponse.json({ error: 'Failed to parse course outline. Please try again.' }, { status: 500 })
      }
    } catch (err) {
      console.error('[course-builder] Outline error:', err)
      return NextResponse.json({ error: 'Failed to generate outline' }, { status: 500 })
    }
  }

  // Start batch generation
  if (action === 'start-batch') {
    if (!outline?.length) {
      return NextResponse.json({ error: 'No episodes in outline' }, { status: 400 })
    }

    // TODO: Verify Stripe payment before generation

    // Create video records for each episode
    const videoIds: string[] = []
    for (let i = 0; i < outline.length; i++) {
      const ep = outline[i]
      const policyData = {
        title: ep.title,
        subtitle: ep.description,
        source: 'AI Course Builder',
        keyMetrics: [],
        sections: ep.keyPoints.map((p, j) => ({
          title: `Point ${j + 1}`,
          content: p,
        })),
        bulletPoints: ep.keyPoints,
      }

      const { data: video, error } = await supabase
        .from('videos')
        .insert({
          user_id: user.id,
          title: `${ep.title}`,
          status: 'pending',
          script: {
            _pipeline_input: {
              policyData,
              brandId: null,
              voiceId: 'Kore',
              styleId: 'executive',
              detailed: false,
            },
            _course_meta: {
              episodeNumber: i + 1,
              totalEpisodes: outline.length,
            },
          },
        })
        .select('id')
        .single()

      if (error || !video) {
        console.error(`[course-builder] Failed to create episode ${i + 1}:`, error)
        continue
      }
      videoIds.push(video.id)
    }

    if (videoIds.length === 0) {
      return NextResponse.json({ error: 'Failed to create any episodes' }, { status: 500 })
    }

    // Trigger pipelines for ALL episodes (fire-and-forget)
    const origin = request.headers.get('origin') ?? `https://${request.headers.get('x-forwarded-host') ?? 'docs2video.com'}`
    const cookieHeader = request.headers.get('cookie') ?? ''

    // Start all videos — each runs independently on Vercel serverless
    for (const vid of videoIds) {
      fetch(`${origin}/api/videos/start-pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
        body: JSON.stringify({ videoId: vid }),
      }).catch(err => console.error(`[course-builder] Failed to start episode ${vid}:`, err))
    }

    return NextResponse.json({
      success: true,
      videoIds,
      totalEpisodes: videoIds.length,
      estimatedCost: '$249',
      message: `Creating ${videoIds.length} episodes. First episode starting now — the rest will generate sequentially.`,
    })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
