'use client'

import { useState } from 'react'
import { SLIDE_STYLES } from '../_lib/types'
import TemplateLightbox from './TemplateLightbox'

type StyleCategory = 'all' | 'bold' | 'classic' | 'creative' | 'edgy' | 'data'
type Industry = 'all' | 'insurance' | 'financial' | 'realestate' | 'legal' | 'healthcare' | 'consulting' | 'education' | 'mortgage'

const STYLE_CATEGORIES: Record<string, StyleCategory> = {
  'executive': 'classic',
  'steampunk': 'creative',
  'social-grid': 'bold',
  'blue-steps': 'data',
  'isometric': 'data',
  'flat-vector': 'classic',
  'doodle': 'creative',
  'watercolor': 'creative',
  'neon-cyber': 'edgy',
  'line-art': 'classic',
  'vintage-craft': 'creative',
  'flat-cartoon': 'creative',
  'colorful-steps': 'bold',
  'timeline': 'data',
  'profile-resume': 'data',
  'anime-pop': 'edgy',
  'felt-craft': 'creative',
  'botanical-warm': 'classic',
  'vintage-editorial': 'classic',
  'torn-collage': 'edgy',
  'inventor-box': 'creative',
  'chalkboard': 'creative',
  'cafe-realistic': 'creative',
  'old-newspaper': 'classic',
  'paper-layers': 'creative',
  'street-graffiti': 'edgy',
  'urban-chaos': 'edgy',
  'urban-canvas': 'edgy',
  'neon-nightclub': 'bold',
  'brick-blocks': 'creative',
  'cinematic-hud': 'bold',
  'commercial-pro': 'bold',
  'americana-poster': 'classic',
  'black-label': 'bold',
  'fire-vibes': 'edgy',
  'urban-friday': 'edgy',
  'summer-fest': 'creative',
  'indie-zine': 'edgy',
  'red-neon': 'bold',
}

const INDUSTRY_RECOMMENDATIONS: Record<string, Industry[]> = {
  'executive': ['insurance', 'financial', 'legal', 'consulting'],
  'blue-steps': ['insurance', 'financial', 'healthcare', 'education'],
  'flat-vector': ['healthcare', 'education', 'consulting'],
  'line-art': ['legal', 'consulting', 'financial'],
  'timeline': ['insurance', 'mortgage', 'legal'],
  'profile-resume': ['financial', 'consulting', 'realestate'],
  'isometric': ['financial', 'consulting', 'education'],
  'botanical-warm': ['healthcare', 'realestate', 'education'],
  'vintage-editorial': ['legal', 'consulting', 'financial'],
  'watercolor': ['realestate', 'healthcare', 'education'],
  'colorful-steps': ['education', 'healthcare', 'mortgage'],
  'cafe-realistic': ['realestate', 'mortgage'],
  'old-newspaper': ['legal', 'financial'],
  'cinematic-hud': ['financial', 'consulting'],
  'neon-cyber': ['financial', 'consulting'],
  'social-grid': ['realestate', 'mortgage'],
  'chalkboard': ['education', 'healthcare'],
  'doodle': ['education', 'healthcare'],
  'flat-cartoon': ['education', 'healthcare', 'insurance'],
  'neon-nightclub': ['realestate', 'mortgage'],
  'steampunk': ['consulting', 'legal'],
  'paper-layers': ['insurance', 'financial'],
  'felt-craft': ['education', 'healthcare'],
  'inventor-box': ['consulting', 'education'],
  'brick-blocks': ['education', 'insurance'],
  'anime-pop': ['education'],
  'torn-collage': ['consulting'],
  'street-graffiti': ['realestate'],
  'urban-chaos': ['consulting'],
  'urban-canvas': ['realestate'],
  'vintage-craft': ['insurance', 'legal'],
  'commercial-pro': ['insurance', 'realestate', 'mortgage', 'financial', 'consulting'],
  'americana-poster': ['insurance', 'legal', 'financial', 'consulting'],
  'black-label': ['realestate', 'consulting', 'financial'],
  'fire-vibes': ['realestate', 'consulting'],
  'urban-friday': ['realestate', 'consulting'],
  'summer-fest': ['realestate', 'education', 'healthcare'],
  'indie-zine': ['education', 'consulting'],
  'red-neon': ['realestate', 'consulting', 'financial'],
}

const CATEGORY_LABELS: Record<StyleCategory, string> = {
  all: 'All Styles',
  bold: 'Bold & Modern',
  classic: 'Classic & Clean',
  creative: 'Creative & Fun',
  edgy: 'Dark & Edgy',
  data: 'Data-Focused',
}

const INDUSTRY_LABELS: Record<Industry, string> = {
  all: 'All Industries',
  insurance: 'Insurance',
  financial: 'Financial Services',
  realestate: 'Real Estate',
  legal: 'Legal',
  healthcare: 'Healthcare',
  consulting: 'Consulting',
  education: 'Education',
  mortgage: 'Mortgage',
}

export default function TemplateGallery() {
  const [category, setCategory] = useState<StyleCategory>('all')
  const [industry, setIndustry] = useState<Industry>('all')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const filtered = SLIDE_STYLES.filter(style => {
    if (category !== 'all' && STYLE_CATEGORIES[style.id] !== category) return false
    if (industry !== 'all') {
      const recs = INDUSTRY_RECOMMENDATIONS[style.id]
      if (!recs || !recs.includes(industry)) return false
    }
    return true
  })

  return (
    <div>
      {/* Filter bar */}
      <div style={{
        display: 'flex', gap: 12, justifyContent: 'center',
        marginBottom: 32, flexWrap: 'wrap',
      }}>
        <select
          value={industry}
          onChange={e => setIndustry(e.target.value as Industry)}
          style={{
            padding: '10px 36px 10px 14px',
            borderRadius: 10,
            border: '1.5px solid var(--border)',
            background: 'var(--surface)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--ink)',
            cursor: 'pointer',
            appearance: 'none',
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23666\' stroke-width=\'2\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
          }}
        >
          {Object.entries(INDUSTRY_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>

        <select
          value={category}
          onChange={e => setCategory(e.target.value as StyleCategory)}
          style={{
            padding: '10px 36px 10px 14px',
            borderRadius: 10,
            border: '1.5px solid var(--border)',
            background: 'var(--surface)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--ink)',
            cursor: 'pointer',
            appearance: 'none',
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23666\' stroke-width=\'2\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
          }}
        >
          {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>

        {(category !== 'all' || industry !== 'all') && (
          <button
            onClick={() => { setCategory('all'); setIndustry('all') }}
            style={{
              padding: '10px 16px', borderRadius: 10, border: 'none',
              background: 'var(--ink)', color: 'white',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results count */}
      <div style={{
        textAlign: 'center', fontSize: 13, color: 'var(--ink-light)',
        marginBottom: 20,
      }}>
        Showing {filtered.length} of {SLIDE_STYLES.length} styles
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 16,
      }}>
        {filtered.map((style) => {
          const globalIndex = SLIDE_STYLES.findIndex(s => s.id === style.id)
          return (
            <div
              key={style.id}
              onClick={() => setLightboxIndex(globalIndex)}
              style={{
                cursor: 'pointer',
                borderRadius: 10,
                overflow: 'hidden',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.1)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <img
                src={`/style-previews/${style.id}.png`}
                alt={style.name}
                loading="lazy"
                style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }}
              />
              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{style.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 2 }}>{style.description}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '48px 20px',
          color: 'var(--ink-light)', fontSize: 15,
        }}>
          No templates match your filters.{' '}
          <button
            onClick={() => { setCategory('all'); setIndustry('all') }}
            style={{ background: 'none', border: 'none', color: 'var(--ink)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <TemplateLightbox
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  )
}
