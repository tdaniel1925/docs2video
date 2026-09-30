import { EditorialVideo } from '../../editorial/EditorialVideo'
import type { QACase } from '../types'

// The EDITORIAL engine (magazine looks: 'time', 'editorial', 'explainer').
// Props are shaped exactly as render-service/server.js /render-editorial writes
// them (masthead, runningTitle, variant, contactLine, recipient, presenter +
// presenterOnCover/Closing, scenes[]) — minus audio. Images live in
// qa-public/editorial-qa/.

const LEN = 120   // frames per page
// Every entrance, count-up and the cover's "Prepared for" line has settled by
// ~frame 60 of a page; PageTurn fades out over the last 8 frames.
const settled = (n: number) => Array.from({ length: n }, (_, i) => i * LEN + 85)

type Scene = Record<string, unknown>
const video = (id: string, props: Record<string, unknown>, scenes: Scene[]): QACase => ({
  id: `editorial-${id}`,
  component: EditorialVideo,
  props: { ...props, scenes: scenes.map((s) => ({ durationInFrames: LEN, ...s })) },
  durationInFrames: LEN * scenes.length,
  // Settled moment of every page, plus the very last frame (the closing page holds).
  frames: [...settled(scenes.length), LEN * scenes.length - 1],
})

const PHOTO = 'editorial-qa/presenter.png'
const IMAGE = 'editorial-qa/scene.png'

/* ------------------------------- worst case -------------------------------- */

const LONG_TITLE = 'Why the Guaranteed Minimum Death Benefit Rider Matters More Than Ever for Families Planning Multi-Generational Wealth Transfers'
const WORD = 'Supercalifragilisticexpialidocious-Indemnification'
const SOLID = 'Supercalifragilisticexpialidociousindemnificationprovisions'
const LONG_KICKER = 'Section Four: Understanding the Non-Guaranteed Elements of Your Indexed Universal Life Illustration'
const LONG_DETAIL = 'A qualifying critical, chronic, or terminal illness diagnosis lets you accelerate a portion of the death benefit while you are still alive, subject to an actuarial discount, administrative charges and the terms of the rider.'
const LONG_BODY = 'Five hundred thousand dollars, guaranteed for your son and structured to flow into a special needs trust so that the benefit never disqualifies him from Medicaid or Supplemental Security Income, keeping every one of his programs intact while fully funding his care. That guarantee holds until you are ninety-four, and coverage can extend automatically for as long as you live depending on market performance, the crediting rate, loan activity, withdrawals, and the charges deducted every month. Non-guaranteed values assume the current illustrated rate continues unchanged for decades, which it will not; review the policy every year with your licensed professional so that small adjustments keep the plan on track long after this summary has been filed away.'
const LONG_QUOTE = 'This plan is designed for long-term commitment — it performs best when it stays in place, when premiums are paid on schedule, when loans are repaid, and when every annual review is treated as a chance to adjust rather than an obligation to endure, because the families who benefit most are the ones who never let it lapse.'
const LONG_NAME = 'Maximiliana Alexandra Worthington-Fairbanks III'
const LONG_ROLE = 'Senior Vice President, Wealth Preservation & Estate Planning Strategies'
const LONG_CLIENT = 'Dr. Bartholomew Christopher Montgomery-Vanderbilt and the Montgomery-Vanderbilt Family Irrevocable Trust'
const LONG_CONTACT = '+1 (555) 123-4567 ext. 8910 | maximiliana.worthington-fairbanks@worthingtonfairbankswealthpartners.com | https://www.worthingtonfairbankswealthpartners.com/advisors/maximiliana-worthington-fairbanks'
const LONG_MASTHEAD = 'WORTHINGTON-FAIRBANKS WEALTH PRESERVATION & ESTATE PLANNING PARTNERS, LLC'
const LONG_RUNNING = 'Understanding Your QoL Max Accumulator+ III Index Universal Life Insurance Policy — Illustration Summary Prepared for the Montgomery-Vanderbilt Family'

const item = (t: string, d?: string) => (d ? { title: t, detail: d } : { title: t })

/** Every archetype, stuffed. `solid` swaps in a word with no break points at all. */
function worstScenes(solid = false): Scene[] {
  const W = solid ? SOLID : WORD
  return [
    { archetype: 'cover', kicker: LONG_KICKER, title: LONG_TITLE, dek: LONG_DETAIL + ' ' + LONG_DETAIL },
    { archetype: 'lede', kicker: `${W} ${W}`, title: LONG_TITLE, body: LONG_BODY, image: IMAGE },
    { archetype: 'lede', kicker: LONG_KICKER, title: `${W} ${LONG_TITLE}`, body: LONG_BODY + ' ' + LONG_BODY },
    {
      archetype: 'grid', kicker: LONG_KICKER, title: LONG_TITLE,
      // 8 given; the grid shows at most 6.
      items: [item(W, LONG_DETAIL), item(LONG_TITLE, LONG_DETAIL), item('Chronic Illness', LONG_DETAIL), item('Terminal Illness', LONG_DETAIL + ' ' + LONG_DETAIL), item('No Extra Cost', W), item(LONG_TITLE, LONG_DETAIL), item('Seventh', 'x'), item('Eighth', 'y')],
    },
    { archetype: 'pullquote', title: 'x', quote: LONG_QUOTE, attribution: `${LONG_NAME}, ${LONG_ROLE}` },
    {
      archetype: 'stat', kicker: LONG_KICKER, title: LONG_TITLE,
      // 5 given; the stat page shows at most 3.
      metrics: [
        { label: 'Index Allocation', value: '100% High Cap Rate Acct (S&P 500 Index)' },
        { label: 'Total Projected Death Benefit Including Riders and Paid-Up Additions at Age 121', value: '$1,234,567,890.00' },
        { label: W, value: '40 — Preferred Non-Tobacco' },
        { label: 'Fourth', value: '4' }, { label: 'Fifth', value: '5' },
      ],
    },
    { archetype: 'stat', kicker: 'One big figure', title: 'A single unbroken value', metrics: [{ label: LONG_TITLE, value: `$${'1,234,567,'.repeat(4)}890.00` }] },
    {
      archetype: 'list', kicker: LONG_KICKER, title: LONG_TITLE,
      // 7 given; the list shows at most 5.
      items: [item(LONG_TITLE, LONG_DETAIL), item(W, LONG_DETAIL), item('Annual Policy Reviews', LONG_DETAIL + ' ' + LONG_DETAIL), item(LONG_TITLE, LONG_DETAIL), item('Monthly Guarantee Premium (MGP)', LONG_DETAIL), item('Sixth', 'x'), item('Seventh', 'y')],
    },
    {
      archetype: 'timeline', kicker: LONG_KICKER, title: LONG_TITLE,
      // 8 given; the timeline shows at most 6.
      timeline: [
        { when: 'Q3 2025 – Q1 2026', title: LONG_TITLE, detail: LONG_DETAIL },
        { when: W, title: 'Policy issued', detail: LONG_DETAIL },
        { when: '2031', title: W, detail: W },
        { when: 'Policy Year 14', title: 'Surrender charges end', detail: LONG_DETAIL },
        { when: 'Age 67', title: 'Guarantee ends', detail: LONG_DETAIL + ' ' + LONG_DETAIL },
        { when: 'Age 121', title: 'Maturity', detail: 'x' },
        { when: '2090', title: 'Seventh' }, { when: '2091', title: 'Eighth' },
      ],
    },
    {
      archetype: 'chart', kicker: LONG_KICKER, title: LONG_TITLE,
      // 7 given; the chart shows at most 5.
      chart: { kind: 'donut', segments: [
        { label: LONG_TITLE, value: 40 }, { label: W, value: 25 }, { label: 'Fixed Account (guaranteed minimum crediting rate of one percent)', value: 20 },
        { label: 'Cash', value: 10 }, { label: LONG_DETAIL, value: 5 }, { label: 'Sixth', value: 3 }, { label: 'Seventh', value: 2 },
      ] },
    },
    {
      archetype: 'chart', kicker: LONG_KICKER, title: LONG_TITLE,
      chart: { kind: 'bar', segments: [
        { label: LONG_TITLE, value: 1234567890 }, { label: W, value: 0.30000000000000004 }, { label: 'Guaranteed Cash Surrender Value at Age 65', value: 987654321.123 },
        { label: 'Premiums', value: 400000 }, { label: LONG_DETAIL, value: 12 }, { label: 'Sixth', value: 5 },
      ] },
    },
    {
      archetype: 'matrix', kicker: LONG_KICKER, title: LONG_TITLE,
      // 6 columns (the payload caps at 4; the page itself does not) and 8 rows (page shows 6).
      matrix: {
        columns: ['Guaranteed Death Benefit', W, 'Cash Value Growth Potential', 'Living Benefits', 'Premium Flexibility', 'Surrender Charges'],
        rows: [
          { label: LONG_TITLE, cells: ['yes', 'yes', 'Limited by the cap rate and participation rate', 'yes', 'no', '14 years'] },
          { label: W, cells: ['no', W, 'yes', '', 'yes', 'yes'] },
          { label: 'Whole Life', cells: ['yes', 'yes', 'Dividends (not guaranteed)', 'Rider', 'no', '10 years'] },
          { label: 'Term Life (20-year level premium, convertible)', cells: ['yes', 'no', 'no', 'yes', 'no', 'none'] },
          { label: 'Variable Universal Life', cells: ['no', 'yes', 'yes', 'yes', 'yes', '15 years'] },
          { label: 'Guaranteed Universal Life', cells: ['yes', 'no', 'no', 'yes', 'yes', '20 years'] },
          { label: 'Seventh', cells: ['yes'] }, { label: 'Eighth', cells: ['no'] },
        ],
      },
    },
    { archetype: 'decision', kicker: LONG_KICKER, title: LONG_TITLE, dek: LONG_CONTACT },
  ]
}

const worstProps = (variant: string, withPresenter: boolean) => ({
  masthead: LONG_MASTHEAD,
  runningTitle: LONG_RUNNING,
  brandColor: '#0B6E4F',
  variant,
  contactLine: LONG_CONTACT,
  recipient: LONG_CLIENT,
  ...(withPresenter
    ? { presenter: { name: LONG_NAME, role: LONG_ROLE, photo: PHOTO }, presenterOnCover: true, presenterOnClosing: true }
    : {}),
})

/** Optional fields missing: no kicker/dek/body/attribution/details, empty title. */
const sparseScenes: Scene[] = [
  { archetype: 'cover', title: '' },
  { archetype: 'lede', title: 'Only a title' },
  { archetype: 'grid', title: 'Grid without details', items: [item('One'), item('Two'), item('Three')] },
  { archetype: 'pullquote', title: 'A quote with no attribution.' },
  { archetype: 'stat', title: '', metrics: [{ label: 'Only one', value: '1' }, { label: '', value: '99' }] },
  { archetype: 'list', title: 'List', items: [item('Just one')] },
  { archetype: 'decision', title: 'Call us' },
]

/* ---------------------------- normal (typical) ----------------------------- */

const normalScenes: Scene[] = [
  { archetype: 'cover', kicker: 'Index Universal Life Insurance', title: 'Your Policy, Explained', dek: "What you're protected by, what you're building, and benefits you may not realize you have." },
  { archetype: 'lede', kicker: 'Coverage at a glance', title: "A Safety Net That's Already Active", body: "From day one, your family has $176,204 in protection. You're funding that with $10,000 a year over twenty years — about $27 a day for a safety net that isn't waiting in the wings, it's already in place.", image: IMAGE },
  { archetype: 'stat', kicker: 'Your policy numbers', title: 'The Figures That Define Your Plan', metrics: [{ label: 'Initial Death Benefit', value: '$176,204' }, { label: 'Annual Planned Premium', value: '$10,000 for 20 years' }, { label: 'Illustrated Growth Rate (non-guaranteed)', value: '6.94%' }] },
  { archetype: 'list', kicker: 'Living benefits', title: "Payouts That Can Reach You While You're Still Alive", items: [item('Critical Illness', 'A qualifying event such as a heart attack or cancer diagnosis can trigger access to a portion of your death benefit.'), item('Chronic Illness', 'If an illness limits your ability to perform daily living activities, you may qualify for an accelerated benefit.'), item('Terminal Illness', 'A terminal diagnosis allows early access to your benefit when you and your family may need it most.'), item('Deductions Apply', 'Benefit payments are subject to an actuarial discount and administrative charges.')] },
  { archetype: 'grid', kicker: 'How your money grows', title: "Four Features Driving Your Policy's Value", items: [item('100% S&P 500 Allocation', 'Your index growth is linked entirely to S&P 500 performance.'), item('6.94% Illustrated Rate', 'A non-guaranteed projection based on current crediting assumptions — not a promise.'), item('Downside Protection', 'Built-in features limit your exposure in years when the market falls.'), item('Account Value Enhancement', 'An AVE bonus begins crediting to your account after policy year five.')] },
  { archetype: 'pullquote', title: 'This plan is designed for long-term commitment — it performs best when it stays in place.', attribution: 'Policy illustration' },
  { archetype: 'timeline', kicker: 'The road ahead', title: 'Key Dates in Your Policy', timeline: [{ when: '2025', title: 'Policy issued', detail: 'Coverage begins' }, { when: '2039', title: 'Surrender period ends', detail: 'Full cash value available' }, { when: '2045', title: 'Premiums complete', detail: 'Twenty years funded' }, { when: 'Age 67', title: 'Guarantee ends', detail: 'Coverage continues if funded' }] },
  { archetype: 'chart', kicker: 'Where it goes', title: 'Your Premium Allocation', chart: { kind: 'donut', segments: [{ label: 'High Cap Rate Account', value: 70 }, { label: 'Fixed Account', value: 20 }, { label: 'Policy Charges', value: 10 }] } },
  { archetype: 'chart', kicker: 'Side by side', title: 'Projected Values at Age 65', chart: { kind: 'bar', segments: [{ label: 'Premiums Paid', value: 200 }, { label: 'Cash Value', value: 312 }, { label: 'Death Benefit', value: 480 }] } },
  { archetype: 'matrix', kicker: 'Compare', title: 'Which Coverage Fits', matrix: { columns: ['Death Benefit', 'Cash Value', 'Living Benefits'], rows: [{ label: 'Index UL', cells: ['yes', 'yes', 'yes'] }, { label: 'Term', cells: ['yes', 'no', 'yes'] }, { label: 'Whole Life', cells: ['yes', 'yes', 'no'] }] } },
  { archetype: 'decision', kicker: 'Next step', title: "Let's Walk Through Your Numbers Together" },
]

/* ------------------------------ real videos -------------------------------- */
// The archetype JSON is built at render time and not stored, so these are read
// back from the pages the customer actually got (videos.slide_urls) plus the
// video's draft_data (recipient, contact, presenter).

// a64cd281 — 'editorial', 2026-06-27, "A Mother's Plan for Her Son".
const realA64: QACase = video('real-a64cd281', {
  masthead: 'VALOR FINANCIAL SPECIALISTS',
  runningTitle: 'QoL Value+ Protector III Index Universal Life Insurance Policy',
  variant: 'editorial',
  recipient: 'Kelly Pachuta',
}, [
  { archetype: 'cover', kicker: 'Kelly Pachuta · Age 61 · Preferred Plus', title: 'Built for His Future', dek: 'A $500,000 policy structured to protect your son — and everything he depends on.' },
  { archetype: 'lede', kicker: 'The Foundation', title: 'His Financial Foundation', body: "Five hundred thousand dollars — guaranteed for your son. Structured to flow into a special needs trust, that benefit won't disqualify him from Medicaid or SSI, keeping his programs intact while fully funding his care. That guarantee holds until you're 94, with coverage that can extend automatically for as long as you live based on market performance.", image: IMAGE },
  { archetype: 'stat', kicker: 'The Numbers', title: 'Your Premium, In Perspective', metrics: [{ label: 'Initial Death Benefit', value: '$500,000' }, { label: 'Annual Premium', value: '$6,883.68' }, { label: 'Cost Per Day', value: '~$19' }] },
  { archetype: 'pullquote', title: 'Preferred Plus — the best available rating, locked in at the most favorable pricing.', attribution: "Kelly Pachuta's Policy" },
  { archetype: 'grid', kicker: 'Built-in Protection', title: 'Living Benefits Included at No Extra Cost', items: [item('Critical Illness', 'Access a portion of the death benefit early upon a qualifying critical illness diagnosis.'), item('Chronic Illness', 'Benefit available early if you meet the criteria for a qualifying chronic illness.'), item('Terminal Illness', 'Accelerated access to the death benefit if diagnosed with a qualifying terminal illness.'), item('No Additional Premium', 'All three living benefit provisions are built in — $0 in additional rider cost.')] },
  { archetype: 'list', kicker: 'Growth Strategy', title: 'Certainty — With Upside Potential', items: [item('S&P 500–Linked Growth', 'Index allocation tied to the S&P 500 via the High Cap Rate Account — without direct market exposure if the index drops.'), item('50% Premium Return at Year 20', 'A built-in rider could return fifty percent of premiums paid at policy year twenty.'), item('Up to 100% Premium Return at Year 25', 'Potentially all premiums paid could be returned at policy year twenty-five.'), item('Illustrated Growth Rate: 6.22%', 'This is a non-guaranteed projection based on the current illustrated rate — not a promise of future performance.')] },
  { archetype: 'list', kicker: 'Important Disclosures', title: 'Keep This in Mind', items: [item('Educational Purposes Only', 'This video is not legal, tax, or financial advice.'), item('Guarantees Are Carrier-Dependent', "All policy guarantees rely on the issuing company's claims-paying ability."), item('Non-Guaranteed Values May Change', 'Illustrated projections are not promises of future performance.'), item('Review Your Official Documents', 'Consult your licensed insurance professional and review your policy documents before making any decisions.')] },
  { archetype: 'decision', kicker: 'Valor Financial Specialists', title: 'He Is Protected. You Made That Happen.', dek: 'Presented by Valor Financial Specialists — your licensed professional is ready to answer any questions.' },
])

// 98389136 — 'explainer', 2026-06-20, "Welcome: Your Policy, Explained". Its stat
// pages shipped with "40 — Preferred Non-Tobacco" and "Age 131
// (non-guaranteed)" running off the right edge of the frame.
const real983: QACase = video('real-98389136', {
  masthead: 'TRENT DANIEL',
  runningTitle: 'Understanding Your QoL Max Accumulator+ III Index Universal Life Insurance Policy',
  variant: 'explainer',
  contactLine: '2815058290 | tdaniel@bundlefly.com | botmakers.ai',
  presenter: { name: 'Trent Daniel', role: 'Agent', photo: PHOTO }, presenterOnCover: true, presenterOnClosing: true,
}, [
  { archetype: 'cover', kicker: 'Index Universal Life — Plain Language Walkthrough', title: 'Your Policy, Explained', dek: 'What you own, what it does, and what to keep an eye on.' },
  { archetype: 'lede', kicker: 'Your Policy at a Glance', title: 'Built for Protection. Wired for Growth.', body: 'At age 40, preferred non-tobacco — the best pricing tier available — ten thousand dollars a year for twenty years buys you an Index Universal Life policy. It pairs death benefit protection with cash value that can grow when the S&P 500 rises, and stays protected when it falls. This is what that means for you and your family.', image: IMAGE },
  { archetype: 'stat', kicker: 'Policy Fundamentals', title: 'The Numbers Behind Your Policy', metrics: [{ label: 'Initial Death Benefit', value: '$176,204' }, { label: 'Annual Premium', value: '$10,000 for 20 Years' }, { label: 'Client Age', value: '40 — Preferred Non-Tobacco' }] },
  { archetype: 'pullquote', title: 'Guaranteed through age 67 — the mortgage years, the raising-kids years, the years your income is irreplaceable.', attribution: 'Policy Illustration' },
  { archetype: 'grid', kicker: 'Living Benefits', title: 'Access You May Not Know You Have', items: [item('Critical Illness', 'A qualifying critical illness diagnosis lets you access a portion of your death benefit while still alive.'), item('Chronic Illness', 'A chronic illness diagnosis triggers the same early-access provision — built right into the policy.'), item('Terminal Illness', "A terminal diagnosis allows acceleration of the death benefit, providing funds when they're needed most."), item('No Extra Cost', 'This is not a separate rider you pay for — it is built into your policy at no additional charge.')] },
  { archetype: 'stat', kicker: 'Growth Potential', title: 'How Your Cash Value Can Grow', metrics: [{ label: 'Hypothetical Annual Growth Rate', value: '6.94%' }, { label: 'Index Allocation', value: '100% S&P 500 (High Cap Rate Account)' }, { label: 'Policy Projected In-Force To', value: 'Age 131 (non-guaranteed)' }] },
  { archetype: 'list', kicker: 'Important Disclosure', title: 'What This Illustration Can and Cannot Tell You', items: [item('Educational Only', 'This video is for informational purposes only — not legal, tax, or financial advice.'), item('Guarantees Have a Basis', 'Policy guarantees depend on the claims-paying ability of the issuing insurer.'), item('Non-Guaranteed Values Can Change', 'Illustrated values assume current rates remain unchanged — actual results will vary.'), item('Review Annually', 'At minimum, review your policy with your licensed professional once per year.'), item('Read Your Documents', 'Walk through your official policy documents with your licensed professional before making any decisions.')] },
  { archetype: 'decision', kicker: 'Next Step', title: "Questions? Let's Talk." },
])

export const cases: QACase[] = [
  realA64,
  real983,
  video('normal-time', { masthead: 'TRENT DANIEL', runningTitle: 'QoL Max Accumulator+ III Index UL', variant: 'time', recipient: 'Kelly Pachuta', contactLine: '936-641-7130 | tdaniel@botmakers.ai | botmakers.ai', presenter: { name: 'Trent Daniel', role: 'Agent', photo: PHOTO }, presenterOnCover: true, presenterOnClosing: true }, normalScenes),
  video('worst-time', worstProps('time', true), worstScenes()),
  video('worst-editorial', worstProps('editorial', true), worstScenes()),
  video('worst-explainer', worstProps('explainer', true), worstScenes()),
  // No presenter photo → the wider text-only cover/closing layouts, and a word
  // with no break points anywhere.
  video('worst-solid-time', worstProps('time', false), worstScenes(true)),
  video('worst-solid-explainer', worstProps('explainer', false), worstScenes(true)),
  video('sparse-editorial', { masthead: '', variant: 'editorial' }, sparseScenes),
]
