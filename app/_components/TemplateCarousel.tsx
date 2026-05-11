'use client'

import { useState, useRef } from 'react'
import { SLIDE_STYLES } from '../_lib/types'
import TemplateLightbox from './TemplateLightbox'

export default function TemplateCarousel() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  function scroll(dir: 'left' | 'right') {
    if (!scrollRef.current) return
    scrollRef.current.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' })
  }

  return (
    <div>
      {/* Carousel thumbnails */}
      <div className="carousel-wrap">
        <button onClick={() => scroll('left')} className="carousel-arrow left" aria-label="Scroll left">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button onClick={() => scroll('right')} className="carousel-arrow right" aria-label="Scroll right">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>

        <div ref={scrollRef} className="carousel-track">
          {SLIDE_STYLES.map((style, i) => (
            <div
              key={style.id}
              className="carousel-card"
              onClick={() => setLightboxIndex(i)}
            >
              <img src={`/style-previews/${style.id}.png`} alt={style.name} loading="lazy" />
              <div className="carousel-card-label">
                <span className="carousel-card-name">{style.name}</span>
                <span className="carousel-card-desc">{style.description}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

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
