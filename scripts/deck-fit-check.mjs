// =============================================================================
// Does any slide in an HTML presentation spill out of its frame?
//
// Every size in the deck uses clamp(), so the type scales with the WINDOW. It
// does not scale with the CONTENT — and the content comes from a model reading
// somebody's document, so one slide gets four bullets and the next gets nine.
// At the clamp minimum that runs past the bottom, and the slide hides its
// overflow: the last bullets vanish and the ones above collide with the nav.
//
// This builds a real deck through the real generator, opens it in a browser at
// several window sizes, and MEASURES every slide. Nothing is judged by eye.
//
//   node scripts/deck-fit-check.mjs
// =============================================================================

import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// Node strips the types itself; the other checks import .ts the same way.
const { buildPresentationHtml } = await import('../app/_lib/presentation.ts')

/** A deck deliberately loaded with more than any slide should carry.
 *  Shaped to the REAL signature — scenes with slideData, not a made-up one.
 *  My first draft invented "slides" and would have rendered an empty deck and
 *  passed. Checked the export before running it. */
const bullets = [
  'Bodily injury and property damage arising out of your premises and completed operations, subject to the limits shown',
  'Personal and advertising injury, including libel, slander and infringement of copyright in your advertisement',
  'Medical payments for injuries occurring on premises you own or rent, regardless of fault, up to the stated sub-limit',
  'Damage to premises rented to you, where the damage is caused by fire, lightning or explosion',
  'Defence costs, which are paid in addition to the limits of insurance and are not eroded by them',
  'Supplementary payments including bail bonds, reasonable expenses and post-judgment interest',
  'Products completed operations hazard, aggregated separately from the general aggregate limit',
  'Contractual liability assumed under an insured contract as that term is defined in the policy',
  'Worldwide territory for suits brought in the United States, its territories and Canada',
]

const html = buildPresentationHtml({
  title: 'Your Commercial General Liability Policy',
  templateId: 'heritage',
  brandName: 'Northside Insurance Group',
  recipientName: 'Evolv 28 — Aether',
  disclaimer: 'This summary is provided by your agent and is not a contract. Refer to the policy for full terms.',
  scenes: [
    {
      _role: 'cover', narration: 'Welcome.',
      title: 'Understanding Every Part Of Your Commercial General Liability Policy And The Endorsements That Apply',
      slideData: { headline: 'Understanding Every Part Of Your Commercial General Liability Policy And The Endorsements That Apply' },
    },
    {
      narration: 'Here is what it covers.',
      title: 'What This Policy Covers',
      slideData: {
        headline: 'What This Policy Covers And What It Deliberately Leaves Out For Your Business This Year',
        bullets: bullets,
      },
    },
    {
      narration: 'And the numbers.',
      title: 'Your Limits',
      slideData: {
        headline: 'Every Limit, Deductible And Endorsement At A Glance',
        stats: Array.from({ length: 6 }, (_, i) => ({ label: 'Coverage Item Number ' + (i + 1) + ' With A Long Label', value: '$1,000,000' })),
        bullets: bullets.slice(0, 5),
      },
    },
    {
      _role: 'closing', narration: 'Thank you.',
      title: 'Next Steps',
      slideData: { headline: 'Any Questions At All, Please Get In Touch', cta: 'Call the office' },
    },
  ],
})

mkdirSync('.deckcheck', { recursive: true })
const file = '.deckcheck/deck.html'
writeFileSync(file, html)

/** Sizes a real customer opens a share link at. */
const SIZES = [
  { name: 'laptop 1440x900', width: 1440, height: 900 },
  { name: 'desktop 1920x1080', width: 1920, height: 1080 },
  { name: 'small laptop 1280x720', width: 1280, height: 720 },
]

const browser = await chromium.launch()
let failed = 0

for (const size of SIZES) {
  const tab = await browser.newPage({ viewport: { width: size.width, height: size.height } })
  await tab.goto(pathToFileURL(file).href, { waitUntil: 'load' })
  await tab.waitForTimeout(600)

  /**
   * THE CHROME, CHECKED AGAINST THE DECORATIVE BORDER.
   *
   * My first version only measured the slide body, and missed the one the
   * customer actually pointed at: the standing disclosure, pinned 6px from the
   * bottom when the border is inset 14px — so its last line sat on the border
   * and past it. It is not part of the slide, so nothing about the slide was
   * ever going to catch it.
   *
   * Everything fixed on top of the deck gets measured against the frame the
   * reader can see, not the window.
   */
  const chrome = await tab.evaluate(() => {
    const frame = document.getElementById('frame')
    if (!frame) return []
    const f = frame.getBoundingClientRect()
    const out = []
    for (const sel of ['.disc', '.corner', '#nav']) {
      const el = document.querySelector(sel)
      if (!el || !el.offsetParent && getComputedStyle(el).position !== 'fixed') continue
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) continue
      const crosses = r.left < f.left - 1 || r.right > f.right + 1
        || r.top < f.top - 1 || r.bottom > f.bottom + 1
      if (crosses) {
        out.push(sel + ' crosses the border by ' + Math.round(Math.max(
          f.left - r.left, r.right - f.right, f.top - r.top, r.bottom - f.bottom,
        )) + 'px')
      }
    }
    return out
  })
  for (const problem of chrome) { failed++; console.log('  FAIL ' + size.name.padEnd(22) + problem) }

  const slides = await tab.evaluate(() => document.querySelectorAll('.sec').length)

  for (let i = 0; i < slides; i++) {
    // Go to the slide the way a reader would, so the fit runs as it really does.
    await tab.evaluate((n) => window.go && window.go(n), i)
    await tab.waitForTimeout(250)

    // BEFORE AND AFTER, in the same browser on the same slide. Without this the
    // run is green whether or not the fix does anything, which is no evidence
    // at all — the trap this file exists to avoid.
    const before = await tab.evaluate((n) => {
      const sec = document.querySelectorAll('.sec')[n]
      const wrap = sec.querySelector('.wrap')
      if (!wrap) return { clipped: false }
      const was = wrap.style.transform
      wrap.style.transform = ''
      const cs = getComputedStyle(sec)
      const room = sec.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
      const clipped = wrap.scrollHeight > room + 2
      wrap.style.transform = was
      return { clipped }
    }, i)

    const m = await tab.evaluate((n) => {
      const sec = document.querySelectorAll('.sec')[n]
      const wrap = sec.querySelector('.wrap')
      if (!wrap) return { clipped: false, scale: 1 }
      const cs = getComputedStyle(sec)
      const room = sec.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
      // THE APPLIED SCALE, read off the element.
      //
      // Two wrong versions before this one, and both printed a confident
      // number. The first divided painted height by scrollHeight, which is a
      // different quantity — it reported 0.92 for slides that were never
      // scaled and 0.58 for one whose floor is 0.62, a value the code cannot
      // produce. The second used a regex mangled by shell escaping, so it
      // never matched and every slide read exactly 1. A number that cannot be
      // true is worse than no number, because it gets quoted.
      const scale = Number((/scale\(([\d.]+)\)/.exec(wrap.style.transform) || [0, '1'])[1])

      // THE SAME BASIS AS "BEFORE", which is the other thing I got wrong.
      // Before measured scrollHeight, after measured the bounding box — and
      // the box excludes children that overflow it, so the comparison was
      // between two different questions and always looked like an improvement.
      return {
        clipped: wrap.scrollHeight * scale > room + 2,
        scale: Math.round(scale * 100) / 100,
      }
    }, i)

    const bad = m.clipped
    if (bad) failed++
    console.log(
      `  ${bad ? 'FAIL' : 'ok  '} ${size.name.padEnd(22)} slide ${i + 1}/${slides}  ` +
      `clipped without the fix: ${before.clipped ? 'YES' : 'no '} · with it: ${bad ? 'YES' : 'no '} · scale ${m.scale}`,
    )
  }
  await tab.close()
}

await browser.close()
console.log(failed ? `\n${failed} slide view(s) still do not fit` : '\nEvery slide fits at every size tested')
process.exit(failed ? 1 : 0)
