'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import type { Step } from './steps'

// Shared tokens + chrome for the four wizard pages, so each page is just its
// own body and nobody re-invents a button. Same palette as /flyer.
export const INK = 'var(--ink,#23201c)'
export const SOFT = 'var(--ink-soft,#6b6459)'
export const LINE = 'var(--border,#ddd6cc)'
export const CREAM = 'var(--cream,#F4F1EC)'
export const MINT = 'var(--mint,#C7E8A8)'

export const card = {
  background: 'white', border: `1px solid ${LINE}`, borderRadius: 10, padding: 20,
} as const

export const plainBtn = {
  padding: '9px 16px', borderRadius: 9, border: `1px solid ${LINE}`, background: 'white',
  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: INK,
} as const

export const primaryBtn = {
  ...plainBtn, background: INK, color: 'white', border: '1px solid transparent',
} as const

/**
 * The Back / Next footer every step shares. Next is disabled with a hint until
 * the step is answered, so nobody advances past a decision the generator needs.
 */
export function StepNav({
  back, next, nextLabel = 'Next', nextReady = true, nextHint, onNext,
}: {
  back?: string
  next?: string
  nextLabel?: string
  nextReady?: boolean
  nextHint?: string
  onNext?: () => void
}) {
  const router = useRouter()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, marginTop: 22, flexWrap: 'wrap',
    }}>
      <div>
        {back && (
          <button style={plainBtn} onClick={() => router.push(back)}>&larr; Back</button>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {!nextReady && nextHint && (
          <span style={{ fontSize: 12.5, color: SOFT }}>{nextHint}</span>
        )}
        {(next || onNext) && (
          <button
            style={{ ...primaryBtn, opacity: nextReady ? 1 : 0.4, cursor: nextReady ? 'pointer' : 'default' }}
            disabled={!nextReady}
            // onNext is a SIDE EFFECT (e.g. save the words), not a replacement
            // for navigating. Run it, THEN go to the next page. Doing one or the
            // other left step 2 saving but never advancing.
            onClick={() => { if (!nextReady) return; onNext?.(); if (next) router.push(next) }}>
            {nextLabel} &rarr;
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * A Back/Next bar meant to sit at the TOP of a page, so the user never scrolls
 * to advance. Same behaviour as StepNav (run onNext side effect, then navigate),
 * just placed above the content. Pass `startMode` to turn Next into the red
 * "Start designing" button on the summary step.
 */
export function TopBar({
  back, next, nextLabel = 'Next', nextReady = true, nextHint, onNext, startMode = false,
}: {
  back?: string
  next?: string
  nextLabel?: string
  nextReady?: boolean
  nextHint?: string
  onNext?: () => void
  startMode?: boolean
}) {
  const router = useRouter()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      padding: '14px 32px', borderBottom: `1px solid ${LINE}`, background: 'rgba(255,255,255,.6)',
      position: 'sticky', top: 0, zIndex: 5, backdropFilter: 'blur(6px)', flexWrap: 'wrap',
    }}>
      <div>
        {back && <button style={plainBtn} onClick={() => router.push(back)}>&larr; Back</button>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {!nextReady && nextHint && <span style={{ fontSize: 12.5, color: SOFT }}>{nextHint}</span>}
        {(next || onNext) && (
          <button
            style={{
              ...primaryBtn, padding: startMode ? '11px 24px' : '9px 20px', fontSize: startMode ? 15 : 13,
              background: startMode ? '#C0392B' : INK, opacity: nextReady ? 1 : 0.4, cursor: nextReady ? 'pointer' : 'default',
            }}
            disabled={!nextReady}
            onClick={() => { if (!nextReady) return; onNext?.(); if (next) router.push(next) }}>
            {nextLabel} {startMode ? '' : '→'}
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * The persistent left rail. Lists every step; the one you're on is lit, the ones
 * behind you carry a check, the ones ahead are faint. Clicking a finished step
 * jumps back to it. Collapses to a slim horizontal bar on narrow screens.
 */
export function Sidebar({ steps, activeIdx, doneFlags }: { steps: Step[]; activeIdx: number; doneFlags?: boolean[] }) {
  const router = useRouter()
  return (
    <>
      {/* WIDE: vertical rail */}
      <nav className="design-rail" style={{
        width: 232, flexShrink: 0, borderRight: `1px solid ${LINE}`, background: 'rgba(255,255,255,.5)',
        padding: '26px 16px', display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', color: SOFT, textTransform: 'uppercase', margin: '0 8px 14px' }}>
          Your design
        </div>
        {steps.map((s, i) => {
          // A tick means DONE, not merely "a step we walked past". When real
          // completeness is known (doneFlags), an earlier step you skipped shows
          // its number, not a ✓ — so the rail can't claim Style is finished when
          // no look was picked. Falls back to position when flags aren't passed.
          const here = i === activeIdx
          const done = doneFlags ? (!!doneFlags[i] && i !== activeIdx) : i < activeIdx
          return (
            <button key={s.path} disabled={i > activeIdx}
              onClick={() => { if (i <= activeIdx) router.push(s.path) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', width: '100%',
                padding: '10px 10px', borderRadius: 9, border: 'none', cursor: i <= activeIdx ? 'pointer' : 'default',
                background: here ? INK : 'transparent', fontFamily: 'inherit',
              }}>
              <span style={{
                width: 22, height: 22, borderRadius: 11, flexShrink: 0, fontSize: 12, fontWeight: 800,
                display: 'grid', placeItems: 'center',
                background: here ? 'white' : done ? MINT : LINE,
                color: here ? INK : done ? INK : SOFT,
              }}>{done ? '✓' : i + 1}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: here ? 'white' : INK }}>{s.label}</span>
                <span style={{ display: 'block', fontSize: 11, color: here ? 'rgba(255,255,255,.7)' : SOFT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.blurb}</span>
              </span>
            </button>
          )
        })}
      </nav>

      {/* NARROW: horizontal dots */}
      <div className="design-rail-mini" style={{ display: 'none', padding: '10px 16px', borderBottom: `1px solid ${LINE}`, background: 'rgba(255,255,255,.6)', alignItems: 'center', gap: 6 }}>
        {steps.map((s, i) => {
          const mDone = doneFlags ? (!!doneFlags[i] && i !== activeIdx) : i < activeIdx
          return (
          <div key={s.path} style={{
            height: 8, borderRadius: 4, flex: i === activeIdx ? '0 0 34px' : '0 0 12px',
            background: i === activeIdx ? INK : mDone ? MINT : LINE, transition: 'all .3s',
          }} title={s.label} />
        )})}
        <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 800, color: SOFT, letterSpacing: '.04em' }}>
          {activeIdx + 1}/{steps.length} &middot; {steps[activeIdx]?.label.toUpperCase()}
        </span>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .design-rail { display: none !important; }
          .design-rail-mini { display: flex !important; }
        }
      `}</style>
    </>
  )
}

/**
 * Render a step title in the display serif, honouring a *word* accent (italic).
 * "Choose your *look*" → "Choose your " + <em>look</em>.
 */
function DisplayTitle({ title }: { title: string }) {
  const parts = title.split(/(\*[^*]+\*)/g).filter(Boolean)
  return (
    <h1 className="t2a-display" style={{ margin: '0 0 6px', fontSize: 'clamp(30px, 5vw, 44px)' }}>
      {parts.map((p, i) =>
        p.startsWith('*') && p.endsWith('*')
          ? <em key={i}>{p.slice(1, -1)}</em>
          : <span key={i}>{p}</span>,
      )}
    </h1>
  )
}

/**
 * The page body: the content column with a display-serif title, ABOVE a STICKY
 * BOTTOM ACTION BAR that holds Back + the primary CTA.
 *
 * WHY THE BAR IS AT THE BOTTOM AND STICKY. The old design put Next in a bar at
 * the TOP, so after picking a style card near the bottom of the page you had to
 * scroll all the way back up to advance — on every single step. A sticky bottom
 * bar keeps the primary action in view no matter how far you've scrolled, and on
 * a phone it sits right in the thumb's reach.
 *
 * The CTA is NAMED ("Next: your words", "Next: pick sizes") so you always know
 * where the button leads; when it's disabled, the hint says exactly what's
 * missing. Same prop contract as before, so no step page changes.
 */
/**
 * A "Need help?" chip that opens a friendly, plain-language pop-up. NOT a
 * tooltip — a proper little card a non-designer can read: a lead line, a few
 * short points, and an optional example. Each step passes its own, type-aware.
 */
export type HelpContent = {
  /** Chip label. Default "Need help?". */
  label?: string
  /** Big line at the top of the card. */
  title: string
  /** A sentence or two under the title. */
  intro?: string
  /** Short bullet points (each a plain tip). */
  points?: string[]
  /** A small "for example" line at the bottom. */
  example?: string
}

export function HelpHint({ help }: { help: HelpContent }) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 12, verticalAlign: 'middle',
          background: `${MINT}44`, border: `1px solid ${MINT}`, color: INK, borderRadius: 999,
          padding: '4px 11px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        }}
        aria-haspopup="dialog"
      >
        <span aria-hidden style={{ fontWeight: 800 }}>?</span>
        {help.label ?? 'Need help?'}
      </button>

      {open && (
        <div
          role="dialog" aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(35,32,28,0.45)', backdropFilter: 'blur(4px)', padding: '24px 16px', overflowY: 'auto' }}
        >
          <div style={{ width: '100%', maxWidth: 440, marginInline: 'auto', background: 'white', border: `1px solid ${LINE}`, borderRadius: 12, padding: 24, boxShadow: '0 24px 60px rgba(35,32,28,0.22)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: INK, lineHeight: 1.25 }}>{help.title}</div>
              <button onClick={() => setOpen(false)} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: SOFT, lineHeight: 1, marginTop: -2 }}>&times;</button>
            </div>
            {help.intro && <p style={{ fontSize: 14, color: SOFT, lineHeight: 1.6, margin: '0 0 12px' }}>{help.intro}</p>}
            {help.points && help.points.length > 0 && (
              <ul style={{ margin: '0 0 12px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {help.points.map((p, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13.5, color: INK, lineHeight: 1.5 }}>
                    <span aria-hidden style={{ color: '#2E7D32', flexShrink: 0, fontWeight: 800 }}>✓</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            )}
            {help.example && (
              <div style={{ fontSize: 12.5, color: SOFT, background: CREAM, border: `1px solid ${LINE}`, borderRadius: 8, padding: '9px 11px', lineHeight: 1.5 }}>
                <strong style={{ color: INK }}>For example:</strong> {help.example}
              </div>
            )}
            <button onClick={() => setOpen(false)} style={{ ...primaryBtn, marginTop: 16, padding: '9px 18px' }}>Got it</button>
          </div>
        </div>
      )}
    </>
  )
}

export function StepShell({
  title, subtitle, children, back, next, nextLabel = 'Next', nextReady = true, nextHint, onNext, startMode, help,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  back?: string
  next?: string
  nextLabel?: string
  nextReady?: boolean
  nextHint?: string
  onNext?: () => void
  startMode?: boolean
  help?: HelpContent
}) {
  const router = useRouter()
  const showBar = Boolean(back || next || onNext)
  const go = () => { if (!nextReady) return; onNext?.(); if (next) router.push(next) }

  return (
    // A flex column that fills the height, so the action bar can stick to the
    // bottom of the content area (below it there is nothing).
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', flex: 1 }}>
      <div style={{ maxWidth: 1100, width: '100%', margin: '0 auto', padding: '32px 32px 24px', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
          <DisplayTitle title={title} />
          {help && <HelpHint help={help} />}
        </div>
        {subtitle && <p style={{ margin: '0 0 24px', fontSize: 14, color: SOFT, lineHeight: 1.55, maxWidth: 640 }}>{subtitle}</p>}
        {children}
      </div>

      {showBar && (
        <div className="t2a-actionbar">
          <div>
            {back && <button className="t2a-back" onClick={() => router.push(back)}>&larr; Back</button>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {!nextReady && nextHint && <span className="t2a-hint" role="status">{nextHint}</span>}
            {(next || onNext) && (
              <button
                className={startMode ? 't2a-cta t2a-cta--start' : 't2a-cta'}
                disabled={!nextReady}
                aria-disabled={!nextReady}
                onClick={go}>
                {nextLabel}{startMode ? '' : ' →'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
