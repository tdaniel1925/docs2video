import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { synthesizeSpeech } from '../../_lib/tts'
import { rateLimit, getRateLimitKey, LIMITS } from '../../_lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 300

const VIDEO_ASSEMBLY_URL = process.env.VIDEO_ASSEMBLY_URL || 'http://5.161.215.156:4000'
const VIDEO_ASSEMBLY_SECRET = (process.env.VIDEO_ASSEMBLY_SECRET || '').trim().replace(/[\r\n]/g, '')

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const rl = rateLimit(getRateLimitKey(user.id, 'generation'), LIMITS.generation.limit, LIMITS.generation.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
  }

  const body = await request.json()
  const { videoId, updatedScenes, updatedSlideUrls, changedAudioIndexes, voiceId } = body as {
    videoId: string
    updatedScenes: { scene: number; title: string; narration: string; slidePrompt: string; duration: number }[]
    updatedSlideUrls: string[]
    changedAudioIndexes: number[]
    voiceId: string
  }

  if (!videoId || !updatedScenes || !updatedSlideUrls) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify video ownership
  const { data: video } = await admin.from('videos').select('*').eq('id', videoId).eq('user_id', user.id).single()
  if (!video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  try {
    // Mark video as re-rendering
    await admin.from('videos').update({ status: 'processing', progress_detail: 'Re-rendering video...', progress_pct: 10 }).eq('id', videoId)

    // 1. Generate new TTS audio only for changed scenes
    const audioBuffers: Buffer[] = []
    const existingAudioUrls = (video.audio_urls ?? []) as string[]

    for (let i = 0; i < updatedScenes.length; i++) {
      if (changedAudioIndexes.includes(i)) {
        console.log(`[re-render ${videoId}] Generating new TTS for scene ${i}...`)
        const audioBuffer = await synthesizeSpeech(updatedScenes[i].narration, voiceId || 'nova')
        audioBuffers.push(audioBuffer)
      } else if (existingAudioUrls[i]) {
        // Download existing audio
        try {
          const audioRes = await fetch(existingAudioUrls[i], { signal: AbortSignal.timeout(10000) })
          if (audioRes.ok) {
            audioBuffers.push(Buffer.from(await audioRes.arrayBuffer()))
          } else {
            // Fallback: regenerate
            const audioBuffer = await synthesizeSpeech(updatedScenes[i].narration, voiceId || 'nova')
            audioBuffers.push(audioBuffer)
          }
        } catch {
          const audioBuffer = await synthesizeSpeech(updatedScenes[i].narration, voiceId || 'nova')
          audioBuffers.push(audioBuffer)
        }
      } else {
        // No existing audio, generate fresh
        const audioBuffer = await synthesizeSpeech(updatedScenes[i].narration, voiceId || 'nova')
        audioBuffers.push(audioBuffer)
      }
    }

    await admin.from('videos').update({ progress_detail: 'Downloading slides...', progress_pct: 40 }).eq('id', videoId)

    // 2. Download all slide images
    const slideBuffers: Buffer[] = []
    for (let i = 0; i < updatedSlideUrls.length; i++) {
      const url = updatedSlideUrls[i]
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
        if (res.ok) {
          slideBuffers.push(Buffer.from(await res.arrayBuffer()))
        } else {
          throw new Error(`Failed to download slide ${i}`)
        }
      } catch (err) {
        throw new Error(`Failed to download slide ${i + 1}: ${err instanceof Error ? err.message : 'unknown error'}`)
      }
    }

    await admin.from('videos').update({ progress_detail: 'Assembling video...', progress_pct: 60 }).eq('id', videoId)

    // 3. Assemble new video via VPS
    const http = await import('http')
    const vpsUrl = new URL(`${VIDEO_ASSEMBLY_URL}/assemble`)
    const bodyStr = JSON.stringify({
      slides: slideBuffers.map(b => b.toString('base64')),
      audios: audioBuffers.map(b => b.toString('base64')),
      videoId,
      userId: user.id,
    })

    const vpsResult = await new Promise<{ ok: boolean; status: number; data: any }>((resolve, reject) => {
      const req = http.request({
        hostname: vpsUrl.hostname,
        port: parseInt(vpsUrl.port || '4000'),
        path: vpsUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-secret': VIDEO_ASSEMBLY_SECRET,
          'Content-Length': Buffer.byteLength(bodyStr),
        },
        timeout: 660000,
      }, (res) => {
        let data = ''
        res.on('data', (chunk: string) => { data += chunk })
        res.on('end', () => {
          try {
            resolve({ ok: res.statusCode === 200, status: res.statusCode ?? 500, data: JSON.parse(data) })
          } catch {
            resolve({ ok: false, status: res.statusCode ?? 500, data: { error: data } })
          }
        })
      })
      req.on('error', reject)
      req.on('timeout', () => { req.destroy(); reject(new Error('VPS request timed out')) })
      req.write(bodyStr)
      req.end()
    })

    if (!vpsResult.ok) {
      throw new Error(vpsResult.data?.error || `VPS returned ${vpsResult.status}`)
    }

    const assemblyResult = vpsResult.data as { success: boolean; videoUrl: string; thumbnailUrl: string; durations: number[]; totalDuration: number }

    // 4. Upload new slides
    const newSlideUrls: string[] = []
    for (let i = 0; i < slideBuffers.length; i++) {
      const slidePath = `${user.id}/${videoId}/slide_${i}.png`
      await admin.storage.from('videos').upload(slidePath, slideBuffers[i], { contentType: 'image/png', upsert: true })
      const { data: slideUrl } = admin.storage.from('videos').getPublicUrl(slidePath)
      newSlideUrls.push(slideUrl.publicUrl)
    }

    // 5. Update video record
    await admin.from('videos').update({
      video_url: assemblyResult.videoUrl,
      thumbnail_url: assemblyResult.thumbnailUrl,
      duration: assemblyResult.totalDuration,
      status: 'completed',
      slide_urls: newSlideUrls,
      script: updatedScenes,
      progress_detail: null,
      progress_pct: 100,
    }).eq('id', videoId)

    return NextResponse.json({
      success: true,
      videoUrl: assemblyResult.videoUrl,
      slideUrls: newSlideUrls,
      duration: assemblyResult.totalDuration,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Re-render failed'
    console.error(`[re-render ${videoId}] Error:`, message)
    // Restore completed status on failure
    await admin.from('videos').update({ status: 'completed', progress_detail: null, progress_pct: null }).eq('id', videoId)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
