'use client'

import { useEffect, useState } from 'react'
import { displayProgress } from '../../../../_lib/video-progress'

// While a project is being made: the big percentage, the stages and the
// "you can leave this page" note. Moved out of the result page unchanged
// (phase 4 split the 2,700-line page into parts).
const PROGRESS_STEPS = [
  { key: 'starting', label: 'Starting', desc: 'Initializing your video pipeline...', sub: 'Setting up generation environment', icon: '🚀' },
  { key: 'scripting', label: 'Writing Script', desc: 'AI is crafting your narration script...', sub: 'Analyzing content and creating scenes', icon: '✍️' },
  { key: 'generating_audio', label: 'Generating Audio', desc: 'Professional voiceover being recorded...', sub: 'Converting script to natural speech', icon: '🎙️' },
  { key: 'generating_slides', label: 'Creating Slides', desc: 'Designing branded visuals for each scene...', sub: 'Generating and compositing graphics', icon: '🎨' },
  { key: 'assembling', label: 'Assembling Video', desc: 'Stitching everything into your final video...', sub: 'Encoding video, mixing audio, adding music', icon: '🎬' },
]

const FUN_FACTS = [
  'Your video will have professional narration with natural-sounding AI voice.',
  // Not every look paints slides in brand colors; this is what every look does.
  'Your logo appears on the cover, the closing card and the share page.',
  'You can share this video with clients via a branded link when it\'s done.',
  'Videos can be downloaded as MP4, PDF slides, or PPTX presentations.',
  'Your share page shows your contact details, and your booking link if you set one in Settings.',
  'Tip: You can leave this page — your video will continue generating in the background.',
]

export default function MakingProgress({ status, createdAt, progressDetail, progressPct, sceneCount }: { status: string; createdAt: string; progressDetail: string | null; progressPct: number | null; sceneCount: number }) {
  const [elapsed, setElapsed] = useState(0)
  const [factIndex, setFactIndex] = useState(0)

  useEffect(() => {
    const start = new Date(createdAt).getTime()
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [createdAt])

  useEffect(() => {
    const timer = setInterval(() => {
      setFactIndex(prev => (prev + 1) % FUN_FACTS.length)
    }, 8000)
    return () => clearInterval(timer)
  }, [])

  const currentIdx = PROGRESS_STEPS.findIndex(s => s.key === status)
  const effectiveIdx = currentIdx < 0 ? 0 : currentIdx
  const fallbackPct = Math.min(95, Math.round(((effectiveIdx + 0.5) / PROGRESS_STEPS.length) * 100))
  // Same shared mapping the builder + dashboard use, so the % never disagrees
  // across screens. Fall back to the time-based estimate only when the server
  // hasn't emitted a real progress value yet.
  const pct = progressPct != null ? displayProgress(progressPct) : fallbackPct
  const currentStep = PROGRESS_STEPS[effectiveIdx] ?? PROGRESS_STEPS[0]

  // Estimate: ~30s script + ~10s per slide audio + ~25s per slide image + ~30s music + ~60s assembly
  const slides = Math.max(sceneCount, 5)
  const estimatedTotal = 30 + (slides * 10) + (slides * 25) + 30 + 60
  const timeRemaining = Math.max(0, estimatedTotal - elapsed)
  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60
  const elapsedMin = Math.floor(elapsed / 60)
  const elapsedSec = elapsed % 60

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <style>{`
        @keyframes progressShimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 60%, transparent); }
          50% { box-shadow: 0 0 0 12px transparent; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fact-rotate { animation: fadeInUp 0.5s ease; }
      `}</style>

      {/* Hero progress card */}
      <div style={{
        background: 'white', borderRadius: 10, padding: '36px 32px',
        border: '1px solid var(--border-light)', boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        textAlign: 'center', marginBottom: 20,
      }}>
        {/* Big percentage */}
        <div style={{ fontSize: 56, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.03em', lineHeight: 1 }}>
          {pct}%
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginTop: 4, marginBottom: 20 }}>
          {timeRemaining > 0
            ? `About ${minutes > 0 ? `${minutes} min` : ''}${minutes > 0 && seconds > 0 ? ' ' : ''}${seconds > 0 ? `${seconds}s` : ''} remaining`
            : `${elapsedMin}:${elapsedSec.toString().padStart(2, '0')} elapsed — almost done`
          }
        </div>

        {/* Animated gradient progress bar */}
        <div style={{ height: 10, background: 'var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{
            height: '100%', borderRadius: 10,
            width: `${pct}%`,
            // Dark green on the light track: pale mint here all but disappears.
            background: 'linear-gradient(90deg, var(--accent-ink), color-mix(in srgb, var(--accent-ink) 55%, var(--accent)), var(--accent-ink), color-mix(in srgb, var(--accent-ink) 55%, var(--accent)))',
            backgroundSize: '200% 100%',
            animation: 'progressShimmer 2s linear infinite',
            transition: 'width 1s ease',
          }} />
        </div>

        {/* Current stage highlight */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 12,
          background: 'var(--accent-soft)', border: '1px solid var(--accent)',
          borderRadius: 10, padding: '12px 24px',
        }}>
          <span style={{ fontSize: 24 }}>{currentStep.icon}</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{currentStep.label}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{progressDetail ?? currentStep.sub}</div>
          </div>
        </div>
      </div>

      {/* Stage pipeline */}
      <div style={{
        background: 'white', borderRadius: 10, padding: '24px 28px',
        border: '1px solid var(--border-light)', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
          {PROGRESS_STEPS.map((step, i) => {
            const isDone = i < effectiveIdx
            const isActive = i === effectiveIdx
            const isPending = i > effectiveIdx
            return (
              <div key={step.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                {/* Connector line */}
                {i > 0 && (
                  <div style={{
                    position: 'absolute', top: 16, right: '50%', width: '100%', height: 3,
                    background: isDone ? 'var(--accent-ink)' : 'var(--border)',
                    transition: 'background 0.5s ease',
                    zIndex: 0,
                  }} />
                )}
                {/* Circle */}
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', zIndex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: isDone ? 14 : 13, fontWeight: 700,
                  background: isDone ? 'var(--accent)' : isActive ? 'var(--ink)' : 'var(--border)',
                  color: isDone ? 'var(--ink)' : isActive ? 'white' : 'var(--ink-light)',
                  transition: 'all 0.5s ease',
                  ...(isActive ? { animation: 'pulseGlow 2s ease-in-out infinite' } : {}),
                }}>
                  {isDone ? '✓' : isActive ? (
                    <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: 'white' }} />
                  ) : i + 1}
                </div>
                {/* Label */}
                <div style={{
                  fontSize: 11, fontWeight: isActive ? 700 : 500, marginTop: 8,
                  color: isDone ? 'var(--mint-darker)' : isActive ? 'var(--ink)' : 'var(--ink-light)',
                  textAlign: 'center', lineHeight: 1.3, transition: 'all 0.3s ease',
                }}>
                  {step.label}
                </div>
                {/* Active description */}
                {isActive && (
                  <div style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 4, textAlign: 'center', maxWidth: 90 }}>
                    {progressDetail ?? step.desc.replace('...', '')}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Fun facts / tips */}
      <div style={{
        background: 'var(--accent-soft)', border: '1px solid var(--accent)',
        borderRadius: 10, padding: '14px 20px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
        <div key={factIndex} className="fact-rotate" style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
          {FUN_FACTS[factIndex]}
        </div>
      </div>

      {/* Safety message */}
      <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-light)' }}>
        You can safely leave this page — your video continues generating in the background.
        <br />
        This page updates automatically every 3 seconds.
      </div>

      {/* Retry option — shows after 5 minutes */}
      {elapsed > 300 && (
        <div style={{
          marginTop: 20, padding: '16px 20px', borderRadius: 10,
          background: 'var(--surface-raised)', border: '1px solid var(--border)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 12 }}>
            Taking longer than expected? Progress is at {pct}%.
            {pct < 30 ? ' The video server may be busy.' : pct < 70 ? ' Slides are still being designed.' : ' Almost done — hang tight.'}
          </div>
          <button
            onClick={async () => {
              // The server stops the old run and refunds its charge before the
              // new run starts — setting 'pending' from here charged twice.
              const vid = window.location.pathname.split('/').filter(Boolean).pop() || ''
              const res = await fetch(`/api/videos/${encodeURIComponent(vid)}/restart`, { method: 'POST' }).catch(() => null)
              if (res && !res.ok) {
                const d = await res.json().catch(() => ({} as { error?: string }))
                window.alert(d.error || 'Could not restart this video. Please try again.')
              }
              window.location.reload()
            }}
            className="btn btn-soft btn-sm"
          >
            Restart Generation
          </button>
        </div>
      )}
    </div>
  )
}
