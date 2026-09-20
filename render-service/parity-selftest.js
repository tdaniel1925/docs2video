// Exercises the REAL scrub→smooth code paths with a torture input and asserts the
// output is clean. Run in the container: docker exec docs2video-service node /app/parity-selftest.js
const slides = require('./slides')
const { CARRIER_BLOCKLIST } = slides

// A torture script: carrier + product names woven into sentences so the word-level
// scrub leaves gaps ("an Income Advantage IUL strategy" → "an strategy"), plus a
// cash-value line the OLD commercial detector missed.
const TORTURE = {
  scenes: [
    { id: 1, narration: "Mutual of Omaha's Income Advantage IUL is a great strategy for you.", layout: { heading: "An Income Advantage IUL", kicker: "Overview" } },
    { id: 2, narration: "With Transamerica life insurance you get guaranteed returns and cash value.", layout: { heading: "Transamerica Life", kicker: "Path two" } },
    { id: 3, narration: "This North American annuity builds cash value and pays a death benefit; surrender charges may apply.", layout: { heading: "North American Annuity", kicker: "Path three" } },
  ],
  intro: { line1: "Prepared by Mutual of Omaha", line2: "Your Income Advantage IUL plan" },
  cta: { line: "Talk with Transamerica today" },
  title: "Your Nationwide Coticy Plan",
}

const understanding = { what_it_is: "A life insurance policy with cash value, death benefit and surrender charges." }

const leaksOf = (obj) => {
  const hay = JSON.stringify(obj).toLowerCase()
  return CARRIER_BLOCKLIST.filter((t) => hay.includes(t))
}
// crude "broken fragment" detector: "an <consonant-word>", double spaces, dangling
const brokenFragments = (obj) => {
  const strs = []
  JSON.stringify(obj, (k, v) => { if (typeof v === 'string') strs.push(v); return v })
  const bad = []
  for (const s of strs) {
    if (/\ban\s+(?![aeiou])/i.test(s) && !/\ban\s+(hour|honest|x-|mri|fyi)/i.test(s)) bad.push(`"an"+consonant: ${s}`)
    if (/\s{2,}/.test(s)) bad.push(`double-space: ${s}`)
    if (/\b(\w+)\s+\1\b/i.test(s)) bad.push(`dup-word: ${s}`)
    if (/^[,;:.\-\s]/.test(s) || /[,;:\-]\s*$/.test(s)) bad.push(`dangling punct: ${s}`)
  }
  return bad
}

;(async () => {
  console.log("=== SLIDES/dispatcher path (scrubSlidePlan → smoothScrubbedSlides) ===")
  const w = JSON.parse(JSON.stringify(TORTURE))
  console.log("isRegulated (shared):", slides.isRegulated(understanding), "(want true)")
  slides.scrubSlidePlan(w, understanding)
  console.log("after scrub — leaks:", leaksOf(w).length, "| broken:", brokenFragments(w).length, "(pre-smooth, expect some broken)")
  const nChanged = (w.__scrubbed || []).length
  if (nChanged) await slides.smoothScrubbedSlides(w)
  const leaks = leaksOf(w), broken = brokenFragments(w)
  console.log("after SMOOTH — leaks:", leaks.length, leaks.length ? JSON.stringify(leaks) : "(none ✓)")
  console.log("after SMOOTH — broken fragments:", broken.length, broken.length ? JSON.stringify(broken.slice(0,4)) : "(none ✓)")
  console.log("sample repaired narration:", JSON.stringify(w.scenes.map(s => s.narration)))
  console.log("sample repaired headings:", JSON.stringify(w.scenes.map(s => s.layout && s.layout.heading)))
  const PASS = leaks.length === 0
  console.log(PASS ? "\nSLIDES PATH: PASS ✓ (no carrier name survived)" : "\nSLIDES PATH: FAIL ✗")
  process.exit(PASS ? 0 : 1)
})().catch(e => { console.error("ERR", e.message); process.exit(2) })
