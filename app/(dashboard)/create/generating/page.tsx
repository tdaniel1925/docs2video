'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '../../../_lib/supabase/client'
import { useToast } from '../../../_components/Toast'
import { displayProgress } from '../../../_lib/video-progress'
import { IN_PROGRESS_STATUSES } from '../../../_lib/video-running'
import { madeNoun, tipsFor } from '../_components/generatingTips'
import { NAMES } from '../../../_lib/names'
import { Button, Note } from '../../../_components/kit'
import Workspace from '../_components/workspace/Workspace'
import Stages from '../_components/workspace/Stages'
import { factsFromDraft } from '../_components/workspace/facts'
import { waitingStages } from './stages'

/*
 * STEP 4 — "Send it": the making/waiting screen.
 *
 * HONEST WAITING. Everything on this screen comes from the project's row,
 * which the render service writes as it works:
 *   - the stage list ticks off the real status (writing, voice, scenes…);
 *   - the line under the running stage is `progress_detail` exactly as
 *     written ("Drawing scene 3 of 6");
 *   - the bar is the same number Home and the Library show for this project
 *     (displayProgress of the real progress_pct). It used to creep forward on
 *     a timer between real updates, so it moved even when nothing happened.
 *
 * "You can close this page — we'll email you" is true: when a project
 * finishes, the stuck-video cron emails the owner once (app/_lib/video-ready.ts).
 * If they are still here when it finishes, this page says so first, so the
 * email (and Home's "finished while you were away") is skipped.
 */

// Every status that means "still working" — the same list the server's
// stuck-video check watches. Anything else that isn't completed/failed gets a
// clear message instead of an endless spinner.
const KNOWN_WORKING = new Set<string>(IN_PROGRESS_STATUSES as unknown as string[])

type Row = {
  status: string
  progress_pct: number | null
  progress_detail: string | null
  error_message: string | null
  output_type: string | null
  video_url: string | null
  preview_thumbs: { idx: number; url: string }[] | null
  total_scenes: number | null
  draft_data: Record<string, any> | null
  deducted_cost: number | null
}

export default function GeneratingPage() {
  const router = useRouter()
  const notify = useToast()
  const searchParams = useSearchParams()
  const videoId = searchParams.get('id')
  const [row, setRow] = useState<Row | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [tipIdx, setTipIdx] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // The Slide Deck look takes longer (it reads the whole document and renders
  // an animated deck), so the time we quote differs. Set by step 3 (?style=).
  const isSlides = (searchParams.get('style') || '') === 'slides'

  // Poll the project's row — the only source of what's happening.
  useEffect(() => {
    if (!videoId) return
    const supabase = createClient()
    let failedPolls = 0
    const poll = async () => {
      let data: Row | null = null
      try {
        const res = await supabase.from('videos')
          .select('status, progress_pct, progress_detail, error_message, output_type, video_url, preview_thumbs, total_scenes, draft_data, deducted_cost')
          .eq('id', videoId).single()
        data = (res.data as Row | null) ?? null
      } catch {
        data = null
      }
      if (!data) {
        // Surface a persistent connection problem instead of spinning forever
        failedPolls++
        if (failedPolls >= 30) {
          clearInterval(interval)
          setError(`Lost connection while checking progress. It may still be in the works — check your ${NAMES.library} in a minute.`)
        }
        return
      }
      failedPolls = 0
      setRow(data)
      if (data.status === 'completed') {
        clearInterval(interval)
        // They watched it finish: no "ready" email, no "while you were away"
        // on Home. Best effort — if this fails they just get the email.
        void fetch(`/api/videos/${videoId}/ready-seen`, { method: 'POST' }).catch(() => {})
        // Video, interactive and deck all live on the detail page
        if (!data.output_type || ['video', 'interactive', 'deck'].includes(data.output_type)) {
          router.push(`/videos/${videoId}`)
        }
      } else if (data.status === 'failed') {
        clearInterval(interval)
        setError(data.error_message || 'Video generation failed')
      } else if (data.status === 'review_required') {
        // Held for a human check (unusual numbers in an insurance document).
        // Nothing more will happen on this page — say so instead of spinning.
        clearInterval(interval)
        setError('This video needs a quick review before it can be made — some numbers in the document looked unusual. Your credits were refunded. Open the video to see what was flagged.')
      } else if (data.status && !KNOWN_WORKING.has(data.status)) {
        // A status this page doesn't know: show it plainly rather than an
        // endless "Getting started" spinner.
        clearInterval(interval)
        setError('This video stopped in an unexpected state. Open it from your library to check on it, or try again.')
      }
    }
    const interval = setInterval(poll, 2000)
    void poll()
    return () => clearInterval(interval)
  }, [videoId, router])

  // A clock, not a progress number: how long it has been running.
  useEffect(() => {
    const timer = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  const outputType = row?.output_type || 'video'
  // Rotate tips — only the ones true for this output.
  const tips = tipsFor(outputType)
  useEffect(() => {
    const timer = setInterval(() => setTipIdx(i => (i + 1) % tips.length), 6000)
    return () => clearInterval(timer)
  }, [tips.length])

  const noun = madeNoun(outputType)
  const soFar = factsFromDraft(row?.draft_data ?? null, {
    output: outputType,
    price: row?.deducted_cost ? { kind: 'charged', credits: row.deducted_cost } : { kind: 'later' },
  })

  if (!videoId) {
    return (
      <Workspace soFar={soFar}>
        <div className="s4-page">
          <h1 className="s1-title">No video found</h1>
          <p className="s1-lead">This page needs a video ID. The video creation may not have started properly.</p>
          <div className="s4-buttons">
            <Button href="/create">Start over</Button>
            <Button href="/dashboard" variant="secondary">Home</Button>
          </div>
        </div>
      </Workspace>
    )
  }

  if (error) {
    return (
      <Workspace soFar={soFar}>
        <div className="s4-page">
          <h1 className="s1-title">Something went wrong</h1>
          <Note tone="stop">{error}</Note>
          <div className="s4-buttons">
            <Button href={`/videos/${videoId}`}>Retry from video page</Button>
            <Button href="/create" variant="secondary">Start over</Button>
            <Button href="/dashboard" variant="secondary">Home</Button>
          </div>
        </div>
      </Workspace>
    )
  }

  const status = row?.status ?? 'pending'

  // PPTX or PDF completed — show download UI instead of redirecting
  if (status === 'completed' && outputType && !['video', 'interactive', 'deck'].includes(outputType)) {
    // Slides: offer BOTH formats at export (PDF + PowerPoint) — they're the same
    // slides, the user picks the wrapper. POST to the on-demand download routes.
    async function downloadAs(format: 'pdf' | 'pptx') {
      try {
        const res = await fetch(`/api/download-${format}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId }),
        })
        if (!res.ok) { notify('Download failed. Please try again.', 'error'); return }
        const blob = await res.blob()
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `presentation.${format}`
        a.click()
        URL.revokeObjectURL(a.href)
      } catch { notify('Download failed. Please try again.', 'error') }
    }
    return (
      <Workspace soFar={soFar}>
        <div className="s4-page">
          <h1 className="s1-title">Your slides are ready!</h1>
          <p className="s1-lead">Download as a PDF or an editable-format PowerPoint.</p>
          <div className="s4-buttons">
            <Button onClick={() => void downloadAs('pdf')}>Download PDF</Button>
            <Button variant="secondary" onClick={() => void downloadAs('pptx')}>Download PowerPoint</Button>
          </div>
          <Note tone="info" title="Want a narrated video version too?" action={<Button href="/create" variant="secondary" size="sm">Create video version</Button>}>
            Turn this into a video with an AI voice, music and animated slides.
          </Note>
          <Button href="/dashboard" variant="quiet">Back to Home</Button>
        </div>
      </Workspace>
    )
  }

  const { stages, current } = waitingStages({ status, outputType, detail: row?.progress_detail ?? '', slidesLook: isSlides })
  const pct = displayProgress(row?.progress_pct)
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  const previews = Array.isArray(row?.preview_thumbs) ? row!.preview_thumbs! : []
  // Filmstrip slots: known scene count (or what we've seen). Fill with previews.
  const slotCount = row?.total_scenes ?? previews.length
  const previewByIdx = new Map(previews.map(p => [p.idx, p.url]))
  const usual = isSlides ? 'about 10 minutes' : 'about 3–5 minutes'

  return (
    <Workspace soFar={soFar}>
      <div className="s4-page">
        <h1 className="s1-title">Making your {noun}</h1>
        <p className="s1-lead">
          This usually takes {usual}. {minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`} so far.
        </p>

        <div className="kit-card s4-progress" role="status" aria-live="polite">
          <Stages stages={stages} current={current} detail={row?.progress_detail || null} label={`Making your ${noun}`} />
          <div className="s4-bar" aria-hidden="true"><div className="s4-bar-fill" style={{ width: `${pct}%` }} /></div>
          <p className="s1-hint">About {pct}% done — the same number Home shows for this project.</p>
        </div>

        {/* Scene filmstrip — fills in as scenes are really built */}
        {slotCount > 0 && (
          <div className="s4-film">
            <p className="s1-hint">{previews.length} of {slotCount} scenes ready</p>
            <div className="s4-film-row">
              {Array.from({ length: slotCount }).map((_, i) => {
                const url = previewByIdx.get(i)
                return (
                  <div key={i} className={`s4-frame ${url ? 'is-ready' : ''}`}>
                    {url ? <img src={url} alt={`Scene ${i + 1}`} /> : <span>{i + 1}</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <Note tone="ok" title="You can close this page —" action={<Button href="/dashboard" size="sm">Go to Home</Button>}>
          we’ll email you when it’s ready. Your {noun} keeps building, and it lands in your {NAMES.library}.
        </Note>

        {row ? <p className="s1-hint s4-tip" key={`${outputType}-${tipIdx}`}>{tips[tipIdx % tips.length]}</p> : null}
      </div>
    </Workspace>
  )
}
