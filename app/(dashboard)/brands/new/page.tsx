'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createBrand } from '../../../_actions/brands'
import { downscaleImage } from '../../../_lib/image-resize'
import { useBrand } from '../../../_components/BrandProvider'
import { usePasteImage, pasteKeyLabel } from '../../../_components/usePasteImage'

const COLOR_LABELS: Record<string, string> = {
  primary_color: 'Primary',
  secondary_color: 'Secondary',
  accent_color: 'Accent',
  background_color: 'Background',
  text_color: 'Text',
}

const COLOR_ROLES: Record<string, string> = {
  primary_color: 'Headers · CTAs',
  secondary_color: 'Highlights',
  accent_color: 'Tags · Badges',
  background_color: 'Canvas',
  text_color: 'Body copy',
}

interface BrandGuideData {
  companyName?: string
  tagline?: string
  description?: string
  industry?: string
  tone?: string
  targetAudience?: string
  primaryColor?: string
  secondaryColor?: string
  accentColor?: string
  backgroundColor?: string
  textColor?: string
  logoUrl?: string
  fonts?: string[]
  brandValues?: string[]
  services?: string[]
  uniqueSellingPoints?: string[]
  contentThemes?: string[]
  socialMediaBio?: string
  hashtagSuggestions?: string[]
  toneGuide?: {
    doSay?: string[]
    dontSay?: string[]
    samplePosts?: string[]
  }
  competitorNotes?: string
  colorPsychology?: string
  socialLinks?: Record<string, string>
}

/**
 * Convert a hex color to HSL components.
 */
function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

/**
 * Convert HSL to hex color.
 */
function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360
  s = Math.max(0, Math.min(100, s)) / 100
  l = Math.max(0, Math.min(100, l)) / 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * Math.max(0, Math.min(1, color))).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/**
 * Derive secondary and accent colors from a primary color.
 * Secondary: analogous (shifted hue +30), slightly lighter.
 * Accent: complementary-adjacent (shifted hue +150), boosted saturation.
 */
function deriveColors(primary: string): { secondary: string; accent: string } {
  const [h, s, l] = hexToHsl(primary)
  const secondary = hslToHex(h + 30, Math.min(s + 10, 100), Math.min(l + 15, 85))
  const accent = hslToHex(h + 150, Math.min(s + 20, 100), Math.max(Math.min(l + 5, 70), 40))
  return { secondary, accent }
}

function BrandScrapingProgress() {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setElapsed(prev => prev + 1), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div style={{ marginTop: 16, padding: '20px 0' }}>
      <div style={{ maxWidth: 340, height: 5, background: 'var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{
          height: '100%', borderRadius: 10, background: 'var(--mint)',
          transition: 'width 1s ease',
          width: elapsed < 3 ? '10%' : elapsed < 8 ? '30%' : elapsed < 15 ? '55%' : elapsed < 25 ? '78%' : elapsed < 40 ? '90%' : '95%',
        }} />
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
        {elapsed < 3 ? 'Scanning website...' :
         elapsed < 8 ? 'Analyzing brand identity...' :
         elapsed < 15 ? 'Extracting colors and visual elements...' :
         elapsed < 25 ? 'Detecting voice and tone...' :
         elapsed < 40 ? 'Compiling brand guide...' :
         'Almost done \u2014 finishing up...'}
      </p>
      <p style={{ marginTop: 6, fontSize: 12, color: 'var(--ink-light)' }}>
        {elapsed}s elapsed
      </p>
    </div>
  )
}

export default function NewBrandPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [brandName, setBrandName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')

  // Profile type (Person | Company)
  const storefront = useBrand()
  const [profileType, setProfileType] = useState<'person' | 'company'>('company')
  const [personRole, setPersonRole] = useState('')
  const [introLine, setIntroLine] = useState('')
  const [showNameOnSlides, setShowNameOnSlides] = useState(true)
  const [photoPlacement, setPhotoPlacement] = useState('auto')
  const [photoUrl, setPhotoUrl] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Contact info (used on closing card; persisted into brand_guide_data)
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactWebsite, setContactWebsite] = useState('')

  // Company logo toggle
  const [showLogo, setShowLogo] = useState(true)
  const [primaryColor, setPrimaryColor] = useState('#1B365D')
  const [colors, setColors] = useState({
    primary_color: '#1B365D',
    secondary_color: '#4A90D9',
    accent_color: '#FFB347',
    background_color: '#0a1628',
    text_color: '#FFFFFF',
  })
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [userEditedAdvancedColors, setUserEditedAdvancedColors] = useState(false)

  // Website scraper state
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scraped, setScraped] = useState(false)
  const [brandGuide, setBrandGuide] = useState<BrandGuideData | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})

  // Auto-derive secondary and accent colors when primary changes (unless user manually edited)
  useEffect(() => {
    if (!userEditedAdvancedColors) {
      const derived = deriveColors(primaryColor)
      setColors(prev => ({
        ...prev,
        primary_color: primaryColor,
        secondary_color: derived.secondary,
        accent_color: derived.accent,
      }))
    } else {
      setColors(prev => ({ ...prev, primary_color: primaryColor }))
    }
  }, [primaryColor, userEditedAdvancedColors])

  function toggleSection(key: string) {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleScrape() {
    if (!websiteUrl.trim()) return
    setScraping(true)
    setError(null)
    setScraped(false)

    try {
      const res = await fetch('/api/scrape-brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: websiteUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scraping failed')

      // Auto-fill form fields
      setBrandName(data.companyName ?? '')
      if (data.logoUrl) setLogoUrl(data.logoUrl)
      const newPrimary = data.primaryColor ?? '#1B365D'
      setPrimaryColor(newPrimary)
      setUserEditedAdvancedColors(true) // Scraper provides its own palette
      setColors({
        primary_color: newPrimary,
        secondary_color: data.secondaryColor ?? '#4A90D9',
        accent_color: data.accentColor ?? '#FFB347',
        background_color: data.backgroundColor ?? '#0a1628',
        text_color: data.textColor ?? '#FFFFFF',
      })
      setBrandGuide(data)
      setScraped(true)
      setExpandedSections({ identity: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze website')
    }
    setScraping(false)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    const result = await createBrand(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  // Only while the headshot field is on screen. A company profile has no
  // photo to paste into, and binding a listener that quietly discards what you
  // pasted is how a feature gets reported as broken.
  usePasteImage((f) => { void handlePhotoUpload(f) }, profileType === 'person')

  async function handlePhotoUpload(file: File) {
    setPhotoUploading(true)
    setPhotoError(null)
    try {
      const upload = await downscaleImage(file, 1024, 0.85)
      const fd = new FormData()
      fd.append('file', upload, upload.name)
      const res = await fetch('/api/brands/photo', { method: 'POST', body: fd })
      if (!res.ok) {
        let msg = `Upload failed (${res.status})`
        try { const d = await res.json(); if (d?.error) msg = d.error } catch { /* non-JSON */ }
        throw new Error(msg)
      }
      const data = await res.json()
      setPhotoUrl(data.url)
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setPhotoUploading(false)
    }
  }

  const SectionHeader = ({ id, title, icon }: { id: string; title: string; icon: string }) => (
    <button
      type="button"
      onClick={() => toggleSection(id)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 0', border: 'none', background: 'none', cursor: 'pointer',
        borderBottom: expandedSections[id] ? '1px solid var(--border)' : 'none',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
        <span style={{ fontSize: 18 }}>{icon}</span> {title}
      </span>
      <span style={{ fontSize: 18, color: 'var(--ink-light)', transition: 'transform 0.2s', transform: expandedSections[id] ? 'rotate(180deg)' : 'rotate(0)' }}>
        &#9662;
      </span>
    </button>
  )

  const Pill = ({ text }: { text: string }) => (
    <span style={{
      display: 'inline-block', padding: '5px 12px', borderRadius: 8,
      background: 'var(--bg-soft)', fontSize: 13, fontWeight: 500, color: 'var(--ink)',
    }}>
      {text}
    </span>
  )

  const advancedColorKeys = ['secondary_color', 'accent_color', 'background_color', 'text_color'] as const

  return (
    <div>
      <Link href="/brands" className="back-link">&larr; Back to profiles</Link>

      {/* Website Scraper — Company profiles only */}
      {profileType === 'company' && (
      <div className="wizard-card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginBottom: 4 }}>Import from <em>website</em></h2>
        <p className="wizard-sub">Enter your website URL and we&apos;ll create a comprehensive brand guide with colors, voice, content strategy, and more.</p>

        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            className="input"
            placeholder="www.youragency.com"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleScrape() } }}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={handleScrape}
            disabled={scraping || !websiteUrl.trim()}
            className="btn btn-primary"
            style={{ flexShrink: 0 }}
          >
            {scraping ? 'Analyzing...' : 'Analyze brand'}
          </button>
        </div>

        {scraping && (
          <BrandScrapingProgress />
        )}

        {scraped && brandGuide && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--mint-darker)" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--mint-darker)' }}>Brand guide generated!</span>
            </div>

            {/* Brand Guide Preview */}
            <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>

              {/* Identity */}
              <div style={{ padding: '0 16px', borderBottom: '1px solid var(--border)' }}>
                <SectionHeader id="identity" title="Brand Identity" icon="&#127919;" />
                {expandedSections.identity && (
                  <div style={{ padding: '12px 0 16px' }}>
                    {brandGuide.tagline && (
                      <p style={{ fontSize: 16, fontStyle: 'italic', color: 'var(--ink)', marginBottom: 10, fontWeight: 500 }}>
                        &ldquo;{brandGuide.tagline}&rdquo;
                      </p>
                    )}
                    {brandGuide.description && (
                      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 12, lineHeight: 1.6 }}>{brandGuide.description}</p>
                    )}
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
                      {brandGuide.industry && <span>Industry: <strong>{brandGuide.industry}</strong></span>}
                      {brandGuide.targetAudience && <span>Audience: <strong>{brandGuide.targetAudience}</strong></span>}
                    </div>
                  </div>
                )}
              </div>

              {/* Brand Voice */}
              <div style={{ padding: '0 16px', borderBottom: '1px solid var(--border)' }}>
                <SectionHeader id="voice" title="Brand Voice & Tone" icon="&#128172;" />
                {expandedSections.voice && (
                  <div style={{ padding: '12px 0 16px' }}>
                    {brandGuide.tone && (
                      <p style={{ fontSize: 14, marginBottom: 12 }}>Tone: <strong style={{ textTransform: 'capitalize' }}>{brandGuide.tone}</strong></p>
                    )}
                    {brandGuide.toneGuide && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                        {brandGuide.toneGuide.doSay?.length ? (
                          <div style={{ padding: 12, borderRadius: 10, background: 'rgba(52,211,153,0.08)' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mint-darker)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Do Say</div>
                            {brandGuide.toneGuide.doSay.map((s, i) => (
                              <div key={i} style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 4, paddingLeft: 12, position: 'relative' }}>
                                <span style={{ position: 'absolute', left: 0, color: 'var(--mint-darker)' }}>+</span> {s}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {brandGuide.toneGuide.dontSay?.length ? (
                          <div style={{ padding: 12, borderRadius: 10, background: 'rgba(239,68,68,0.06)' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Don&apos;t Say</div>
                            {brandGuide.toneGuide.dontSay.map((s, i) => (
                              <div key={i} style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 4, paddingLeft: 12, position: 'relative' }}>
                                <span style={{ position: 'absolute', left: 0, color: '#dc2626' }}>-</span> {s}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )}
                    {brandGuide.toneGuide?.samplePosts?.length ? (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-light)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Sample Posts</div>
                        {brandGuide.toneGuide.samplePosts.map((post, i) => (
                          <div key={i} style={{
                            padding: 12, borderRadius: 10, background: 'var(--bg-soft)', marginBottom: 8,
                            fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, fontStyle: 'italic',
                          }}>
                            {post}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Colors & Psychology */}
              <div style={{ padding: '0 16px', borderBottom: '1px solid var(--border)' }}>
                <SectionHeader id="colors" title="Color Psychology" icon="&#127912;" />
                {expandedSections.colors && brandGuide.colorPsychology && (
                  <div style={{ padding: '12px 0 16px' }}>
                    <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6 }}>{brandGuide.colorPsychology}</p>
                  </div>
                )}
              </div>

              {/* Fonts */}
              {brandGuide.fonts?.length ? (
                <div style={{ padding: '0 16px', borderBottom: '1px solid var(--border)' }}>
                  <SectionHeader id="fonts" title="Typography" icon="&#128221;" />
                  {expandedSections.fonts && (
                    <div style={{ padding: '12px 0 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {brandGuide.fonts.map((f, i) => <Pill key={i} text={f} />)}
                    </div>
                  )}
                </div>
              ) : null}

              {/* Core Values */}
              {brandGuide.brandValues?.length ? (
                <div style={{ padding: '0 16px', borderBottom: '1px solid var(--border)' }}>
                  <SectionHeader id="values" title="Core Values" icon="&#11088;" />
                  {expandedSections.values && (
                    <div style={{ padding: '12px 0 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {brandGuide.brandValues.map((v, i) => <Pill key={i} text={v} />)}
                    </div>
                  )}
                </div>
              ) : null}

              {/* Services */}
              {brandGuide.services?.length ? (
                <div style={{ padding: '0 16px', borderBottom: '1px solid var(--border)' }}>
                  <SectionHeader id="services" title="Services / Products" icon="&#128188;" />
                  {expandedSections.services && (
                    <div style={{ padding: '12px 0 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {brandGuide.services.map((s, i) => <Pill key={i} text={s} />)}
                    </div>
                  )}
                </div>
              ) : null}

              {/* USPs */}
              {brandGuide.uniqueSellingPoints?.length ? (
                <div style={{ padding: '0 16px', borderBottom: '1px solid var(--border)' }}>
                  <SectionHeader id="usps" title="Unique Selling Points" icon="&#128161;" />
                  {expandedSections.usps && (
                    <div style={{ padding: '12px 0 16px' }}>
                      {brandGuide.uniqueSellingPoints.map((u, i) => (
                        <div key={i} style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 6, paddingLeft: 16, position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 0 }}>{i + 1}.</span> {u}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {/* Content Themes */}
              {brandGuide.contentThemes?.length ? (
                <div style={{ padding: '0 16px', borderBottom: '1px solid var(--border)' }}>
                  <SectionHeader id="themes" title="Content Themes" icon="&#128196;" />
                  {expandedSections.themes && (
                    <div style={{ padding: '12px 0 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {brandGuide.contentThemes.map((t, i) => <Pill key={i} text={t} />)}
                    </div>
                  )}
                </div>
              ) : null}

              {/* Hashtags */}
              {brandGuide.hashtagSuggestions?.length ? (
                <div style={{ padding: '0 16px', borderBottom: '1px solid var(--border)' }}>
                  <SectionHeader id="hashtags" title="Suggested Hashtags" icon="#" />
                  {expandedSections.hashtags && (
                    <div style={{ padding: '12px 0 16px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {brandGuide.hashtagSuggestions.map((h, i) => (
                        <span key={i} style={{
                          display: 'inline-block', padding: '4px 10px', borderRadius: 8,
                          background: 'var(--bg-soft)', fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)',
                        }}>
                          {h.startsWith('#') ? h : `#${h}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {/* Social Links */}
              {brandGuide.socialLinks && Object.keys(brandGuide.socialLinks).length > 0 && (
                <div style={{ padding: '0 16px', borderBottom: '1px solid var(--border)' }}>
                  <SectionHeader id="social" title="Social Links Found" icon="&#128279;" />
                  {expandedSections.social && (
                    <div style={{ padding: '12px 0 16px' }}>
                      {Object.entries(brandGuide.socialLinks).map(([platform, url]) => (
                        <div key={platform} style={{ fontSize: 13, marginBottom: 4 }}>
                          <strong style={{ textTransform: 'capitalize' }}>{platform}:</strong>{' '}
                          <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{url}</a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Competitor Notes */}
              {brandGuide.competitorNotes && (
                <div style={{ padding: '0 16px' }}>
                  <SectionHeader id="competitor" title="Positioning Notes" icon="&#128202;" />
                  {expandedSections.competitor && (
                    <div style={{ padding: '12px 0 16px' }}>
                      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6 }}>{brandGuide.competitorNotes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      )}

      {/* Profile Form */}
      <div className="wizard-card brand-form">
        <h2 style={{ marginBottom: 4 }}>Profile details</h2>
        <p className="wizard-sub" style={{ marginBottom: 20 }}>
          {profileType === 'person'
            ? 'Create a presenter profile — your name, photo, and how you want to be introduced.'
            : scraped
            ? 'We pre-filled everything -- review and adjust as needed.'
            : 'Create a profile to apply your logo and colors across all your creations. Just a name and logo is enough to get started.'}
        </p>

        <form onSubmit={handleSubmit}>
          {/* Profile type toggle */}
          <input type="hidden" name="profile_type" value={profileType} />
          {storefront.showVideoFeatures && (
          <div className="form-group">
            <label className="input-label">Profile type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['company', 'person'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setProfileType(t)}
                  style={{
                    flex: 1, padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
                    fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                    border: profileType === t ? '2px solid var(--mint)' : '1px solid var(--border)',
                    background: profileType === t ? 'rgba(199, 232, 168, 0.12)' : 'white',
                    color: 'var(--ink)',
                  }}
                >
                  {t === 'company' ? 'Company' : 'Person'}
                </button>
              ))}
            </div>
          </div>
          )}

          {/* === Essential Fields === */}
          <div className="form-group">
            <label className="input-label">{profileType === 'person' ? 'Your name' : 'Brand Name'} <span style={{ color: '#dc2626' }}>*</span></label>
            <input
              name="name"
              required
              className="input"
              placeholder={profileType === 'person' ? 'e.g., Sarah Talls' : 'e.g., My Agency'}
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
            />
          </div>

          {/* ───────── Person fields ───────── */}
          {profileType === 'person' && (
            <>
              <input type="hidden" name="photo_url" value={photoUrl} />
              <input type="hidden" name="show_name_on_slides" value={showNameOnSlides ? 'true' : 'false'} />

              <div className="form-group">
                <label className="input-label">Role / title <span style={{ color: 'var(--ink-light)', fontWeight: 400 }}>(optional)</span></label>
                <input
                  name="person_role"
                  className="input"
                  placeholder="e.g., Registered Nurse"
                  value={personRole}
                  onChange={(e) => setPersonRole(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="input-label">Photo <span style={{ color: 'var(--ink-light)', fontWeight: 400 }}>(optional)</span></label>
                {photoUrl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <img src={photoUrl} alt="Presenter" style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border)' }} />
                    <button
                      type="button"
                      onClick={() => { setPhotoUrl(''); if (photoInputRef.current) photoInputRef.current.value = '' }}
                      style={{ background: 'none', border: 'none', color: 'var(--ink-light)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Remove photo
                    </button>
                  </div>
                )}
                <div
                  onClick={() => photoInputRef.current?.click()}
                  style={{
                    border: '2px dashed var(--border)', borderRadius: 10, padding: '20px 16px',
                    textAlign: 'center', cursor: 'pointer',
                  }}
                >
                  {photoUploading ? (
                    <span style={{ fontSize: 14, color: 'var(--ink-soft)' }}>Uploading...</span>
                  ) : (
                    <span style={{ fontSize: 14, color: 'var(--ink-light)' }}>Click to upload a headshot — or paste one with {pasteKeyLabel()}</span>
                  )}
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f) }}
                    style={{ display: 'none' }}
                  />
                </div>
                {photoError && <div style={{ marginTop: 8, fontSize: 13, color: '#dc2626', fontWeight: 500 }}>{photoError}</div>}
              </div>

              <div className="form-group">
                <label className="input-label">Intro line <span style={{ color: 'var(--ink-light)', fontWeight: 400 }}>(optional)</span></label>
                <textarea
                  name="intro_line"
                  className="input"
                  rows={3}
                  style={{ resize: 'vertical' }}
                  placeholder="Hi, I'm Sarah Talls, a registered nurse. I've prepared this video to walk you through your prescription plan."
                  value={introLine}
                  onChange={(e) => setIntroLine(e.target.value)}
                />
                <p style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 6, marginBottom: 0 }}>
                  Spoken at the start of your video — write it the way you&apos;d say it.
                </p>
              </div>

              <div className="form-group">
                <label className="input-label">Accent color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ display: 'block', position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: primaryColor, border: '2px solid var(--border)' }} />
                    <input
                      type="color"
                      name="primary_color"
                      value={primaryColor}
                      onChange={(e) => { setPrimaryColor(e.target.value); setUserEditedAdvancedColors(false) }}
                      style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                    />
                  </label>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', fontFamily: 'monospace' }}>{primaryColor.toUpperCase()}</span>
                </div>
              </div>

              <div className="form-group">
                <label className="input-label">Photo placement</label>
                <select
                  name="photo_placement"
                  className="input"
                  value={photoPlacement}
                  onChange={(e) => setPhotoPlacement(e.target.value)}
                >
                  <option value="auto">Auto (style decides)</option>
                  <option value="cover">Cover</option>
                  <option value="closing">Closing</option>
                  <option value="both">Both</option>
                  <option value="none">None</option>
                </select>
                <p style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 6, marginBottom: 0 }}>Where your photo appears in the video.</p>
              </div>

              <div className="check-row">
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={showNameOnSlides} onChange={(e) => setShowNameOnSlides(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--ink)' }} />
                  <span style={{ fontSize: 14.5, fontWeight: 500 }}>Show my name on slides</span>
                </label>
                <p style={{ fontSize: 12, color: 'var(--ink-light)', margin: '6px 0 0 30px' }}>
                  Off = the document title leads the cover; your name still appears in the intro and closing.
                </p>
              </div>

              {/* Contact info — shown on the closing card */}
              <div className="form-group">
                <label className="input-label">Contact info <span style={{ color: 'var(--ink-light)', fontWeight: 400 }}>(optional, for closing card)</span></label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    type="tel"
                    className="input"
                    placeholder="Phone number"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                  />
                  <input
                    type="email"
                    className="input"
                    placeholder="Email address"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                  />
                  <input
                    type="url"
                    className="input"
                    placeholder="Website URL"
                    value={contactWebsite}
                    onChange={(e) => setContactWebsite(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {/* ───────── Company fields ───────── */}
          {profileType === 'company' && (
          <>
          <input type="hidden" name="show_logo" value={showLogo ? 'true' : 'false'} />
          <div className="form-group">
            <label className="input-label">Logo URL <span style={{ color: 'var(--ink-light)', fontWeight: 400 }}>(optional)</span></label>
            <p style={{ fontSize: 12, color: 'var(--ink-light)', margin: '-2px 0 8px' }}>{storefront.showVideoFeatures ? 'Used on slide decks and client emails. Videos use text branding only.' : 'Placed on your designs. Upload the real thing — a logo is never drawn from your name.'}</p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                name="logo_url"
                type="url"
                className="input"
                placeholder="https://..."
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                onBlur={async () => {
                  if (!logoUrl || !logoUrl.startsWith('http') || userEditedAdvancedColors) return
                  try {
                    const res = await fetch('/api/extract-logo-colors', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ imageUrl: logoUrl }),
                    })
                    if (res.ok) {
                      const extracted = await res.json()
                      if (extracted.primary) {
                        setPrimaryColor(extracted.primary)
                        setColors({
                          primary_color: extracted.primary,
                          secondary_color: extracted.secondary,
                          accent_color: extracted.accent,
                          background_color: extracted.background,
                          text_color: extracted.text,
                        })
                      }
                    }
                  } catch { /* best effort */ }
                }}
                style={{ flex: 1 }}
              />
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="Logo preview"
                  style={{ height: 40, width: 'auto', maxWidth: 120, borderRadius: 6, border: '1px solid var(--border)', objectFit: 'contain', padding: 4, background: 'white' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              )}
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-light)', marginTop: 8, marginBottom: 0 }}>
              You can upload a logo file after creating the brand.
            </p>
            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--ink)' }} />
                <span style={{ fontSize: 14.5, fontWeight: 500 }}>{storefront.showVideoFeatures ? 'Show logo in videos' : 'Add my logo to designs'}</span>
              </label>
              <p style={{ fontSize: 12, color: 'var(--ink-light)', margin: '6px 0 0 30px' }}>{storefront.showVideoFeatures ? 'Turn off to render videos without your logo.' : 'Turn off to leave your logo off the artwork.'}</p>
            </div>
          </div>

          <div className="form-group">
            <label className="input-label">Primary Color</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ display: 'block', position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
                <div
                  style={{
                    width: 44, height: 44, borderRadius: 10, background: primaryColor,
                    border: '2px solid var(--border)',
                  }}
                />
                <input
                  type="color"
                  name="primary_color"
                  value={primaryColor}
                  onChange={(e) => {
                    setPrimaryColor(e.target.value)
                    setUserEditedAdvancedColors(false) // re-derive secondary/accent from new primary
                  }}
                  style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                />
              </label>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', fontFamily: 'monospace' }}>{primaryColor.toUpperCase()}</span>
              <span style={{ fontSize: 12, color: 'var(--ink-light)' }}>Used for headers and buttons</span>
            </div>
          </div>

          {/* === Advanced Section (collapsed by default) === */}
          <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 4 }}>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 0', border: 'none', background: 'none', cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                Advanced color settings
              </span>
              <span style={{
                fontSize: 12, color: 'var(--ink-light)', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {!showAdvanced && (
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {advancedColorKeys.map((key) => (
                      <span key={key} style={{
                        display: 'inline-block', width: 16, height: 16, borderRadius: 4,
                        background: colors[key],
                        border: colors[key].toLowerCase() === '#ffffff' ? '1px solid var(--border)' : 'none',
                      }} />
                    ))}
                  </span>
                )}
                <span style={{ fontSize: 18, transition: 'transform 0.2s', transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0)' }}>
                  &#9662;
                </span>
              </span>
            </button>

            {showAdvanced && (
              <div style={{ paddingBottom: 8 }}>
                <p style={{ fontSize: 13, color: 'var(--ink-light)', marginTop: 0, marginBottom: 16 }}>
                  Secondary and accent colors are auto-suggested from your primary color. Feel free to adjust them.
                </p>
                <div className="color-pickers">
                  {advancedColorKeys.map((key) => (
                    <div key={key} className="color-picker">
                      <div className="lbl">{COLOR_LABELS[key]}</div>
                      <label style={{ display: 'block', position: 'relative', cursor: 'pointer' }}>
                        <div
                          className="color-input"
                          style={{
                            background: colors[key],
                            borderRadius: 10,
                            ...(colors[key].toLowerCase() === '#ffffff' ? { boxShadow: 'inset 0 0 0 3px white, 0 0 0 1px var(--border)' } : {}),
                          }}
                        />
                        <input
                          type="color"
                          name={key}
                          value={colors[key]}
                          onChange={(e) => {
                            setUserEditedAdvancedColors(true)
                            setColors((prev) => ({ ...prev, [key]: e.target.value }))
                          }}
                          style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                        />
                      </label>
                      <div className="color-hex">{colors[key].toUpperCase()}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 2 }}>{COLOR_ROLES[key]}</div>
                    </div>
                  ))}
                </div>

                {/* Preview */}
                <div className="brand-preview">
                  <div className="brand-preview-label">Live Preview</div>
                  <div className="preview-card-mini" style={{ borderRadius: 10, overflow: 'hidden' }}>
                    {Object.entries(colors).filter(([k]) => k !== 'text_color').map(([key, value]) => (
                      <div key={key} className="pcm-row" style={{ background: value }}>
                        <span>{COLOR_LABELS[key]}</span>
                        <span style={{ opacity: 0.85, fontSize: 12, fontWeight: 500 }}>{COLOR_ROLES[key]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          </>
          )}

          <div className="check-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <input type="checkbox" name="is_default" value="true" style={{ width: 18, height: 18, accentColor: 'var(--ink)' }} />
              <span style={{ fontSize: 14.5, fontWeight: 500 }}>Set as default profile</span>
            </label>
          </div>

          {/* Hidden fields for brand guide data — Company only */}
          {profileType === 'company' && brandGuide && (
            <>
              <input type="hidden" name="tagline" value={brandGuide.tagline ?? ''} />
              <input type="hidden" name="description" value={brandGuide.description ?? ''} />
              <input type="hidden" name="industry" value={brandGuide.industry ?? ''} />
              <input type="hidden" name="tone" value={brandGuide.tone ?? ''} />
              <input type="hidden" name="target_audience" value={brandGuide.targetAudience ?? ''} />
              <input type="hidden" name="fonts" value={JSON.stringify(brandGuide.fonts ?? [])} />
              <input type="hidden" name="brand_values" value={JSON.stringify(brandGuide.brandValues ?? [])} />
              <input type="hidden" name="services" value={JSON.stringify(brandGuide.services ?? [])} />
              <input type="hidden" name="social_links" value={JSON.stringify(brandGuide.socialLinks ?? {})} />
              <input type="hidden" name="content_themes" value={JSON.stringify(brandGuide.contentThemes ?? [])} />
              <input type="hidden" name="competitor_notes" value={brandGuide.competitorNotes ?? ''} />
              <input type="hidden" name="unique_selling_points" value={JSON.stringify(brandGuide.uniqueSellingPoints ?? [])} />
            </>
          )}

          {/* brand_guide_data — closing-card contact lands here for BOTH modes.
              Merge manually-entered contact over any scraped Company brand guide. */}
          <input
            type="hidden"
            name="brand_guide_data"
            value={JSON.stringify({
              ...(profileType === 'company' && brandGuide ? brandGuide : {}),
              ...(contactPhone.trim() ? { phone: contactPhone.trim() } : {}),
              ...(contactEmail.trim() ? { email: contactEmail.trim() } : {}),
              ...(contactWebsite.trim() ? { website: contactWebsite.trim() } : {}),
            })}
          />

          {/* Hidden fields for advanced colors when section is collapsed (so they still submit) */}
          {!showAdvanced && (
            <>
              <input type="hidden" name="secondary_color" value={colors.secondary_color} />
              <input type="hidden" name="accent_color" value={colors.accent_color} />
              <input type="hidden" name="background_color" value={colors.background_color} />
              <input type="hidden" name="text_color" value={colors.text_color} />
            </>
          )}

          {error && (
            <div style={{ borderRadius: 10, background: '#fde8e8', padding: '10px 16px', fontSize: 13, marginBottom: 16, color: 'var(--ink)', fontWeight: 600 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/brands" className="btn btn-soft">Cancel</Link>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
              {loading ? 'Creating...' : 'Create profile \u2192'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
