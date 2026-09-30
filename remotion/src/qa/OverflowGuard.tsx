import { useLayoutEffect } from 'react'
import { continueRender, delayRender, getInputProps, useCurrentFrame, useVideoConfig } from 'remotion'

/**
 * OVERFLOW GUARD — measures every word on the frame and reports any that
 * doesn't sit where a viewer can read it. QA only: mounted by the QA root
 * (src/qa/QARoot.tsx), never in a customer render.
 *
 * For every visible run of text it checks four things, using the real
 * rendered positions (transforms and all):
 *
 *   off-frame  the text reaches past the edge of the video
 *   clipped    an ancestor that hides overflow cuts part of it off
 *   out-of-box the text spills out of the card / panel / pill drawn around it
 *   box-off-frame  a card that holds text runs past the edge of the video
 *                  (the "100% High Cap Rate Ac" bug: the words were inside
 *                  their card; the card was half off the screen)
 *
 * With the `__qaOverlap` input prop (QA_OVERLAP=1 in the runner) it also
 * checks a fifth thing:
 *
 *   overlap    two different pieces of text drawn on top of each other (five
 *              huge bar values printed over one another; a long brand name
 *              printed across the scene title). Nothing is off screen, so the
 *              four checks above can't see it.
 *   over-image words running under a logo, icon or other small picture
 *              (a bottom title sliding under the corner logo).
 *
 * Each finding is logged as `D2V_OVERFLOW {json}`; scripts/overflow-qa.mjs
 * collects them through the browser console and fails the run.
 *
 * A decoration that overlaps words ON PURPOSE (a drop cap, a giant quote mark)
 * opts out of the overlap checks only with data-overlap-ok="<why>".
 *
 * Something that bleeds off the edge ON PURPOSE (a giant decorative numeral)
 * opts out with data-overflow-ok="<why>". Use it sparingly, and say why.
 */

const TOL = 2   // px of slack for anti-aliasing and sub-pixel rounding

type Finding = { kind: string; text: string; by: number; where: string }

function effectiveOpacity(el: Element | null): number {
  let o = 1
  for (let e = el; e && e instanceof Element; e = e.parentElement) {
    const cs = getComputedStyle(e)
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return 0
    o *= parseFloat(cs.opacity || '1')
    if (o < 0.05) return 0
  }
  return o
}

/** A decoration that sits on or next to other words on purpose (drop cap, giant quote mark): skips only the overlap checks. */
function overlapOk(el: Element | null): boolean {
  for (let e = el; e; e = e.parentElement) if (e.hasAttribute('data-overlap-ok')) return true
  return false
}

function optedOut(el: Element | null): boolean {
  for (let e = el; e; e = e.parentElement) if (e.hasAttribute('data-overflow-ok')) return true
  return false
}

function paints(cs: CSSStyleDeclaration): boolean {
  const alpha = (c: string) => {
    const m = c.match(/rgba?\(([^)]+)\)/)
    if (!m) return c === 'transparent' ? 0 : 1
    const parts = m[1].split(/[ ,/]+/).filter(Boolean)
    return parts.length >= 4 ? parseFloat(parts[3]) : 1
  }
  if (alpha(cs.backgroundColor) > 0.04) return true
  if (cs.backgroundImage && cs.backgroundImage !== 'none' && cs.backgroundClip !== 'text' && (cs as any).webkitBackgroundClip !== 'text') return true
  for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
    if (parseFloat((cs as any)[`border${side}Width`]) > 0 && alpha((cs as any)[`border${side}Color`]) > 0.04) return true
  }
  return false
}

function describe(el: Element): string {
  const parts: string[] = []
  for (let e: Element | null = el, i = 0; e && i < 4; e = e.parentElement, i++) {
    const tag = e.tagName.toLowerCase()
    const id = e.getAttribute('data-qa') || e.getAttribute('class')?.split(/\s+/)[0] || ''
    parts.push(id ? `${tag}.${id}` : tag)
  }
  return parts.join(' < ')
}

function textRects(node: Text): DOMRect[] {
  const parent = node.parentElement
  if (parent && parent.closest('svg')) {
    // SVG text: the <text>/<tspan> box is the reliable measure.
    const r = parent.getBoundingClientRect()
    return r.width && r.height ? [r] : []
  }
  const range = document.createRange()
  range.selectNodeContents(node)
  return Array.from(range.getClientRects()).filter((r) => r.width > 0.5 && r.height > 0.5)
}

export function scanForOverflow(W: number, H: number, overlap = false): Finding[] {
  const found: Finding[] = []
  const seen = new Set<string>()
  const add = (f: Finding) => {
    const k = `${f.kind}|${f.text}|${f.where}`
    if (seen.has(k)) return
    seen.add(k)
    found.push(f)
  }
  const boxesChecked = new Set<Element>()
  const placed: { el: Element; text: string; r: DOMRect }[] = []

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const node = n as Text
    const text = (node.textContent || '').replace(/\s+/g, ' ').trim()
    if (!text) continue
    const el = node.parentElement
    if (!el || el.closest('script,style,noscript,title')) continue
    if (effectiveOpacity(el) === 0) continue
    if (optedOut(el)) continue
    const rects = textRects(node)
    if (!rects.length) continue
    const snippet = text.slice(0, 70)
    const where = describe(el)
    if (overlap && effectiveOpacity(el) >= 0.15 && !overlapOk(el)) for (const r of rects) placed.push({ el, text: snippet, r })

    for (const r of rects) {
      // 1. Off the frame.
      const over = Math.max(-r.left, -r.top, r.right - W, r.bottom - H)
      if (over > TOL) add({ kind: 'off-frame', text: snippet, by: Math.round(over), where })

      // 2. Cut off by an ancestor that hides overflow; 3. out of its drawn box.
      let boxDone = false
      for (let a = el as Element | null; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a)
        const ar = a.getBoundingClientRect()
        const bigAsFrame = ar.width >= W * 0.97 && ar.height >= H * 0.97
        const clipX = cs.overflowX !== 'visible'
        const clipY = cs.overflowY !== 'visible'
        if ((clipX || clipY) && !bigAsFrame) {
          const cx = clipX ? Math.max(ar.left - r.left, r.right - ar.right) : 0
          const cy = clipY ? Math.max(ar.top - r.top, r.bottom - ar.bottom) : 0
          const cut = Math.max(cx, cy)
          if (cut > TOL) add({ kind: 'clipped', text: snippet, by: Math.round(cut), where })
        }
        if (!boxDone && !bigAsFrame && paints(cs)) {
          boxDone = true
          const spill = Math.max(ar.left - r.left, ar.top - r.top, r.right - ar.right, r.bottom - ar.bottom)
          if (spill > TOL) add({ kind: 'out-of-box', text: snippet, by: Math.round(spill), where })
          // 4. The box holding this text must itself be on the frame.
          if (!boxesChecked.has(a)) {
            boxesChecked.add(a)
            const boxOver = Math.max(-ar.left, -ar.top, ar.right - W, ar.bottom - H)
            if (boxOver > TOL && !optedOut(a)) add({ kind: 'box-off-frame', text: snippet, by: Math.round(boxOver), where: describe(a) })
          }
        }
      }
    }
  }
  if (overlap) {
    // A text rect is the whole line box; the letters fill roughly its middle.
    // Trim 15% top and bottom so a huge number's empty line box touching the
    // label above it isn't a collision — the letters themselves must meet.
    const ink = (r: DOMRect) => ({ left: r.left, right: r.right, top: r.top + r.height * 0.15, bottom: r.bottom - r.height * 0.15, height: r.height * 0.7 })
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i], b = placed[j]
        if (a.el === b.el) continue
        const ra = ink(a.r), rb = ink(b.r)
        const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left)
        const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top)
        if (w <= 6 || h <= Math.max(4, 0.2 * Math.min(ra.height, rb.height))) continue
        // The same words stacked exactly (a glow or shadow layer) are one piece of text.
        const same = a.text === b.text && Math.abs(a.r.left - b.r.left) < 8 && Math.abs(a.r.top - b.r.top) < 8
        if (same) continue
        add({ kind: 'overlap', text: `${a.text.slice(0, 40)}  ×  ${b.text.slice(0, 40)}`, by: Math.round(Math.min(w, h)), where: describe(a.el) })
      }
    }
    // Small pictures (logos, icons, headshots): words must not run under them.
    // Full-size backdrops and photos are meant to sit behind text, so only
    // pictures under 8% of the frame count.
    const pics = Array.from(document.querySelectorAll('img, svg, canvas, video')).filter((p) => {
      if (p.parentElement?.closest('svg') || optedOut(p) || effectiveOpacity(p) < 0.3) return false
      const r = p.getBoundingClientRect()
      return r.width > 4 && r.height > 4 && r.width * r.height < W * H * 0.08
    })
    for (const t of placed) {
      for (const p of pics) {
        if (p.contains(t.el)) continue
        const r = p.getBoundingClientRect(), ti = ink(t.r)
        const w = Math.min(ti.right, r.right) - Math.max(ti.left, r.left)
        const h = Math.min(ti.bottom, r.bottom) - Math.max(ti.top, r.top)
        if (w <= 6 || h <= Math.max(4, 0.2 * ti.height)) continue
        add({ kind: 'over-image', text: t.text, by: Math.round(Math.min(w, h)), where: `${describe(t.el)} under ${p.tagName.toLowerCase()}` })
      }
    }
  }
  return found
}

/** Mounted once per QA composition. Scans after fonts are in and every Fit has settled. */
export const OverflowGuard: React.FC = () => {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const overlap = !!(getInputProps() as Record<string, unknown>).__qaOverlap
  useLayoutEffect(() => {
    const handle = delayRender('OverflowGuard: scanning frame')
    const done = () => {
      try {
        for (const f of scanForOverflow(width, height, overlap)) console.log('D2V_OVERFLOW ' + JSON.stringify({ frame, ...f }))
        console.log('D2V_SCANNED ' + JSON.stringify({ frame }))
      } finally {
        continueRender(handle)
      }
    }
    const ready = document.fonts ? document.fonts.ready : Promise.resolve()
    ready.then(() => setTimeout(done, 60))
  }, [frame, width, height, overlap])
  return null
}
