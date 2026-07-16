import React from 'react'
import { AbsoluteFill, Img, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import { loadFont as loadArchivoBlack } from '@remotion/google-fonts/ArchivoBlack'
import { KineticSlam, toFrames, type Slam } from './lib/kinetic'
import transients from '../public/d2v-kinetic/transients.json'

const { fontFamily: BLACK } = loadArchivoBlack()
const FPS = 30
const ACCENT = '#0d9488'   // Docs2Video teal accent (the one restrained color, Apple-style)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ============================================================================
 * DOCS2VIDEO — KINETIC SLAM edition. Fast black/white word slams frame-locked to
 * SYNCOPATED DRUM TRANSIENTS, with a few text-over-image beats, ending on a clean
 * Apple-style LOGO REVEAL. The script sells the product one punchy word per hit.
 * ==========================================================================*/

const HITS = toFrames((transients as any).transients, FPS)

// one word/phrase PER DRUM HIT. Punchy. A few 'over' image beats for texture.
// The teal accent used sparingly (Apple restraint). Ends before the logo reveal.
const SLAMS: Slam[] = [
  { text: 'YOU', mode: 'solid' },
  { text: 'SEND', mode: 'solid' },
  { text: 'DOCS.', mode: 'solid', invert: true },
  { text: 'THEY', mode: 'over', img: 'd2v-kinetic/reading.png' },
  { text: "DON'T", mode: 'over', img: 'd2v-kinetic/reading.png' },
  { text: 'READ', mode: 'over', img: 'd2v-kinetic/reading.png' },
  { text: 'THEM.', mode: 'solid', invert: true },
  { text: 'SO', mode: 'solid' },
  { text: 'STOP', mode: 'solid', accent: ACCENT, size: 240 },
  { text: 'SENDING', mode: 'solid' },
  { text: 'DOCS.', mode: 'solid', invert: true },
  { text: 'UPLOAD', mode: 'solid' },
  { text: 'ANY', mode: 'solid' },
  { text: 'FILE.', mode: 'solid', invert: true },
  { text: 'AI', mode: 'solid', accent: ACCENT },
  { text: 'READS', mode: 'solid' },
  { text: 'IT.', mode: 'solid', invert: true },
  { text: 'WRITES', mode: 'solid' },
  { text: 'A', mode: 'solid' },
  { text: 'STORY.', mode: 'solid', accent: ACCENT },
  { text: 'BUILDS', mode: 'solid' },
  { text: 'A', mode: 'solid' },
  { text: 'VIDEO.', mode: 'over', img: 'd2v-kinetic/screen.png' },
  { text: 'BRANDED.', mode: 'over', img: 'd2v-kinetic/screen.png' },
  { text: 'NARRATED.', mode: 'over', img: 'd2v-kinetic/screen.png' },
  { text: 'YOURS.', mode: 'solid', invert: true },
  { text: 'IN', mode: 'solid' },
  { text: 'MINUTES.', mode: 'solid', accent: ACCENT, size: 180 },
  { text: 'NOT', mode: 'solid' },
  { text: 'HOURS.', mode: 'solid', invert: true },
  { text: 'THEY', mode: 'solid' },
  { text: 'WATCH.', mode: 'solid' },
  { text: 'THEY', mode: 'solid' },
  { text: 'GET', mode: 'solid' },
  { text: 'IT.', mode: 'solid', accent: ACCENT },
  { text: 'THEY', mode: 'solid' },
  { text: 'SAY', mode: 'solid' },
  { text: 'YES.', mode: 'solid', invert: true, size: 240 },
]

// The detector found 134 hits (very dense, front-loaded). If we used the first N
// they'd all burn in the first ~7s and leave a dead static logo for 17s (the bug).
// Instead: pick hits SPREAD across the body (0 → ~19.5s) so the words fill the
// whole track, then reveal the logo with ~4.5s to breathe.
export const D2VK_FRAMES = Math.round(24.0 * FPS)
const LOGO_AT = Math.round(19.5 * FPS)
// candidate hits within the body, then evenly sample SLAMS.length of them
const bodyHits = HITS.filter((h) => h < LOGO_AT - 6)
const N = SLAMS.length
const WORD_HITS: number[] = []
for (let i = 0; i < N; i++) {
  const idx = Math.round((i * (bodyHits.length - 1)) / (N - 1))
  WORD_HITS.push(bodyHits[idx])
}
// snap the logo to the nearest real hit near LOGO_AT so it lands on a drum
const LOGO_HIT = HITS.reduce((best, h) => Math.abs(h - LOGO_AT) < Math.abs(best - LOGO_AT) ? h : best, LOGO_AT)

// Apple-style logo reveal: black screen, logo pops in on the beat with a subtle
// scale-settle + the teal accent glow, holds clean to the end.
const LogoReveal: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()   // sequence-relative (starts at 0)
  const pop = spring({ frame: f, fps, config: { damping: 13, stiffness: 150 } })
  const flash = interpolate(f, [-2, 0, 6], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const tagO = interpolate(f, [16, 28], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ background: '#000', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 26 }}>
      <div style={{ transform: `scale(${0.7 + clamp(pop, 0, 1) * 0.3})`, filter: `drop-shadow(0 0 ${30 * clamp(pop, 0, 1)}px ${ACCENT}66)` }}>
        <Img src={staticFile('d2v-kinetic/logo.png')} style={{ width: 640, height: 'auto', display: 'block' }} />
      </div>
      <div style={{ fontFamily: BLACK, fontSize: 30, letterSpacing: '0.06em', color: '#fff', opacity: tagO, textTransform: 'uppercase' }}>
        Any document. <span style={{ color: ACCENT }}>One video.</span>
      </div>
      <div style={{ fontFamily: BLACK, fontSize: 22, letterSpacing: '0.04em', color: '#8fa3bf', opacity: tagO }}>docs2video.com · start free</div>
      {/* white flash on the reveal hit */}
      <AbsoluteFill style={{ background: '#fff', opacity: flash * 0.9, pointerEvents: 'none' }} />
    </AbsoluteFill>
  )
}

export const CommercialDocs2VideoKinetic: React.FC = () => (
  <AbsoluteFill>
    {/* word slams frame-locked to drums, SPREAD across the whole body (WORD_HITS) */}
    <Sequence from={0} durationInFrames={LOGO_HIT}>
      <KineticSlam slams={SLAMS} hits={WORD_HITS} font={BLACK} end={LOGO_HIT} />
    </Sequence>
    {/* Apple-style clean logo reveal — lands on a real drum hit, holds to the end */}
    <Sequence from={LOGO_HIT} durationInFrames={D2VK_FRAMES - LOGO_HIT}>
      <LogoReveal />
    </Sequence>
    <Audio src={staticFile('d2v-kinetic/music.mp3')} volume={0.85} />
  </AbsoluteFill>
)
