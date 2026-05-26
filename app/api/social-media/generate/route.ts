import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { deductCredits } from '../../../_lib/credits'
import OpenAI from 'openai'

export const runtime = 'nodejs'

const CREDITS_PER_GENERATION = 25

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const { action } = body as { action: string }
  const admin = createAdminClient()

  // Load user's brand context
  const { data: brand } = await admin
    .from('brands')
    .select('name, industry, tone, target_audience, tagline, services, content_themes, unique_selling_points')
    .eq('user_id', user.id)
    .eq('is_default', true)
    .single()

  const { data: profile } = await admin
    .from('profiles')
    .select('social_voice, company_name')
    .eq('id', user.id)
    .single()

  const brandContext = brand
    ? `Brand: ${brand.name}
Industry: ${brand.industry || 'general'}
Tone: ${profile?.social_voice || brand.tone || 'professional'}
Target audience: ${brand.target_audience || 'general audience'}
Tagline: ${brand.tagline || 'N/A'}
Services: ${(brand.services || []).join(', ') || 'N/A'}
Content themes: ${(brand.content_themes || []).join(', ') || 'N/A'}
Unique selling points: ${(brand.unique_selling_points || []).join(', ') || 'N/A'}`
    : `Company: ${profile?.company_name || 'Unknown'}
Tone: ${profile?.social_voice || 'professional'}`

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

  // Generate captions from a topic/description
  if (action === 'captions') {
    const { topic, platforms } = body as { topic: string; platforms: string[] }

    if (!topic?.trim()) {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 })
    }
    if (!platforms?.length) {
      return NextResponse.json({ error: 'Select at least one platform' }, { status: 400 })
    }

    // Deduct credits
    const deducted = await deductCredits(user.id, CREDITS_PER_GENERATION, 'social_caption_gen', undefined, `AI captions for ${platforms.join(', ')}`)
    if (!deducted) {
      return NextResponse.json({ error: `Insufficient credits. Need ${CREDITS_PER_GENERATION} credits.` }, { status: 402 })
    }

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.8,
        messages: [
          {
            role: 'system',
            content: `You are a social media expert. Generate platform-specific captions optimized for each platform's audience and format.

${brandContext}

Return ONLY valid JSON with a key for each requested platform. Each value is a string containing the full post text.

Platform guidelines:
- linkedin: Professional, 2-4 sentences, 2-3 hashtags, thought leadership angle
- twitter: Under 250 characters, punchy, 1-2 hashtags max
- facebook: Conversational, 2-3 sentences, question or CTA, no hashtags
- instagram: Engaging, emoji-friendly, 5-10 hashtags at the end, storytelling angle`,
          },
          {
            role: 'user',
            content: `Generate social media captions about: "${topic}"\n\nPlatforms: ${platforms.join(', ')}`,
          },
        ],
        response_format: { type: 'json_object' },
      })

      const content = completion.choices[0]?.message?.content ?? '{}'
      let captions: Record<string, string>
      try {
        captions = JSON.parse(content)
      } catch {
        return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
      }

      return NextResponse.json({ captions, creditsUsed: CREDITS_PER_GENERATION })
    } catch (err) {
      console.error('[social-media/generate] captions error:', err)
      return NextResponse.json({ error: 'Failed to generate captions' }, { status: 500 })
    }
  }

  // Generate posts from existing content (video/infographic)
  if (action === 'from-content') {
    const { videoId } = body as { videoId: string }

    if (!videoId) {
      return NextResponse.json({ error: 'Content ID is required' }, { status: 400 })
    }

    // Fetch video and verify ownership
    const { data: video } = await admin
      .from('videos')
      .select('id, title, script, user_id, share_url')
      .eq('id', videoId)
      .single()

    if (!video || video.user_id !== user.id) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    // Deduct credits
    const deducted = await deductCredits(user.id, CREDITS_PER_GENERATION, 'social_from_content', videoId, `Social posts from video: ${video.title}`)
    if (!deducted) {
      return NextResponse.json({ error: `Insufficient credits. Need ${CREDITS_PER_GENERATION} credits.` }, { status: 402 })
    }

    // Extract narration text
    let narrationText = ''
    const scriptData = video.script as any
    if (Array.isArray(scriptData)) {
      narrationText = scriptData.map((s: any) => s.narration || '').filter(Boolean).join(' ').slice(0, 800)
    } else if (scriptData?._pipeline_input?.scenes) {
      narrationText = (scriptData._pipeline_input.scenes as any[]).map((s: any) => s.narration || '').filter(Boolean).join(' ').slice(0, 800)
    }

    const shareLink = video.share_url || `https://docs2video.com/watch/${videoId}`

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.85,
        messages: [
          {
            role: 'system',
            content: `You are a social media expert. Generate 4 varied social media posts to promote a video. Each post should take a different angle (educational, engaging question, stat/insight, call-to-action).

${brandContext}

Return ONLY valid JSON:
{
  "posts": [
    {
      "angle": "educational | question | insight | cta",
      "linkedin": "LinkedIn version of the post",
      "twitter": "Twitter version (under 250 chars)",
      "facebook": "Facebook version",
      "instagram": "Instagram version with hashtags"
    }
  ]
}

Do NOT include the share link in the text — it will be appended automatically.
Keep each post unique with a different hook/angle.`,
          },
          {
            role: 'user',
            content: `Video title: "${video.title}"\n\nVideo content summary:\n${narrationText || 'No narration available.'}\n\nShare link (will be appended, do not include): ${shareLink}`,
          },
        ],
        response_format: { type: 'json_object' },
      })

      const content = completion.choices[0]?.message?.content ?? '{}'
      let result: { posts: any[] }
      try {
        result = JSON.parse(content)
      } catch {
        return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
      }

      // Append share link to all posts
      if (result.posts) {
        result.posts = result.posts.map(post => ({
          ...post,
          linkedin: post.linkedin ? `${post.linkedin.trim()}\n\n${shareLink}` : shareLink,
          twitter: post.twitter ? `${post.twitter.trim()}\n\n${shareLink}` : shareLink,
          facebook: post.facebook ? `${post.facebook.trim()}\n\n${shareLink}` : shareLink,
          instagram: post.instagram ? `${post.instagram.trim()}\n\n${shareLink}` : shareLink,
        }))
      }

      return NextResponse.json({ ...result, creditsUsed: CREDITS_PER_GENERATION, videoTitle: video.title })
    } catch (err) {
      console.error('[social-media/generate] from-content error:', err)
      return NextResponse.json({ error: 'Failed to generate posts' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
