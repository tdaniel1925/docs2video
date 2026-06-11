import { parseBuffer } from 'music-metadata'
import { inngest } from './client'
import { createAdminClient } from '../supabase/admin'
import { generateSlideFromPrompt } from '../gemini'
import { synthesizeSpeech } from '../tts'
import { buildRenderSource, startRender } from '../creatomate'
import { addTopupCredits } from '../credits'
import { sendNotification } from '../notify'

export interface RenderV2Event {
  videoId: string
  userId: string
  voiceId: string
  /** All scenes including cover + closing, narration already TTS-formatted */
  scenes: { narration: string }[]
  /** Fully-built Gemini prompts, same length/order as scenes */
  slidePrompts: string[]
  deductedCost: number
  musicUrl?: string
}

/**
 * Pipeline v2: slides (Gemini) + TTS (OpenAI) generated here in parallel,
 * assembly by Creatomate. Completion is driven by the Creatomate webhook
 * (app/api/webhooks/creatomate). The VPS is not involved.
 */
export const renderVideoV2 = inngest.createFunction(
  {
    id: 'render-video-v2',
    triggers: [{ event: 'video/render.v2' }],
    onFailure: async ({ event, error }: { event: any; error: Error }) => {
      const data = (event?.data?.event?.data ?? {}) as Partial<RenderV2Event>
      const { videoId, userId, deductedCost } = data
      if (!videoId || !userId) return
      const admin = createAdminClient()
      console.error(`[pipeline-v2 ${videoId}] Failed permanently:`, error?.message)
      if (deductedCost && deductedCost > 0) {
        try {
          await addTopupCredits(userId, deductedCost, `refund: failed video ${videoId}`)
        } catch (refundErr) {
          console.error(`[pipeline-v2 ${videoId}] Credit refund failed:`, refundErr)
        }
      }
      await admin.from('videos').update({
        status: 'failed',
        error_message: error?.message || 'Video generation failed',
      }).eq('id', videoId)
      await sendNotification(admin, userId, {
        type: 'video_failed',
        title: 'Video generation failed',
        message: error?.message || 'Video generation failed',
        link: `/videos/${videoId}`,
      })
    },
  },
  async ({ event, step }) => {
    const { videoId, userId, voiceId, scenes, slidePrompts, deductedCost, musicUrl } =
      event.data as RenderV2Event
    const admin = createAdminClient()

    await step.run('status-start', async () => {
      await admin.from('videos').update({
        status: 'generating_slides',
        progress_detail: 'Designing slides and recording narration...',
        progress_pct: 25,
      }).eq('id', videoId)
    })

    // Slides and TTS for every scene, all in parallel.
    // Buffers can't cross step boundaries — upload inside the step, return URLs.
    const slideSteps = scenes.map((_, i) =>
      step.run(`slide-${i}`, async () => {
        const buf = await generateSlideFromPrompt(slidePrompts[i])
        if (!buf) throw new Error(`Slide ${i + 1}/${scenes.length} generation returned no image`)
        const path = `${userId}/${videoId}/v2-slide-${i}.png`
        const { error } = await admin.storage.from('videos').upload(path, buf, {
          contentType: 'image/png',
          upsert: true,
        })
        if (error) throw new Error(`Slide ${i + 1} upload failed: ${error.message}`)
        return admin.storage.from('videos').getPublicUrl(path).data.publicUrl
      })
    )

    const audioSteps = scenes.map((scene, i) =>
      step.run(`tts-${i}`, async () => {
        const buf = await synthesizeSpeech(scene.narration || '', voiceId)
        let duration: number
        try {
          const meta = await parseBuffer(buf, 'audio/mpeg')
          duration = meta.format.duration || 0
        } catch {
          duration = 0
        }
        // Fallback estimate: ~15 chars/sec of narration
        if (!duration || duration <= 0) duration = Math.max(3, (scene.narration?.length || 50) / 15)
        const path = `${userId}/${videoId}/v2-audio-${i}.mp3`
        const { error } = await admin.storage.from('videos').upload(path, buf, {
          contentType: 'audio/mpeg',
          upsert: true,
        })
        if (error) throw new Error(`Audio ${i + 1} upload failed: ${error.message}`)
        return {
          url: admin.storage.from('videos').getPublicUrl(path).data.publicUrl,
          duration: Math.round(duration * 100) / 100,
        }
      })
    )

    const [slideUrls, audios] = await Promise.all([
      Promise.all(slideSteps),
      Promise.all(audioSteps),
    ])

    const renderId = await step.run('start-render', async () => {
      await admin.from('videos').update({
        status: 'assembling',
        progress_detail: 'Assembling your video...',
        progress_pct: 70,
        slide_urls: slideUrls,
      }).eq('id', videoId)

      const source = buildRenderSource(
        scenes.map((_, i) => ({
          imageUrl: slideUrls[i],
          audioUrl: audios[i].url,
          duration: audios[i].duration,
        })),
        musicUrl
      )
      const { id } = await startRender(source, { videoId, userId, deductedCost })
      console.log(`[pipeline-v2 ${videoId}] Creatomate render started: ${id}`)
      return id
    })

    return { renderId, scenes: scenes.length }
  }
)
