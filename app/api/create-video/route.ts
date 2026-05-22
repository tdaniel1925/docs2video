import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { isAdmin } from '../../_lib/admin'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * Unified create-video endpoint.
 * Accepts content (URL, text, idea, or file reference) + purpose,
 * extracts content, creates a video record, and triggers the pipeline.
 * Returns the videoId so the frontend can navigate to the generating page.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const { purpose, method, url, text, idea, audience, voiceId, brandId, aiMusic, musicPrompt } = body as {
    purpose: string
    method: 'url' | 'text' | 'idea'
    url?: string
    text?: string
    idea?: string
    audience?: string
    voiceId?: string
    brandId?: string | null
    aiMusic?: boolean
    musicPrompt?: string
  }

  if (!purpose) return NextResponse.json({ error: 'Purpose is required' }, { status: 400 })
  if (!method) return NextResponse.json({ error: 'Method is required' }, { status: 400 })

  try {
    // Step 1: Extract content
    let extractedData: any = null
    let autoBrandId: string | null = null
    let autoLogoUrl: string | null = null
    let customStylePrompt: string | null = null

    if (method === 'url') {
      if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })
      const origin = new URL(request.url).origin
      const extractRes = await fetch(`${origin}/api/extract-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': request.headers.get('cookie') || '',
        },
        body: JSON.stringify({ url }),
      })
      const extractResult = await extractRes.json()
      if (!extractRes.ok) return NextResponse.json({ error: extractResult.error || 'Extraction failed' }, { status: extractRes.status })

      const { suggestedTheme, autoBrandId: aBrandId, autoLogoUrl: aLogoUrl, ...contentData } = extractResult
      extractedData = contentData
      autoBrandId = aBrandId || null
      autoLogoUrl = aLogoUrl || null
      if (suggestedTheme?.prompt) customStylePrompt = suggestedTheme.prompt
    } else if (method === 'text') {
      if (!text) return NextResponse.json({ error: 'Text content is required' }, { status: 400 })
      const origin = new URL(request.url).origin
      const extractRes = await fetch(`${origin}/api/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': request.headers.get('cookie') || '',
        },
        body: JSON.stringify({ text, purpose }),
      })
      const extractResult = await extractRes.json()
      if (!extractRes.ok) return NextResponse.json({ error: extractResult.error || 'Extraction failed' }, { status: extractRes.status })
      extractedData = extractResult
    } else if (method === 'idea') {
      if (!idea) return NextResponse.json({ error: 'Idea topic is required' }, { status: 400 })
      const origin = new URL(request.url).origin
      const extractRes = await fetch(`${origin}/api/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': request.headers.get('cookie') || '',
        },
        body: JSON.stringify({ idea, audience, purpose }),
      })
      const extractResult = await extractRes.json()
      if (!extractRes.ok) return NextResponse.json({ error: extractResult.error || 'Extraction failed' }, { status: extractRes.status })
      extractedData = extractResult
    }

    if (!extractedData) return NextResponse.json({ error: 'No content could be extracted' }, { status: 400 })

    // Step 2: Create video record
    const policyData = { ...extractedData }
    const effectiveBrandId = brandId || autoBrandId || null
    const effectiveVoice = voiceId || 'nova'

    const origin = new URL(request.url).origin
    const createRes = await fetch(`${origin}/api/videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || '',
      },
      body: JSON.stringify({ policyData, brandId: effectiveBrandId, voiceId: effectiveVoice }),
    })
    const createData = await createRes.json()
    if (!createRes.ok) return NextResponse.json({ error: createData.error || 'Failed to create video record' }, { status: createRes.status })

    // Step 3: Save pipeline input
    await supabase.from('videos').update({
      script: {
        _pipeline_input: {
          policyData, brandId: effectiveBrandId, voiceId: effectiveVoice,
          styleId: customStylePrompt ? 'custom-url-theme' : undefined,
          customStylePrompt: customStylePrompt || undefined,
          narrationStyle: 'solo',
          aiMusic: aiMusic || false,
          musicPrompt: aiMusic ? (musicPrompt || 'Professional ambient background music, subtle and warm') : undefined,
          purpose,
          industry: extractedData?.industry || 'general',
        },
      },
    }).eq('id', createData.id)

    // Step 4: Trigger pipeline
    const genRes = await fetch(`${origin}/api/generate-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || '',
      },
      body: JSON.stringify({
        videoId: createData.id, policyData, brandId: effectiveBrandId, voiceId: effectiveVoice,
        styleId: customStylePrompt ? 'custom-url-theme' : undefined,
        customStylePrompt: customStylePrompt || undefined,
        narrationStyle: 'solo',
        aiMusic: aiMusic || false,
        musicPrompt: aiMusic ? (musicPrompt || 'Professional ambient background music, subtle and warm') : undefined,
        purpose,
        industry: extractedData?.industry || 'general',
      }),
    })
    const genData = await genRes.json()
    if (!genRes.ok) {
      // Video record exists but pipeline failed — user can retry from video page
      return NextResponse.json({
        videoId: createData.id,
        warning: genData.error || 'Pipeline failed to start, but your video was saved. You can retry from the video page.',
      })
    }

    return NextResponse.json({ videoId: createData.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Something went wrong'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
