import React from 'react'
import { AbsoluteFill, useCurrentFrame, interpolate, Easing, Sequence, useVideoConfig, staticFile, Img } from 'remotion'

/* ============================================================================
 * TORN PAPER — sample of the signature transition (like Apex's site + the ref
 * videos). A ragged paper edge sweeps down/across and RIPS away the top layer to
 * reveal the layer beneath. Built with an SVG jagged clip-path so the tear edge
 * is irregular (real paper), plus a faint paper-grain texture + drop shadow on
 * the torn edge for depth. Pure code — no image assets needed.
 * ==========================================================================*/

const FPS = 30

// a ragged horizontal tear edge as an SVG path, at vertical position `y` (0-100%).
// The jaggedness is deterministic so it doesn't flicker frame to frame.
function tearPath(y: number, w = 1920, h = 1080): string {
  const yPx = (y / 100) * h
  const segs = 26
  const pts: string[] = [`M 0 ${yPx}`]
  // pseudo-random but fixed ragged edge
  const rand = (i: number) => (Math.sin(i * 12.9898) * 43758.5453) % 1
  for (let i = 1; i <= segs; i++) {
    const x = (i / segs) * w
    const jag = (rand(i) - 0.5) * 46 + Math.sin(i * 1.7) * 10   // ±ragged
    pts.push(`L ${x.toFixed(1)} ${(yPx + jag).toFixed(1)}`)
  }
  // close up over the top so we fill the ABOVE-tear region
  pts.push(`L ${w} 0 L 0 0 Z`)
  return pts.join(' ')
}

// paper texture as an inline SVG noise overlay
const paperTexture = 'url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><filter id=%22p%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.04 0.08%22 numOctaves=%223%22 seed=%224%22/><feColorMatrix type=%22matrix%22 values=%220 0 0 0 0.9  0 0 0 0 0.88  0 0 0 0 0.82  0 0 0 0.06 0%22/></filter><rect width=%22200%22 height=%22200%22 filter=%22url(%23p%22)%22/></svg>")'

// A full-frame "paper card": a solid color panel with paper grain + centered text.
const Panel: React.FC<{ bg: string; fg: string; kicker?: string; title: string; sub?: string; font: string }> =
({ bg, fg, kicker, title, sub, font }) => (
  <AbsoluteFill style={{ background: bg }}>
    <AbsoluteFill style={{ backgroundImage: paperTexture, backgroundSize: '340px', mixBlendMode: 'multiply', opacity: 0.6 }} />
    {/* faint repeated background wordmark (like the ref videos) */}
    <AbsoluteFill style={{ display: 'flex', flexWrap: 'wrap', overflow: 'hidden', opacity: 0.06, alignContent: 'center' }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} style={{ fontFamily: font, fontWeight: 900, fontSize: 120, color: fg, textTransform: 'uppercase', whiteSpace: 'nowrap', width: '100%', textAlign: i % 2 ? 'right' : 'left' }}>APEX AFFINITY</div>
      ))}
    </AbsoluteFill>
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 10 }}>
      {kicker && <div style={{ fontFamily: font, fontWeight: 800, fontSize: 26, letterSpacing: '0.3em', color: fg, opacity: 0.7, textTransform: 'uppercase' }}>{kicker}</div>}
      <div style={{ fontFamily: font, fontWeight: 900, fontSize: 120, color: fg, textTransform: 'uppercase', textAlign: 'center', lineHeight: 0.95, letterSpacing: '-0.02em' }}>{title}</div>
      {sub && <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 40, color: fg, opacity: 0.85, marginTop: 8 }}>{sub}</div>}
    </AbsoluteFill>
  </AbsoluteFill>
)

// The TEAR: the TOP panel is clipped by the tear path and slides up+away, ripping
// off to reveal the BOTTOM panel underneath. A drop-shadow + light edge sell the
// paper depth.
const TornReveal: React.FC<{ top: React.ReactNode; bottom: React.ReactNode; at: number; dur?: number }> =
({ top, bottom, at, dur = 22 }) => {
  const frame = useCurrentFrame()
  const t = interpolate(frame, [at, at + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) })
  // tear sweeps from y=110 (below frame, top fully covers) up to y=-10 (top gone)
  const tearY = interpolate(t, [0, 1], [112, -12])
  const lift = interpolate(t, [0, 1], [0, -140])          // torn piece lifts up as it goes
  const clip = `path('${tearPath(tearY)}')`
  return (
    <AbsoluteFill>
      {bottom}
      {/* the tearing-away TOP layer */}
      <AbsoluteFill style={{ clipPath: clip, WebkitClipPath: clip, transform: `translateY(${lift}px)`, filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.45))' }}>
        {top}
      </AbsoluteFill>
      {/* bright torn-edge highlight riding the rip */}
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, transform: `translateY(${lift}px)`, opacity: t > 0 && t < 1 ? 1 : 0 }}>
        <path d={tearPath(tearY).replace(' L 1920 0 L 0 0 Z', '')} fill="none" stroke="#fff" strokeWidth={5} strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))' }} />
      </svg>
    </AbsoluteFill>
  )
}

const FONT = 'Archivo Black, Impact, sans-serif'
const NAVY = '#16244a', RED = '#e01f26', CREAM = '#f4efe6', INK = '#1a1a1a'

export const TORN_FRAMES = FPS * 8

export const TornPaperTest: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      {/* Beat 1 → tears to Beat 2 */}
      <Sequence from={0} durationInFrames={FPS * 3}>
        <TornReveal
          at={FPS * 1.6}
          top={<Panel bg={CREAM} fg={INK} kicker="Insurance pros" title={'Buried in\nspreadsheets?'} font={FONT} />}
          bottom={<Panel bg={NAVY} fg={CREAM} kicker="The unfair advantage" title="SmartViewz" sub="ask your book anything" font={FONT} />}
        />
      </Sequence>
      {/* Beat 2 → tears to Beat 3 (red) */}
      <Sequence from={FPS * 3} durationInFrames={FPS * 3}>
        <TornReveal
          at={FPS * 1.4}
          top={<Panel bg={NAVY} fg={CREAM} kicker="The unfair advantage" title="SmartViewz" sub="ask your book anything" font={FONT} />}
          bottom={<Panel bg={RED} fg={CREAM} title={'Answers in\nseconds.'} font={FONT} />}
        />
      </Sequence>
      {/* Beat 3 hold */}
      <Sequence from={FPS * 6} durationInFrames={FPS * 2}>
        <Panel bg={RED} fg={CREAM} kicker="Get started free" title="Reach your apex." font={FONT} />
      </Sequence>
    </AbsoluteFill>
  )
}
