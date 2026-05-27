import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Video Editor API — consolidated endpoint for post-generation editing.
 *
 * Actions:
 *   save-script    — update video.script with modified scenes
 *   reorder        — reorder scenes array
 *   delete-scene   — remove a scene by index
 *   re-render      — trigger full video re-assembly (proxies to /api/re-render)
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const { action, videoId } = body as { action: string; videoId: string }

  if (!videoId || !action) {
    return NextResponse.json({ error: 'Missing videoId or action' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify ownership
  const { data: video } = await admin
    .from('videos')
    .select('*')
    .eq('id', videoId)
    .eq('user_id', user.id)
    .single()

  if (!video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  try {
    switch (action) {
      case 'save-script': {
        const { scenes } = body as { scenes: any[] }
        if (!scenes || !Array.isArray(scenes)) {
          return NextResponse.json({ error: 'Missing scenes array' }, { status: 400 })
        }

        // Re-number scenes
        const numbered = scenes.map((s: any, i: number) => ({
          ...s,
          scene: i + 1,
        }))

        const { error } = await admin
          .from('videos')
          .update({ script: numbered, updated_at: new Date().toISOString() })
          .eq('id', videoId)

        if (error) throw error
        return NextResponse.json({ success: true, scenes: numbered })
      }

      case 'reorder': {
        const { fromIndex, toIndex } = body as { fromIndex: number; toIndex: number }
        const currentScenes = Array.isArray(video.script) ? [...video.script] : []

        if (fromIndex < 0 || fromIndex >= currentScenes.length || toIndex < 0 || toIndex >= currentScenes.length) {
          return NextResponse.json({ error: 'Invalid indices' }, { status: 400 })
        }

        const [moved] = currentScenes.splice(fromIndex, 1)
        currentScenes.splice(toIndex, 0, moved)

        // Re-number
        const reordered = currentScenes.map((s: any, i: number) => ({ ...s, scene: i + 1 }))

        // Also reorder slide_urls if present
        const slideUrls = Array.isArray(video.slide_urls) ? [...video.slide_urls] : []
        if (slideUrls.length > 0) {
          const [movedSlide] = slideUrls.splice(fromIndex, 1)
          slideUrls.splice(toIndex, 0, movedSlide)
        }

        const { error } = await admin
          .from('videos')
          .update({
            script: reordered,
            slide_urls: slideUrls.length > 0 ? slideUrls : video.slide_urls,
            updated_at: new Date().toISOString(),
          })
          .eq('id', videoId)

        if (error) throw error
        return NextResponse.json({ success: true, scenes: reordered, slideUrls })
      }

      case 'delete-scene': {
        const { sceneIndex } = body as { sceneIndex: number }
        const currentScenes = Array.isArray(video.script) ? [...video.script] : []

        if (sceneIndex < 0 || sceneIndex >= currentScenes.length) {
          return NextResponse.json({ error: 'Invalid scene index' }, { status: 400 })
        }

        if (currentScenes.length <= 2) {
          return NextResponse.json({ error: 'Video must have at least 2 scenes' }, { status: 400 })
        }

        currentScenes.splice(sceneIndex, 1)
        const renumbered = currentScenes.map((s: any, i: number) => ({ ...s, scene: i + 1 }))

        // Also remove from slide_urls
        const slides = Array.isArray(video.slide_urls) ? [...video.slide_urls] : []
        if (slides.length > sceneIndex) {
          slides.splice(sceneIndex, 1)
        }

        const { error } = await admin
          .from('videos')
          .update({
            script: renumbered,
            slide_urls: slides,
            updated_at: new Date().toISOString(),
          })
          .eq('id', videoId)

        if (error) throw error
        return NextResponse.json({ success: true, scenes: renumbered, slideUrls: slides })
      }

      case 're-render': {
        // Proxy to existing /api/re-render with the same payload
        const { updatedScenes, updatedSlideUrls, changedAudioIndexes, voiceId } = body
        const reRenderRes = await fetch(new URL('/api/re-render', request.url).toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || '',
          },
          body: JSON.stringify({ videoId, updatedScenes, updatedSlideUrls, changedAudioIndexes, voiceId }),
        })
        const reRenderData = await reRenderRes.json()
        if (!reRenderRes.ok) {
          return NextResponse.json({ error: reRenderData.error || 'Re-render failed' }, { status: reRenderRes.status })
        }
        return NextResponse.json(reRenderData)
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Editor action failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
