'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'

type DemoStatus = 'idle' | 'scraping' | 'scripting' | 'generating_slides' | 'generating_audio' | 'assembling' | 'completed' | 'failed'

const PRODUCT_VIDEO_URL = 'https://izccljcgxsbumgsznndd.supabase.co/storage/v1/object/public/videos/0e28a48c-978c-4bf0-93c3-6769229c85cc/7c22a559-ad5b-495e-8ebc-6839fdbc9b34.mp4'
const PRODUCT_THUMB_URL = 'https://izccljcgxsbumgsznndd.supabase.co/storage/v1/object/public/videos/0e28a48c-978c-4bf0-93c3-6769229c85cc/7c22a559-ad5b-495e-8ebc-6839fdbc9b34_thumb.png'

const STATUS_MESSAGES: Record<DemoStatus, string> = {
  idle: '',
  scraping: 'Analyzing your website',
  scripting: 'Writing your script',
  generating_slides: 'Designing your slides',
  generating_audio: 'Recording narration',
  assembling: 'Assembling your video',
  completed: 'Your demo is ready!',
  failed: 'Something went wrong.',
}

export default function DemoForm() {
  const [url, setUrl] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<DemoStatus>('idle')
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [brandName, setBrandName] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  useEffect(() => {
    return () => {
      stopPolling()
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [stopPolling])

  // When countdown reaches 0, show the result
  useEffect(() => {
    if (countdown === 0) {
      setShowResult(true)
      setCountdown(null)
    }
  }, [countdown])

  const startCountdown = useCallback(() => {
    setCountdown(5)
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const pollStatus = useCallback((id: string) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/demo-video/${id}`)
        if (!res.ok) return
        const data = await res.json()

        if (data.brandData?.companyName) setBrandName(data.brandData.companyName)

        if (data.status === 'completed' && data.videoUrl) {
          setVideoUrl(data.videoUrl)
          setStatus('completed')
          stopPolling()
          startCountdown()
        } else if (data.status === 'failed') {
          setStatus('failed')
          setErrorMsg(data.errorMessage ?? 'Generation failed. Please try again.')
          stopPolling()
        } else {
          setStatus(data.status)
        }
      } catch { /* retry */ }
    }, 3000)
  }, [stopPolling, startCountdown])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim() || !companyName.trim() || !email.trim()) return
    setStatus('scraping')
    setVideoUrl(null)
    setErrorMsg(null)
    setShowResult(false)
    setCountdown(null)
    setBrandName(companyName.trim())
    try {
      const res = await fetch('/api/demo-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          companyName: companyName.trim(),
          email: email.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setStatus('failed'); setErrorMsg(data.error ?? 'Failed to start demo'); return }
      setStatus(data.status)
      if (data.status === 'completed' && data.videoUrl) {
        setVideoUrl(data.videoUrl)
        if (data.brandData?.companyName) setBrandName(data.brandData.companyName)
        startCountdown()
      } else { pollStatus(data.id) }
    } catch { setStatus('failed'); setErrorMsg('Network error. Please try again.') }
  }

  const isGenerating = !['idle', 'completed', 'failed'].includes(status)
  const isWaiting = isGenerating || (status === 'completed' && !showResult)
  const progressPct = status === 'scraping' ? 15 : status === 'scripting' ? 30 : status === 'generating_slides' ? 55 : status === 'generating_audio' ? 75 : status === 'assembling' ? 90 : status === 'completed' ? 100 : 0
  const canSubmit = url.trim() && companyName.trim() && email.trim()

  return (
    <div className="demo-form-wrap">

      {/* ---- IDLE: URL + Company + Email ---- */}
      {status === 'idle' && (
        <form onSubmit={handleSubmit} className="demo-form">
          <div className="demo-input-row">
            <div className="demo-input-wrap">
              <svg className="demo-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="Your website URL"
                className="demo-input"
              />
            </div>
          </div>
          <div className="demo-input-row" style={{marginTop:8}}>
            <div className="demo-input-wrap">
              <svg className="demo-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="Company name"
                className="demo-input"
              />
            </div>
            <div className="demo-input-wrap">
              <svg className="demo-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Your email"
                className="demo-input"
              />
            </div>
            <button type="submit" disabled={!canSubmit} className="btn btn-primary btn-lg demo-btn">
              Generate demo
            </button>
          </div>
          <div className="demo-hint">We&apos;ll create a branded explainer video for your company in about 90 seconds</div>
        </form>
      )}

      {/* ---- WAITING: progress + product video (stays visible during countdown too) ---- */}
      {isWaiting && (
        <div style={{textAlign:'center'}}>
          {/* Status line */}
          {isGenerating && (
            <>
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,marginBottom:6}}>
                <span className="demo-spinner" />
                <span style={{fontSize:15,fontWeight:600,color:'var(--ink)'}}>
                  {STATUS_MESSAGES[status]}{brandName ? ` for ${brandName}` : ''}
                </span>
              </div>
              <div style={{maxWidth:400,margin:'0 auto 16px',height:3,background:'var(--border)',borderRadius:10,overflow:'hidden'}}>
                <div style={{width:`${progressPct}%`,height:'100%',background:'var(--mint)',borderRadius:10,transition:'width 0.6s ease'}} />
              </div>
            </>
          )}

          {/* Countdown notice — appears when demo is ready but product video still playing */}
          {countdown !== null && countdown > 0 && (
            <div style={{
              background:'#C03A1F', color:'white', padding:'10px 20px',
              borderRadius:10, marginBottom:12, fontSize:15, fontWeight:700,
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              animation:'demo-pulse 1s ease infinite',
            }}>
              Your demo is ready! Starting in {countdown}...
            </div>
          )}

          {/* Intro text above video */}
          <p style={{fontSize:14,color:'var(--ink-soft)',marginBottom:16}}>
            While your video is rendering, find out a little more about what Docs2Video can do for you!
          </p>

          {/* Product video */}
          <video
            src={PRODUCT_VIDEO_URL}
            poster={PRODUCT_THUMB_URL}
            controls
            autoPlay
            muted
            playsInline
            style={{width:'100%',borderRadius:10,display:'block'}}
          />

          {/* Email note */}
          <p style={{fontSize:13,color:'var(--ink-soft)',marginTop:14}}>
            We&apos;ll email <strong style={{color:'var(--ink)'}}>{email}</strong> when your demo is ready. You can close this page.
          </p>
        </div>
      )}

      {/* ---- ERROR ---- */}
      {status === 'failed' && errorMsg && (
        <div className="demo-error">
          <p>{errorMsg}</p>
          <button onClick={() => { setStatus('idle'); setErrorMsg(null); setShowResult(false) }} className="btn btn-soft">Try again</button>
        </div>
      )}

      {/* ---- COMPLETED + SHOWN ---- */}
      {showResult && videoUrl && (
        <div className="demo-result">
          <div className="demo-video-wrap">
            <video src={videoUrl} controls autoPlay playsInline style={{width:'100%',borderRadius:10,display:'block'}} />
          </div>
          <p style={{fontSize:13,color:'var(--ink-soft)',marginTop:14,textAlign:'center',lineHeight:1.6}}>
            This is a rough draft demo version. With full access you can select from 28 different themes, create your own custom styles, and share polished HD videos with anyone.
          </p>
          <div className="demo-result-cta">
            <div className="demo-result-text">
              {brandName && <p className="demo-result-brand">Your {brandName} demo is ready!</p>}
              <p className="demo-result-sub">Sign up to unlock all themes, remove the watermark, and create unlimited videos</p>
            </div>
            <Link href="/signup" className="btn btn-primary btn-lg">Sign up free &rarr;</Link>
          </div>
        </div>
      )}
    </div>
  )
}
