'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../../_lib/supabase/client'
import type { Infographic, Brand } from '../../../_lib/types'
import { VOICE_OPTIONS } from '../../../_lib/types'
import InlineConfirm from '../../../_components/InlineConfirm'
import { useToast } from '../../../_components/Toast'

export default function InfographicDetailPage() {
  const notify = useToast()
  const params = useParams()
  const router = useRouter()
  const [infographic, setInfographic] = useState<Infographic | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showVideoModal, setShowVideoModal] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState<string>(VOICE_OPTIONS[0].id)
  const [generatingVideo, setGeneratingVideo] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data } = await supabase
        .from('infographics')
        .select('*, brand:brands(*)')
        .eq('id', params.id as string)
        .single()

      if (data) {
        setInfographic(data as Infographic)
      }
    }

    load()

    // Poll if processing
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('infographics')
        .select('*, brand:brands(*)')
        .eq('id', params.id as string)
        .single()

      if (data) {
        setInfographic(data as Infographic)
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(interval)
        }
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [params.id])

  async function handleDelete() {
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('infographics').delete().eq('id', params.id as string)
    router.push('/infographics')
  }

  async function handleDownload() {
    if (!infographic?.image_url) return
    const res = await fetch(infographic.image_url)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${infographic.title ?? 'infographic'}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDownloadPDF() {
    if (!infographic?.image_url) return
    const res = await fetch('/api/download-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrls: [infographic.image_url],
        title: infographic.title ?? 'Infographic',
      }),
    })
    if (!res.ok) { notify('PDF generation failed', 'error'); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${infographic.title ?? 'infographic'}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleCreateVideo() {
    if (!infographic) return
    setGeneratingVideo(true)

    try {
      const supabase = createClient()
      const { data: igData } = await supabase
        .from('infographics')
        .select('policy_data')
        .eq('id', infographic.id)
        .single()

      if (!igData?.policy_data) {
        throw new Error('No policy data found. Please regenerate the infographic from the Create page.')
      }

      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyData: igData.policy_data,
          brandId: infographic.brand_id,
          voiceId: selectedVoice,
          infographicId: infographic.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Video generation failed')
      router.push(`/videos/${data.id}`)
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Video generation failed', 'error')
      setGeneratingVideo(false)
    }
  }

  if (!infographic) {
    return (
      <div style={{ color: 'var(--ink-light)', padding: '64px', textAlign: 'center' }}>
        <span className="spinner lg" />
      </div>
    )
  }

  return (
    <div>
      <Link href="/infographics" className="back-link">
        &larr; Back to gallery
      </Link>

      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 6 }}>{infographic.title ?? 'Untitled'}</h1>
        <div style={{ fontSize: 14, color: 'var(--ink-light)', marginBottom: 20 }}>
          {infographic.source_pdf_name && <>From {infographic.source_pdf_name} &middot; </>}
          {new Date(infographic.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {infographic.status === 'completed' && infographic.image_url && (
            <>
              <button onClick={() => setShowVideoModal(true)} className="btn btn-primary">
                Create video explainer
              </button>
              <button onClick={handleDownload} className="btn btn-mint">
                Download PNG
              </button>
              <button onClick={handleDownloadPDF} className="btn btn-soft">
                Download PDF
              </button>
            </>
          )}
          <InlineConfirm message="Delete this infographic?" confirmLabel="Delete" onConfirm={handleDelete}>
            <button className="btn btn-danger btn-sm">Delete</button>
          </InlineConfirm>
        </div>
      </div>

      {infographic.status === 'processing' && (
        <div className="progress-card" style={{ textAlign: 'center', padding: '64px 36px' }}>
          <span className="spinner lg" />
          <p style={{ marginTop: '16px', fontSize: '18px', fontWeight: 700, color: 'var(--ink)' }}>
            Still generating...
          </p>
          <p style={{ marginTop: '8px', fontSize: '14px', color: 'var(--ink-light)' }}>
            This page will update automatically
          </p>
        </div>
      )}

      {infographic.status === 'failed' && (
        <div style={{
          background: 'white',
          border: '1px solid var(--rose)',
          borderRadius: '10px',
          padding: '48px',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: '18px', fontWeight: 700, color: '#C03A1F', marginBottom: '8px' }}>
            Generation Failed
          </p>
          {infographic.error_message && (
            <p style={{ fontSize: '14px', color: 'var(--ink-soft)', marginBottom: '16px' }}>
              {infographic.error_message}
            </p>
          )}
          <Link href="/create" className="btn btn-mint">
            Try Again
          </Link>
        </div>
      )}

      {infographic.status === 'completed' && infographic.image_url && (
        <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, padding: 16, maxWidth: 800, margin: '0 auto' }}>
          <img
            src={infographic.image_url}
            alt={infographic.title ?? 'Infographic'}
            style={{ width: '100%', borderRadius: 10, display: 'block' }}
          />
        </div>
      )}

      {/* Video Creation Modal */}
      {showVideoModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(15,26,18,0.5)',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{
            width: '100%',
            maxWidth: '440px',
            background: 'white',
            border: '1px solid var(--border-light)',
            borderRadius: '10px',
            padding: '32px',
          }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '4px', letterSpacing: '-0.02em' }}>
              Create Video Explainer
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--ink-soft)', marginBottom: '24px' }}>
              Choose a voice for the narration
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {VOICE_OPTIONS.map((voice) => (
                <button
                  key={voice.id}
                  onClick={() => setSelectedVoice(voice.id)}
                  style={{
                    width: '100%',
                    borderRadius: '10px',
                    border: selectedVoice === voice.id
                      ? '2px solid var(--ink)'
                      : '1px solid var(--border-light)',
                    background: selectedVoice === voice.id ? 'var(--mint)' : 'white',
                    padding: '16px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <p style={{ fontWeight: 700, fontSize: '14px', marginBottom: '2px' }}>{voice.name}</p>
                  <p style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>{voice.description}</p>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowVideoModal(false)}
                className="btn btn-soft"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowVideoModal(false); handleCreateVideo() }}
                disabled={generatingVideo}
                className="btn btn-primary"
                style={{ flex: 1, ...(generatingVideo ? { opacity: 0.5 } : {}) }}
              >
                {generatingVideo ? 'Starting...' : 'Generate Video'}
              </button>
            </div>

            <p style={{
              marginTop: '16px',
              fontSize: '12px',
              color: 'var(--ink-light)',
              textAlign: 'center',
            }}>
              Generates a narrated video (from 500 credits). Takes 1-3 minutes.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
