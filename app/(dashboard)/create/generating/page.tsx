'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../../_lib/supabase/client'
import { useToast } from '../../../_components/Toast'
import { displayProgress } from '../../../_lib/video-progress'
import { IN_PROGRESS_STATUSES } from '../../../_lib/video-running'
import { madeNoun, tipsFor } from '../_components/generatingTips'
import { NAMES } from '../../../_lib/names'

const STAGES = [
  { key: 'pending', icon: '🚀', label: 'Starting up', desc: 'Preparing your video pipeline' },
  { key: 'scripting', icon: '✍️', label: 'Writing script', desc: 'AI is crafting your narration' },
  { key: 'generating_audio', icon: '🎙️', label: 'Recording voices', desc: 'Professional voiceover being generated' },
  { key: 'generating_slides', icon: '🎨', label: 'Designing slides', desc: 'Creating branded visuals for each scene' },
  { key: 'assembling', icon: '🎬', label: 'Assembling video', desc: 'Stitching everything together' },
]

// Every status that means "still working" — the same list the server's
// stuck-video check watches. Anything else that isn't completed/failed gets a
// clear message instead of an endless spinner.
const KNOWN_WORKING = new Set<string>(IN_PROGRESS_STATUSES as unknown as string[])

// Slide Deck: the render service writes the script itself and may first wait
// in line for the video server — so its steps are named for what is really
// happening, never "Writing script" while it waits.
function slideDeckStage(detail: string) {
  if (/waiting in line/i.test(detail)) return { key: 'queued', icon: '⏳', label: 'Waiting in line', desc: 'Your deck starts as soon as the video server is free' }
  return { key: 'slides', icon: '🎬', label: 'Building your slide deck', desc: 'Writing slides, recording the voice and rendering' }
}

// The rotating tips depend on what is being made — see generatingTips.ts.

export default function GeneratingPage() {
  const router = useRouter()
  const notify = useToast()
  const searchParams = useSearchParams()
  const videoId = searchParams.get('id')
  const [status, setStatus] = useState('pending')
  const [progressPct, setProgressPct] = useState(0)
  const [displayPct, setDisplayPct] = useState(0)
  const [progressDetail, setProgressDetail] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [tipIdx, setTipIdx] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [outputType, setOutputType] = useState<string>('video')
  // Tips wait for the first answer, so a deck never flashes a video's tip.
  const [typeKnown, setTypeKnown] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [previews, setPreviews] = useState<{ idx: number; url: string }[]>([])
  const [totalScenes, setTotalScenes] = useState<number | null>(null)
  const [lastUpdateAt, setLastUpdateAt] = useState<number>(Date.now())
  // style comes from the URL (?style=slides) — set by the theme step. Slide-deck
  // videos take longer (they read the whole doc + render an animated deck), so we
  // set expectations accurately + show a sample of what they'll get.
  const isSlides = (searchParams.get('style') || '') === 'slides'

  // Poll for status
  useEffect(() => {
    if (!videoId) return
    const supabase = createClient()
    let failedPolls = 0
    const interval = setInterval(async () => {
      let data = null
      try {
        const res = await supabase.from('videos').select('status, progress_pct, progress_detail, error_message, output_type, video_url, preview_thumbs, total_scenes').eq('id', videoId).single()
        data = res.data
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
      if (data) {
        setStatus(data.status)
        setProgressPct(prev => {
          const next = data.progress_pct ?? 0
          if (next !== prev) setLastUpdateAt(Date.now()) // a real move resets the "stuck" timer
          return next
        })
        setProgressDetail(data.progress_detail ?? '')
        if (data.output_type) setOutputType(data.output_type)
        setTypeKnown(true)
        if (data.video_url) setVideoUrl(data.video_url)
        if (Array.isArray(data.preview_thumbs)) {
          setPreviews(data.preview_thumbs)
          if (data.preview_thumbs.length > 0) setLastUpdateAt(Date.now()) // a new preview = progress
        }
        if (typeof data.total_scenes === 'number') setTotalScenes(data.total_scenes)
        if (data.status === 'completed') {
          clearInterval(interval)
          // Video, interactive and deck all live on the detail page
          if (!data.output_type || ['video', 'interactive', 'deck'].includes(data.output_type)) {
            router.push(`/videos/${videoId}`)
          }
        }
        if (data.status === 'failed') {
          clearInterval(interval)
          setError(data.error_message || 'Video generation failed')
        } else if (data.status === 'review_required') {
          // Held for a human check (unusual numbers in an insurance document).
          // Nothing more will happen on this page — say so instead of spinning.
          clearInterval(interval)
          setError('This video needs a quick review before it can be made — some numbers in the document looked unusual. Your credits were refunded. Open the video to see what was flagged.')
        } else if (data.status && data.status !== 'completed' && !KNOWN_WORKING.has(data.status)) {
          // A status this page doesn't know: show it plainly rather than an
          // endless "Starting up" spinner.
          clearInterval(interval)
          setError('This video stopped in an unexpected state. Open it from your library to check on it, or try again.')
        }
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [videoId, router])

  // Elapsed timer
  useEffect(() => {
    const timer = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  // Smooth "creep": the server emits only a few progress milestones, so the
  // bar would otherwise sit frozen (e.g. at 18%) for minutes during slide/
  // audio/assembly. Ease displayPct toward the next milestone so it always
  // feels alive — but never past the real value's ceiling and never backward.
  useEffect(() => {
    if (status === 'completed' || status === 'failed') { setDisplayPct(progressPct); return }
    const timer = setInterval(() => {
      setDisplayPct(prev => {
        // Ease toward the SHARED display target (displayProgress) so the bar is
        // never frozen between coarse server milestones — and, crucially, lands
        // on the SAME number the dashboard shows for this video (single source
        // of truth in video-progress.ts). Never go backward.
        const ceiling = displayProgress(progressPct)
        const target = Math.max(prev, 0)
        if (target >= ceiling) return target
        return Math.min(ceiling, target + Math.max(0.25, (ceiling - target) * 0.04))
      })
    }, 700)
    return () => clearInterval(timer)
  }, [progressPct, status])

  // Rotate tips — only the ones true for this output.
  const tips = tipsFor(outputType)
  useEffect(() => {
    const timer = setInterval(() => setTipIdx(i => (i + 1) % tips.length), 6000)
    return () => clearInterval(timer)
  }, [tips.length])

  const currentStage = isSlides ? slideDeckStage(progressDetail) : (STAGES.find(s => s.key === status) || STAGES[0])
  const stageIdx = STAGES.findIndex(s => s.key === status)
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  // "Still working" reassurance: no real progress change for a while, but not done.
  // Slide-deck renders legitimately sit on one step (the render) for minutes, so
  // give them a longer grace window before the "still working" note appears.
  const stalled = status !== 'completed' && status !== 'failed' && (Date.now() - lastUpdateAt) > (isSlides ? 180_000 : 90_000)
  // Filmstrip slots: known scene count (or what we've seen). Fill with previews.
  const slotCount = totalScenes ?? (previews.length || 0)
  const previewByIdx = new Map(previews.map(p => [p.idx, p.url]))

  if (!videoId) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#9888;&#65039;</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>No video found</h1>
          <p style={{ fontSize: 16, color: 'var(--ink-soft)', marginBottom: 24, lineHeight: 1.6 }}>
            This page needs a video ID. The video creation may not have started properly.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Link href="/create" style={{
              padding: '12px 24px', borderRadius: 10, background: 'var(--ink)', color: 'white',
              fontSize: 14, fontWeight: 700, textDecoration: 'none',
            }}>
              Start over
            </Link>
            <Link href="/dashboard" style={{
              padding: '12px 24px', borderRadius: 10, border: '1px solid var(--border)',
              background: 'white', color: 'var(--ink-soft)', fontSize: 14, fontWeight: 600, textDecoration: 'none',
            }}>
              Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#9888;&#65039;</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ fontSize: 16, color: 'var(--ink-soft)', marginBottom: 24, lineHeight: 1.6 }}>{error}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {videoId && (
              <Link href={`/videos/${videoId}`} style={{
                padding: '12px 24px', borderRadius: 10, background: 'var(--ink)', color: 'white',
                fontSize: 14, fontWeight: 700, textDecoration: 'none',
              }}>
                Retry from video page
              </Link>
            )}
            <Link href="/create" style={{
              padding: '12px 24px', borderRadius: 10, border: '1px solid var(--border)',
              background: 'white', color: 'var(--ink-soft)', fontSize: 14, fontWeight: 600, textDecoration: 'none',
            }}>
              Start over
            </Link>
            <Link href="/dashboard" style={{
              padding: '12px 24px', borderRadius: 10, border: '1px solid var(--border)',
              background: 'white', color: 'var(--ink-soft)', fontSize: 14, fontWeight: 600, textDecoration: 'none',
            }}>
              Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // PPTX or PDF completed — show download UI instead of redirecting
  if (status === 'completed' && outputType && !['video', 'interactive', 'deck'].includes(outputType)) {
    // Slides: offer BOTH formats at export (PDF + PowerPoint) \u2014 they're the same
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
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px', minHeight: '80vh',
      }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>{'\uD83D\uDCCA'}</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.03em' }}>
          Your slides are ready!
        </h1>
        <p style={{ fontSize: 16, color: 'var(--ink-soft)', marginBottom: 32, lineHeight: 1.6, textAlign: 'center', maxWidth: 480 }}>
          Download as a PDF or an editable-format PowerPoint.
        </p>

        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => downloadAs('pdf')}
            style={{ padding: '16px 32px', borderRadius: 10, background: 'var(--ink)', color: 'white', fontSize: 17, fontWeight: 800, border: 'none', cursor: 'pointer', letterSpacing: '-0.02em' }}
          >
            Download PDF
          </button>
          <button
            onClick={() => downloadAs('pptx')}
            style={{ padding: '16px 32px', borderRadius: 10, background: 'white', color: 'var(--ink)', fontSize: 17, fontWeight: 800, border: '1.5px solid var(--border)', cursor: 'pointer', letterSpacing: '-0.02em' }}
          >
            Download PowerPoint
          </button>
        </div>

        {/* Upsell for video version */}
        <div style={{
          maxWidth: 480, width: '100%', padding: '24px 28px', borderRadius: 10,
          background: 'var(--accent-soft)', border: '1.5px solid var(--accent)',
          textAlign: 'center', marginBottom: 24,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
            Want a narrated video version too?
          </div>
          <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 16, lineHeight: 1.5 }}>
            Turn this into a professional video with AI voiceover, music, and animated slides.
          </div>
          <Link href="/create" style={{
            display: 'inline-block', padding: '10px 28px', borderRadius: 8,
            border: '2px solid var(--accent-ink)', background: 'white', color: 'var(--ink)',
            fontSize: 14, fontWeight: 700, textDecoration: 'none',
          }}>
            Create video version
          </Link>
        </div>

        <Link href="/dashboard" style={{
          fontSize: 14, color: 'var(--ink-light)', textDecoration: 'none',
        }}>
          Back to Home
        </Link>
      </div>
    )
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px', minHeight: '80vh',
    }}>
      <style>{`
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 60%, transparent); }
          50% { box-shadow: 0 0 0 20px transparent; }
        }
      `}</style>

      {/* Big percentage */}
      <div style={{
        fontSize: 72, fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--ink)',
        marginBottom: 8, lineHeight: 1,
      }}>
        {Math.round(displayPct)}%
      </div>

      {/* Elapsed time + expectation */}
      <div style={{ fontSize: 14, color: 'var(--ink-light)', marginBottom: 4 }}>
        {minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`} elapsed
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink-light)', marginBottom: isSlides ? 20 : 28, maxWidth: 460, textAlign: 'center', lineHeight: 1.5 }}>
        {isSlides
          ? (elapsed >= 600
              ? 'Almost there — the animated deck is rendering. You can safely leave; we’ll notify you when it’s ready.'
              : 'Slide Deck reads your whole document and renders an animated, narrated deck — so it takes about 10 minutes. It’s worth the wait. Feel free to leave; we’ll email you when it’s ready.')
          : (elapsed >= 240
              ? 'Taking a little longer than usual — hang tight, it’s still working. You can safely leave; we’ll notify you when it’s ready.'
              : 'This usually takes about 3–5 minutes.')}
      </div>

      {/* Slide Deck: show a sample of what a slide from THEIRS will look like, so
          the ~10 min wait feels purposeful (they can see the payoff coming). */}
      {isSlides && status !== 'completed' && (
        <div style={{ width: '100%', maxWidth: 520, marginBottom: 28, padding: '16px 18px', borderRadius: 12, background: 'var(--accent-soft)', border: '1.5px solid var(--accent)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 10, textAlign: 'center' }}>
            While you wait — here’s the kind of slide you’re getting:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {['cover', 'data', 'closing'].map((kind) => (
              <a key={kind} href={`/style-samples/slides-${kind}.png`} target="_blank" rel="noreferrer" style={{ display: 'block', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-light)', cursor: 'zoom-in' }}>
                <img src={`/style-samples/slides-${kind}.png`} alt={`Sample ${kind} slide`} style={{ width: '100%', display: 'block' }} />
              </a>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 8, textAlign: 'center' }}>
            Tap any frame to see it full-size · yours will use your content, brand &amp; voice
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div style={{
        width: '100%', maxWidth: 480, height: 8, background: 'var(--border)',
        borderRadius: 10, overflow: 'hidden', marginBottom: 40,
      }}>
        <div style={{
          height: '100%', borderRadius: 10,
          background: 'linear-gradient(90deg, var(--accent-ink), color-mix(in srgb, var(--accent-ink) 55%, var(--accent)))',
          backgroundSize: '200% 100%',
          animation: 'shimmer 2s infinite',
          transition: 'width 0.7s ease',
          width: `${displayPct}%`,
        }} />
      </div>

      {/* Current stage */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
        animation: 'pulseGlow 2s infinite',
        padding: '12px 24px', borderRadius: 10, background: 'var(--accent-soft)',
      }}>
        <span style={{ fontSize: 28 }}>{currentStage.icon}</span>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{currentStage.label}</div>
          <div style={{ fontSize: 14, color: 'var(--ink-soft)' }}>{progressDetail || currentStage.desc}</div>
        </div>
      </div>

      {/* Stage dots */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 48 }}>
        {STAGES.map((s, i) => (
          <div key={s.key} style={{
            width: i <= stageIdx ? 24 : 8, height: 8, borderRadius: 8,
            background: i < stageIdx ? 'var(--accent-ink)' : i === stageIdx ? 'var(--ink)' : 'var(--border)',
            transition: 'all 0.4s ease',
          }} />
        ))}
      </div>

      {/* Scene filmstrip — fills in as scenes are built (turns waiting into watching) */}
      {slotCount > 0 && (
        <div style={{ width: '100%', maxWidth: 560, marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-light)', marginBottom: 10, textAlign: 'center' }}>
            {previews.length} of {slotCount} scenes ready
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {Array.from({ length: slotCount }).map((_, i) => {
              const url = previewByIdx.get(i)
              return (
                <div key={i} style={{
                  width: 92, height: 52, borderRadius: 8, overflow: 'hidden',
                  border: url ? '1.5px solid var(--accent-ink)' : '1px solid var(--border)',
                  background: url ? 'transparent' : 'var(--border)',
                  position: 'relative', flexShrink: 0,
                  animation: url ? 'fadeInUp 0.4s ease' : undefined,
                }}>
                  {url
                    ? <img src={url} alt={`Scene ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--ink-light)' }}>{i + 1}</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* "Still working" reassurance when a real step is taking a while */}
      {stalled && (
        <div style={{
          maxWidth: 480, width: '100%', padding: '12px 20px', borderRadius: 10,
          background: 'var(--accent-soft)', border: '1px solid var(--accent)',
          textAlign: 'center', marginBottom: 24, fontSize: 13, color: 'var(--ink-soft)',
        }}>
          Still working — this step (often the final render) can take a few minutes for longer videos. Nothing is stuck.
        </div>
      )}

      {/* You can leave card */}
      <div style={{
        maxWidth: 480, width: '100%', padding: '24px 28px', borderRadius: 10,
        background: 'var(--accent-soft)', border: '2px solid var(--accent)',
        textAlign: 'center', marginBottom: 32,
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
          You can safely leave this page
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 16, lineHeight: 1.5 }}>
          Your {madeNoun(outputType)} will continue building in the background. We&apos;ll notify you when it&apos;s ready.
        </div>
        <Link href="/dashboard" style={{
          display: 'inline-block', padding: '12px 32px', borderRadius: 10,
          background: 'var(--ink)', color: 'white', fontSize: 15, fontWeight: 700,
          textDecoration: 'none', transition: 'opacity 0.2s',
        }}>
          Go to Home
        </Link>
      </div>

      {/* Rotating tip */}
      {typeKnown ? (
        <div key={`${outputType}-${tipIdx}`} style={{
          fontSize: 14, color: 'var(--ink-light)', textAlign: 'center', maxWidth: 400,
          animation: 'fadeInUp 0.4s ease', lineHeight: 1.5,
        }}>
          {tips[tipIdx % tips.length]}
        </div>
      ) : null}
    </div>
  )
}
