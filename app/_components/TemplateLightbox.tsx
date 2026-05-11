'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { SLIDE_STYLES } from '../_lib/types'

interface TemplateLightboxProps {
  initialIndex: number
  onClose: () => void
  showCTA?: boolean
}

export default function TemplateLightbox({ initialIndex, onClose, showCTA = true }: TemplateLightboxProps) {
  const [index, setIndex] = useState(initialIndex)
  const style = SLIDE_STYLES[index]

  const prev = useCallback(() => {
    setIndex(i => (i > 0 ? i - 1 : SLIDE_STYLES.length - 1))
  }, [])

  const next = useCallback(() => {
    setIndex(i => (i < SLIDE_STYLES.length - 1 ? i + 1 : 0))
  }, [])

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [prev, next, onClose])

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  if (!style) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(10, 22, 18, 0.92)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 20, right: 20,
          width: 40, height: 40, borderRadius: 10,
          background: 'rgba(255,255,255,0.1)', border: 'none',
          color: 'white', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20,
        }}
      >
        &times;
      </button>

      {/* Counter */}
      <div style={{
        position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)',
        color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600,
      }}>
        {index + 1} / {SLIDE_STYLES.length}
      </div>

      {/* Main image */}
      <div
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 1100, width: '100%', position: 'relative' }}
      >
        {/* Prev arrow */}
        <button
          onClick={prev}
          style={{
            position: 'absolute', left: -60, top: '50%', transform: 'translateY(-50%)',
            width: 48, height: 48, borderRadius: 10, border: 'none',
            background: 'rgba(255,255,255,0.1)', color: 'white',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
        </button>

        {/* Next arrow */}
        <button
          onClick={next}
          style={{
            position: 'absolute', right: -60, top: '50%', transform: 'translateY(-50%)',
            width: 48, height: 48, borderRadius: 10, border: 'none',
            background: 'rgba(255,255,255,0.1)', color: 'white',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
        </button>

        {/* Image */}
        <img
          src={`/style-previews/${style.id}.png`}
          alt={style.name}
          style={{
            width: '100%',
            borderRadius: 10,
            display: 'block',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}
        />

        {/* Info bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 16, padding: '0 4px',
        }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>
              {style.name}
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
              {style.description}
            </div>
          </div>
          {showCTA && (
            <Link
              href="/signup"
              className="btn btn-mint"
              onClick={e => e.stopPropagation()}
            >
              Try this style &rarr;
            </Link>
          )}
        </div>

        {/* Thumbnail strip */}
        <div style={{
          display: 'flex', gap: 6, marginTop: 20, overflowX: 'auto',
          padding: '4px 0',
          msOverflowStyle: 'none', scrollbarWidth: 'none',
        }}>
          {SLIDE_STYLES.map((s, i) => (
            <img
              key={s.id}
              src={`/style-previews/${s.id}.png`}
              alt={s.name}
              onClick={(e) => { e.stopPropagation(); setIndex(i) }}
              style={{
                width: 80, height: 45,
                borderRadius: 6,
                objectFit: 'cover',
                cursor: 'pointer',
                border: i === index ? '2px solid var(--mint)' : '2px solid transparent',
                opacity: i === index ? 1 : 0.5,
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
              loading="lazy"
            />
          ))}
        </div>
      </div>
    </div>
  )
}
