// =============================================================================
// Does the slide still spill out of the frame?
//
// The sizes on a presentation slide were fixed numbers — 72px headline, 28px
// subtitle — for text whose length nobody controls. The words come out of a
// model reading somebody's document, so a headline can be four words or
// fourteen. At fourteen it wrapped onto three lines, shoved the panels down,
// and the frame clips: overlapping text, and content cut off at the bottom.
//
// This builds slides with deliberately punishing content, renders them in the
// same browser the real thing uses, and MEASURES whether anything overflows.
// Nothing here is judged by eye or inferred from the code.
//
//   node scripts/slide-fit-check.mjs
// =============================================================================

// Playwright's Chromium, because Puppeteer's bundled browser is not installed
// on this machine. The renderer uses Puppeteer — same engine, and layout is the
// engine's job, so a measurement here holds there.
import { chromium } from 'playwright'

/** The same rules the real slide uses, kept in step with animated-slide.ts. */
const FIT = `
  var overlay = document.querySelector('.overlay');
  var bar = document.querySelector('.brand-bar');
  if (bar) overlay.style.paddingBottom = (bar.offsetHeight + 32) + 'px';
  overlay.style.overflowWrap = 'anywhere';
  var scaled = [
    { el: overlay.querySelector('.title'), floor: 34 },
    { el: overlay.querySelector('.subtitle'), floor: 17 },
  ];
  overlay.querySelectorAll('.metric-value').forEach(function (el) { scaled.push({ el: el, floor: 24 }) });
  overlay.querySelectorAll('.metric-label').forEach(function (el) { scaled.push({ el: el, floor: 11 }) });
  scaled = scaled.filter(function (s) { return s.el });
  var doesNotFit = function () {
    if (overlay.scrollHeight > overlay.clientHeight + 1) return true;
    if (overlay.scrollWidth > overlay.clientWidth + 1) return true;
    var kids = Array.prototype.slice.call(overlay.children);
    for (var k = 0; k < kids.length; k++) {
      var r = kids[k].getBoundingClientRect();
      if (r.top < -1 || r.bottom > window.innerHeight + 1) return true;
      if (r.left < -1 || r.right > window.innerWidth + 1) return true;
    }
    if (bar) {
      var barTop = bar.getBoundingClientRect().top;
      for (var j = 0; j < kids.length; j++) {
        if (kids[j].getBoundingClientRect().bottom > barTop + 1) return true;
      }
    }
    return false;
  };
  for (var step = 0; step < 40 && doesNotFit(); step++) {
    var moved = false;
    for (var i = 0; i < scaled.length; i++) {
      var s = scaled[i];
      var now = parseFloat(getComputedStyle(s.el).fontSize);
      var next = Math.max(s.floor, now * 0.96);
      if (next < now - 0.01) { s.el.style.fontSize = next + 'px'; moved = true }
    }
    if (!moved) break;
  }
`

const page = (title, subtitle, metrics, withBar) => `<!DOCTYPE html><html><head><style>
  * { margin:0; padding:0; box-sizing:border-box }
  body { width:1920px; height:1080px; overflow:hidden; font-family:Arial,sans-serif; background:#123 }
  .overlay { width:100%; height:100%; display:flex; flex-direction:column; justify-content:safe center;
             align-items:center; padding:80px 120px; background:rgba(0,0,0,.25); color:#fff }
  .title { font-size:72px; font-weight:800; text-align:center; margin-bottom:12px }
  .subtitle { font-size:28px; margin-bottom:60px }
  .metrics-grid { display:grid; grid-template-columns:repeat(${Math.min(metrics.length, 2)},1fr);
                  gap:24px; width:100%; max-width:900px }
  .metric { background:rgba(255,255,255,.12); border-radius:16px; padding:32px 36px }
  .metric-label { font-size:16px; text-transform:uppercase; margin-bottom:8px }
  .metric-value { font-size:48px; font-weight:800 }
  .brand-bar { position:absolute; bottom:0; left:0; right:0; height:56px; background:#046;
               display:flex; align-items:center; justify-content:center; font-size:18px }
</style></head><body>
  <div class="overlay">
    <div class="title">${title}</div>
    <div class="subtitle">${subtitle}</div>
    <div class="metrics-grid">
      ${metrics.map((m) => `<div class="metric"><div class="metric-label">${m.label}</div><div class="metric-value">${m.value}</div></div>`).join('')}
    </div>
  </div>
  ${withBar ? '<div class="brand-bar">Northside Heating | 555-0142 | northsideheating.com</div>' : ''}
</body></html>`

/** Content chosen to break it, not to flatter it. */
const CASES = [
  {
    name: 'short and easy',
    title: 'Your Cover',
    subtitle: 'A quick look',
    metrics: [{ label: 'Premium', value: '$1,200' }, { label: 'Term', value: '12 mo' }],
  },
  {
    name: 'a long real headline',
    title: 'Understanding Your Commercial General Liability Coverage And What It Means For Your Business',
    subtitle: 'Prepared for Evolv 28 — Aether, covering the 2026 to 2027 policy period and all endorsements',
    metrics: [
      { label: 'Each Occurrence Limit', value: '$1,000,000' },
      { label: 'General Aggregate Limit', value: '$2,000,000' },
      { label: 'Products Completed Operations', value: '$2,000,000' },
      { label: 'Damage To Rented Premises', value: '$100,000' },
    ],
  },
  {
    name: 'an unbreakable string',
    title: 'Reviewing northsideheatingandairconditioningservices.example.com/quotes/2026',
    subtitle: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    metrics: [{ label: 'Reference', value: 'QT-2026-000148-AETHER-GL' }],
  },
  {
    name: 'six panels and a brand bar',
    title: 'Your Full Coverage Summary At A Glance',
    subtitle: 'Every limit, deductible and endorsement in one place',
    metrics: Array.from({ length: 6 }, (_, i) => ({ label: `Coverage Item Number ${i + 1}`, value: '$1,000,000' })),
  },
  {
    name: 'the one that actually broke',
    // Eight panels is four rows at roughly 150px each, under a headline that
    // wraps to three lines. Nothing about this is unreasonable for an insurance
    // summary, and it does not fit — which is the whole complaint.
    title: 'Understanding Every Part Of Your Commercial General Liability Policy And The Endorsements That Apply To Your Business This Year',
    subtitle: 'Prepared for Evolv 28 — Aether · 2026 to 2027 policy period · all limits shown are per occurrence unless stated otherwise',
    metrics: Array.from({ length: 8 }, (_, i) => ({
      label: `Coverage Item Number ${i + 1} With A Long Label`, value: '$1,000,000',
    })),
  },
]

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
const tab = await browser.newPage({ viewport: { width: 1920, height: 1080 } })

let failed = 0
for (const c of CASES) {
  await tab.setContent(page(c.title, c.subtitle, c.metrics, true), { waitUntil: 'load' })

  const measure = () => tab.evaluate(() => {
    const o = document.querySelector('.overlay')
    const kids = [...o.children].map((k) => k.getBoundingClientRect())
    const bar = document.querySelector('.brand-bar')
    const grid = document.querySelector('.metrics-grid')
    return {
      // The box says it scrolls...
      scrolls: o.scrollHeight > o.clientHeight + 1 || o.scrollWidth > o.clientWidth + 1,
      // ...and separately, is anything actually outside the 1920x1080 frame?
      outside: kids.some((k) => k.top < -1 || k.bottom > 1081 || k.left < -1 || k.right > 1921),
      // ...and is the last row hidden under the brand bar, which floats above
      // everything and would not register as overflow at all?
      under: Boolean(bar && grid && grid.getBoundingClientRect().bottom > bar.getBoundingClientRect().top + 1),
      title: Math.round(parseFloat(getComputedStyle(document.querySelector('.title')).fontSize)),
    }
  })

  const before = await measure()

  await tab.evaluate(FIT)

  const after = await measure()

  const broken = (m) => m.scrolls || m.outside || m.under
  const ok = !broken(after)
  if (!ok) failed++
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'} ${c.name.padEnd(30)} ` +
    `broken before: ${broken(before) ? 'yes' : 'no '} · after: ${broken(after) ? 'yes' : 'no '} · ` +
    `headline ${before.title} -> ${after.title}px`,
  )
}

await browser.close()
console.log(`\n${CASES.length - failed}/${CASES.length} fit inside the frame`)
process.exit(failed ? 1 : 0)
