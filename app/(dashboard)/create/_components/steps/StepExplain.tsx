/*
 * WHAT THIS STEP IS FOR, AND WHAT COMES NEXT — under every create step's
 * headline (owner, 2026-10-18: "each step needs to be clearly explained").
 * Two short lines a newcomer can act on; the steps' own words stay below it.
 *
 * BRAND VS LOOK: the owner did not see that every scene wears the look, nor
 * how it differs from the brand. LookVsBrand says it in one place, shown on
 * both steps.
 */
import type { ReactNode } from 'react'

export type StepCopy = { what: ReactNode; next: ReactNode }

/** The eight steps' explanations, in one place so they read as one voice. */
export const STEP_COPY: Record<'content' | 'story' | 'brand' | 'look' | 'scenes' | 'voice' | 'opening' | 'review', StepCopy> = {
  content: {
    what: 'Give us what the video is about: a document (PDF, Word, PowerPoint, Excel or a photo of a page), a website, text you paste, or a one-line idea. Reading it is free.',
    next: 'Next, Story: we tell you back what we took from it, so you can fix anything before a single scene is made.',
  },
  story: {
    what: 'This is what we took from your content: the one point the video makes and the numbers it uses. Correct anything wrong and remove anything that should not be said. The video will say exactly this.',
    next: 'Next, Brand: who the video comes from.',
  },
  brand: {
    what: 'Who this video comes from: your name, photo and contact details, or a company’s logo and colors. The brand is stamped on the video. It does not decide how the scenes are designed. That is the Look, next.',
    next: 'Next, Look: the design every scene of the video wears.',
  },
  look: {
    what: 'The look is the design of the whole video. Every scene, from the cover to the closing, wears it: the layout, the type, the motion and the color mood. Pick one below; the pictures show its cover and an inside page.',
    next: 'Next, Scenes: the words and visuals of each scene, in order.',
  },
  scenes: {
    what: 'Your video, scene by scene. Each scene is one screen and what the voice says over it. Change any word, drag a scene to move it, and choose how long the video runs (a new length rewrites it free).',
    next: 'Next, Voice: who narrates it and whether music plays.',
  },
  voice: {
    what: 'Who tells your story, and whether soft music plays under it. Press ▶ to hear each voice before you pick.',
    next: 'Next, Opener & close: how you are introduced at the start and how to reach you at the end.',
  },
  opening: {
    what: 'The first and last screens your client sees: your introduction and photo at the start, your contact details and booking link at the end.',
    next: 'Next, Review: check everything, see a free preview, then make it.',
  },
  review: {
    what: 'Everything you chose, at a glance. Change any step from here, play the free preview, and press Make it. That is the only button that spends credits, and the price is on it.',
    next: 'After Make it: the video is made in a few minutes. You can leave this page; we tell you when it is ready.',
  },
}

export function StepExplain({ step }: { step: keyof typeof STEP_COPY }) {
  const c = STEP_COPY[step]
  return (
    <div className="cf-explain" data-step-explain={step}>
      <p><b>This step</b> {c.what}</p>
      <p className="cf-explain-next"><b>Then</b> {c.next}</p>
    </div>
  )
}

/** Look vs brand, side by side, so nobody mistakes one for the other. */
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
