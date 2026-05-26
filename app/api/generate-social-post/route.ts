import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import OpenAI from 'openai'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { videoId } = (await request.json()) as { videoId?: string }
    if (!videoId) {
      return NextResponse.json({ error: 'Missing videoId' }, { status: 400 })
    }

    // Fetch video and verify ownership
    const { data: video, error } = await supabase
      .from('videos')
      .select('id, title, script, user_id')
      .eq('id', videoId)
      .single()

    if (error || !video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    if (video.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Extract narration text from scenes (first 500 chars)
    let narrationText = ''
    const scriptData = video.script as any
    if (Array.isArray(scriptData)) {
      narrationText = scriptData
        .map((s: any) => s.narration || '')
        .filter(Boolean)
        .join(' ')
        .slice(0, 500)
    } else if (scriptData?._pipeline_input?.scenes) {
      narrationText = (scriptData._pipeline_input.scenes as any[])
        .map((s: any) => s.narration || '')
        .filter(Boolean)
        .join(' ')
        .slice(0, 500)
    }

    const title = video.title || 'Untitled Video'
    const shareLink = `https://docs2video.com/watch/${videoId}`

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: `You generate social media posts to promote a video. Return a JSON object with three keys: "linkedin", "twitter", "facebook". Each value is a string containing the post text. Do NOT include the share link in the text — it will be appended automatically. Do not use hashtags excessively (max 2-3 for LinkedIn, 1-2 for Twitter, none for Facebook).`,
        },
        {
          role: 'user',
          content: `Video title: "${title}"\n\nVideo summary (from narration): ${narrationText || 'No narration available.'}\n\nShare link (will be appended, don't include): ${shareLink}\n\nGenerate 3 social post variants:\n1. LinkedIn: Professional, 2-3 sentences\n2. Twitter/X: Under 250 characters (leave room for link)\n3. Facebook: Casual, 3-4 sentences`,
        },
      ],
      response_format: { type: 'json_object' },
    })

    const content = completion.choices[0]?.message?.content ?? '{}'
    let posts: { linkedin?: string; twitter?: string; facebook?: string }
    try {
      posts = JSON.parse(content)
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    // Append share link to each post
    const appendLink = (text: string | undefined) =>
      text ? `${text.trim()}\n\n${shareLink}` : shareLink

    return NextResponse.json({
      linkedin: appendLink(posts.linkedin),
      twitter: appendLink(posts.twitter),
      facebook: appendLink(posts.facebook),
    })
  } catch (err: unknown) {
    console.error('[generate-social-post] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
