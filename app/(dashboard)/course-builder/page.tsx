'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Episode {
  episodeNumber: number
  title: string
  description: string
  keyPoints: string[]
  estimatedDuration: string
}

interface CourseOutline {
  courseTitle: string
  courseDescription: string
  targetAudience: string
  estimatedTotalDuration: string
  episodes: Episode[]
}

type Step = 'input' | 'outline' | 'generating' | 'done'

export default function CourseBuilderPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('input')

  // Input state
  const [topic, setTopic] = useState('')
  const [audience, setAudience] = useState('')
  const [episodeCount, setEpisodeCount] = useState(8)
  const [tone, setTone] = useState('Professional')

  // Outline state
  const [outline, setOutline] = useState<CourseOutline | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Batch state
  const [videoIds, setVideoIds] = useState<string[]>([])
  const [batchStarting, setBatchStarting] = useState(false)

  async function handleGenerateOutline() {
    if (!topic.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/course-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-outline',
          topic,
          audience,
          episodeCount,
          tone,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate outline')
      setOutline(data)
      setStep('outline')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function removeEpisode(index: number) {
    if (!outline) return
    const updated = { ...outline, episodes: outline.episodes.filter((_, i) => i !== index).map((ep, i) => ({ ...ep, episodeNumber: i + 1 })) }
    setOutline(updated)
  }

  function moveEpisode(index: number, direction: -1 | 1) {
    if (!outline) return
    const eps = [...outline.episodes]
    const target = index + direction
    if (target < 0 || target >= eps.length) return
    ;[eps[index], eps[target]] = [eps[target], eps[index]]
    setOutline({ ...outline, episodes: eps.map((ep, i) => ({ ...ep, episodeNumber: i + 1 })) })
  }

  function updateEpisodeTitle(index: number, title: string) {
    if (!outline) return
    const eps = [...outline.episodes]
    eps[index] = { ...eps[index], title }
    setOutline({ ...outline, episodes: eps })
  }

  async function handleStartBatch() {
    if (!outline) return
    setBatchStarting(true)
    setError(null)

    try {
      const res = await fetch('/api/course-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start-batch',
          outline: outline.episodes.map(ep => ({
            title: ep.title,
            description: ep.description,
            keyPoints: ep.keyPoints,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start batch')
      setVideoIds(data.videoIds)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start')
    } finally {
      setBatchStarting(false)
    }
  }

  const estimatedPrice = '$249'

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Coming Soon gate */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '32px 24px', textAlign: 'center', marginBottom: 32 }}>
        <h2 style={{ marginBottom: 8 }}>Coming Soon</h2>
        <p style={{ color: 'var(--ink-soft)', fontSize: 15, marginBottom: 16 }}>
          This feature is coming soon. You&apos;ll be notified when it&apos;s available.
        </p>
        <Link href="/dashboard" className="btn btn-soft">Back to Dashboard</Link>
      </div>

      <div style={{ display: 'none' }}>
      <div className="page-head">
        <div>
          <h1>Course Builder</h1>
          <p>Create a multi-episode video course with AI. Describe your topic and we'll build the curriculum.</p>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(255,199,194,0.15)', border: '1px solid var(--rose)',
          borderRadius: 10, padding: '14px 20px', fontSize: 14, color: '#C03A1F', marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="btn btn-soft btn-sm">Dismiss</button>
        </div>
      )}

      {/* Step 1: Input */}
      {step === 'input' && (
        <div className="wizard-card">
          <h2>What should this course teach?</h2>
          <p className="wizard-sub">Describe the topic, who it's for, and how many episodes you want. AI will design the full curriculum.</p>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="input-label">Course Topic *</label>
            <textarea
              className="input"
              style={{ minHeight: 80, resize: 'vertical', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6 }}
              placeholder="e.g., Complete Guide to Life Insurance Sales for New Agents&#10;or: Understanding Cryptocurrency for Financial Advisors&#10;or: How to Build an AI Automation Business"
              value={topic}
              onChange={e => setTopic(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div className="form-group">
              <label className="input-label">Target Audience</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., New insurance agents, Small business owners"
                value={audience}
                onChange={e => setAudience(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="input-label">Tone</label>
              <select className="input" value={tone} onChange={e => setTone(e.target.value)}>
                <option value="Professional">Professional</option>
                <option value="Casual">Casual & Friendly</option>
                <option value="Educational">Educational</option>
                <option value="Motivational">Motivational</option>
                <option value="Technical">Technical</option>
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="input-label">Number of Episodes</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="range"
                min={3}
                max={20}
                value={episodeCount}
                onChange={e => setEpisodeCount(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <div style={{
                width: 48, height: 48, borderRadius: 10, background: 'var(--mint)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 20, flexShrink: 0,
              }}>
                {episodeCount}
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 6 }}>
              {estimatedPrice} for up to {episodeCount} episodes
            </div>
          </div>

          <button
            onClick={handleGenerateOutline}
            disabled={!topic.trim() || loading}
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
          >
            {loading ? 'Generating curriculum...' : 'Generate Course Outline'}
          </button>

          {loading && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <div className="spinner" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>AI is designing your curriculum. This takes 15-30 seconds...</div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Review & Edit Outline */}
      {step === 'outline' && outline && (
        <div>
          <div className="wizard-card" style={{ marginBottom: 20 }}>
            <h2>{outline.courseTitle}</h2>
            <p className="wizard-sub">{outline.courseDescription}</p>
            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--ink-soft)' }}>
              <span>Audience: <strong>{outline.targetAudience}</strong></span>
              <span>Duration: <strong>{outline.estimatedTotalDuration}</strong></span>
              <span>Episodes: <strong>{outline.episodes.length}</strong></span>
              <span>Price: <strong>{estimatedPrice}</strong></span>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Episodes</h3>
              <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Drag to reorder, click to edit titles</span>
            </div>

            {outline.episodes.map((ep, i) => (
              <div key={i} style={{
                background: 'white', border: '1px solid var(--border-light)',
                borderRadius: 10, padding: '16px 20px', marginBottom: 8,
                display: 'flex', gap: 14, alignItems: 'flex-start',
              }}>
                {/* Episode number */}
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: 'var(--mint)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontWeight: 800, fontSize: 14,
                }}>
                  {ep.episodeNumber}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input
                    type="text"
                    value={ep.title}
                    onChange={e => updateEpisodeTitle(i, e.target.value)}
                    style={{
                      border: 'none', outline: 'none', fontSize: 15, fontWeight: 700,
                      color: 'var(--ink)', width: '100%', background: 'transparent',
                      padding: 0, marginBottom: 4,
                    }}
                  />
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5, marginBottom: 8 }}>
                    {ep.description}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ep.keyPoints.map((point, j) => (
                      <span key={j} className="tag" style={{ fontSize: 11 }}>{point}</span>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 6 }}>
                    {ep.estimatedDuration}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={() => moveEpisode(i, -1)}
                    disabled={i === 0}
                    style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1, fontSize: 14 }}
                  >
                    &#9650;
                  </button>
                  <button
                    onClick={() => moveEpisode(i, 1)}
                    disabled={i === outline.episodes.length - 1}
                    style={{ background: 'none', border: 'none', cursor: i === outline.episodes.length - 1 ? 'default' : 'pointer', opacity: i === outline.episodes.length - 1 ? 0.3 : 1, fontSize: 14 }}
                  >
                    &#9660;
                  </button>
                  <button
                    onClick={() => removeEpisode(i)}
                    disabled={outline.episodes.length <= 2}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C03A1F', fontSize: 12, marginTop: 4, opacity: outline.episodes.length <= 2 ? 0.3 : 1 }}
                  >
                    &#10005;
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setStep('input')} className="btn btn-soft" style={{ flex: 1 }}>
              &larr; Start Over
            </button>
            <button onClick={handleGenerateOutline} disabled={loading} className="btn btn-soft" style={{ flex: 1 }}>
              {loading ? 'Regenerating...' : 'Regenerate Outline'}
            </button>
            <button
              onClick={handleStartBatch}
              disabled={batchStarting}
              className="btn btn-primary"
              style={{ flex: 2 }}
            >
              {batchStarting ? 'Starting...' : `Generate ${outline.episodes.length} Videos (${estimatedPrice})`}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {step === 'done' && (
        <div className="wizard-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#127891;</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Course Generation Started!</h2>
          <p style={{ fontSize: 15, color: 'var(--ink-soft)', marginBottom: 24, maxWidth: 500, margin: '0 auto 24px' }}>
            Your {videoIds.length}-episode course is being generated. Each video takes 2-3 minutes.
            You can leave this page — videos will continue generating in the background.
          </p>

          <div style={{ background: 'var(--bg-soft)', borderRadius: 10, padding: '20px 24px', marginBottom: 24, textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Episodes Queued
            </div>
            {videoIds.map((id, i) => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < videoIds.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: 13, flex: 1 }}>{outline?.episodes[i]?.title ?? `Episode ${i + 1}`}</span>
                <Link href={`/videos/${id}`} className="btn btn-soft btn-sm" style={{ fontSize: 11, padding: '4px 10px' }}>
                  View
                </Link>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Link href="/videos" className="btn btn-primary">Go to Library</Link>
            <button onClick={() => { setStep('input'); setOutline(null); setVideoIds([]) }} className="btn btn-soft">
              Build Another Course
            </button>
          </div>
        </div>
      )}
      </div>{/* end hidden div */}
    </div>
  )
}
