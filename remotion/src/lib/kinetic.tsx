import React from 'react'
import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate, Easing } from 'remotion'

/* ============================================================================
 * KINETIC SLAM — the fast, beat-locked, black/white kinetic-typography style
 * (Apple-ad style). Words SLAM one-per-cut, frame-locked to SYNCOPATED DRUM
 * TRANSIENTS (not a straight grid) — the rhythm is the whole point.
 *
 * Two modes per word (director picks):
 *   'solid' → full-frame b&w INVERT slam (black-on-white ⇄ white-on-black)
 *   'over'  → big text over a graded image underneath
 *
 * The signature micro-motion on each hit: scale-pop (1.14→1.0 in ~4f) + a 1-2
 * frame directional motion-blur SMEAR + occasional invert flash.
 *
 * Usage: build a SLAMS list [{ text, mode, img?, hit }] where `hit` is the
 * transient frame; the component picks the active word for the current frame.
 * ==========================================================================*/

export type SlamMode = 'solid' | 'over'
export type Slam = { text: string; mode?: SlamMode; img?: string; invert?: boolean; accent?: string; size?: number }

// map transient times (sec) → frames
export const toFrames = (transients: number[], fps: number) => transients.map((t) => Math.round(t * fps))

// A full kinetic sequence. `slams` and `hits` (frames) are parallel arrays.
// Each word shows from its hit until the next hit — frame-locked to the drums.
export const KineticSlam: React.FC<{
  slams: Slam[]; hits: number[]; font: string; end: number
  bg?: string; fg?: string
}> = ({ slams, hits, font, end, bg = '#ffffff', fg = '#000000' }) => {
  const frame = useCurrentFrame()
  // which slam is active
  let idx = 0
  for (let i = 0; i < hits.length; i++) if (frame >= hits[i]) idx = i
  const active = slams[idx]
  const start = hits[idx]
  const next = hits[idx + 1] ?? end
  const since = frame - start
  const life = next - start

  // invert flashing: alternate b&w unless the slam overrides
  const inverted = active?.invert ?? (idx % 2 === 1)
  const solidBg = inverted ? fg : bg
  const solidFg = inverted ? bg : fg

  // scale-pop on the hit (1.14 → 1.0 over 4 frames) + tiny settle
  const scale = since < 5 ? interpolate(since, [0, 4], [1.16, 1.0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }) : 1
  // motion-blur SMEAR for 1-2 frames right at the cut
  const smear = since <= 1 ? 14 : since === 2 ? 6 : 0
  // a 1-frame full white/black invert FLASH on the hit (every few cuts)
  const flash = since === 0 && idx % 3 === 0 ? 1 : 0

  const isOver = active?.mode === 'over' && active.img
  const size = active?.size ?? (active?.text.length > 10 ? 150 : 220)

  return (
    <AbsoluteFill style={{ background: isOver ? '#000' : solidBg, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
      {/* image underneath (over-mode), graded high-contrast */}
      {isOver && (
        <AbsoluteFill>
          <Img src={staticFile(active!.img!)} style={{ width: '108%', height: '108%', position: 'absolute', left: '-4%', top: '-4%', objectFit: 'cover', transform: `scale(${1.02 + since * 0.002})`, filter: 'brightness(0.55) contrast(1.35) grayscale(0.4)' }} />
          <AbsoluteFill style={{ background: 'rgba(0,0,0,0.35)' }} />
        </AbsoluteFill>
      )}
      {/* the slammed word */}
      <div style={{
        fontFamily: font, fontWeight: 900, fontSize: size, lineHeight: 1.05,
        color: isOver ? '#fff' : solidFg, textTransform: 'uppercase', letterSpacing: '-0.03em',
        textAlign: 'center', maxWidth: '90%', padding: '0 40px',
        transform: `scale(${scale}) translateX(${smear > 6 ? -6 : 0}px)`,
        filter: smear ? `blur(${smear}px)` : undefined,
        textShadow: isOver ? '0 6px 40px rgba(0,0,0,0.8)' : undefined,
      }}>
        {active?.accent
          ? <span style={{ color: active.accent }}>{active.text}</span>
          : active?.text}
      </div>
      {/* invert flash */}
      {flash > 0 && <AbsoluteFill style={{ background: solidFg, opacity: 0.9 }} />}
    </AbsoluteFill>
  )
}
