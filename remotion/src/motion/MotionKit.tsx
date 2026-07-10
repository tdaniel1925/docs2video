import { useCurrentFrame, useVideoConfig, spring, interpolate, Easing, Img, staticFile } from 'remotion'

/**
 * MotionKit — the motion VOCABULARY. Named, parameterized techniques a director
 * chooses from, each with research-verified easing/spring values. The whole
 * point: consecutive scenes pick DIFFERENT techniques → variety + intent, not
 * one reused slide-up. Values grounded in the motion-design research pass:
 *  - linear reads cheap; use eased curves per scene
 *  - spring overshoot (overshootClamping:false) for punch
 *  - stagger + follow-through for premium secondary motion
 *  - 2.5D camera = perspective on the PARENT + translateZ/rotateY
 */

// ── signature eases (verified named curves) ──
export const EASE = {
  expoOut: Easing.bezier(0.16, 1, 0.3, 1),      // smooth, luxurious settle
  backOut: Easing.bezier(0.34, 1.56, 0.64, 1),  // overshoot punch
  circOut: Easing.bezier(0, 0.55, 0.45, 1),
  anticipate: Easing.bezier(0.36, 0, 0.66, -0.56),
  power: Easing.bezier(0.22, 1, 0.36, 1),
}

// ── entrance taxonomy: each returns a CSS transform + opacity for local time t ──
export type EntranceName = 'flip3D' | 'zoomBlur' | 'maskWipe' | 'driftDepth' | 'riseOvershoot' | 'slideEdge' | 'unfold' | 'punchIn'

export function useEntrance(name: EntranceName, at: number, opts?: { edge?: 'l' | 'r' | 't' | 'b' }) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const t = frame - at
  // primary progress via a springy or eased ramp depending on the move
  const sp = spring({ frame: t, fps, config: { damping: 15, stiffness: 110, mass: 0.9, overshootClamping: false } })
  const e = (dur: number, ease = EASE.expoOut) => interpolate(t, [0, dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease })

  switch (name) {
    case 'flip3D': { // card flips in on Y axis (needs perspective on parent)
      const p = e(24, EASE.expoOut)
      return { transform: `perspective(1600px) rotateY(${(1 - p) * -85}deg) translateZ(${(1 - p) * -200}px) scale(${0.9 + p * 0.1})`, opacity: interpolate(t, [0, 6], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }), filter: 'none' }
    }
    case 'zoomBlur': { // rushes in from big + blurred → sharp (motion-blur reveal)
      const p = e(20, EASE.power)
      return { transform: `scale(${1.5 - p * 0.5})`, opacity: p, filter: `blur(${(1 - p) * 22}px)` }
    }
    case 'maskWipe': { // revealed by a wipe (clip-path handled by wrapper); scale settle
      const p = e(22, EASE.expoOut)
      return { transform: `scale(${0.98 + p * 0.02})`, opacity: 1, clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`, filter: 'none' }
    }
    case 'driftDepth': { // floats forward from deep space with slight yaw
      const p = e(26, EASE.expoOut)
      return { transform: `perspective(1800px) translateZ(${(1 - p) * -1200}px) rotateY(${(1 - p) * 26}deg) translateX(${(1 - p) * -160}px)`, opacity: interpolate(t, [0, 8], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }), filter: 'none' }
    }
    case 'riseOvershoot': { // rises with a spring bounce
      return { transform: `translateY(${(1 - sp) * 300}px) scale(${0.9 + sp * 0.1})`, opacity: interpolate(t, [0, 8], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }), filter: 'none' }
    }
    case 'slideEdge': {
      const p = e(20, EASE.backOut)
      const edge = opts?.edge ?? 'r'
      const off = (1 - p) * 900
      const tf = edge === 'l' ? `translateX(${-off}px)` : edge === 'r' ? `translateX(${off}px)` : edge === 't' ? `translateY(${-off}px)` : `translateY(${off}px)`
      return { transform: `${tf} scale(${0.94 + p * 0.06})`, opacity: interpolate(t, [0, 6], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }), filter: 'none' }
    }
    case 'unfold': { // tips up from the bottom edge (rotateX)
      const p = e(24, EASE.expoOut)
      return { transform: `perspective(1500px) rotateX(${(1 - p) * 70}deg) translateY(${(1 - p) * 120}px) scale(${0.92 + p * 0.08})`, opacity: interpolate(t, [0, 6], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }), filter: 'none', transformOrigin: 'bottom center' }
    }
    case 'punchIn': { // hard scale-punch with overshoot (energetic beats)
      return { transform: `scale(${interpolate(sp, [0, 1], [0.4, 1])})`, opacity: interpolate(t, [0, 4], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }), filter: 'none' }
    }
  }
}

// ── continuous "alive" secondary motion once settled ──
export function useIdleDrift(seed = 0) {
  const frame = useCurrentFrame()
  return {
    y: Math.sin(frame * 0.03 + seed) * 7,
    r: Math.sin(frame * 0.022 + seed) * 0.5,
    s: 1 + Math.sin(frame * 0.018 + seed) * 0.004, // scale breathing
  }
}

// ── camera move applied to a whole scene (Ken Burns / push-in toward a point) ──
export function useCameraMove(kind: 'pushIn' | 'pullBack' | 'panLeft' | 'panRight' | 'kenBurns', at: number, focusX = 50, focusY = 50) {
  const frame = useCurrentFrame(); const { durationInFrames } = useVideoConfig()
  const p = interpolate(frame, [at, at + durationInFrames], [0, 1], { extrapolateRight: 'clamp', easing: EASE.expoOut })
  switch (kind) {
    case 'pushIn': return { scale: 1 + p * 0.12, x: (50 - focusX) * p * 0.4, y: (50 - focusY) * p * 0.4 }
    case 'pullBack': return { scale: 1.14 - p * 0.12, x: 0, y: 0 }
    case 'panLeft': return { scale: 1.08, x: p * 60, y: 0 }
    case 'panRight': return { scale: 1.08, x: -p * 60, y: 0 }
    case 'kenBurns': return { scale: 1.06 + p * 0.08, x: (50 - focusX) * p * 0.5, y: (50 - focusY) * p * 0.5 }
  }
}

// ── a UI screenshot wrapped in a browser chrome, given an entrance ──
export const UICard: React.FC<{ src: string; entrance: EntranceName; at: number; edge?: 'l' | 'r' | 't' | 'b'; width?: number; seed?: number; glowBeat?: number }> =
({ src, entrance, at, edge, width = 1120, seed = 0, glowBeat = 0 }) => {
  const en = useEntrance(entrance, at, { edge })
  const idle = useIdleDrift(seed)
  return (
    <div style={{
      width, borderRadius: 16, overflow: 'hidden',
      transform: `${en.transform} translateY(${idle.y}px) rotate(${idle.r}deg) scale(${idle.s})`,
      opacity: en.opacity, clipPath: (en as any).clipPath, filter: en.filter,
      transformOrigin: (en as any).transformOrigin ?? 'center',
      boxShadow: `0 46px 120px rgba(0,0,0,0.62), 0 0 ${24 + glowBeat * 60}px rgba(74,159,224,${0.15 + glowBeat * 0.25})`,
      border: '1px solid #2a3648',
    }}>
      <Img src={staticFile(src)} style={{ width: '100%', display: 'block' }} />
    </div>
  )
}
