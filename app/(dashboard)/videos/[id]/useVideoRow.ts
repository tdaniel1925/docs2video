'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '../../../_lib/supabase/client'
import type { Video } from '../../../_lib/types'

/**
 * The project row for the result page, kept fresh while it is being made.
 *
 * Polls every 3 seconds until the row reaches ANY ending — not just
 * completed/failed: 'review_required' (and the other finished words older
 * rows carry) used to keep the page hitting the database forever. A hard
 * stop after 3 hours covers any ending word we don't know about yet.
 *
 * `watch()` starts polling again — used when a change (Fix-a-Scene, a
 * rebuild) sets a finished row back to working, so the page follows it
 * without a full reload.
 *
 * A row still at 'pending'/'starting' gets its pipeline started from here,
 * once (that is how the create flow hands over).
 */
/** How long the page waits for the project before saying it can't find it. */
export const MISSING_AFTER_MS = 6000

const TERMINAL = ['completed', 'complete', 'failed', 'review_required', 'ready', 'cancelled', 'canceled', 'error']

export function useVideoRow(id: string) {
  const [video, setVideo] = useState<Video | null>(null)
  const [userPlan, setUserPlan] = useState<string>('trial')
  // True when the first look-up came back empty (wrong link, deleted, someone
  // else's) or nothing arrived within MISSING_AFTER_MS. The page then says
  // "We can't find this video" instead of spinning forever (audit 2026-10-09).
  const [missing, setMissing] = useState(false)
  const pipelineStarted = useRef(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchRow = useCallback(async () => {
    const { data } = await createClient()
      .from('videos')
      .select('*, brand:brands(*)')
      .eq('id', id)
      .single()
    return (data as Video | null) ?? null
  }, [id])

  const stop = useCallback(() => {
    if (timer.current) { clearInterval(timer.current); timer.current = null }
  }, [])

  const watch = useCallback(() => {
    stop()
    const startedAt = Date.now()
    timer.current = setInterval(async () => {
      if (Date.now() - startedAt > 3 * 60 * 60 * 1000) { stop(); return }
      const row = await fetchRow()
      if (!row) return
      setMissing(false)
      setVideo(row)
      if (TERMINAL.includes(String(row.status ?? '').toLowerCase())) stop()
    }, 3000)
  }, [fetchRow, stop])

  useEffect(() => {
    let cancelled = false
    let gotRow = false
    const slow = setTimeout(() => { if (!cancelled && !gotRow) setMissing(true) }, MISSING_AFTER_MS)
    ;(async () => {
      const supabase = createClient()
      const row = await fetchRow()
      gotRow = !!row
      // Nothing came back: no such project for this account. Stop asking.
      if (!cancelled && !row) { setMissing(true); stop(); return }
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).single()
        if (profile && !cancelled) setUserPlan(profile.subscription_status)
      }
      if (cancelled || !row) return
      setVideo(row)
      if ((row.status === 'pending' || (row.status as string) === 'starting') && !pipelineStarted.current) {
        pipelineStarted.current = true
        startPipeline(row)
      }
    })()
    watch()
    return () => { cancelled = true; clearTimeout(slow); stop() }
  }, [fetchRow, watch, stop])

  /** Retry a failed row: back to pending; the reload hands it to the
   *  generator the same way a fresh page load always has. */
  const retry = useCallback(async () => {
    if (!video) return
    // Projects made in today's create flow (slide deck, the other looks,
    // presentations) carry no _pipeline_input — they are started from step 3.
    // Flipping them to 'pending' started nothing: the page sat on "Starting"
    // with the old error until the stuck-video job failed it again (2026-10-08).
    // Send them back to step 3 with everything filled in; Make it there shows
    // the price and starts it properly.
    const hasPipelineInput = !!(video.script as unknown as { _pipeline_input?: unknown } | null)?._pipeline_input
    if (!hasPipelineInput && video.draft_data) {
      window.location.href = `/create/theme?id=${encodeURIComponent(video.id)}`
      return
    }
    await createClient().from('videos').update({ status: 'pending', error_message: null }).eq('id', video.id)
    window.location.reload()
  }, [video])

  return { video, setVideo, userPlan, watch, retry, missing }
}

/** Hands a 'pending' row to the generator — the create flow's last step. */
function startPipeline(row: Video) {
  const input = (row.script as unknown as { _pipeline_input?: Record<string, any> } | null)?._pipeline_input
  if (!input) return
  fetch('/api/generate-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      videoId: row.id,
      policyData: input.policyData,
      brandId: input.brandId,
      voiceId: input.voiceId,
      styleId: input.styleId,
      approvedSlides: input.approvedSlides,
      preGeneratedScenes: input.scenes,
      preGeneratedAudioId: input.preGeneratedAudioId,
      detailed: input.detailed,
      customStylePrompt: input.customStylePrompt,
      musicUrl: input.musicUrl,
      aiMusic: input.aiMusic,
      musicPrompt: input.musicPrompt,
      narrationStyle: input.narrationStyle,
      assetUrls: input.assets,
      purpose: input.purpose,
      uploadMode: input.uploadMode,
      industry: input.industry,
    }),
  }).then(res => {
    if (!res.ok) res.json().then(d => console.error('[video] Pipeline failed:', d.error)).catch(() => {})
  }).catch((err) => console.error('[video] Pipeline fetch error:', err))
}
