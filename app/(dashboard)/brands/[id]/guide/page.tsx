'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '../../../../_lib/supabase/client'
import type { Brand } from '../../../../_lib/types'

export default function BrandGuidePage() {
  const params = useParams()
  const [brand, setBrand] = useState<Brand | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('brands')
        .select('*')
        .eq('id', params.id as string)
        .single()
      if (data) setBrand(data as Brand)
    }
    load()
  }, [params.id])

  if (!brand) {
    return <div style={{ color: 'var(--ink-light)' }}>Loading...</div>
  }

  const guide = (brand.brand_guide_data ?? {}) as Record<string, unknown>
  const toneGuide = guide.toneGuide as { doSay?: string[]; dontSay?: string[]; samplePosts?: string[] } | undefined
  const hashtagSuggestions = (guide.hashtagSuggestions ?? []) as string[]
  const colorPsychology = (guide.colorPsychology ?? null) as string | null
  const socialMediaBio = (guide.socialMediaBio ?? null) as string | null

  const ColorSwatch = ({ color, label }: { color: string; label: string }) => (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: 56, height: 56, borderRadius: 10, background: color,
        border: '1px solid var(--border)', marginBottom: 6,
        ...(color.toLowerCase() === '#ffffff' ? { boxShadow: 'inset 0 0 0 2px var(--border-light)' } : {}),
      }} />
      <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-soft)', fontFamily: 'monospace' }}>{color.toUpperCase()}</div>
    </div>
  )

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div style={{
      fontSize: 'var(--fs-caption)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5,
      color: 'var(--ink-light)', marginBottom: 14, marginTop: 32, paddingBottom: 8,
      borderBottom: '2px solid var(--border)',
    }}>
      {children}
    </div>
  )

  const Pill = ({ text }: { text: string }) => (
    <span style={{
      display: 'inline-block', padding: '5px 14px', borderRadius: 8,
      background: 'var(--bg-soft)', fontSize: 'var(--fs-small)', fontWeight: 500, color: 'var(--ink)',
    }}>
      {text}
    </span>
  )

  return (
    <div>
      <Link href={`/brands/${params.id}`} className="back-link">&larr; Back to brand</Link>

      <div className="wizard-card" style={{ maxWidth: 720 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {brand.logo_url && (
            <img
              src={brand.logo_url}
              alt={`${brand.name} logo`}
              style={{ height: 56, width: 'auto', maxWidth: 200, objectFit: 'contain', marginBottom: 16, borderRadius: 6 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <h1 style={{ fontSize: 'var(--fs-h2)', fontWeight: 800, marginBottom: 4 }}>{brand.name}</h1>
          {brand.tagline && (
            <p style={{ fontSize: 'var(--fs-body)', fontStyle: 'italic', color: 'var(--ink-soft)', marginBottom: 8 }}>
              &ldquo;{brand.tagline}&rdquo;
            </p>
          )}
          {brand.description && (
            <p style={{ fontSize: 'var(--fs-ui)', color: 'var(--ink-soft)', lineHeight: 1.6, maxWidth: 520, margin: '0 auto' }}>
              {brand.description}
            </p>
          )}
          <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', marginTop: 12, fontSize: 'var(--fs-small)', color: 'var(--ink-light)' }}>
            {brand.industry && <span>Industry: <strong>{brand.industry}</strong></span>}
            {brand.tone && <span>Tone: <strong style={{ textTransform: 'capitalize' }}>{brand.tone}</strong></span>}
          </div>
        </div>

        {/* Visual Identity */}
        <SectionTitle>Visual identity</SectionTitle>
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 16 }}>
          <ColorSwatch color={brand.primary_color} label="Primary" />
          <ColorSwatch color={brand.secondary_color} label="Secondary" />
          <ColorSwatch color={brand.accent_color} label="Accent" />
          <ColorSwatch color={brand.background_color} label="Background" />
          <ColorSwatch color={brand.text_color} label="Text" />
        </div>
        {colorPsychology && (
          <p style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-soft)', lineHeight: 1.6, fontStyle: 'italic', padding: '10px 14px', background: 'var(--bg-soft)', borderRadius: 10 }}>
            {colorPsychology}
          </p>
        )}

        {brand.fonts?.length > 0 && (
          <>
            <div style={{ fontSize: 'var(--fs-small)', fontWeight: 700, marginTop: 16, marginBottom: 8 }}>Typography</div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {brand.fonts.map((f, i) => <Pill key={i} text={f} />)}
            </div>
          </>
        )}

        {/* Brand Voice */}
        <SectionTitle>Brand voice</SectionTitle>
        {brand.tone && (
          <p style={{ fontSize: 'var(--fs-ui)', marginBottom: 12 }}>Voice: <strong style={{ textTransform: 'capitalize' }}>{brand.tone}</strong></p>
        )}
        {brand.target_audience && (
          <p style={{ fontSize: 'var(--fs-ui)', marginBottom: 16 }}>Target Audience: <strong>{brand.target_audience}</strong></p>
        )}

        {toneGuide && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 16 }}>
            {toneGuide.doSay?.length ? (
              <div style={{ padding: 14, borderRadius: 10, background: 'rgba(52,211,153,0.08)' }}>
                <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 800, color: 'var(--mint-darker)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Do say</div>
                {toneGuide.doSay.map((s, i) => (
                  <div key={i} style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-soft)', marginBottom: 5, paddingLeft: 14, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, color: 'var(--mint-darker)', fontWeight: 700 }}>+</span> {s}
                  </div>
                ))}
              </div>
            ) : null}
            {toneGuide.dontSay?.length ? (
              <div style={{ padding: 14, borderRadius: 10, background: 'rgba(239,68,68,0.06)' }}>
                <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 800, color: 'var(--error)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Don&apos;t say</div>
                {toneGuide.dontSay.map((s, i) => (
                  <div key={i} style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-soft)', marginBottom: 5, paddingLeft: 14, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, color: 'var(--error)', fontWeight: 700 }}>-</span> {s}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {toneGuide?.samplePosts?.length ? (
          <>
            <div style={{ fontSize: 'var(--fs-small)', fontWeight: 700, marginBottom: 8 }}>Sample posts</div>
            {toneGuide.samplePosts.map((post, i) => (
              <div key={i} style={{
                padding: 14, borderRadius: 10, background: 'var(--bg-soft)', marginBottom: 8,
                fontSize: 'var(--fs-small)', color: 'var(--ink)', lineHeight: 1.6, fontStyle: 'italic',
              }}>
                {post}
              </div>
            ))}
          </>
        ) : null}

        {socialMediaBio && (
          <>
            <div style={{ fontSize: 'var(--fs-small)', fontWeight: 700, marginTop: 16, marginBottom: 8 }}>Suggested social bio</div>
            <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg-soft)', fontSize: 'var(--fs-small)', color: 'var(--ink)', lineHeight: 1.5 }}>
              {socialMediaBio}
            </div>
          </>
        )}

        {/* Content Strategy */}
        <SectionTitle>Content strategy</SectionTitle>

        {brand.content_themes?.length > 0 && (
          <>
            <div style={{ fontSize: 'var(--fs-small)', fontWeight: 700, marginBottom: 8 }}>Content themes</div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 16 }}>
              {brand.content_themes.map((t, i) => <Pill key={i} text={t} />)}
            </div>
          </>
        )}

        {hashtagSuggestions.length > 0 && (
          <>
            <div style={{ fontSize: 'var(--fs-small)', fontWeight: 700, marginBottom: 8 }}>Hashtags</div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 16 }}>
              {hashtagSuggestions.map((h, i) => (
                <span key={i} style={{
                  display: 'inline-block', padding: '4px 10px', borderRadius: 8,
                  background: 'var(--bg-soft)', fontSize: 'var(--fs-caption)', fontWeight: 600, color: 'var(--ink-soft)',
                }}>
                  {h.startsWith('#') ? h : `#${h}`}
                </span>
              ))}
            </div>
          </>
        )}

        {brand.unique_selling_points?.length > 0 && (
          <>
            <div style={{ fontSize: 'var(--fs-small)', fontWeight: 700, marginBottom: 8 }}>Unique selling points</div>
            {brand.unique_selling_points.map((u, i) => (
              <div key={i} style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-soft)', marginBottom: 6, paddingLeft: 20, position: 'relative' }}>
                <span style={{ position: 'absolute', left: 0, fontWeight: 700 }}>{i + 1}.</span> {u}
              </div>
            ))}
          </>
        )}

        {/* Services */}
        {brand.services?.length > 0 && (
          <>
            <SectionTitle>Services / products</SectionTitle>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {brand.services.map((s, i) => <Pill key={i} text={s} />)}
            </div>
          </>
        )}

        {/* Core Values */}
        {brand.brand_values?.length > 0 && (
          <>
            <SectionTitle>Core values</SectionTitle>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {brand.brand_values.map((v, i) => <Pill key={i} text={v} />)}
            </div>
          </>
        )}

        {/* Social Links */}
        {brand.social_links && Object.keys(brand.social_links).length > 0 && (
          <>
            <SectionTitle>Social media</SectionTitle>
            {Object.entries(brand.social_links).map(([platform, url]) => (
              <div key={platform} style={{ fontSize: 'var(--fs-small)', marginBottom: 6 }}>
                <strong style={{ textTransform: 'capitalize' }}>{platform}:</strong>{' '}
                <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--link)' }}>{url}</a>
              </div>
            ))}
          </>
        )}

        {/* Competitor Notes */}
        {brand.competitor_notes && (
          <>
            <SectionTitle>Positioning notes</SectionTitle>
            <p style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-soft)', lineHeight: 1.6 }}>{brand.competitor_notes}</p>
          </>
        )}
      </div>
    </div>
  )
}
