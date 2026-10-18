import { useLayoutEffect, useRef } from 'react'
import { AbsoluteFill, continueRender, delayRender, useVideoConfig } from 'remotion'

/**
 * STAGE — the box every infographic layout sits in, so a scene can never run
 * off the top or bottom of the frame or slide under the brand logo.
 *
 * The words inside are already kept to their width by <Fit> (lib/fit.tsx).
 * What <Fit> can't see is the scene as a whole: a long heading plus four
 * cards plus the intro logo can add up to more than the frame is tall. The
 * Stage measures the real laid-out height of its content every frame and:
 *
 *   - centres it on the frame, exactly as the layouts always did;
 *   - but never higher than `top` or lower than `bottom` (the space kept clear
 *     for the eyebrow, the corner logo, the intro/outro brand lockup);
 *   - and if it still doesn't fit, scales the whole group down together.
 *
 * It only scales (never re-wraps), so the <Fit> text inside keeps the width it
 * measured itself against. The content column has a fixed pixel width for the
 * same reason. Below `minScale` it still shrinks rather than overflow, and logs
 * D2V_FIT_SMALL so the overflow QA reports it as a warning.
 */

/** Clear space kept at the very top and bottom of the frame. */
export const EDGE = 60

export type Reserve = {
  /** Keep content below this y (px from the top). */
  top?: number
  /** Keep content above this distance from the bottom (px). */
  bottom?: number
}

const fontsReady = () => typeof document === 'undefined' || !document.fonts || document.fonts.status === 'loaded'

export const Stage: React.FC<{
  /** Width of the content column in px (capped to the frame minus `padX` each side). */
  width: number
  padX?: number
  reserve?: Reserve
  /** Smallest scale before QA warns (it still goes smaller rather than overflow). */
  minScale?: number
  /** Drawn behind the content, centred on the frame (e.g. a glow) — not measured. */
  backdrop?: React.ReactNode
  children: React.ReactNode
}> = ({ width, padX = 120, reserve, minScale = 0.8, backdrop, children }) => {
  const { width: W, height: H } = useVideoConfig()
  const colW = Math.max(200, Math.min(width, W - 2 * padX))
  const ref = useRef<HTMLDivElement>(null)
  const top = Math.max(EDGE, reserve?.top ?? 0)
  const bottom = Math.max(EDGE, reserve?.bottom ?? 0)

  const place = () => {
    const el = ref.current
    if (!el) return
    const h = el.offsetHeight   // the laid-out height; transforms don't change it
    if (!h) return
    const avail = Math.max(1, H - top - bottom)
    const s = h > avail ? avail / h : 1
    const hs = h * s
    // Centred on the frame, then pushed down/up just enough to clear the reserves.
    const y = Math.min(Math.max((H - hs) / 2, top), H - bottom - hs)
    el.style.transform = `translateY(${y.toFixed(2)}px) scale(${s.toFixed(4)})`
    if (s < minScale) {
      console.log('D2V_FIT_SMALL ' + JSON.stringify({ what: 'Stage', size: Math.round(s * 100), min: Math.round(minScale * 100), text: (el.textContent || '').slice(0, 80) }))
    }
  }

  // Children's <Fit>s run their layout effects first (React runs a child's
  // before its parent's), so their final sizes are in place when this measures.
  // If fonts are still loading, measure again once they land — after the Fits
  // do (their callbacks were registered first).
  useLayoutEffect(() => {
    place()
    if (!fontsReady()) {
      const handle = delayRender('Stage: waiting for fonts before measuring')
      document.fonts.ready.then(() => {
        place()
        continueRender(handle)
      })
    }
  })

  return (
    <AbsoluteFill>
      {backdrop ? <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>{backdrop}</AbsoluteFill> : null}
      <div
        ref={ref}
        style={{
          position: 'absolute', top: 0, left: (W - colW) / 2, width: colW,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          transformOrigin: '50% 0',
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  )
}
