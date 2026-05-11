'use client'

import { useState, useRef } from 'react'

interface ClickToPlayVideoProps {
  src: string
  poster?: string
  style?: React.CSSProperties
}

export default function ClickToPlayVideo({ src, poster, style }: ClickToPlayVideoProps) {
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  function handlePlay() {
    if (videoRef.current) {
      videoRef.current.play().catch(() => setError(true))
      setPlaying(true)
    }
  }

  return (
    <div style={{ position: 'relative', cursor: playing ? 'default' : 'pointer', ...style }} onClick={!playing ? handlePlay : undefined}>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        preload="metadata"
        playsInline
        controls={playing}
        onEnded={() => setPlaying(false)}
        onError={() => setError(true)}
        style={{ width: '100%', borderRadius: 10, display: 'block', aspectRatio: '16/9', background: '#0a1628' }}
      />
      {!playing && !error && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 10,
          background: poster ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.15)',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'var(--ink, #1B3A5C)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            transition: 'transform 0.2s ease',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="var(--mint, #3BB5C8)">
              <polygon points="8 4 20 12 8 20" />
            </svg>
          </div>
        </div>
      )}
      {error && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 10, background: '#0a1628', color: 'white',
          fontSize: 14,
        }}>
          Video unavailable
        </div>
      )}
    </div>
  )
}
