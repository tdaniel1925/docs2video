'use client'

import { useLayoutEffect, useRef } from 'react'
import { FLYER_SIZES, VISIBLE_STYLES, thumbUrl } from '../../../_lib/flyer-engine'

/** The size the headline would like to be. It only ever gets smaller than this. */
const HEADLINE_SIZE = 'clamp(18px, 4.5vw, 34px)'
/** Smallest the headline goes. Tiny on a thin banner thumbnail, but never cut off. */
const HEADLINE_FLOOR = 5

/**
 * KEEP THE HEADLINE INSIDE THE PREVIEW.
 *
 * The headline is whatever the customer typed, and the preview can be a thin
 * banner only ~70px tall. At a fixed size a long headline ran out of the top of
 * the picture (the tile hides what spills, so the first lines just vanished)
 * and one long word ran off the side. This measures the real text in the real
 * font and shrinks it until it fits, wrapping at spaces. Only if even the
 * smallest size can't hold one long word does it break inside the word —
 * ugly beats missing. Normal headlines on normal shapes are untouched.
 */
function fitHeadline(tile: HTMLElement, scrim: HTMLElement, el: HTMLElement) {
  const W = tile.clientWidth, H = tile.clientHeight
  if (!W || !H) return
  // The inner margin follows the tile: 16px on a poster, less on a thin banner
  // so the words keep some room.
  const pad = Math.max(4, Math.min(16, Math.round(Math.min(W, H) * 0.08)))
  scrim.style.padding = `${pad}px`
  const room = H - pad * 2
  const fits = () => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= room + 1

  el.style.overflowWrap = 'normal'
  el.style.fontSize = HEADLINE_SIZE
  if (fits()) return
  const search = () => {
    let lo = HEADLINE_FLOOR, hi = parseFloat(getComputedStyle(el).fontSize)
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2
      el.style.fontSize = `${mid}px`
      if (fits()) lo = mid
      else hi = mid
    }
    el.style.fontSize = `${Math.floor(lo * 10) / 10}px`
  }
  search()
  if (!fits()) {
    el.style.fontSize = HEADLINE_SIZE
    el.style.overflowWrap = 'anywhere'
    search()
  }
}

/**
 * The live preview mock — a fast, honest stand-in for the finished design.
 *
 * It is NOT the generated artwork (that's made fresh by the engine and costs
 * credits). It shows three things the moment you choose them, so a choice is a
 * comparison instead of a gamble:
 *   1. the SHAPE — the exact aspect ratio of the size you picked,
 *   2. the LOOK — the chosen style's real thumbnail as a tinted backdrop (or the
 *      reference you uploaded), and
 *   3. your WORDS — the real headline set over it.
 *
 * Deliberately cheap: no API call, updates in well under 100ms on every tap.
 */
export function Preview({
  sizeId, templateId, referenceDataUrl, headline, className, maxHeight = 360,
}: {
  sizeId?: string | null
  templateId?: string | null
  referenceDataUrl?: string | null
  headline?: string
  className?: string
  maxHeight?: number
}) {
  const size = FLYER_SIZES.find((s) => s.id === sizeId) ?? FLYER_SIZES.find((s) => s.id === 'letter')!
  const aspect = `${size.w} / ${size.h}`
  const styleName = VISIBLE_STYLES.find((t) => t.id === templateId)?.name
  const backdrop = referenceDataUrl || (templateId ? thumbUrl(templateId) : null)
  const words = (headline || '').trim()

  const tileRef = useRef<HTMLDivElement>(null)
  const scrimRef = useRef<HTMLDivElement>(null)
  const wordsRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const tile = tileRef.current, scrim = scrimRef.current, el = wordsRef.current
    if (!tile || !scrim || !el) return
    const fit = () => fitHeadline(tile, scrim, el)
    fit()
    // Again when the tile changes size (window resized, panel opened) and once
    // the display font has loaded — a measurement in the fallback font is wrong.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null
    ro?.observe(tile)
    let alive = true
    document.fonts?.ready.then(() => { if (alive) fit() })
    return () => { alive = false; ro?.disconnect() }
  }, [words, size.id])

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-2)' }}>
      <div
        ref={tileRef}
        style={{
          // The width is capped by the height limit too, so a tall size (rack
          // card, story) keeps its real shape instead of being squashed to
          // the height cap at full width.
          position: 'relative', aspectRatio: aspect, maxHeight, width: '100%',
          maxWidth: `min(100%, 420px, ${Math.floor(maxHeight * (size.w / size.h))}px)`, borderRadius: 'var(--r-4)', overflow: 'hidden',
          border: '1px solid var(--t2a-line)', background: '#efece6',
          boxShadow: '0 8px 30px rgba(35,32,28,0.10)',
        }}
      >
        {backdrop ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={backdrop} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(140deg,#f4f1ec,#e6e0d4)' }} />
        )}
        {/* a soft scrim so the headline is always legible over any backdrop */}
        {words && (
          <div ref={scrimRef} style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end',
            background: 'linear-gradient(to top, rgba(20,18,16,.55) 0%, rgba(20,18,16,.05) 45%, transparent 70%)',
            padding: 'var(--sp-4)',
          }}>
            <div ref={wordsRef} className="t2a-display" style={{ color: '#fff', fontSize: HEADLINE_SIZE, textShadow: '0 2px 12px rgba(0,0,0,.4)', maxWidth: '95%', minWidth: 0 }}>
              {words}
            </div>
          </div>
        )}
      </div>
      <div style={{ fontSize: 'var(--fs-1)', color: 'var(--t2a-soft)', textAlign: 'center' }}>
        Preview of layout &amp; type{styleName ? ` · ${styleName}` : ''} — final art is generated fresh.
      </div>
    </div>
  )
}

/**
 * A single aspect-correct skeleton tile for the making screen. `state` drives
 * the shimmer: waiting (dim), busy (shimmer), done (blurred image sharpens in).
 */
export function SkeletonTile({
  sizeId, label, state, src,
}: {
  sizeId: string
  label: string
  state: 'wait' | 'busy' | 'done'
  src?: string
}) {
  const size = FLYER_SIZES.find((s) => s.id === sizeId)
  const aspect = size ? `${size.w} / ${size.h}` : '1 / 1'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)', alignItems: 'center' }}>
      <div
        aria-label={`${label}: ${state === 'done' ? 'ready' : state === 'busy' ? 'designing' : 'queued'}`}
        style={{
          position: 'relative', width: '100%', aspectRatio: aspect, borderRadius: 'var(--r-3)',
          overflow: 'hidden', border: '1px solid var(--t2a-line)',
          background: state === 'done' ? '#111' : '#efece6',
        }}
      >
        {state === 'done' && src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={label}
            style={{ width: '100%', height: '100%', objectFit: 'cover', animation: 't2a-sharpen 500ms var(--ease) both' }} />
        )}
        {state === 'busy' && <div style={{ position: 'absolute', inset: 0, animation: 't2a-shimmer 1.1s linear infinite',
          background: 'linear-gradient(100deg, #efece6 30%, #fff 50%, #efece6 70%)', backgroundSize: '200% 100%' }} />}
      </div>
      <div style={{ fontSize: 'var(--fs-1)', color: 'var(--t2a-soft)', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
    </div>
  )
}
