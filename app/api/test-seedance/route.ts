import { NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

export const runtime = 'nodejs'
export const maxDuration = 300

fal.config({ credentials: process.env.FAL_KEY! })

export async function POST(request: Request) {
  const body = await request.json()
  const { mode, imageUrl, prompt, audioUrl, duration, resolution } = body as {
    mode: 'text-to-video' | 'image-to-video'
    imageUrl?: string
    prompt: string
    audioUrl?: string
    duration?: string
    resolution?: string
  }

  try {
    let result: any

    if (mode === 'image-to-video' && imageUrl) {
      // If the image URL is relative (local file), convert to data URI
      let resolvedImageUrl = imageUrl
      if (imageUrl.startsWith('/')) {
        const fs = await import('fs/promises')
        const path = await import('path')
        const filePath = path.join(process.cwd(), 'public', imageUrl)
        try {
          const fileBuffer = await fs.readFile(filePath)
          resolvedImageUrl = `data:image/png;base64,${fileBuffer.toString('base64')}`
        } catch {
          return NextResponse.json({ error: `Could not read local file: ${imageUrl}` }, { status: 400 })
        }
      }

      // Reference-to-video: animate a slide image
      const input: any = {
        prompt,
        image_urls: [resolvedImageUrl],
        resolution: resolution || '720p',
        duration: duration || '8',
        generate_audio: !audioUrl, // only generate audio if we don't provide our own
      }

      // If we have TTS audio, pass it as reference
      if (audioUrl) {
        input.audio_urls = [audioUrl]
      }

      console.log('[seedance] Submitting reference-to-video:', JSON.stringify({ ...input, image_urls: ['[image]'], audio_urls: input.audio_urls ? ['[audio]'] : undefined }))

      result = await fal.subscribe('bytedance/seedance-2.0/reference-to-video', {
        input,
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === 'IN_PROGRESS') {
            console.log('[seedance] Progress:', update.logs?.map((l: any) => l.message).join(', '))
          }
        },
      })
    } else {
      // Text-to-video: generate from prompt only
      console.log('[seedance] Submitting text-to-video:', prompt.slice(0, 100))

      result = await fal.subscribe('bytedance/seedance-2.0/text-to-video', {
        input: {
          prompt,
          resolution: resolution || '720p',
          duration: duration || '8',
          aspect_ratio: '16:9',
          generate_audio: true,
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === 'IN_PROGRESS') {
            console.log('[seedance] Progress:', update.logs?.map((l: any) => l.message).join(', '))
          }
        },
      })
    }

    const videoUrl = result.data?.video?.url
    if (!videoUrl) {
      return NextResponse.json({ error: 'No video URL in response', raw: result.data }, { status: 500 })
    }

    return NextResponse.json({
      videoUrl,
      seed: result.data?.seed,
      requestId: result.requestId,
    })
  } catch (err) {
    console.error('[seedance] Error:', err)
    const message = err instanceof Error ? err.message : 'Seedance generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
