import { describe, it, expect } from 'vitest'
import { visibleScenes, buildPresentationHtml } from '../presentation'
import type { PresentationScene } from '../presentation'

// =============================================================================
// The player said "1 / 11". The page above it said "Slide 1 of 12".
//
// Neither number was a counting mistake. A deck folds away a trailing "call us"
// scene, because the closing card already carries the same phone and email — so
// eleven slides really do come from twelve scenes. The page was counting the
// stored script; the deck was counting what it drew.
//
// The mismatched number is only how you notice. The actual fault is that the
// page also lists a chip per scene to jump around with, so the last chip
// pointed at a slide that does not exist.
//
// These pin the rule in one place. If it moves, the count and the chips move
// with it.
// =============================================================================

const scene = (title: string, extra: Partial<PresentationScene> = {}): PresentationScene => ({
  narration: 'words', title, slideData: { headline: title }, ...extra,
})

/** The shape that produced the report: a CTA scene, then a thank-you. */
const REPORTED: PresentationScene[] = [
  scene('Your Personalized Illustration', { _role: 'cover' }),
  scene('Opening — The Plan in Plain Terms'),
  scene('Why Age 40 Is the Right Time'),
  scene('Day-One Death Benefit'),
  scene('What It Costs You'),
  scene("Living Benefits While You're Alive"),
  scene('Honest Note on Accelerated Benefits'),
  scene('Cash Value Growth — S&P 500 Linked'),
  scene('Rewards for Staying — and a Fair Warning'),
  scene('The Whole Picture in One Breath'),
  scene('Call to Action — Contact Trent Daniel'),
  scene('Thank You', { _role: 'closing' }),
]

describe('what counts as a slide is decided once', () => {
  it('folds the repeated call-to-action away', () => {
    expect(REPORTED).toHaveLength(12)
    expect(visibleScenes(REPORTED)).toHaveLength(11)
  })

  it('folds the right one — the closing survives', () => {
    const titles = visibleScenes(REPORTED).map((s) => s.title)
    expect(titles).not.toContain('Call to Action — Contact Trent Daniel')
    expect(titles).toContain('Thank You')
    expect(titles).toContain('The Whole Picture in One Breath')
  })

  it('agrees with the number of slides the deck actually draws', () => {
    // THE ONE THAT MATTERS. Counting the rule and counting the output are two
    // different things, and the whole bug was that they disagreed.
    //
    // My first attempt counted `class="sec"` in the HTML and found ZERO — the
    // sections do not exist in the file at all, they are built at load time
    // from an embedded array. It failed loudly rather than passing on a
    // coincidence, which is the only reason I looked.
    const html = buildPresentationHtml({
      title: 'Your Illustration', templateId: 'heritage', scenes: REPORTED,
    })
    const embedded = /const SLIDES=(\[[\s\S]*?\]);/.exec(html)
    expect(embedded, 'could not find the slide array in the generated deck').toBeTruthy()
    const drawn = JSON.parse(embedded![1]) as string[]
    expect(drawn.length).toBe(visibleScenes(REPORTED).length)
    expect(drawn.length).toBe(11)
  })

  it('leaves a deck alone when the call to action carries its own content', () => {
    // Only a THIN cta scene is redundant. One with real bullets is saying
    // something the closing card does not, and deleting it loses content the
    // customer wrote.
    const withBullets = REPORTED.map((s) =>
      s.title === 'Call to Action — Contact Trent Daniel'
        ? { ...s, slideData: { headline: s.title, bullets: ['Book a review', 'Bring last year’s statement'] } }
        : s)
    expect(visibleScenes(withBullets)).toHaveLength(12)
  })

  it('leaves short decks alone', () => {
    const two = [scene('Cover', { _role: 'cover' }), scene('Thank You', { _role: 'closing' })]
    expect(visibleScenes(two)).toHaveLength(2)
  })

  it('does not fold when there is no closing scene', () => {
    const noClose = REPORTED.slice(0, 11)
    expect(visibleScenes(noClose)).toHaveLength(11)
  })

  it('never changes the array it was handed', () => {
    const before = [...REPORTED]
    visibleScenes(REPORTED)
    expect(REPORTED).toEqual(before)
  })
})
