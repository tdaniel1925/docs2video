'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '../../_lib/supabase/client'
import type { Brand } from '../../_lib/types'

type SocialTab = 'brand' | 'create' | 'content'

const PLATFORM_META: Record<string, { icon: string; color: string; label: string }> = {
  linkedin: { icon: 'in', color: '#0077B5', label: 'LinkedIn' },
  twitter: { icon: 'X', color: '#000000', label: 'Twitter / X' },
  facebook: { icon: 'f', color: '#1877F2', label: 'Facebook' },
  instagram: { icon: 'IG', color: '#E4405F', label: 'Instagram' },
}

const VOICE_OPTIONS = ['professional', 'casual', 'witty', 'authoritative', 'educational']
const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: '3x/week', label: '3x per week' },
  { value: 'weekly', label: 'Weekly' },
]

export default function SocialMediaPage() {
  const [tab, setTab] = useState<SocialTab>('create')
  const [brand, setBrand] = useState<Brand | null>(null)
  const [socialVoice, setSocialVoice] = useState('professional')
  const [socialTopics, setSocialTopics] = useState<string[]>([])
  const [newTopic, setNewTopic] = useState('')
  const [postingFrequency, setPostingFrequency] = useState('3x/week')
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([])
  const [hasProfile, setHasProfile] = useState(false)
  const [brandSaving, setBrandSaving] = useState(false)
  const [brandSaved, setBrandSaved] = useState(false)

  // Create Post state
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [captionTopic, setCaptionTopic] = useState('')
  const [captions, setCaptions] = useState<Record<string, string>>({})
  const [generating, setGenerating] = useState(false)
  const [posting, setPosting] = useState(false)
  const [postResult, setPostResult] = useState<string | null>(null)

  // From Content state
  const [videos, setVideos] = useState<any[]>([])
  const [loadingVideos, setLoadingVideos] = useState(false)
  const [contentPosts, setContentPosts] = useState<any[]>([])
  const [generatingContent, setGeneratingContent] = useState<string | null>(null)
  const [selectedContentPlatform, setSelectedContentPlatform] = useState<string>('linkedin')
  const [postingContent, setPostingContent] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load brand
      const { data: b } = await supabase.from('brands').select('*').eq('user_id', user.id).eq('is_default', true).single()
      if (b) setBrand(b as Brand)

      // Load profile social settings
      try {
        const { data: p } = await supabase.from('profiles').select('social_voice, social_topics, posting_schedule, ayrshare_profile_key').eq('id', user.id).single()
        if (p) {
          setSocialVoice((p as any).social_voice ?? 'professional')
          setSocialTopics((p as any).social_topics ?? [])
          const schedule = (p as any).posting_schedule
          if (schedule?.frequency) setPostingFrequency(schedule.frequency)
          setHasProfile(!!(p as any).ayrshare_profile_key)
        }
      } catch { /* columns may not exist yet */ }

      // Load connected platforms (always runs, even if profile load fails)
      try {
        const res = await fetch('/api/social-accounts')
        const data = await res.json()
        if (data.platforms?.length > 0) {
          const connected = data.platforms.map((pl: any) => pl.platform)
          setConnectedPlatforms(connected)
          setHasProfile(true)
        } else if (data.connected) {
          setHasProfile(true)
        }
      } catch { /* ignore */ }
    }
    load()
  }, [])

  // Load videos for "From Content" tab
  useEffect(() => {
    if (tab === 'content' && videos.length === 0) {
      loadVideos()
    }
  }, [tab])

  async function loadVideos() {
    setLoadingVideos(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('videos')
      .select('id, title, thumbnail_url, created_at, status')
      .eq('user_id', user.id)
      .in('status', ['completed', 'ready'])
      .order('created_at', { ascending: false })
      .limit(20)
    setVideos(data || [])
    setLoadingVideos(false)
  }

  async function saveBrandSettings() {
    setBrandSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setBrandSaving(false); return }
    await supabase.from('profiles').update({
      social_voice: socialVoice,
      social_topics: socialTopics,
      posting_schedule: { frequency: postingFrequency, preferred_times: ['09:00', '12:00', '17:00'] },
    }).eq('id', user.id)
    setBrandSaving(false)
    setBrandSaved(true)
    setTimeout(() => setBrandSaved(false), 3000)
  }

  function addTopic() {
    const t = newTopic.trim()
    if (t && !socialTopics.includes(t)) {
      setSocialTopics([...socialTopics, t])
      setNewTopic('')
    }
  }

  function removeTopic(topic: string) {
    setSocialTopics(socialTopics.filter(t => t !== topic))
  }

  function togglePlatform(platform: string) {
    setSelectedPlatforms(prev =>
      prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]
    )
  }

  async function generateCaptions() {
    if (!captionTopic.trim() || selectedPlatforms.length === 0) return
    setGenerating(true)
    setCaptions({})
    setPostResult(null)
    try {
      const res = await fetch('/api/social-media/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'captions', topic: captionTopic, platforms: selectedPlatforms }),
      })
      const data = await res.json()
      if (data.captions) {
        setCaptions(data.captions)
      } else {
        setPostResult(data.error || 'Failed to generate captions')
      }
    } catch {
      setPostResult('Failed to generate captions')
    }
    setGenerating(false)
  }

  async function postNow() {
    if (Object.keys(captions).length === 0) return
    setPosting(true)
    setPostResult(null)
    try {
      // Post each platform's caption
      for (const platform of Object.keys(captions)) {
        const res = await fetch('/api/social-media/post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caption: captions[platform], platforms: [platform] }),
        })
        const data = await res.json()
        if (!res.ok) {
          setPostResult(data.error || 'Failed to post')
          setPosting(false)
          return
        }
      }
      setPostResult('Posted successfully to all platforms!')
      setCaptions({})
      setCaptionTopic('')
    } catch {
      setPostResult('Failed to post')
    }
    setPosting(false)
  }

  async function generateFromContent(videoId: string) {
    setGeneratingContent(videoId)
    setContentPosts([])
    try {
      const res = await fetch('/api/social-media/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'from-content', videoId }),
      })
      const data = await res.json()
      if (data.posts) {
        setContentPosts(data.posts)
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to generate posts' })
      }
    } catch {
      setStatusMsg({ type: 'error', text: 'Failed to generate posts' })
    }
    setGeneratingContent(null)
  }

  async function postContentItem(caption: string) {
    if (!caption || connectedPlatforms.length === 0) return
    setPostingContent(true)
    try {
      const res = await fetch('/api/social-media/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption, platforms: [selectedContentPlatform] }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatusMsg({ type: 'success', text: 'Posted successfully!' })
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to post' })
      }
    } catch {
      setStatusMsg({ type: 'error', text: 'Failed to post' })
    }
    setPostingContent(false)
  }

  const tabs: { id: SocialTab; label: string }[] = [
    { id: 'brand', label: 'Brand & Setup' },
    { id: 'create', label: 'Create Post' },
    { id: 'content', label: 'From Your Content' },
  ]

  if (!hasProfile) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', padding: '80px 20px' }}>
        <h1 style={{ marginBottom: 8 }}>Social Media Hub</h1>
        <p style={{ color: 'var(--ink-soft)', marginBottom: 32, fontSize: 15 }}>
          Connect your social media accounts to start posting directly from Docs2Video.
        </p>
        <Link href="/settings?tab=integrations" className="btn btn-primary">
          Connect Social Accounts in Settings
        </Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="page-head">
        <div>
          <h1>Social Media</h1>
          <p>Create and publish social posts powered by your brand and content.</p>
        </div>
      </div>

      {statusMsg && (
        <div style={{ borderRadius: 10, padding: '10px 16px', fontSize: 13, marginBottom: 12, fontWeight: 600, background: statusMsg.type === 'error' ? '#fde8e8' : 'rgba(199,232,168,0.2)', color: statusMsg.type === 'error' ? '#b91c1c' : '#2d8a4e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {statusMsg.text}
          <button onClick={() => setStatusMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'inherit', lineHeight: 1 }}>&times;</button>
        </div>
      )}

      {/* Tabs */}
      <div className="settings-tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`settings-tab${tab === t.id ? ' active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== BRAND & SETUP TAB ===== */}
      {tab === 'brand' && (
        <div>
          {/* Brand Info */}
          {brand && (
            <div className="settings-card">
              <h3>Your Brand</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                {(brand.logo_file_url || brand.logo_url) && (
                  <img
                    src={brand.logo_file_url ?? brand.logo_url!}
                    alt="Logo"
                    style={{ height: 48, width: 'auto', maxWidth: 120, borderRadius: 8, objectFit: 'contain', border: '1px solid var(--border-light)', padding: 4, background: 'white' }}
                  />
                )}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{brand.name}</div>
                  {brand.industry && <div style={{ fontSize: 13, color: 'var(--ink-soft)', textTransform: 'capitalize' }}>{brand.industry}</div>}
                  {brand.tone && <div style={{ fontSize: 12, color: 'var(--ink-light)' }}>Tone: {brand.tone}</div>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[brand.primary_color, brand.secondary_color, brand.accent_color].map((c, i) => (
                  <div key={i} style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: c?.toLowerCase() === '#ffffff' ? '1.5px solid var(--border)' : 'none' }} />
                ))}
              </div>
            </div>
          )}

          {/* Social Voice */}
          <div className="settings-card">
            <h3>Social Voice</h3>
            <p className="ssub">How should your social posts sound?</p>
            <div className="form-group">
              <select className="input-select" value={socialVoice} onChange={e => setSocialVoice(e.target.value)}>
                {VOICE_OPTIONS.map(v => (
                  <option key={v} value={v} style={{ textTransform: 'capitalize' }}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Content Topics */}
          <div className="settings-card">
            <h3>Content Topics</h3>
            <p className="ssub">What topics do you want to post about? AI will use these as content pillars.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {socialTopics.map(topic => (
                <span
                  key={topic}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                    background: 'rgba(199,232,168,0.2)', color: 'var(--ink)',
                  }}
                >
                  {topic}
                  <button
                    onClick={() => removeTopic(topic)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--ink-light)', padding: 0, lineHeight: 1 }}
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                value={newTopic}
                onChange={e => setNewTopic(e.target.value)}
                placeholder="Add a topic..."
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTopic() } }}
                style={{ flex: 1 }}
              />
              <button className="btn btn-soft btn-sm" onClick={addTopic}>Add</button>
            </div>
          </div>

          {/* Posting Schedule */}
          <div className="settings-card">
            <h3>Posting Schedule</h3>
            <p className="ssub">How often do you want to post?</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {FREQUENCY_OPTIONS.map(f => (
                <button
                  key={f.value}
                  className={`btn btn-sm ${postingFrequency === f.value ? 'btn-primary' : 'btn-soft'}`}
                  onClick={() => setPostingFrequency(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Save */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
            <button className="btn btn-primary" onClick={saveBrandSettings} disabled={brandSaving}>
              {brandSaving ? 'Saving...' : 'Save Settings'}
            </button>
            {brandSaved && <span style={{ fontSize: 13, color: 'var(--mint-darker)', fontWeight: 600 }}>Saved!</span>}
          </div>
        </div>
      )}

      {/* ===== CREATE POST TAB ===== */}
      {tab === 'create' && (
        <div>
          {connectedPlatforms.length === 0 && (
            <div className="settings-card" style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--ink-soft)', marginBottom: 12 }}>No social accounts connected yet.</p>
              <Link href="/settings" className="btn btn-primary btn-sm">Connect in Settings</Link>
            </div>
          )}

          {/* Platform Select */}
          <div className="settings-card">
            <h3>Select Platforms</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(PLATFORM_META).map(([key, meta]) => {
                const isConnected = connectedPlatforms.includes(key)
                const isSelected = selectedPlatforms.includes(key)
                return (
                  <button
                    key={key}
                    onClick={() => isConnected && togglePlatform(key)}
                    disabled={!isConnected}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 14px', borderRadius: 10,
                      border: isSelected ? `2px solid ${meta.color}` : '1px solid var(--border-light)',
                      background: isSelected ? `${meta.color}10` : 'white',
                      cursor: isConnected ? 'pointer' : 'not-allowed',
                      opacity: isConnected ? 1 : 0.4,
                      fontSize: 13, fontWeight: 600, color: 'var(--ink)',
                    }}
                  >
                    <span style={{ width: 24, height: 24, borderRadius: 6, background: `${meta.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: meta.color }}>
                      {meta.icon}
                    </span>
                    {meta.label}
                    {!isConnected && <span style={{ fontSize: 10, color: 'var(--ink-light)' }}>(not connected)</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Caption Input */}
          <div className="settings-card">
            <h3>What do you want to post about?</h3>
            <div className="form-group">
              <textarea
                className="input"
                value={captionTopic}
                onChange={e => setCaptionTopic(e.target.value)}
                placeholder="Describe your post topic, e.g. 'Tips for choosing the right insurance policy for families with young children'"
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                className="btn btn-primary"
                onClick={generateCaptions}
                disabled={generating || !captionTopic.trim() || selectedPlatforms.length === 0}
              >
                {generating ? 'Generating...' : 'Generate Captions'}
              </button>
              <span style={{ fontSize: 12, color: 'var(--ink-light)' }}>
                25 credits per generation | 25 credits per platform post
              </span>
            </div>
          </div>

          {/* Generated Captions */}
          {Object.keys(captions).length > 0 && (
            <div>
              {Object.entries(captions).map(([platform, text]) => {
                const meta = PLATFORM_META[platform]
                return (
                  <div key={platform} className="settings-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ width: 28, height: 28, borderRadius: 7, background: `${meta?.color || '#666'}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: meta?.color || '#666' }}>
                        {meta?.icon || platform[0].toUpperCase()}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{meta?.label || platform}</span>
                    </div>
                    <textarea
                      className="input"
                      value={text}
                      onChange={e => setCaptions({ ...captions, [platform]: e.target.value })}
                      rows={4}
                      style={{ resize: 'vertical', fontSize: 13 }}
                    />
                  </div>
                )
              })}

              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button className="btn btn-primary" onClick={postNow} disabled={posting}>
                  {posting ? 'Posting...' : 'Post Now'}
                </button>
              </div>
            </div>
          )}

          {/* Result message */}
          {postResult && (
            <div style={{
              marginTop: 16, padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              background: postResult.includes('success') ? 'rgba(199,232,168,0.2)' : '#fde8e8',
              color: postResult.includes('success') ? 'var(--mint-darker)' : '#c03a1f',
            }}>
              {postResult}
            </div>
          )}
        </div>
      )}

      {/* ===== FROM YOUR CONTENT TAB ===== */}
      {tab === 'content' && (
        <div>
          {loadingVideos ? (
            <div className="settings-card" style={{ textAlign: 'center' }}>
              <p className="ssub">Loading your content...</p>
            </div>
          ) : videos.length === 0 ? (
            <div className="settings-card" style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--ink-soft)', marginBottom: 12 }}>No completed videos yet.</p>
              <Link href="/create" className="btn btn-primary btn-sm">Create Your First Video</Link>
            </div>
          ) : (
            <>
              <div className="settings-card">
                <h3>Your Videos</h3>
                <p className="ssub">Generate social posts from your existing content. 25 credits per generation.</p>
              </div>
              {videos.map(video => (
                <div key={video.id} className="settings-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {video.thumbnail_url && (
                    <img
                      src={video.thumbnail_url}
                      alt=""
                      style={{ width: 80, height: 45, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {video.title || 'Untitled'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-light)' }}>
                      {new Date(video.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => generateFromContent(video.id)}
                    disabled={generatingContent === video.id}
                    style={{ flexShrink: 0 }}
                  >
                    {generatingContent === video.id ? 'Generating...' : 'Generate Posts'}
                  </button>
                </div>
              ))}
            </>
          )}

          {/* Content-generated posts */}
          {contentPosts.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div className="settings-card">
                <h3>Generated Posts</h3>
                <p className="ssub">Edit and post to your connected accounts.</p>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {Object.entries(PLATFORM_META).map(([key, meta]) => (
                    <button
                      key={key}
                      className={`btn btn-sm ${selectedContentPlatform === key ? 'btn-primary' : 'btn-soft'}`}
                      onClick={() => setSelectedContentPlatform(key)}
                      style={{ fontSize: 12 }}
                    >
                      {meta.label}
                    </button>
                  ))}
                </div>
              </div>
              {contentPosts.map((post, idx) => {
                const caption = post[selectedContentPlatform] || post.linkedin || ''
                return (
                  <div key={idx} className="settings-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: 'var(--bg-soft)', color: 'var(--ink-soft)', textTransform: 'capitalize',
                      }}>
                        {post.angle}
                      </span>
                    </div>
                    <textarea
                      className="input"
                      defaultValue={caption}
                      rows={4}
                      style={{ resize: 'vertical', fontSize: 13, marginBottom: 10 }}
                      id={`content-post-${idx}`}
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={postingContent || !connectedPlatforms.includes(selectedContentPlatform)}
                      onClick={() => {
                        const el = document.getElementById(`content-post-${idx}`) as HTMLTextAreaElement
                        postContentItem(el?.value || caption)
                      }}
                    >
                      {postingContent ? 'Posting...' : `Post to ${PLATFORM_META[selectedContentPlatform]?.label || selectedContentPlatform}`}
                    </button>
                    {!connectedPlatforms.includes(selectedContentPlatform) && (
                      <span style={{ fontSize: 11, color: 'var(--ink-light)', marginLeft: 8 }}>
                        Not connected — <Link href="/settings" style={{ color: 'var(--mint-darker)' }}>connect in Settings</Link>
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
