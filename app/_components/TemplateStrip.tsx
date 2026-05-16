'use client'

import { useState } from 'react'
import { SLIDE_STYLES } from '../_lib/types'

export default function TemplateStrip() {
  const [expanded, setExpanded] = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  // Double the items for seamless marquee loop
  const items = [...SLIDE_STYLES, ...SLIDE_STYLES]

  return (
    <div>
      {/* Auto-scrolling strip */}
      <div style={{ overflow: 'hidden', marginBottom: 20 }}>
        <div style={{
          display: 'flex',
          gap: 12,
          animation: 'template-scroll 60s linear infinite',
          width: 'max-content',
        }}>
          {items.map((style, i) => (
            <div
              key={`${style.id}-${i}`}
              onClick={() => setLightboxIdx(i % SLIDE_STYLES.length)}
              style={{
                flexShrink: 0,
                width: 180,
                borderRadius: 8,
                overflow: 'hidden',
                border: '1px solid var(--border-light)',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 20px rgba(0,0,0,0.1)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
            >
              <img
                src={`/style-previews/${style.id}.png`}
                alt={style.name}
                loading="lazy"
                style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Expand/collapse button */}
      <div style={{ textAlign: 'center', marginBottom: expanded ? 24 : 0 }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '10px 24px',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--ink)',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {expanded ? 'Collapse gallery \u25B2' : `See all ${SLIDE_STYLES.length}+ styles \u25BC`}
        </button>
      </div>

      {/* Expanded full gallery */}
      {expanded && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 12,
          maxWidth: 1000,
          margin: '0 auto',
        }}>
          {SLIDE_STYLES.map((style, i) => (
            <div
              key={style.id}
              onClick={() => setLightboxIdx(i)}
              style={{
                borderRadius: 8,
                overflow: 'hidden',
                border: '1px solid var(--border-light)',
                cursor: 'pointer',
                transition: 'transform 0.2s',
                background: 'white',
              }}
            >
              <img
                src={`/style-previews/${style.id}.png`}
                alt={style.name}
                loading="lazy"
                style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }}
              />
              <div style={{ padding: '6px 8px', fontSize: 11, fontWeight: 600, color: 'var(--ink)', textAlign: 'center' }}>
                {style.name}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 40, cursor: 'pointer',
          }}
          onClick={() => setLightboxIdx(null)}
        >
          <div
            style={{ maxWidth: 1000, width: '100%', background: 'white', borderRadius: 10, overflow: 'hidden', cursor: 'default', position: 'relative' }}
            onClick={e => e.stopPropagation()}
          >
            <img
              src={`/style-previews/${SLIDE_STYLES[lightboxIdx].id}.png`}
              alt={SLIDE_STYLES[lightboxIdx].name}
              style={{ width: '100%', display: 'block' }}
            />
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{SLIDE_STYLES[lightboxIdx].name}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{SLIDE_STYLES[lightboxIdx].description}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={() => setLightboxIdx(lightboxIdx > 0 ? lightboxIdx - 1 : SLIDE_STYLES.length - 1)}
                  style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <span style={{ fontSize: 12, color: 'var(--ink-light)', minWidth: 40, textAlign: 'center' }}>{lightboxIdx + 1}/{SLIDE_STYLES.length}</span>
                <button
                  onClick={() => setLightboxIdx(lightboxIdx < SLIDE_STYLES.length - 1 ? lightboxIdx + 1 : 0)}
                  style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
                <button
                  onClick={() => setLightboxIdx(null)}
                  style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS animation */}
      <style>{`
        @keyframes template-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
