'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { STEPS, activeStepIndex, stepDoneFlags } from './steps'
import { Sidebar } from './ui'
import { useWizard } from './useWizard'
import { Preview } from './system/Preview'
import './system/tokens.css'

/**
 * THE FIVE-STEP FRAME.
 *
 * A persistent left SIDEBAR lists the steps (lit = here, check = done) so the
 * user always knows where they are and can jump back. Each page's primary action
 * lives in a STICKY BOTTOM BAR (see StepShell) that never leaves the viewport, so
 * nobody scrolls back up to advance. The step list lives in ./steps as the single
 * source of truth. Brand-neutral: no product name, because /design serves both
 * storefronts.
 *
 * The whole frame carries the `t2a` class so the design-wizard tokens apply here
 * and nowhere else in the app.
 *
 * The wait screen (/design/making) and results (/design/results) are OUTSIDE the
 * numbered flow — they render full-bleed with no sidebar.
 */
export default function DesignLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { state, ready } = useWizard()
  const [previewOpen, setPreviewOpen] = useState(false)
  // WIDE SCREENS GET THE PREVIEW ALWAYS-ON, docked as its own column. Watching
  // the design take shape WHILE choosing is the whole point of a live preview —
  // hiding it behind a toggle made every choice a blind one again. Narrow
  // screens keep the slide-in toggle (no room for a permanent column there).
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)')
    const apply = () => setWide(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  const bare = pathname === '/design/making' || pathname === '/design/results'

  if (bare) {
    return (
      <div className="t2a" style={{ minHeight: '100vh', background: 'var(--t2a-canvas)' }}>{children}</div>
    )
  }

  const activeIdx = activeStepIndex(pathname)
  const doneFlags = ready ? stepDoneFlags(state) : undefined

  // Show the live preview once there's something to show (a look chosen or a
  // reference or words). On Step 1 (nothing picked yet) it stays hidden so the
  // kind tiles get the full width. Decks skip it (they preview per-slide later).
  const showPreview = ready && !state.deckSlides &&
    Boolean(state.templateId || state.reference || state.fields?.headline)
  const firstSize = state.sizes?.[0] ?? (state.kind === 'social' ? 'ig-post' : 'letter')

  const preview = (
    <Preview
      sizeId={firstSize}
      templateId={state.templateId}
      referenceDataUrl={state.reference?.dataUrl ?? null}
      headline={state.fields?.headline}
    />
  )

  return (
    // height:100vh + overflow on the content column so the step body scrolls
    // UNDER a sticky bottom bar that pins to the viewport edge.
    <div className="t2a" style={{ height: '100vh', display: 'flex', background: 'var(--t2a-canvas)', overflow: 'hidden', position: 'relative' }}>
      <Sidebar steps={STEPS} activeIdx={activeIdx} doneFlags={doneFlags} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {children}
      </div>

      {/* DOCKED PREVIEW (wide screens) — a real column, always visible, so every
          choice updates the picture the user is looking at. */}
      {showPreview && wide && (
        <aside style={{
          width: 320, flexShrink: 0, borderLeft: '1px solid var(--t2a-line)', background: '#fff',
          padding: 'var(--sp-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', overflowY: 'auto',
        }}>
          <div style={{ fontSize: 'var(--fs-1)', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--t2a-soft)' }}>
            Live preview
          </div>
          {preview}
        </aside>
      )}

      {/* SLIDE-IN PREVIEW (narrow screens) — same preview behind a toggle. */}
      {showPreview && !wide && (
        <>
          {/* Floating toggle — tap to slide the preview in, tap again to hide. */}
          <button
            onClick={() => setPreviewOpen((v) => !v)}
            aria-expanded={previewOpen}
            style={{
              position: 'fixed', right: previewOpen ? 372 : 20, bottom: 88, zIndex: 40,
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
              borderRadius: 'var(--r-4)', border: '1px solid var(--t2a-line)', background: '#fff',
              color: 'var(--t2a-ink)', fontWeight: 700, fontSize: 'var(--fs-2)', cursor: 'pointer',
              boxShadow: 'var(--shadow-hover)', transition: 'right var(--base) var(--ease)', fontFamily: 'var(--font-ui)',
            }}>
            {previewOpen ? 'Hide preview →' : '👁 Preview'}
          </button>

          {/* Dim behind the panel so a tap-outside closes it. */}
          {previewOpen && (
            <div onClick={() => setPreviewOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,16,.25)', zIndex: 38 }} />
          )}

          {/* The slide-in panel — overlays the right edge, takes NO layout width,
              so the centre section is never squeezed. */}
          <aside
            aria-hidden={!previewOpen}
            style={{
              position: 'fixed', top: 0, right: 0, height: '100vh', width: 'min(360px, 92vw)', zIndex: 39,
              background: '#fff', borderLeft: '1px solid var(--t2a-line)', boxShadow: '-8px 0 30px rgba(35,32,28,0.12)',
              padding: 'var(--sp-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', overflowY: 'auto',
              transform: previewOpen ? 'translateX(0)' : 'translateX(100%)',
              transition: 'transform var(--base) var(--ease)',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 'var(--fs-1)', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--t2a-soft)' }}>
                Live preview
              </div>
              <button onClick={() => setPreviewOpen(false)} aria-label="Hide preview"
                style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--t2a-soft)', lineHeight: 1 }}>×</button>
            </div>
            {preview}
          </aside>
        </>
      )}
    </div>
  )
}
