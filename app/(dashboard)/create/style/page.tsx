'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import WizardProgress from '../_components/WizardProgress'
import { SLIDE_STYLES } from '../../../_lib/types'
import { autoSelectStyle } from '../../../_lib/style-picker'

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
                    <div style={styles.styleThumbnail}>
                      <span style={styles.styleInitial}>{style.name.charAt(0)}</span>
                    </div>
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
    background: '#F4F1EC',
    padding: '24px 16px 48px',
    fontFamily: 'var(--font-sans, "Plus Jakarta Sans", sans-serif)',
  },
  container: {
    maxWidth: 720,
    margin: '0 auto',
  },
  heading: {
    fontSize: 28,
    fontWeight: 800,
    color: 'var(--ink, #1B3A5C)',
    margin: '16px 0 4px',
    fontFamily: 'var(--font-serif, "Instrument Serif", serif)',
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
  suggestedName: {
    fontSize: 24,
    fontWeight: 800,
    color: 'var(--ink, #1B3A5C)',
    fontFamily: 'var(--font-serif, "Instrument Serif", serif)',
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
  styleThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
    background: 'var(--bg-soft, #F7F9FB)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    border: '1px solid var(--border-light, #e0e0e0)',
  },
  styleInitial: {
    fontSize: 18,
    fontWeight: 800,
    color: 'var(--ink-light, #8899AA)',
    fontFamily: 'var(--font-serif, "Instrument Serif", serif)',
  },
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
