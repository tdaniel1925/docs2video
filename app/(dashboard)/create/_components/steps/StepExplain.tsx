'use client'

/*
 * THE COACH BAR — one amber line at the top of every create step (owner,
 * 2026-10-18: "there's a lot going on here … a lot of text on these pages";
 * approved option B). It says which step this is, what it is for in one
 * sentence, and what comes next. The longer explanation, and Look vs Brand on
 * those two steps, wait behind "More help". × hides the bar for that step (remembered on
 * this device); a small "Step tip" button brings it back.
 *
 * Guidance is amber so it never reads as the page's own content.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { STEPS } from '../workspace/steps'

export type StepCopy = { short: string; what: ReactNode; next: ReactNode }

/** The eight steps' words, in one place so they read as one voice. */
export const STEP_COPY: Record<'content' | 'story' | 'brand' | 'look' | 'scenes' | 'voice' | 'opening' | 'review', StepCopy> = {
  content: {
    short: 'Give us what the video is about: a document, a website, text or an idea. Reading it is free.',
    what: 'A document (PDF, Word, PowerPoint, Excel or a photo of a page), a website, text you paste, or a one-line idea. Reading it is free.',
    next: 'Next, Story: we tell you back what we took from it, so you can fix anything before a single scene is made.',
  },
  story: {
    short: 'Check what we took from your content. The video says exactly this.',
    what: 'This is what we took from your content: the one point the video makes and the numbers it uses. Correct anything wrong and remove anything that should not be said.',
    next: 'Next, Brand: who the video comes from.',
  },
  brand: {
    short: 'Who the video comes from: your name, photo and contact, or a company’s logo and colors.',
    what: 'The brand is stamped on the video. It does not decide how the scenes are designed. That is the Look, next. None of it needs a website.',
    next: 'Next, Look: the design every scene of the video wears.',
  },
  look: {
    short: 'The design every scene uses. Your brand is placed inside it.',
    what: 'Every scene, from the cover to the closing, wears the look: the layout, the type, the motion and the color mood. Pick a template, or match a picture you like.',
    next: 'Next, Scenes: the words and visuals of each scene, in order.',
  },
  scenes: {
    short: 'Each scene in order: what is on screen and what the voice says.',
    what: 'Change any word, drag a scene to move it, and choose how long the video runs (a new length rewrites it free).',
    next: 'Next, Voice: who narrates it and whether music plays.',
  },
  voice: {
    short: 'Pick who narrates and whether music plays. Press ▶ to hear a voice.',
    what: 'Who tells your story, and whether soft music plays under it. Press ▶ to hear each voice before you pick.',
    next: 'Next, Opener & close: how you are introduced at the start and how to reach you at the end.',
  },
  opening: {
    short: 'How you are introduced at the start, and how to reach you at the end.',
    what: 'The first and last screens your client sees: your introduction and photo at the start, your contact details and booking link at the end.',
    next: 'Next, Review: check everything, see a free preview, then make it.',
  },
  review: {
    short: 'Check everything, play the free preview, then press Make it.',
    what: 'Change any step from here. Make it is the only button that spends credits, and the price is on it.',
    next: 'After Make it: the video is made in a few minutes. You can leave this page; we tell you when it is ready.',
  },
}

const HIDE_KEY = 'd2v-coach-hidden:'

export function StepExplain({ step }: { step: keyof typeof STEP_COPY }) {
  const c = STEP_COPY[step]
  const n = STEPS.findIndex((s) => s.key === step)
  const name = STEPS[n]?.label ?? step
  const nextName = STEPS[n + 1]?.label
  const [hidden, setHidden] = useState(false)
  const [more, setMore] = useState(false)

  // Remembered per step, on this device only. Storage can be missing or
  // blocked (private windows): the bar then simply shows.
  useEffect(() => {
    try { setHidden(window.localStorage.getItem(HIDE_KEY + step) === '1') } catch { setHidden(false) }
  }, [step])
  const hide = (v: boolean) => {
    setHidden(v)
    setMore(false)
    try { if (v) window.localStorage.setItem(HIDE_KEY + step, '1'); else window.localStorage.removeItem(HIDE_KEY + step) } catch { /* not remembered */ }
  }

  if (hidden) {
    return (
      <button type="button" className="cf-coach-tip" onClick={() => hide(false)} data-step-explain={step}>
        Step {n + 1} of {STEPS.length} · tip
      </button>
    )
  }

  return (
    <div className="cf-coach" role="note" data-step-explain={step}>
      <div className="cf-coach-row">
        <span className="cf-coach-step">Step {n + 1} of {STEPS.length}</span>
        <p className="cf-coach-text">
          <b>{name}:</b> {c.short}
          {nextName ? <span className="cf-coach-next"> Next: {nextName}.</span> : null}
        </p>
        <button type="button" className="cf-coach-more" aria-expanded={more} onClick={() => setMore(!more)}>
          {more ? 'Less help' : 'More help'}
        </button>
        <button type="button" className="cf-coach-x" aria-label="Hide this tip" onClick={() => hide(true)}>×</button>
      </div>
      {more ? (
        <div className="cf-coach-more-body">
          <p>{c.what}</p>
          <p className="cf-coach-next">{c.next}</p>
          {step === 'brand' || step === 'look' ? <LookVsBrand /> : null}
        </div>
      ) : null}
    </div>
  )
}

/** Look vs brand, side by side, so nobody mistakes one for the other. Shown
 *  inside the coach bar's More help on the Brand and Look steps. */
export function LookVsBrand() {
  return (
    <div className="cf-vs" data-look-vs-brand>
      <div>
        <span className="cf-label">Brand: who it comes from</span>
        <p>Your logo or photo, your name, colors and contact details. Set on the Brand step.</p>
      </div>
      <div>
        <span className="cf-label">Look: how every scene is designed</span>
        <p>The layout, type, motion and color mood that the cover and <b>every inside scene</b> wear. Your brand sits inside the look.</p>
      </div>
    </div>
  )
}
