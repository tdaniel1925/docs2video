import React from 'react'
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, interpolate, Easing } from 'remotion'

/* ============================================================================
 * CINEMATIC FOOTAGE — makes free Pexels stock look like a filmed commercial.
 * Layers a full post-grade over a video clip: color grade (crushed blacks, teal/
 * orange, S-curve contrast), film grain, bloom/halation on highlights, vignette,
 * optional letterbox + slow-mo + Ken-Burns push, and a brand-color tint so the
 * footage binds to the brand palette. Any Pexels clip drops in looking cinematic.
 *
 *   <CinematicFootage src="apex/footage/win.mp4" dur={D} grade="warm"
 *      brand="#cc2027" slowmo letterbox trim={2} focus="50% 40%" />
 * ==========================================================================*/

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const FPS = 30

type Grade = 'warm' | 'cool' | 'teal-orange' | 'noir' | 'clean'
// base CSS filter grade — the "expensive camera" look
const GRADES: Record<Grade, string> = {
  warm: 'brightness(0.92) contrast(1.18) saturate(1.06) sepia(0.1)',
  cool: 'brightness(0.9) contrast(1.2) saturate(1.02) hue-rotate(-6deg)',
  'teal-orange': 'brightness(0.9) contrast(1.22) saturate(1.12)',
  noir: 'brightness(0.85) contrast(1.4) saturate(0.35)',
  clean: 'brightness(0.98) contrast(1.08) saturate(1.05)',
}

export const CinematicFootage: React.FC<{
  src: string; dur: number; trim?: number; focus?: string
  grade?: Grade; brand?: string; brandStrength?: number
  slowmo?: boolean | number; letterbox?: boolean; push?: number
  grain?: number; bloom?: number; vignette?: number
  children?: React.ReactNode
}> = ({
  src, dur, trim = 0, focus = '50% 45%', grade = 'teal-orange', brand, brandStrength = 0.14,
  slowmo = false, letterbox = false, push = 0.06, grain = 0.08, bloom = 1, vignette = 1, children,
}) => {
  const frame = useCurrentFrame()
  const rate = typeof slowmo === 'number' ? slowmo : slowmo ? 0.5 : 1
  const p = interpolate(frame, [0, dur], [0, 1], { extrapolateRight: 'clamp' })
  const scale = 1.02 + push * p       // subtle Ken-Burns even on moving footage
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#000' }}>
      {/* the footage, graded + pushed */}
      <OffthreadVideo
        src={staticFile(src)} startFrom={Math.round(trim * FPS)} playbackRate={rate} muted
        style={{ width: '108%', height: '108%', position: 'absolute', left: '-4%', top: '-4%', objectFit: 'cover', objectPosition: focus, transform: `scale(${scale})`, filter: GRADES[grade] }}
      />
      {/* teal-shadows / orange-highlights split-tone (the blockbuster grade) */}
      {grade === 'teal-orange' && <>
        <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(20,45,55,0.35), transparent 45%)', mixBlendMode: 'multiply' }} />
        <AbsoluteFill style={{ background: 'radial-gradient(70% 70% at 60% 40%, rgba(255,150,60,0.14), transparent 60%)', mixBlendMode: 'screen' }} />
      </>}
      {/* brand color tint — binds the footage to the brand palette */}
      {brand && <AbsoluteFill style={{ background: brand, opacity: brandStrength, mixBlendMode: 'soft-light' as any }} />}
      {/* bloom/halation — highlights glow softly (cinema warmth) */}
      {bloom > 0 && <AbsoluteFill style={{ background: 'radial-gradient(60% 55% at 50% 42%, rgba(255,245,220,0.1), transparent 65%)', mixBlendMode: 'screen', opacity: bloom }} />}
      {/* vignette */}
      {vignette > 0 && <AbsoluteFill style={{ background: `radial-gradient(125% 125% at 50% 46%, transparent 40%, rgba(0,0,0,${0.62 * vignette}))`, pointerEvents: 'none' }} />}
      {/* film grain (moving) — the single biggest 'looks like film' trick */}
      {grain > 0 && <Grain opacity={grain} />}
      {/* letterbox bars — instant cinematic crop */}
      {letterbox && <>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '11%', background: '#000' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '11%', background: '#000' }} />
      </>}
      {children}
    </AbsoluteFill>
  )
}

const Grain: React.FC<{ opacity: number }> = ({ opacity }) => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: 'overlay', pointerEvents: 'none' }}>
      <svg width="100%" height="100%"><filter id="fgrain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 10} /></filter><rect width="100%" height="100%" filter="url(#fgrain)" /></svg>
    </AbsoluteFill>
  )
}

// a light-leak / flash wipe made for cutting between footage clips on a beat
export const FootageFlash: React.FC<{ at: number; color?: string; dur?: number }> = ({ at, color = '#ffffff', dur = 8 }) => {
  const frame = useCurrentFrame()
  const o = interpolate(frame, [at - 2, at, at + dur], [0, 0.7, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  if (o <= 0) return null
  return <AbsoluteFill style={{ background: color, opacity: o, pointerEvents: 'none' }} />
}
