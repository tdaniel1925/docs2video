'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import WizardProgress from '../_components/WizardProgress'
import { SLIDE_STYLES } from '../../../_lib/types'
import { autoSelectStyle } from '../../../_lib/style-picker'

/* Color palette for each style used to render mini preview swatches */
const STYLE_COLORS: Record<string, { bg: string; accent: string; text: string; bar: string }> = {
  'executive':        { bg: '#2C2C2C', accent: '#C9A84C', text: '#FFFFFF', bar: '#C9A84C' },
  'steampunk':        { bg: '#1E1610', accent: '#B87333', text: '#F5E6CC', bar: '#8B6914' },
  'social-grid':      { bg: '#FFFFFF', accent: '#FF6F61', text: '#333333', bar: '#FFB347' },
  'blue-steps':       { bg: '#F0F8FF', accent: '#00838F', text: '#004D40', bar: '#4DD0E1' },
  'isometric':        { bg: '#F5F5F5', accent: '#6C63FF', text: '#333333', bar: '#FF6584' },
  'flat-vector':      { bg: '#FFFFFF', accent: '#2196F3', text: '#333333', bar: '#4CAF50' },
  'doodle':           { bg: '#FFFBF0', accent: '#FF7043', text: '#5D4037', bar: '#66BB6A' },
  'watercolor':       { bg: '#FFF0F5', accent: '#CE93D8', text: '#4A148C', bar: '#80CBC4' },
  'neon-cyber':       { bg: '#0A0A0A', accent: '#00FFFF', text: '#FFFFFF', bar: '#FF00FF' },
  'line-art':         { bg: '#FFFFFF', accent: '#00897B', text: '#37474F', bar: '#B2DFDB' },
  'vintage-craft':    { bg: '#2C1E10', accent: '#D4A76A', text: '#F5E6CC', bar: '#8B5E3C' },
  'flat-cartoon':     { bg: '#FFFFFF', accent: '#FF5722', text: '#333333', bar: '#FFCA28' },
  'colorful-steps':   { bg: '#FFFFFF', accent: '#E91E63', text: '#333333', bar: '#00BCD4' },
  'timeline':         { bg: '#F5F5F5', accent: '#00796B', text: '#37474F', bar: '#B2DFDB' },
  'profile-resume':   { bg: '#FFF8E1', accent: '#D84315', text: '#3E2723', bar: '#FF8F00' },
  'anime-pop':        { bg: '#1A1A2E', accent: '#FF2E63', text: '#FFFFFF', bar: '#08D9D6' },
  'felt-craft':       { bg: '#E8E0D8', accent: '#E57373', text: '#4E342E', bar: '#81C784' },
  'botanical-warm':   { bg: '#FFF3E0', accent: '#6D4C41', text: '#3E2723', bar: '#A1887F' },
  'vintage-editorial':{ bg: '#F5F0E0', accent: '#1B5E20', text: '#1A1A1A', bar: '#C9A84C' },
  'torn-collage':     { bg: '#E0E0E0', accent: '#FF6D00', text: '#1A1A1A', bar: '#212121' },
  'inventor-box':     { bg: '#F5ECD7', accent: '#795548', text: '#3E2723', bar: '#B8860B' },
  'chalkboard':       { bg: '#2E3B2E', accent: '#FFEB3B', text: '#FFFFFF', bar: '#4FC3F7' },
  'cafe-realistic':   { bg: '#4E3524', accent: '#D4A76A', text: '#FFF8E1', bar: '#8D6E63' },
  'old-newspaper':    { bg: '#F5E6C8', accent: '#1A1A1A', text: '#333333', bar: '#8D6E63' },
  'paper-layers':     { bg: '#87CEEB', accent: '#1565C0', text: '#FFFFFF', bar: '#D7CCC8' },
  'street-graffiti':  { bg: '#757575', accent: '#FF1744', text: '#FFFFFF', bar: '#FFEA00' },
  'urban-chaos':      { bg: '#1A1A1A', accent: '#FFFFFF', text: '#EEEEEE', bar: '#FF6F00' },
  'urban-canvas':     { bg: '#FFD600', accent: '#1A1A1A', text: '#1A1A1A', bar: '#FFFFFF' },
  'neon-nightclub':   { bg: '#0D0D2B', accent: '#FF4081', text: '#FFFFFF', bar: '#448AFF' },
  'brick-blocks':     { bg: '#C8E6C9', accent: '#F44336', text: '#1A1A1A', bar: '#2196F3' },
  'cinematic-hud':    { bg: '#1A1A2E', accent: '#FFB300', text: '#E0E0E0', bar: '#00E5FF' },
  'commercial-pro':   { bg: '#0D47A1', accent: '#FFD600', text: '#FFFFFF', bar: '#FF6D00' },
  'americana-poster': { bg: '#F5E6C8', accent: '#B71C1C', text: '#1A1A1A', bar: '#1565C0' },
  'black-label':      { bg: '#0A0A0A', accent: '#C0C0C0', text: '#FFFFFF', bar: '#808080' },
  'fire-vibes':       { bg: '#0A0A0A', accent: '#FF6D00', text: '#FFFFFF', bar: '#FFB300' },
  'urban-friday':     { bg: '#1A1A1A', accent: '#FFD600', text: '#FFFFFF', bar: '#FFC107' },
  'summer-fest':      { bg: '#FFCDD2', accent: '#FFD600', text: '#333333', bar: '#81D4FA' },
  'indie-zine':       { bg: '#FFF8E1', accent: '#4CAF50', text: '#1A1A1A', bar: '#FF9800' },
  'red-neon':         { bg: '#0A0A0A', accent: '#FF1744', text: '#FFFFFF', bar: '#FFD700' },
  'editorial':        { bg: '#E8E8EC', accent: '#00AEEF', text: '#1A1A1A', bar: '#EC008C' },
  'rock-poster':      { bg: '#B71C1C', accent: '#FFFFFF', text: '#FFFFFF', bar: '#FFD600' },
  'street-grunge':    { bg: '#0D7377', accent: '#F5F0E1', text: '#FFFFFF', bar: '#1A1A1A' },
  'stock-certificate':{ bg: '#FFFFF0', accent: '#1B5E20', text: '#1A1A1A', bar: '#C9A84C' },
  'vintage-bond':     { bg: '#F5E6C8', accent: '#8B4513', text: '#1A1A1A', bar: '#B87333' },
  'art-deco':         { bg: '#0A0A0A', accent: '#C9A84C', text: '#FFFFFF', bar: '#FFD700' },
  'marble-gold':      { bg: '#F5F5F5', accent: '#C9A84C', text: '#333333', bar: '#E0E0E0' },
  'nightclub-flyer':  { bg: '#0A0A0A', accent: '#FF4081', text: '#FFFFFF', bar: '#00E5FF' },
  'concert-poster':   { bg: '#1A1A1A', accent: '#D32F2F', text: '#FFFFFF', bar: '#FFCDD2' },
  'movie-poster':     { bg: '#0D1B2A', accent: '#FF6D00', text: '#FFFFFF', bar: '#00838F' },
  'festival':         { bg: '#FF8A65', accent: '#CE93D8', text: '#FFFFFF', bar: '#FFD54F' },
  'medical-journal':  { bg: '#FFFFFF', accent: '#00897B', text: '#1A1A1A', bar: '#B2DFDB' },
  'legal-brief':      { bg: '#FFFFF5', accent: '#1A237E', text: '#1A237E', bar: '#C5CAE9' },
  'scientific-paper': { bg: '#FFFFFF', accent: '#1A237E', text: '#1A1A1A', bar: '#90CAF9' },
  'collage-scrapbook':{ bg: '#D7CCC8', accent: '#F48FB1', text: '#4E342E', bar: '#AED581' },
  'comic-book':       { bg: '#FFFFFF', accent: '#D32F2F', text: '#1A1A1A', bar: '#1976D2' },
  'chalkboard-v2':    { bg: '#2E4A2E', accent: '#FFEB3B', text: '#FFFFFF', bar: '#F48FB1' },
  'glassmorphism':    { bg: '#7B1FA2', accent: '#FFFFFF', text: '#FFFFFF', bar: '#2196F3' },
  'neubrutalism':     { bg: '#F5F5F0', accent: '#FFEB3B', text: '#1A1A1A', bar: '#FF4081' },
  'gradient-mesh':    { bg: '#0A0A0A', accent: '#7C4DFF', text: '#FFFFFF', bar: '#00E5FF' },
  'terminal':         { bg: '#000000', accent: '#00FF00', text: '#00FF00', bar: '#00CC00' },
  'newspaper':        { bg: '#F5F0E0', accent: '#1A1A1A', text: '#333333', bar: '#C5C5C5' },
  'travel-magazine':  { bg: '#1976D2', accent: '#FFD700', text: '#FFFFFF', bar: '#80DEEA' },
}

const DEFAULT_COLORS = { bg: '#F5F5F5', accent: '#6C63FF', text: '#333333', bar: '#FF6584' }

/** Renders a tiny visual preview swatch representing the style */
function StylePreviewSwatch({ styleId, size = 'small' }: { styleId: string; size?: 'small' | 'large' }) {
  const c = STYLE_COLORS[styleId] || DEFAULT_COLORS
  const isLarge = size === 'large'
  const w = isLarge ? 180 : 64
  const h = isLarge ? 110 : 44

  return (
    <div style={{
      width: w,
      height: h,
      borderRadius: 6,
      background: c.bg,
      border: '1px solid rgba(0,0,0,0.1)',
      overflow: 'hidden',
      position: 'relative',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      padding: isLarge ? 10 : 4,
      gap: isLarge ? 5 : 2,
    }}>
      {/* Title bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: isLarge ? 24 : 10,
        background: c.accent,
        opacity: 0.9,
      }} />
      {/* Fake text lines */}
      <div style={{
        width: isLarge ? '60%' : '55%',
        height: isLarge ? 6 : 3,
        borderRadius: 2,
        background: c.text,
        opacity: 0.5,
      }} />
      <div style={{
        width: isLarge ? '80%' : '75%',
        height: isLarge ? 4 : 2,
        borderRadius: 2,
        background: c.text,
        opacity: 0.25,
      }} />
      {/* Fake bar chart */}
      <div style={{
        display: 'flex',
        gap: isLarge ? 3 : 2,
        alignItems: 'flex-end',
        marginTop: isLarge ? 4 : 2,
      }}>
        {[0.5, 0.8, 0.35, 1, 0.65].map((ratio, i) => (
          <div key={i} style={{
            flex: 1,
            height: Math.round((isLarge ? 36 : 14) * ratio),
            borderRadius: 1,
            background: i % 2 === 0 ? c.accent : c.bar,
            opacity: 0.85,
          }} />
        ))}
      </div>
    </div>
  )
}

export default function StylePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const videoId = searchParams.get('id')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outputType, setOutputType] = useState<'video' | 'pptx' | 'pdf'>('video')

  const [selectedStyleId, setSelectedStyleId] = useState('executive')
  const [suggestedStyleId, setSuggestedStyleId] = useState('executive')
  const [browsing, setBrowsing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

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

        // Auto-select style from brand colors / industry
        const primaryColor = draft.inlineBrand?.primaryColor || null
        const suggested = autoSelectStyle(primaryColor, null)
        setSuggestedStyleId(suggested)

        // Restore saved style or use suggested
        if (draft.styleId) {
          setSelectedStyleId(draft.styleId)
        } else {
          setSelectedStyleId(suggested)
        }
      } catch (err) {
        console.error('[style] load error:', err)
        setError('Could not load your draft. Please go back and try again.')
      } finally {
        setLoading(false)
      }
    }
    loadDraft()
  }, [videoId, router])

  const suggestedStyle = useMemo(
    () => SLIDE_STYLES.find((s) => s.id === suggestedStyleId) || SLIDE_STYLES[0],
    [suggestedStyleId]
  )

  const selectedStyle = useMemo(
    () => SLIDE_STYLES.find((s) => s.id === selectedStyleId) || SLIDE_STYLES[0],
    [selectedStyleId]
  )

  const filteredStyles = useMemo(() => {
    if (!searchQuery.trim()) return SLIDE_STYLES
    const q = searchQuery.toLowerCase()
    return SLIDE_STYLES.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    )
  }, [searchQuery])

  const backPath =
    outputType === 'video'
      ? `/create/voice?id=${videoId}`
      : `/create/brand?id=${videoId}`

  const wizardStep = outputType === 'video' ? 4 : 3

  async function handleNext() {
    if (!videoId) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/videos/draft', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          updates: {
            styleId: selectedStyleId,
            step: wizardStep,
          },
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      router.push(`/create/script?id=${videoId}`)
    } catch (err) {
      console.error('[style] save error:', err)
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
        <WizardProgress currentStep={wizardStep} outputType={outputType} />

        <h1 style={styles.heading}>Choose your slide style</h1>
        <p style={styles.subheading}>Pick a visual style for your slides</p>

        {error && <div style={styles.errorBanner}>{error}</div>}

        {!browsing ? (
          /* Suggested style view */
          <section style={styles.section}>
            <div style={styles.suggestedCard}>
              <div style={styles.suggestedBadge}>Suggested for you</div>
              <div style={styles.suggestedPreviewWrap}>
                <StylePreviewSwatch styleId={suggestedStyle.id} size="large" />
              </div>
              <div style={styles.suggestedName}>{suggestedStyle.name}</div>
              <div style={styles.suggestedDesc}>{suggestedStyle.description}</div>
              <p style={styles.suggestedReason}>
                We suggest <strong>{suggestedStyle.name}</strong> based on your brand
              </p>
              <div style={styles.suggestedActions}>
                <button
                  onClick={() => {
                    setSelectedStyleId(suggestedStyleId)
                    handleNext()
                  }}
                  disabled={saving}
                  style={styles.primaryBtn}
                >
                  {saving ? 'Saving...' : 'Use this style'}
                </button>
                <button
                  onClick={() => setBrowsing(true)}
                  style={styles.secondaryBtn}
                >
                  Browse other styles
                </button>
              </div>
            </div>
          </section>
        ) : (
          /* Browse all styles */
          <section style={styles.section}>
            <div style={styles.searchRow}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search styles..."
                style={styles.searchInput}
              />
              <button
                onClick={() => {
                  setBrowsing(false)
                  setSearchQuery('')
                }}
                style={styles.backToSuggested}
              >
                Back to suggested
              </button>
            </div>

            {/* Currently selected */}
            {selectedStyleId !== suggestedStyleId && (
              <div style={styles.currentSelection}>
                Selected: <strong>{selectedStyle.name}</strong> - {selectedStyle.description}
              </div>
            )}

            <div style={styles.styleGrid}>
              {filteredStyles.map((style) => {
                const isSelected = selectedStyleId === style.id
                return (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyleId(style.id)}
                    style={{
                      ...styles.styleCard,
                      ...(isSelected ? styles.styleCardSelected : {}),
                    }}
                  >
                    <StylePreviewSwatch styleId={style.id} size="small" />
                    <div style={styles.styleInfo}>
                      <span style={styles.styleName}>{style.name}</span>
                      <span style={styles.styleDesc}>{style.description}</span>
                    </div>
                    {isSelected && (
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={styles.checkIcon}>
                        <circle cx="9" cy="9" r="8" fill="#C7E8A8" stroke="#7BC47F" strokeWidth="1.5" />
                        <path d="M5.5 9L8 11.5L12.5 7" stroke="#1B3A5C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>

            {filteredStyles.length === 0 && (
              <div style={styles.noResults}>No styles match your search</div>
            )}
          </section>
        )}

        {/* Navigation */}
        <div style={styles.navRow}>
          <button
            onClick={() => router.push(backPath)}
            style={styles.backBtn}
          >
            Back
          </button>
          {browsing && (
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
          )}
        </div>
      </div>
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

  // Suggested style card
  suggestedCard: {
    padding: '32px 28px',
    borderRadius: 10,
    border: '2px solid #C7E8A8',
    background: 'white',
    textAlign: 'center' as const,
  },
  suggestedBadge: {
    display: 'inline-block',
    padding: '4px 14px',
    borderRadius: 8,
    background: '#F0F9E8',
    color: '#3D7A3F',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.03em',
    textTransform: 'uppercase' as const,
    marginBottom: 16,
  },
  suggestedPreviewWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 16,
  },
  suggestedName: {
    fontSize: 24,
    fontWeight: 800,
    color: 'var(--ink, #1B3A5C)',
    fontFamily: 'inherit',
    letterSpacing: '-0.03em',
    marginBottom: 6,
  },
  suggestedDesc: {
    fontSize: 14,
    color: 'var(--ink-soft, #3D5A7A)',
    marginBottom: 12,
  },
  suggestedReason: {
    fontSize: 13,
    color: 'var(--ink-light, #8899AA)',
    marginBottom: 24,
  },
  suggestedActions: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
  },
  primaryBtn: {
    padding: '12px 28px',
    borderRadius: 10,
    border: 'none',
    background: '#C7E8A8',
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--ink, #1B3A5C)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  secondaryBtn: {
    padding: '12px 28px',
    borderRadius: 10,
    border: '1px solid var(--border-light, #e0e0e0)',
    background: 'white',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--ink-soft, #3D5A7A)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  // Browse styles
  searchRow: {
    display: 'flex',
    gap: 10,
    marginBottom: 16,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    padding: '12px 16px',
    borderRadius: 10,
    border: '2px solid var(--border-light, #e0e0e0)',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    background: 'white',
    color: 'var(--ink, #1B3A5C)',
  },
  backToSuggested: {
    padding: '10px 16px',
    borderRadius: 10,
    border: '1px solid var(--border-light, #e0e0e0)',
    background: 'white',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--ink-soft, #3D5A7A)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap' as const,
  },
  currentSelection: {
    padding: '10px 16px',
    borderRadius: 8,
    background: '#F0F9E8',
    fontSize: 13,
    color: 'var(--ink, #1B3A5C)',
    marginBottom: 16,
    border: '1px solid #C7E8A8',
  },
  styleGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 10,
  },
  styleCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 14px',
    borderRadius: 10,
    border: '2px solid var(--border-light, #e0e0e0)',
    background: 'white',
    cursor: 'pointer',
    textAlign: 'left' as const,
    fontFamily: 'inherit',
    transition: 'all 0.15s ease',
    position: 'relative' as const,
  },
  styleCardSelected: {
    borderColor: '#C7E8A8',
    background: '#F0F9E8',
  },
  /* styleThumbnail and styleInitial removed — replaced by StylePreviewSwatch */
  styleInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    flex: 1,
    minWidth: 0,
  },
  styleName: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--ink, #1B3A5C)',
  },
  styleDesc: {
    fontSize: 12,
    color: 'var(--ink-soft, #3D5A7A)',
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
  },
  checkIcon: {
    flexShrink: 0,
  },
  noResults: {
    textAlign: 'center' as const,
    padding: 32,
    fontSize: 14,
    color: 'var(--ink-light, #8899AA)',
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
