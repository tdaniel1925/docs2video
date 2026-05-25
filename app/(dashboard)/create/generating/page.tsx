'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../../_lib/supabase/client'

const STAGES = [
  { key: 'pending', icon: '🚀', label: 'Starting up', desc: 'Preparing your video pipeline' },
  { key: 'scripting', icon: '✍️', label: 'Writing script', desc: 'AI is crafting your narration' },
  { key: 'generating_audio', icon: '🎙️', label: 'Recording voices', desc: 'Professional voiceover being generated' },
  { key: 'generating_slides', icon: '🎨', label: 'Designing slides', desc: 'Creating branded visuals for each scene' },
  { key: 'assembling', icon: '🎬', label: 'Assembling video', desc: 'Stitching everything together' },
]

const TIPS = [
  'Your video will have professional narration with natural-sounding AI voices.',
  'Each slide is custom-designed with your brand colors and logo.',
  'You can share this video with a branded link when it\'s done.',
  'Videos can be downloaded as MP4, PDF slides, or PPTX presentations.',
  'The AI chatbot on your share page will know everything about this video.',
]

export default function GeneratingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const videoId = searchParams.get('id')
  const [status, setStatus] = useState('pending')
  const [progressPct, setProgressPct] = useState(0)
  const [progressDetail, setProgressDetail] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [tipIdx, setTipIdx] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [outputType, setOutputType] = useState<string>('video')
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  // Poll for status
  useEffect(() => {
    if (!videoId) return
    const supabase = createClient()
    const interval = setInterval(async () => {
      const { data } = await supabase.from('videos').select('status, progress_pct, progress_detail, error_message, output_type, video_url').eq('id', videoId).single()
      if (data) {
        setStatus(data.status)
        setProgressPct(data.progress_pct ?? 0)
        setProgressDetail(data.progress_detail ?? '')
        if (data.output_type) setOutputType(data.output_type)
        if (data.video_url) setVideoUrl(data.video_url)
        if (data.status === 'completed') {
          clearInterval(interval)
          // For video output, redirect to the video page as before
          if (!data.output_type || data.output_type === 'video') {
            router.push(`/videos/${videoId}`)
          }
        }
        if (data.status === 'failed') {
          clearInterval(interval)
          setError(data.error_message || 'Video generation failed')
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

  // Rotate tips
  useEffect(() => {
    const timer = setInterval(() => setTipIdx(i => (i + 1) % TIPS.length), 6000)
    return () => clearInterval(timer)
  }, [])

  const currentStage = STAGES.find(s => s.key === status) || STAGES[0]
  const stageIdx = STAGES.findIndex(s => s.key === status)
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60

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
              Dashboard
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
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // PPTX or PDF completed — show download UI instead of redirecting
  if (status === 'completed' && outputType && outputType !== 'video') {
    const isPptx = outputType === 'pptx'
    const label = isPptx ? 'PPTX' : 'PDF'
    const readyMsg = isPptx ? 'Your slide deck is ready!' : 'Your document is ready!'
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px', minHeight: '80vh',
      }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>{isPptx ? '\uD83D\uDCCA' : '\uD83D\uDCC4'}</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.03em' }}>
          {readyMsg}
        </h1>
        <p style={{ fontSize: 16, color: 'var(--ink-soft)', marginBottom: 32, lineHeight: 1.6, textAlign: 'center', maxWidth: 480 }}>
          Your {label} has been generated and is ready to download.
        </p>

        {videoUrl && (
          <a
            href={videoUrl}
            download
            style={{
              display: 'inline-block', padding: '16px 40px', borderRadius: 10,
              background: 'var(--ink)', color: 'white', fontSize: 18, fontWeight: 800,
              textDecoration: 'none', marginBottom: 24, letterSpacing: '-0.02em',
              transition: 'opacity 0.2s',
            }}
          >
            Download {label}
          </a>
        )}

        {/* Upsell for video version */}
        <div style={{
          maxWidth: 480, width: '100%', padding: '24px 28px', borderRadius: 10,
          background: 'rgba(199, 232, 168, 0.12)', border: '1.5px solid var(--mint)',
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
            border: '2px solid var(--mint)', background: 'white', color: 'var(--ink)',
            fontSize: 14, fontWeight: 700, textDecoration: 'none',
          }}>
            Create video version
          </Link>
        </div>

        <Link href="/dashboard" style={{
          fontSize: 14, color: 'var(--ink-light)', textDecoration: 'none',
        }}>
          Back to Dashboard
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
          0%, 100% { box-shadow: 0 0 0 0 rgba(168,240,212,0.4); }
          50% { box-shadow: 0 0 0 20px rgba(168,240,212,0); }
        }
      `}</style>

      {/* Big percentage */}
      <div style={{
        fontSize: 72, fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--ink)',
        marginBottom: 8, lineHeight: 1,
      }}>
        {Math.min(progressPct, 99)}%
      </div>

      {/* Elapsed time */}
      <div style={{ fontSize: 14, color: 'var(--ink-light)', marginBottom: 32 }}>
        {minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`} elapsed
      </div>

      {/* Progress bar */}
      <div style={{
        width: '100%', maxWidth: 480, height: 8, background: 'var(--border)',
        borderRadius: 10, overflow: 'hidden', marginBottom: 40,
      }}>
        <div style={{
          height: '100%', borderRadius: 10,
          background: 'linear-gradient(90deg, var(--mint), #4ade80)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 2s infinite',
          transition: 'width 1s ease',
          width: `${Math.min(progressPct, 99)}%`,
        }} />
      </div>

      {/* Current stage */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
        animation: 'pulseGlow 2s infinite',
        padding: '12px 24px', borderRadius: 16, background: 'rgba(168,240,212,0.08)',
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
            background: i < stageIdx ? 'var(--mint)' : i === stageIdx ? 'var(--ink)' : 'var(--border)',
            transition: 'all 0.4s ease',
          }} />
        ))}
      </div>

      {/* You can leave card */}
      <div style={{
        maxWidth: 480, width: '100%', padding: '24px 28px', borderRadius: 16,
        background: 'white', border: '2px solid var(--mint)',
        textAlign: 'center', marginBottom: 32,
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
          You can safely leave this page
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 16, lineHeight: 1.5 }}>
          Your video will continue building in the background. We&apos;ll notify you when it&apos;s ready.
        </div>
        <Link href="/dashboard" style={{
          display: 'inline-block', padding: '12px 32px', borderRadius: 10,
          background: 'var(--ink)', color: 'white', fontSize: 15, fontWeight: 700,
          textDecoration: 'none', transition: 'opacity 0.2s',
        }}>
          Go to Dashboard
        </Link>
      </div>

      {/* Rotating tip */}
      <div key={tipIdx} style={{
        fontSize: 14, color: 'var(--ink-light)', textAlign: 'center', maxWidth: 400,
        animation: 'fadeInUp 0.4s ease', lineHeight: 1.5,
      }}>
        {TIPS[tipIdx]}
      </div>
    </div>
  )
}
