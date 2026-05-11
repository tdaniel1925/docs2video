'use client'

import { useRef, useState } from 'react'
import type { Brand } from '../_lib/types'

interface VideoPlayerProps {
  videoUrl: string
  thumbnailUrl?: string | null
  title?: string | null
  brand?: Brand | null
}

export default function VideoPlayer({ videoUrl, thumbnailUrl, title, brand }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const primary = brand?.primary_color ?? '#1B365D'
  const secondary = brand?.secondary_color ?? '#4A90D9'
  const bg = brand?.background_color ?? '#0a1628'
  const textColor = brand?.text_color ?? '#FFFFFF'

  function togglePlay() {
    if (!videoRef.current) return
    if (playing) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }
    setPlaying(!playing)
  }

  function handleTimeUpdate() {
    if (!videoRef.current) return
    const curr = videoRef.current.currentTime
    const dur = videoRef.current.duration || 1
    setCurrentTime(curr)
    setProgress((curr / dur) * 100)
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    if (!videoRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    videoRef.current.currentTime = pct * videoRef.current.duration
  }

  function formatTime(s: number) {
    const mins = Math.floor(s / 60)
    const secs = Math.floor(s % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-2xl"
      style={{ backgroundColor: bg, border: `2px solid ${primary}` }}
    >
      {/* Header bar with brand */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ backgroundColor: primary }}
      >
        <div className="flex items-center gap-3">
          {brand?.logo_url ? (
            <img src={brand.logo_url} alt={brand.name} className="h-8 w-8 rounded object-cover" />
          ) : brand?.name ? (
            <div
              className="flex h-8 w-8 items-center justify-center rounded text-xs font-bold"
              style={{ backgroundColor: secondary, color: textColor }}
            >
              {brand.name[0]}
            </div>
          ) : null}
          <span className="text-sm font-medium" style={{ color: textColor }}>
            {brand?.name ?? 'Docs2Video'}
          </span>
        </div>
        {title && (
          <span className="text-xs truncate max-w-[200px]" style={{ color: `${textColor}aa` }}>
            {title}
          </span>
        )}
      </div>

      {/* Video */}
      <div className="relative aspect-video cursor-pointer" onClick={togglePlay}>
        <video
          ref={videoRef}
          src={videoUrl}
          poster={thumbnailUrl ?? undefined}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
          onEnded={() => setPlaying(false)}
          className="w-full h-full object-contain"
          style={{ backgroundColor: '#000' }}
          playsInline
        />
        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: `${primary}dd` }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill={textColor}>
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-4 py-3 space-y-2" style={{ backgroundColor: bg }}>
        {/* Progress bar */}
        <div
          className="h-1.5 rounded-full cursor-pointer overflow-hidden"
          style={{ backgroundColor: `${textColor}20` }}
          onClick={handleSeek}
        >
          <div
            className="h-full rounded-full transition-all duration-150"
            style={{ width: `${progress}%`, backgroundColor: secondary }}
          />
        </div>

        {/* Time */}
        <div className="flex items-center justify-between">
          <button
            onClick={togglePlay}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:opacity-80"
            style={{ backgroundColor: `${textColor}15` }}
          >
            {playing ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill={textColor}>
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill={textColor}>
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <span className="text-xs" style={{ color: `${textColor}80` }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  )
}
