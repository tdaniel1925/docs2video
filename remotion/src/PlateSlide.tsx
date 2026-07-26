// PLATE + TEXT — the hybrid.
//
// Gemini designs and renders the slide, then a second pass strips its own type
// to leave a clean background PLATE. Everything readable is re-set here in
// Remotion as real text: editable, brand-swappable, compliance-scrubbable, and
// animatable. The Gemini slide-with-text is the design guide; the plate is what
// actually ships underneath.
import React from 'react'
import {
  AbsoluteFill, Img, staticFile, interpolate, spring,
  useCurrentFrame, useVideoConfig, Sequence,
} from 'remotion'
import { loadFont as loadArchivo } from '@remotion/google-fonts/Archivo'

export const PLATE_FPS = 30
export const PLATE_FRAMES = 210 // 7s

const NAVY = '#123049'
const CORAL = '#E8443A'
const YELLOW = '#FFC629'
const CREAM = '#F5EFE2'

// Load the face explicitly and use the family name it reports. Naming a font
// in a CSS string that was never loaded silently falls back to the system sans
// — which is exactly how a deck ends up looking nothing like its design guide.
const { fontFamily: ARCHIVO } = loadArchivo()
/** Condensed poster face, matching the display type in the plate. */
const DISPLAY = `"${ARCHIVO}", Impact, sans-serif`

/** Heavy poster type sits on busy photography, so it needs the same dark
 *  outline the generated design used or it stops reading. */
const outline = (c: string, w = 3) =>
  `${w}px ${w}px 0 ${c}, -${w}px -${w}px 0 ${c}, ${w}px -${w}px 0 ${c}, -${w}px ${w}px 0 ${c},
   ${w}px 0 0 ${c}, -${w}px 0 0 ${c}, 0 ${w}px 0 ${c}, 0 -${w}px 0 ${c}`

/** Rise + settle. Overshoot is what makes poster type feel struck rather than
 *  faded in. */
const useRise = (delay: number, damping = 14) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: frame - delay, fps, config: { damping, mass: 0.7 } })
  return { y: interpolate(s, [0, 1], [60, 0]), o: interpolate(s, [0, 1], [0, 1]), s }
}

/** Digits tick up to the real figure, formatted with commas throughout so the
 *  number never reads as a raw integer mid-count. */
const CountUp: React.FC<{ to: number; delay: number; prefix?: string }> = ({ to, delay, prefix = '' }) => {
  const frame = useCurrentFrame()
  const p = interpolate(frame - delay, [0, 55], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  })
  // Ease-out so it decelerates into the final value rather than stopping dead.
  const eased = 1 - Math.pow(1 - p, 3)
  return <>{prefix}{Math.round(to * eased).toLocaleString('en-US')}</>
}

export const PlateSlide: React.FC = () => {
  const frame = useCurrentFrame()

  // Slow push on the plate — a still frame reads as a dead slide the moment
  // anything else on screen moves.
  const scale = interpolate(frame, [0, PLATE_FRAMES], [1.06, 1.13])
  const drift = interpolate(frame, [0, PLATE_FRAMES], [0, -14])

  const kicker = useRise(4)
  const head = useRise(12)
  const label = useRise(46)
  const b1 = useRise(74, 11)
  const b2 = useRise(86, 11)
  const bar = useRise(100)

  return (
    <AbsoluteFill style={{ backgroundColor: NAVY, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${scale}) translateX(${drift}px)` }}>
        <Img src={staticFile('plates/growth.jpg')}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </AbsoluteFill>

      {/* Left type block — all of this is real text */}
      <AbsoluteFill style={{ padding: '68px 0 0 78px' }}>
        <div style={{
          fontFamily: DISPLAY, fontSize: 46, fontWeight: 700, color: NAVY,
          opacity: kicker.o, transform: `translateY(${kicker.y}px)`, letterSpacing: '.02em',
        }}>02</div>

        <div style={{
          fontFamily: DISPLAY, fontSize: 92, fontWeight: 700, color: NAVY,
          letterSpacing: '-.02em', lineHeight: 1, marginTop: 14,
          opacity: head.o, transform: `translateY(${head.y}px)`,
          textShadow: outline('#ffffff', 2),
        }}>WHAT IT BECOMES</div>

        {/* The hero figure counts up. Tabular figures stop the width jittering
            as digits change, which would otherwise shake the whole line. */}
        <div style={{
          fontFamily: DISPLAY, fontSize: 168, fontWeight: 700, color: CORAL,
          letterSpacing: '-.03em', lineHeight: 1, marginTop: 6,
          fontVariantNumeric: 'tabular-nums',
          textShadow: outline('#ffffff', 4),
          // Gradient-clipped text needs headroom or the $ and comma descenders clip.
          paddingBottom: 12,
        }}>
          <CountUp to={176204} delay={30} prefix="$" />
        </div>

        <div style={{
          fontFamily: DISPLAY, fontSize: 40, fontWeight: 700, color: NAVY,
          letterSpacing: '.04em', marginTop: 2,
          opacity: label.o, transform: `translateY(${label.y}px)`,
        }}>PROJECTED CASH VALUE</div>
      </AbsoluteFill>

      {/* Badge text, dropped into the empty badge shapes the plate kept.
          Coordinates are measured off the PLATE, not off the design guide —
          the strip pass re-composes slightly, so guide positions don't carry
          over. Each is centred on its shape and rotated to match it. */}
      <div style={{
        position: 'absolute', left: 1447, top: 689, width: 420,
        marginLeft: -210, marginTop: -26, textAlign: 'center',
        transform: `rotate(-10deg) scale(${interpolate(b1.s, [0, 1], [0.72, 1])})`,
        opacity: b1.o, fontFamily: DISPLAY, fontSize: 38, fontWeight: 700, color: NAVY,
        letterSpacing: '-.01em', whiteSpace: 'nowrap',
      }}>98% PARTICIPATION</div>

      <div style={{
        position: 'absolute', left: 1642, top: 802, width: 340,
        marginLeft: -170, marginTop: -24, textAlign: 'center',
        transform: `rotate(-8deg) scale(${interpolate(b2.s, [0, 1], [0.72, 1])})`,
        opacity: b2.o, fontFamily: DISPLAY, fontSize: 36, fontWeight: 700, color: CREAM,
        letterSpacing: '-.01em', whiteSpace: 'nowrap',
      }}>FLOOR OF 0%</div>

      {/* Disclosure bar — real text, so compliance can scrub it */}
      <Sequence from={0}>
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: 92,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: bar.o,
        }}>
          <span style={{
            fontFamily: DISPLAY, fontSize: 27, fontWeight: 700, color: CREAM,
            letterSpacing: '.06em', textAlign: 'center',
          }}>
            PROJECTED VALUES ARE NOT GUARANTEED . SEE YOUR FULL ILLUSTRATION FOR COMPLETE TERMS
          </span>
        </div>
      </Sequence>

      {/* A yellow wipe that sweeps the chart area once, so the plate's static
          bars feel like they were drawn rather than photographed. */}
      <AbsoluteFill style={{
        background: `linear-gradient(90deg, transparent, ${YELLOW}33, transparent)`,
        transform: `translateX(${interpolate(frame, [18, 70], [-1400, 1900], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        })}px)`,
        mixBlendMode: 'screen', pointerEvents: 'none',
      }} />
    </AbsoluteFill>
  )
}
