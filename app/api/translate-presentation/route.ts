import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { GoogleGenAI } from '@google/genai'
import { isAdmin } from '../../_lib/admin'
import { rateLimit, getRateLimitKey, LIMITS } from '../../_lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 120

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const SUPPORTED_LANGUAGES = [
  'Spanish', 'French', 'Portuguese', 'German', 'Korean',
  'Japanese', 'Chinese (Simplified)', 'Arabic', 'Hindi', 'Italian',
]

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rl = rateLimit(getRateLimitKey(user.id, 'generation'), LIMITS.generation.limit, LIMITS.generation.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
  }

  const body = await request.json()
  const { videoId, targetLanguage } = body as { videoId: string; targetLanguage: string }

  if (!videoId || !targetLanguage) {
    return NextResponse.json({ error: 'videoId and targetLanguage are required' }, { status: 400 })
  }

  if (!SUPPORTED_LANGUAGES.includes(targetLanguage)) {
    return NextResponse.json({ error: `Unsupported language: ${targetLanguage}` }, { status: 400 })
  }

  // Fetch the original video
  const { data: video, error: fetchErr } = await supabase
    .from('videos')
    .select('*')
    .eq('id', videoId)
    .single()

  if (fetchErr || !video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  if (video.status !== 'completed') {
    return NextResponse.json({ error: 'Can only translate completed videos' }, { status: 400 })
  }

  if (!video.script || !Array.isArray(video.script)) {
    return NextResponse.json({ error: 'Video has no script to translate' }, { status: 400 })
  }

  // Credit check (skip for admins and beta users)
  const { data: creditProfile } = await supabase
    .from('profiles')
    .select('is_admin, is_beta, subscription_status, credits_remaining, pack_credits, card_on_file, free_videos_remaining')
    .eq('id', user.id)
    .single()

  if (!creditProfile?.is_admin && !creditProfile?.is_beta) {
    const subStatus = (creditProfile?.subscription_status ?? '').toLowerCase()
    const isPaidUser = ['active', 'professional', 'pro', 'business', 'enterprise', 'starter'].includes(subStatus)
    const freeRemaining = creditProfile?.free_videos_remaining ?? 0
    const cardOnFile = creditProfile?.card_on_file ?? false

    if (!isPaidUser && freeRemaining <= 0 && !cardOnFile) {
      return NextResponse.json(
        { error: 'No credits remaining. Please upgrade or add a payment method.' },
        { status: 403 }
      )
    }
  }

  // Filter out _pipeline_input from script scenes for translation
  const scenes = (video.script as any[]).filter(
    (s: any) => typeof s === 'object' && s !== null && 'narration' in s
  )

  if (scenes.length === 0) {
    return NextResponse.json({ error: 'No translatable scenes found' }, { status: 400 })
  }

  // Translate using Gemini 2.5 Pro
  try {
    const prompt = `Translate the following presentation script from English to ${targetLanguage}.

Rules:
- Translate ALL narration text naturally — not word-for-word
- Keep the same tone and energy
- Keep all numbers, currency amounts, and percentages as-is
- Keep proper names unchanged
- Return the EXACT same JSON structure with translated narration and slidePrompt fields
- The slidePrompt should describe slides with text in ${targetLanguage}
- Return ONLY the JSON array, no markdown fences or extra text

Original script:
${JSON.stringify(scenes, null, 2)}`

    const result = await genai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
    })

    const responseText = result.text ?? ''

    // Parse the translated scenes from the response
    let translatedScenes: any[]
    try {
      // Strip markdown fences if present
      const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      translatedScenes = JSON.parse(cleaned)
    } catch {
      console.error('[translate] Failed to parse Gemini response:', responseText.slice(0, 500))
      return NextResponse.json({ error: 'Translation failed — could not parse AI response' }, { status: 500 })
    }

    if (!Array.isArray(translatedScenes) || translatedScenes.length === 0) {
      return NextResponse.json({ error: 'Translation returned empty result' }, { status: 500 })
    }

    // Preserve _pipeline_input from original script if it exists
    const pipelineInput = (video.script as any[]).find((s: any) => s?._pipeline_input)
    const newScript = pipelineInput
      ? [pipelineInput, ...translatedScenes]
      : translatedScenes

    // If original had _pipeline_input, update it for the new video so the pipeline can re-run
    if (pipelineInput) {
      // Clone pipeline input and update scenes for re-generation
      const updatedPipelineInput = {
        ...pipelineInput,
        _pipeline_input: {
          ...pipelineInput._pipeline_input,
          scenes: translatedScenes,
          preGeneratedScenes: translatedScenes,
          // Clear pre-generated audio so new TTS is generated in the target language
          preGeneratedAudioId: undefined,
          approvedSlides: undefined,
        },
      }
      newScript[0] = updatedPipelineInput
    }

    // Build new title
    const originalTitle = video.title ?? 'Untitled'
    // Remove existing language suffix if re-translating
    const baseTitle = originalTitle.replace(/\s*\([A-Za-z\s()]+\)\s*$/, '')
    const newTitle = `${baseTitle} (${targetLanguage})`

    // Create new video record
    const admin = createAdminClient()
    const { data: newVideo, error: insertErr } = await admin
      .from('videos')
      .insert({
        user_id: user.id,
        brand_id: video.brand_id,
        infographic_id: video.infographic_id,
        title: newTitle,
        script: newScript,
        voice_id: video.voice_id,
        status: 'pending',
        is_trial: false,
      })
      .select('id')
      .single()

    if (insertErr || !newVideo) {
      console.error('[translate] Failed to create video record:', insertErr)
      return NextResponse.json({ error: 'Failed to create translated video' }, { status: 500 })
    }

    return NextResponse.json({ videoId: newVideo.id })
  } catch (err) {
    console.error('[translate] Error:', err)
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 })
  }
}
