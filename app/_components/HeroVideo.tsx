'use client'

import { useState, useRef } from 'react'

const VIDEO_URL = 'https://izccljcgxsbumgsznndd.supabase.co/storage/v1/object/public/videos/0e28a48c-978c-4bf0-93c3-6769229c85cc/7c22a559-ad5b-495e-8ebc-6839fdbc9b34.mp4'
const THUMB_URL = 'https://izccljcgxsbumgsznndd.supabase.co/storage/v1/object/public/videos/0e28a48c-978c-4bf0-93c3-6769229c85cc/7c22a559-ad5b-495e-8ebc-6839fdbc9b34_thumb.png'

export default function HeroVideo() {
  const [playing, setPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  function handlePlay() {
    if (videoRef.current) {
      videoRef.current.play()
      setPlaying(true)
    }
  }

  return (
    <div className="hero-video" style={{ position: 'relative', cursor: playing ? 'default' : 'pointer' }} onClick={!playing ? handlePlay : undefined}>
      <video
        ref={videoRef}
        poster={THUMB_URL}
        playsInline
        controls={playing}
        style={{ width: '100%', borderRadius: 10, display: 'block' }}
        onEnded={() => setPlaying(false)}
      >
        <source src={VIDEO_URL} type="video/mp4" />
      </video>
      {!playing && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 10,
        }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'var(--ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            transition: 'transform 0.2s ease',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="var(--mint)">
              <polygon points="8 4 20 12 8 20" />
            </svg>
          </div>
        </div>
      )}
    </div>
  )
}
