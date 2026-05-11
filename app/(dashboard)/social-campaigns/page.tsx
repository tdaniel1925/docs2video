'use client'

import { useState } from 'react'

interface CampaignPost {
  dayOffset: number
  platform: string
  type: string
  caption: string
  imagePrompt: string
  bestTime: string
  hashtags: string[]
  // After generation:
  id?: string
  image_url?: string
  status?: string
}

type Step = 'setup' | 'calendar' | 'generating' | 'done'

const PLATFORM_OPTIONS = [
  { id: 'facebook', label: 'Facebook', icon: 'f' },
  { id: 'instagram', label: 'Instagram', icon: 'IG' },
  { id: 'twitter', label: 'X / Twitter', icon: 'X' },
  { id: 'linkedin', label: 'LinkedIn', icon: 'in' },
  { id: 'youtube', label: 'YouTube', icon: 'YT' },
  { id: 'tiktok', label: 'TikTok', icon: 'TT' },
]

const GOAL_OPTIONS = [
  'Brand Awareness',
  'Lead Generation',
  'Product Launch',
  'Educational Content',
  'Community Engagement',
  'Sales & Promotion',
]

const PLATFORM_COLORS: Record<string, string> = {
  facebook: '#1877F2',
  instagram: '#E4405F',
  twitter: '#1DA1F2',
  linkedin: '#0A66C2',
  youtube: '#FF0000',
  tiktok: '#000000',
}

export default function SocialCampaignsPage() {
  const [step, setStep] = useState<Step>('setup')

  // Setup
  const [businessName, setBusinessName] = useState('')
  const [businessDesc, setBusinessDesc] = useState('')
  const [goal, setGoal] = useState('Brand Awareness')
  const [platforms, setPlatforms] = useState<string[]>(['instagram', 'facebook', 'linkedin'])
  const [duration, setDuration] = useState<'1week' | '2weeks' | '1month'>('2weeks')
  const [frequency, setFrequency] = useState<'daily' | '3xweek' | 'weekly'>('3xweek')
  const [tone, setTone] = useState('Professional but friendly')
  const [primaryColor, setPrimaryColor] = useState('#1a1a2e')

  // Calendar
  const [campaignName, setCampaignName] = useState('')
  const [posts, setPosts] = useState<CampaignPost[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedPost, setExpandedPost] = useState<number | null>(null)

  // Done
  const [campaignId, setCampaignId] = useState<string | null>(null)

  function togglePlatform(id: string) {
    setPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  async function handleGeneratePlan() {
    if (!businessName.trim() || !businessDesc.trim() || platforms.length === 0) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/social-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-plan',
          businessName, businessDescription: businessDesc,
          goal, platforms, duration, frequency, tone,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate plan')
      setCampaignName(data.campaignName)
      setPosts(data.posts)
      setStep('calendar')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function removePost(index: number) {
    setPosts(prev => prev.filter((_, i) => i !== index))
  }

  function updatePostCaption(index: number, caption: string) {
    setPosts(prev => prev.map((p, i) => i === index ? { ...p, caption } : p))
  }

  async function handleStartCampaign() {
    if (!posts.length) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/social-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start-campaign',
          campaignName,
          posts,
          businessName,
          primaryColor,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start campaign')
      setCampaignId(data.campaignId)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start')
    } finally {
      setLoading(false)
    }
  }

  async function publishAllReady() {
    if (!campaignId) return
    // This would be called from the done/management view
    // For now, show a message
    alert('Publishing will begin automatically based on your schedule.')
  }

  const totalPosts = posts.length
  const daysLabel = duration === '1week' ? '1 week' : duration === '2weeks' ? '2 weeks' : '1 month'

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="page-head">
        <div>
          <h1>Social Media Campaigns</h1>
          <p>AI-powered content calendar with auto-publishing.</p>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(255,199,194,0.15)', border: '1px solid var(--rose)', borderRadius: 10, padding: '14px 20px', fontSize: 14, color: '#C03A1F', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="btn btn-soft btn-sm">Dismiss</button>
        </div>
      )}

      {/* Step 1: Setup */}
      {step === 'setup' && (
        <div className="wizard-card">
          <h2>Plan your campaign</h2>
          <p className="wizard-sub">Tell us about your business and campaign goals. AI will create a complete content calendar.</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div className="form-group">
              <label className="input-label">Business Name *</label>
              <input type="text" className="input" placeholder="Your company name" value={businessName} onChange={e => setBusinessName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="input-label">Brand Color</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} style={{ width: 40, height: 36, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }} />
                <input type="text" className="input" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} style={{ flex: 1 }} />
              </div>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="input-label">What does your business do? *</label>
            <textarea className="input" style={{ minHeight: 60, resize: 'vertical', fontFamily: 'inherit', fontSize: 14 }} placeholder="e.g., We provide life insurance solutions for families and small businesses..." value={businessDesc} onChange={e => setBusinessDesc(e.target.value)} />
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="input-label">Campaign Goal</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {GOAL_OPTIONS.map(g => (
                <button key={g} onClick={() => setGoal(g)} className={`btn btn-sm ${goal === g ? 'btn-primary' : 'btn-soft'}`} type="button">{g}</button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="input-label">Platforms</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {PLATFORM_OPTIONS.map(p => (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  type="button"
                  style={{
                    padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
                    border: platforms.includes(p.id) ? `2px solid ${PLATFORM_COLORS[p.id]}` : '1px solid var(--border)',
                    background: platforms.includes(p.id) ? `${PLATFORM_COLORS[p.id]}15` : 'white',
                    fontWeight: 600, fontSize: 13, color: 'var(--ink)',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 800, color: PLATFORM_COLORS[p.id] }}>{p.icon}</span>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div className="form-group">
              <label className="input-label">Duration</label>
              <select className="input" value={duration} onChange={e => setDuration(e.target.value as any)}>
                <option value="1week">1 Week</option>
                <option value="2weeks">2 Weeks</option>
                <option value="1month">1 Month</option>
              </select>
            </div>
            <div className="form-group">
              <label className="input-label">Frequency</label>
              <select className="input" value={frequency} onChange={e => setFrequency(e.target.value as any)}>
                <option value="daily">Daily</option>
                <option value="3xweek">3x per week</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            <div className="form-group">
              <label className="input-label">Tone</label>
              <input type="text" className="input" value={tone} onChange={e => setTone(e.target.value)} placeholder="Professional but friendly" />
            </div>
          </div>

          <button onClick={handleGeneratePlan} disabled={!businessName.trim() || !businessDesc.trim() || platforms.length === 0 || loading} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
            {loading ? 'Generating content plan...' : 'Generate Campaign Plan'}
          </button>
          {loading && (
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <div className="spinner" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>AI is planning your campaign. This takes 15-30 seconds...</div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Calendar / Review */}
      {step === 'calendar' && (
        <div>
          <div className="wizard-card" style={{ marginBottom: 20 }}>
            <h2>{campaignName}</h2>
            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--ink-soft)', flexWrap: 'wrap' }}>
              <span>{totalPosts} posts</span>
              <span>{daysLabel}</span>
              <span>{platforms.map(p => PLATFORM_OPTIONS.find(o => o.id === p)?.label).join(', ')}</span>
              <span style={{ fontWeight: 700, color: 'var(--mint-darker, #2d7a4f)' }}>{totalPosts} credits required</span>
            </div>
          </div>

          {/* Posts list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {posts.map((post, i) => {
              const isExpanded = expandedPost === i
              const platformColor = PLATFORM_COLORS[post.platform] ?? 'var(--ink)'
              const startDate = new Date()
              const postDate = new Date(startDate.getTime() + post.dayOffset * 86400000)

              return (
                <div key={i} style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden' }}>
                  <button
                    onClick={() => setExpandedPost(isExpanded ? null : i)}
                    style={{ width: '100%', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}
                  >
                    {/* Day badge */}
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--bg-soft)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase' }}>
                        {postDate.toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>
                        {postDate.getDate()}
                      </div>
                    </div>

                    {/* Platform badge */}
                    <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: `${platformColor}15`, color: platformColor, flexShrink: 0 }}>
                      {post.platform}
                    </span>

                    {/* Type */}
                    <span className="tag" style={{ fontSize: 11, flexShrink: 0 }}>{post.type}</span>

                    {/* Caption preview */}
                    <div style={{ flex: 1, fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {post.caption.split('\n')[0]}
                    </div>

                    {/* Time */}
                    <span style={{ fontSize: 12, color: 'var(--ink-light)', flexShrink: 0 }}>{post.bestTime}</span>

                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-light)" strokeWidth="2" style={{ flexShrink: 0, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div style={{ padding: '0 18px 18px', borderTop: '1px solid var(--border-light)' }}>
                      <div style={{ marginTop: 12 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)', marginBottom: 4, display: 'block' }}>Caption</label>
                        <textarea
                          value={post.caption}
                          onChange={e => updatePostCaption(i, e.target.value)}
                          className="input"
                          style={{ minHeight: 80, resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
                        />
                      </div>
                      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-light)' }}>
                        <strong>Image:</strong> {post.imagePrompt}
                      </div>
                      {post.hashtags.length > 0 && (
                        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {post.hashtags.map((tag, j) => (
                            <span key={j} style={{ fontSize: 11, color: platformColor }}>{tag}</span>
                          ))}
                        </div>
                      )}
                      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                        <button onClick={() => removePost(i)} className="btn btn-soft btn-sm" style={{ color: '#C03A1F' }}>Remove</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setStep('setup')} className="btn btn-soft" style={{ flex: 1 }}>&larr; Start Over</button>
            <button onClick={handleGeneratePlan} disabled={loading} className="btn btn-soft" style={{ flex: 1 }}>
              {loading ? 'Regenerating...' : 'Regenerate Plan'}
            </button>
            <button onClick={handleStartCampaign} disabled={loading || !posts.length} className="btn btn-primary" style={{ flex: 2 }}>
              {loading ? 'Starting...' : `Launch Campaign (${totalPosts} credits)`}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {step === 'done' && (
        <div className="wizard-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#128640;</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Campaign Launched!</h2>
          <p style={{ fontSize: 15, color: 'var(--ink-soft)', maxWidth: 500, margin: '0 auto 24px' }}>
            Your {totalPosts}-post campaign is being prepared. AI is generating graphics for each post. Once ready, posts will be published on schedule via AyrShare.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={() => { setStep('setup'); setPosts([]); setCampaignId(null) }} className="btn btn-primary">Create Another Campaign</button>
            <button onClick={() => window.location.href = '/dashboard'} className="btn btn-soft">Back to Dashboard</button>
          </div>
        </div>
      )}
    </div>
  )
}
