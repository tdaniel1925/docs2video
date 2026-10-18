// =============================================================================
// The tips that rotate on the "making it" screen — true for what is being made.
//
// One list used to be shown for everything, so a silent slide deck heard about
// "natural-sounding AI voices", a project with no brand was promised slides
// "custom-designed with your brand colors and logo", and every output was told
// it could be downloaded "as MP4, PDF slides, or PPTX". Each output now gets
// only the tips that are true for it.
//
// Pure (no React) so a test can read every tip.
// =============================================================================

import { NAMES } from '../../../_lib/names'

const LIBRARY = `Everything you make is kept in your ${NAMES.library}, so you can come back to it any time.`
const BOOKING = 'Your share page shows your contact details, and your booking link if you set one in Settings.'
const SLIDE_FILES = `You can download the slides as a PDF or a PowerPoint file from its page in your ${NAMES.library}.`
const EDIT_SLIDES = 'Want to change a word afterwards? Use Edit slides on its page — no need to start again.'

const TIPS: Record<string, string[]> = {
  video: [
    LIBRARY,
    'The voice reads the story you checked on the story step, in the voice you picked.',
    'When it’s ready you get one link to send — your client watches it there.',
    BOOKING,
    `You can download the finished video as an MP4 from its page in your ${NAMES.library}.`,
  ],
  interactive: [
    LIBRARY,
    'Your client clicks through it at their own pace, with the voice you picked reading along.',
    'When it’s ready you get one link to send.',
    BOOKING,
    SLIDE_FILES,
    EDIT_SLIDES,
  ],
  deck: [
    LIBRARY,
    'A slide deck is silent slides, made for presenting in a meeting.',
    SLIDE_FILES,
    EDIT_SLIDES,
  ],
  pptx: [
    LIBRARY,
    'When it’s ready you can download it as a PDF or a PowerPoint file.',
  ],
  pdf: [
    LIBRARY,
    'When it’s ready you can download it as a PDF or a PowerPoint file.',
  ],
}

/** The tips for an output type. Unknown types get only the tip true for all. */
export function tipsFor(outputType: string | null | undefined): string[] {
  return TIPS[String(outputType || '')] ?? [LIBRARY]
}

/** Every tip, for tests. */
export const ALL_TIPS: Record<string, string[]> = TIPS

/** What to call the thing being made, in "Your ___ keeps building…". */
export function madeNoun(outputType: string | null | undefined): string {
  switch (outputType) {
    case 'interactive': return 'presentation'
    case 'deck': return 'slide deck'
    case 'pptx':
    case 'pdf': return 'slides'
    default: return 'video'
  }
}
