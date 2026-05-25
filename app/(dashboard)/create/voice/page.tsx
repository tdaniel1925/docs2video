'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import WizardProgress from '../_components/WizardProgress'
import CreditCost from '../_components/CreditCost'
import UpgradeModal from '../../../_components/UpgradeModal'
import { createClient } from '../../../_lib/supabase/client'
import { getUserTier, type PlanTier } from '../../../_lib/pricing'

const VOICE_OPTIONS = [
  { id: 'nova', name: 'Nova', description: 'Warm female' },
  { id: 'shimmer', name: 'Shimmer', description: 'Soft female' },
  { id: 'onyx', name: 'Onyx', description: 'Deep male' },
  { id: 'echo', name: 'Echo', description: 'Smooth male' },
  { id: 'alloy', name: 'Alloy', description: 'Neutral' },
  { id: 'fable', name: 'Fable', description: 'British male' },
]

const NARRATION_STYLES = [
  {
    id: 'solo' as const,
    title: 'Solo Narrator',
    description: 'A single professional voice tells your story',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
        <path d="M8 26c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'podcast' as const,
    title: 'Two-Person Conversation',
    description: 'Two voices discuss your topic naturally',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle cx="11" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
        <circle cx="21" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
        <path d="M4 26c0-3.9 3.1-7 7-7s7 3.1 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M14 26c0-3.9 3.1-7 7-7s7 3.1 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
]

const DETAIL_LEVELS = [
  { id: 'quick' as const, title: 'Quick', description: 'Under 60 seconds. Key highlights only.' },
  { id: 'standard' as const, title: 'Standard', description: '2-3 minutes. Covers all major points.' },
  { id: 'detailed' as const, title: 'Detailed', description: '5+ minutes. Deep dive into every detail.' },
]

export default function VoicePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const videoId = searchParams.get('id')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outputType, setOutputType] = useState<'video' | 'pptx' | 'pdf'>('video')

  const [narrationStyle, setNarrationStyle] = useState<'solo' | 'podcast'>('solo')
  const [voiceId, setVoiceId] = useState('nova')
  const [podcastVoice1, setPodcastVoice1] = useState('nova')
  const [podcastVoice2, setPodcastVoice2] = useState('onyx')
  const [styleAlreadyPicked, setStyleAlreadyPicked] = useState(false)
  const [playingSample, setPlayingSample] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  function playSample(samplePath: string) {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    if (playingSample === samplePath) { setPlayingSample(null); return }
    const audio = new Audio(samplePath)
    audio.onended = () => setPlayingSample(null)
    audio.play()
    audioRef.current = audio
    setPlayingSample(samplePath)
  }
  const [detailLevel, setDetailLevel] = useState<'quick' | 'standard' | 'detailed'>('standard')
  const [aiMusic, setAiMusic] = useState(false)
  const [userTier, setUserTier] = useState<PlanTier>('free')
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  useEffect(() => {
    if (!videoId) {
      router.replace('/create')
      return
    }
    async function loadDraft() {
      try {
        const res = await fetch(`/api/videos/draft?videoId=${videoId}`)
        if (!res.ok) throw new Error('Failed to load draft')
        const video = await res.json()
        const draft = video.draft_data
        if (!draft) throw new Error('No draft data')

        const ot = draft.outputType || video.output_type || 'video'
        setOutputType(ot)

        // Skip voice step for non-video outputs
        if (ot === 'pptx' || ot === 'pdf') {
          router.replace(`/create/script?id=${videoId}`)
          return
        }

        // Restore saved values
        if (draft.narrationStyle) setNarrationStyle(draft.narrationStyle)
        if (draft.voiceId) {
          setVoiceId(draft.voiceId)
          if (draft.narrationStyle === 'podcast') setPodcastVoice1(draft.voiceId)
        }
        if (draft.podcastVoice2) setPodcastVoice2(draft.podcastVoice2)
        if (draft.detailLevel) setDetailLevel(draft.detailLevel)
        if (draft.aiMusic !== undefined) setAiMusic(draft.aiMusic)
        if (draft.styleId) setStyleAlreadyPicked(true)
      } catch (err) {
        console.error('[voice] load error:', err)
        setError('Could not load your draft. Please go back and try again.')
      } finally {
        setLoading(false)
      }
    }
    loadDraft()
  }, [videoId, router])

  // Fetch user tier for detail level gating
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('subscription_status').eq('id', user.id).single().then(({ data }) => {
        if (data) setUserTier(getUserTier(data.subscription_status))
      })
    })
  }, [])

  function isDetailLevelAllowed(level: 'quick' | 'standard' | 'detailed'): boolean {
    if (level === 'quick') return true
    if (level === 'standard') return userTier !== 'free'
    // detailed requires pro+
    return userTier === 'pro' || userTier === 'business' || userTier === 'enterprise'
  }

  function handleDetailLevelClick(level: 'quick' | 'standard' | 'detailed') {
    if (isDetailLevelAllowed(level)) {
      setDetailLevel(level)
    } else {
      setShowUpgradeModal(true)
    }
  }

  async function handleNext() {
    if (!videoId) return
    setSaving(true)
    setError(null)
    try {
      const selectedVoice = narrationStyle === 'podcast' ? podcastVoice1 : voiceId
      const res = await fetch('/api/videos/draft', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          updates: {
            voiceId: selectedVoice,
            narrationStyle,
            detailLevel,
            aiMusic,
            podcastVoice2: narrationStyle === 'podcast' ? podcastVoice2 : undefined,
            step: 3,
          },
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      // Always go to script — style step removed from wizard
      router.push(`/create/script?id=${videoId}`)
    } catch (err) {
      console.error('[voice] save error:', err)
      setError('Failed to save. Please try again.')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.loadingText}>Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <WizardProgress currentStep={3} outputType={outputType} />

        <h1 style={styles.heading}>Voice &amp; Length</h1>
        <p style={styles.subheading}>Choose how your video sounds and feels</p>

        {error && <div style={styles.errorBanner}>{error}</div>}

        {/* Narration Style */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Narrator style</h2>
          <div style={styles.narrationGrid}>
            {NARRATION_STYLES.map((style) => {
              const selected = narrationStyle === style.id
              return (
                <button
                  key={style.id}
                  onClick={() => setNarrationStyle(style.id)}
                  style={{
                    ...styles.narrationCard,
                    ...(selected ? styles.narrationCardSelected : {}),
                  }}
                >
                  <div style={styles.narrationIcon}>{style.icon}</div>
                  <div style={styles.narrationContent}>
                    <span style={styles.narrationTitle}>{style.title}</span>
                    <span style={styles.narrationDesc}>{style.description}</span>
                  </div>
                  <button
                    style={styles.playBtn}
                    onClick={(e) => { e.stopPropagation(); playSample(style.id === 'solo' ? `/samples/solo-${voiceId}.mp3` : '/samples/podcast-sample.mp3') }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M4 3L13 8L4 13V3Z" fill="currentColor" />
                    </svg>
                  </button>
                </button>
              )
            })}
          </div>
        </section>

        {/* Voice Selection */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Choose a voice</h2>
          {narrationStyle === 'solo' ? (
            <div style={styles.voiceGrid}>
              {VOICE_OPTIONS.map((voice) => {
                const selected = voiceId === voice.id
                return (
                  <button
                    key={voice.id}
                    onClick={() => setVoiceId(voice.id)}
                    style={{
                      ...styles.voiceCard,
                      ...(selected ? styles.voiceCardSelected : {}),
                    }}
                  >
                    <span style={styles.voiceName}>{voice.name}</span>
                    <span style={styles.voiceDesc}>{voice.description}</span>
                    <span
                      onClick={(e) => { e.stopPropagation(); playSample(`/samples/solo-${voice.id}.mp3`) }}
                      style={{ fontSize: 11, color: playingSample === `/samples/solo-${voice.id}.mp3` ? 'var(--mint-darker, #0d9488)' : 'var(--ink-light)', cursor: 'pointer', marginTop: 4 }}
                    >
                      {playingSample === `/samples/solo-${voice.id}.mp3` ? '■ Stop' : '▶ Listen'}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div style={styles.podcastGrid}>
              <div style={styles.podcastSelector}>
                <label style={styles.podcastLabel}>Voice 1</label>
                <select
                  value={podcastVoice1}
                  onChange={(e) => setPodcastVoice1(e.target.value)}
                  style={styles.select}
                >
                  {VOICE_OPTIONS.map((v) => (
                    <option key={v.id} value={v.id}>{v.name} - {v.description}</option>
                  ))}
                </select>
              </div>
              <div style={styles.podcastSelector}>
                <label style={styles.podcastLabel}>Voice 2</label>
                <select
                  value={podcastVoice2}
                  onChange={(e) => setPodcastVoice2(e.target.value)}
                  style={styles.select}
                >
                  {VOICE_OPTIONS.map((v) => (
                    <option key={v.id} value={v.id}>{v.name} - {v.description}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </section>

        {/* Video Length */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Video length</h2>
          <div style={styles.lengthGrid}>
            {DETAIL_LEVELS.map((level) => {
              const selected = detailLevel === level.id
              const allowed = isDetailLevelAllowed(level.id)
              return (
                <button
                  key={level.id}
                  onClick={() => handleDetailLevelClick(level.id)}
                  style={{
                    ...styles.lengthCard,
                    ...(selected ? styles.lengthCardSelected : {}),
                    ...(!allowed ? { opacity: 0.7, position: 'relative' as const } : {}),
                  }}
                >
                  <span style={styles.lengthTitle}>
                    {!allowed && <span style={{ marginRight: 4 }}>&#128274;</span>}
                    {level.title}
                  </span>
                  <span style={styles.lengthDesc}>{level.description}</span>
                  {!allowed && (
                    <span style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 4, display: 'block' }}>
                      {level.id === 'standard' ? 'Starter+ plan' : 'Pro+ plan'}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* Background Music */}
        <section style={styles.section}>
          <div style={styles.musicRow}>
            <div>
              <h2 style={styles.sectionTitle}>Background music</h2>
              <p style={styles.musicDesc}>AI generates subtle, professional background music that fades in and out automatically</p>
            </div>
            <button
              onClick={() => setAiMusic(!aiMusic)}
              style={{
                ...styles.toggle,
                ...(aiMusic ? styles.toggleOn : {}),
              }}
              role="switch"
              aria-checked={aiMusic}
            >
              <div
                style={{
                  ...styles.toggleKnob,
                  ...(aiMusic ? styles.toggleKnobOn : {}),
                }}
              />
            </button>
          </div>
        </section>

        {/* Credit Cost */}
        <section style={styles.section}>
          <CreditCost
            outputType={outputType}
            detailLevel={detailLevel}
            narrationStyle={narrationStyle}
          />
        </section>

        {/* Navigation */}
        <div style={styles.navRow}>
          <button
            onClick={() => router.push(`/create/brand?id=${videoId}`)}
            style={styles.backBtn}
          >
            Back
          </button>
          <button
            onClick={handleNext}
            disabled={saving}
            style={{
              ...styles.nextBtn,
              ...(saving ? styles.nextBtnDisabled : {}),
            }}
          >
            {saving ? 'Saving...' : 'Next'}
          </button>
        </div>
      </div>
      <UpgradeModal open={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    padding: '24px 16px 48px',
    fontFamily: 'var(--font-sans, "Plus Jakarta Sans", sans-serif)',
  },
  container: {
    maxWidth: 720,
    margin: '0 auto',
  },
  heading: {
    fontSize: 30,
    fontWeight: 800,
    letterSpacing: '-0.03em',
    color: 'var(--ink, #1B3A5C)',
    margin: '16px 0 4px',
    fontFamily: 'inherit',
  },
  subheading: {
    fontSize: 15,
    color: 'var(--ink-soft, #3D5A7A)',
    marginBottom: 24,
  },
  loadingText: {
    textAlign: 'center' as const,
    padding: 48,
    fontSize: 15,
    color: 'var(--ink-light, #8899AA)',
  },
  errorBanner: {
    padding: '12px 16px',
    borderRadius: 10,
    background: '#FEF2F2',
    color: '#DC2626',
    fontSize: 14,
    marginBottom: 16,
    border: '1px solid #FECACA',
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--ink, #1B3A5C)',
    marginBottom: 12,
  },

  // Narration style cards
  narrationGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },
  narrationCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '20px 16px',
    borderRadius: 10,
    border: '2px solid var(--border-light, #e0e0e0)',
    background: 'white',
    cursor: 'pointer',
    textAlign: 'left' as const,
    fontFamily: 'inherit',
    transition: 'all 0.15s ease',
    position: 'relative' as const,
  },
  narrationCardSelected: {
    borderColor: '#C7E8A8',
    background: '#F0F9E8',
  },
  narrationIcon: {
    flexShrink: 0,
    color: 'var(--ink, #1B3A5C)',
  },
  narrationContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    flex: 1,
  },
  narrationTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--ink, #1B3A5C)',
  },
  narrationDesc: {
    fontSize: 13,
    color: 'var(--ink-soft, #3D5A7A)',
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: '1px solid var(--border-light, #e0e0e0)',
    background: 'var(--bg-soft, #F7F9FB)',
    color: 'var(--ink-light, #8899AA)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'not-allowed',
    opacity: 0.5,
    flexShrink: 0,
  },

  // Voice cards
  voiceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
  },
  voiceCard: {
    padding: '16px 14px',
    borderRadius: 10,
    border: '2px solid var(--border-light, #e0e0e0)',
    background: 'white',
    cursor: 'pointer',
    textAlign: 'center' as const,
    fontFamily: 'inherit',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
    transition: 'all 0.15s ease',
  },
  voiceCardSelected: {
    borderColor: '#C7E8A8',
    background: '#F0F9E8',
  },
  voiceName: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--ink, #1B3A5C)',
  },
  voiceDesc: {
    fontSize: 12,
    color: 'var(--ink-soft, #3D5A7A)',
  },

  // Podcast selectors
  podcastGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },
  podcastSelector: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  podcastLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--ink, #1B3A5C)',
  },
  select: {
    padding: '12px 14px',
    borderRadius: 10,
    border: '2px solid var(--border-light, #e0e0e0)',
    background: 'white',
    fontSize: 14,
    fontFamily: 'inherit',
    color: 'var(--ink, #1B3A5C)',
    cursor: 'pointer',
    outline: 'none',
  },

  // Length cards
  lengthGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
  },
  lengthCard: {
    padding: '18px 14px',
    borderRadius: 10,
    border: '2px solid var(--border-light, #e0e0e0)',
    background: 'white',
    cursor: 'pointer',
    textAlign: 'center' as const,
    fontFamily: 'inherit',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
    transition: 'all 0.15s ease',
  },
  lengthCardSelected: {
    borderColor: '#C7E8A8',
    background: '#F0F9E8',
  },
  lengthTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--ink, #1B3A5C)',
  },
  lengthDesc: {
    fontSize: 12,
    color: 'var(--ink-soft, #3D5A7A)',
    lineHeight: 1.4,
  },

  // Music toggle
  musicRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderRadius: 10,
    border: '1px solid var(--border-light, #e0e0e0)',
    background: 'white',
  },
  musicDesc: {
    fontSize: 13,
    color: 'var(--ink-soft, #3D5A7A)',
    marginTop: 4,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 10,
    border: 'none',
    background: 'var(--border-light, #e0e0e0)',
    cursor: 'pointer',
    position: 'relative' as const,
    transition: 'background 0.2s ease',
    flexShrink: 0,
    padding: 0,
  },
  toggleOn: {
    background: '#C7E8A8',
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 8,
    background: 'white',
    position: 'absolute' as const,
    top: 3,
    left: 3,
    transition: 'left 0.2s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
  },
  toggleKnobOn: {
    left: 23,
  },

  // Navigation
  navRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTop: '1px solid var(--border-light, #e0e0e0)',
    marginTop: 8,
  },
  backBtn: {
    padding: '12px 24px',
    borderRadius: 10,
    border: '1px solid var(--border-light, #e0e0e0)',
    background: 'white',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--ink-soft, #3D5A7A)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  nextBtn: {
    padding: '12px 32px',
    borderRadius: 10,
    border: 'none',
    background: '#C7E8A8',
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--ink, #1B3A5C)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity 0.15s ease',
  },
  nextBtnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
}
