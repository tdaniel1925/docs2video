import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { synthesizeSpeech } from '../../_lib/tts'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const { scenes, voiceId } = body as {
    scenes: { narration: string }[]
    voiceId: string
  }

  if (!scenes?.length || !voiceId) {
    return NextResponse.json({ error: 'Missing scenes or voiceId' }, { status: 400 })
  }

  try {
    const audioId = randomUUID()
    const admin = createAdminClient()

    // Generate all audio clips in parallel
    console.log(`[pre-audio ${audioId}] Generating ${scenes.length} clips...`)
    const audioBuffers = await Promise.all(
      scenes.map((scene) => synthesizeSpeech(scene.narration, voiceId))
    )

    // Upload each clip to storage for later retrieval
    for (let i = 0; i < audioBuffers.length; i++) {
      const path = `${user.id}/pre-audio/${audioId}/clip_${i}.mp3`
      await admin.storage.from('videos').upload(path, audioBuffers[i], {
        contentType: 'audio/mpeg',
        upsert: true,
      })
    }

    // Store metadata
    const metaPath = `${user.id}/pre-audio/${audioId}/meta.json`
    await admin.storage.from('videos').upload(
      metaPath,
      Buffer.from(JSON.stringify({ clipCount: audioBuffers.length, voiceId })),
      { contentType: 'application/json', upsert: true }
    )

    console.log(`[pre-audio ${audioId}] Done. ${audioBuffers.length} clips cached.`)
    return NextResponse.json({ audioId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Audio generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
