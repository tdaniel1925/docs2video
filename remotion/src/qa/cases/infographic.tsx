import { InfographicVideo } from '../../components/infographic/InfographicVideo'
import type { QACase } from '../types'

// The render service's infographic theme (render-service/server.js v3Theme),
// with no brand accents. Brand accents only change colours, never layout.
const THEME = {
  name: 'Modern Fintech', ink: '#070D1A', inkSoft: '#0C1730',
  glass: 'rgba(120,170,255,0.06)', glassEdge: 'rgba(120,170,255,0.22)',
  textPrimary: '#EAF2FF', textMuted: '#8FA6C8',
  accents: ['#3B82F6', '#22D3EE', '#8B5CF6'], mode: 'dark',
}

const LEN = 150   // frames per scene
// Scan each scene once it has settled (entrances + count-ups are done by ~70),
// and — with `late` — again at the very end of the scene.
const settled = (n: number, late = false) =>
  Array.from({ length: n }, (_, i) => (late ? [i * LEN + 110, i * LEN + 148] : [i * LEN + 110])).flat()

type Scene = Record<string, unknown>
const video = (id: string, scenes: Scene[], extra: Record<string, unknown> = {}, late = false): QACase => ({
  id: `infographic-${id}`,
  component: InfographicVideo,
  props: { theme: THEME, ...extra, scenes: scenes.map((s) => ({ durationInFrames: LEN, ...s })) },
  durationInFrames: LEN * scenes.length,
  frames: settled(scenes.length, late),
})

// ── Worst-case text ─────────────────────────────────────────────────────────
const LONG_TITLE = 'How Your Guaranteed Minimum Death Benefit, Index Crediting Caps and Accelerated Living Benefit Riders All Work Together'
const HUGE_TITLE = LONG_TITLE + ' Over the Next Forty Years, Even If Interest Rates Fall and You Need to Take a Policy Loan Along the Way'
const WORD = 'Supercalifragilisticexpialidocious-Indemnification'
const LONG_VALUE = '100% High Cap Rate Acct (S&P 500 Index)'
const HUGE = '$1,234,567,890.00'
const LONG_LABEL = 'Death Benefit Guaranteed To Age (Under Current Non-Guaranteed Assumptions And Illustrated Rates)'
const LONG_BODY = 'Illustrated values are hypothetical and not guaranteed; they assume the current non-guaranteed charges and crediting rates continue unchanged for the life of the policy, which is unlikely, and actual results may be more or less favorable than shown here.'
const LONG_EYEBROW = 'Prepared for the Jonathan Alexander Montgomery-Worthington Family Trust and Estate Planning Group'
const LONG_BRAND = 'Montgomery-Worthington Financial Planning & Insurance Services Group of Greater Chicago, LLC'

export const cases: QACase[] = [
  // ── REAL production data ──────────────────────────────────────────────────
  // Video 590fe9f6 as it shipped (2026-09-30): "100% High Cap Rate Ac" with the
  // rest of the card off the right edge.
  video('real-590fe9f6', [
    { title: 'Three Layers of Protection', body: 'Protects family at death', metrics: [{ label: 'Client Age', value: '40' }, { label: 'Underwriting Class', value: 'Preferred Non-Tobacco' }] },
    { title: 'Premium & Index Growth', body: 'Every dollar allocated to High Cap Rate Account', metrics: [{ label: 'Annual Premium', value: '$10,000.00' }, { label: 'Index Allocation', value: '100% High Cap Rate Acct (S&P 500 Index)', highlight: true }] },
    { title: 'Illustration vs. Guarantee', body: 'Illustrated values are hypothetical, not guaranteed', metrics: [{ label: 'Hypothetical Illustrated Rate', value: '6.94%' }, { label: 'Policy In-Force To (non-guaranteed)', value: 'Age 131' }, { label: 'Death Benefit Guaranteed To', value: 'Age 67' }] },
  ]),
  // Video 2dd094c2 (term life, classified "insurance" → auto-picks infographic),
  // shaped exactly as buildV3Payload + /render-v3 hand it to the engine.
  video('real-2dd094c2', [
    { title: 'Summary' },
    { title: 'Your Home, Protected', heroMetric: { value: '$270,000', label: 'Your Home, Protected', caption: 'Outstanding Mortgage Balance', tone: 'hero' } },
    { title: "What's at Stake", body: 'This is the core number your coverage must address', metrics: [{ label: 'Outstanding Mortgage Balance', value: '$270,000', highlight: true }] },
    { title: 'Coverage Gaps: $150K & $200K', body: '$150K leaves family ~$120,000 still owed — not full protection', metrics: [{ label: '$150,000 Coverage — Mortgage Shortfall', value: '~$120,000', highlight: true }, { label: '$200,000 Coverage — Mortgage Shortfall', value: '~$70,000', highlight: true }, { label: '$150,000 Covers', value: '~56% of mortgage', highlight: false }, { label: '$200,000 Covers', value: '~74% of mortgage', highlight: false }] },
    { title: 'Your Quoted Plan: $250K', body: 'Currently quoted plan covers 93% of the $270,000 mortgage', metrics: [{ label: 'Quoted Face Amount', value: '$250,000', highlight: true }, { label: '$250,000 Covers', value: '~93% of mortgage', highlight: true }, { label: 'Remaining Mortgage Gap', value: '~$20,000', highlight: false }] },
    { title: 'The $300K Difference', body: '$300K fully eliminates the mortgage burden', metrics: [{ label: 'Recommended Coverage', value: '$300,000', highlight: true }, { label: 'Mortgage Fully Paid Off', value: '$270,000', highlight: true }, { label: 'Remaining Buffer', value: '~$30,000', highlight: false }] },
    { title: 'What You Pay Today', body: 'Current quote: $84.26/month for $250,000 plan', metrics: [{ label: 'Monthly Premium (EFT)', value: '$84.26', highlight: true }, { label: 'Daily Cost', value: '~$2.80', highlight: true }, { label: 'Quoted Face Amount', value: '$250,000', highlight: false }] },
    { title: '30 Years, Locked In', body: 'Premiums projected level for full 30-year — no increases', metrics: [{ label: 'Level Premium Period', value: '30 years', highlight: true }, { label: 'Conversion Window', value: '20 years (or age 70)', highlight: true }] },
    { title: 'Living Benefits — No Extra Cost', body: 'Access part of your death benefit if seriously ill while living', metrics: [{ label: 'Accelerated Benefits Rider', value: 'Included — $0 extra premium', highlight: true }] },
    { title: 'Next Steps: Choose $300K', body: '$250,000 leaves a $20,000 gap — recommendation is $300,000', metrics: [{ label: 'Recommended Coverage', value: '$300,000', highlight: true }, { label: 'Quoted Plan Shortfall', value: '$20,000', highlight: true }, { label: 'Statement Valid Until', value: '30 days from Aug 20, 2026', highlight: false }] },
    { title: 'Thank You' },
  ]),
  // Video a56307c2 (IUL illustration): long non-numeric values, a street
  // address as a "value", and parenthesised qualifiers.
  video('real-a56307c2', [
    { title: 'Your () Policy: and Living Benefits' },
    { title: 'More Than Life Insurance', heroMetric: { value: '$250,000', label: 'More Than Life Insurance', caption: 'Initial Death Benefit', tone: 'hero' } },
    { title: 'Two-Way Protection', body: 'Protects your family if you die', metrics: [{ label: 'Client Age', value: '35', highlight: true }] },
    { title: 'Your Death Benefit', body: 'Covers mortgage, tuition, everyday expenses', metrics: [{ label: 'Initial Death Benefit', value: '$250,000', highlight: true }, { label: 'Death Benefit Designed to Grow Through', value: 'Year 81', highlight: true }] },
    { title: 'Your Annual Premium', body: 'Roughly $8 a day for $250,000 in coverage', metrics: [{ label: 'Initial Planned Annual Premium', value: '$2,981.51', highlight: true }, { label: 'Daily Cost', value: '~$8/day', highlight: true }] },
    { title: 'Projected vs. Projected', body: 'Projected coverage: over 4 decades of certainty', metrics: [{ label: 'Death Benefit projected To', value: 'Age 77', highlight: true }, { label: 'Policy Projected In-Force To', value: 'Age 115', highlight: true }] },
    { title: 'S&P 500 Index Link', body: 'Cash value linked to S&P 500 performance', metrics: [{ label: 'Index Allocation', value: '100% S&P 500 Index High Cap Rate Acct', highlight: true }] },
    { title: 'Living Benefits Included', body: 'Covers critical, chronic, and inal illness', metrics: [{ label: 'Initial Planned Annual Premium', value: '$2,981.51 (for 81 Years)', highlight: true }, { label: 'Index Allocation', value: '100.00% to S&P 500 Index High Cap Rate Acct', highlight: true }] },
    { title: 'Accelerated Benefit Details', body: 'Amount received is less than the portion elected — reduced by actuarial discount and charges', metrics: [{ label: 'Death Benefit Guaranteed To', value: 'Age 77 (Under Guaranteed Values)', highlight: true }, { label: 'Policy In-Force To', value: 'Age 115 (Under Current Non-Guaranteed Assumptions)', highlight: true }] },
    { title: 'Safeguards & Annual Review', body: 'Monthly assurance Premium (MGP) prevents policy lapse' },
    { title: 'Important Disclosures', body: 'For educational purposes only — not financial advice' },
    { title: "Questions? Let's Talk", metrics: [{ label: 'Phone', value: '773-259-6908', highlight: true }, { label: 'Address', value: '5105 Tollview Dr, Rolling Meadows, IL 60008', highlight: true }] },
    { title: 'Thank You' },
  ]),

  // ── NORMAL: typical lengths in every layout, to prove the look is unchanged ─
  video('normal', [
    { title: 'Your Coverage at a Glance', body: 'Guaranteed protection from day one.', metrics: [{ label: 'Initial Death Benefit', value: '$176,204' }] },
    { title: 'The policy at a glance', metrics: [{ label: 'Planned Premium', value: '$10,000/yr', highlight: true }, { label: 'Death Benefit', value: '$176,204', highlight: true }, { label: 'Premium Duration', value: '20 years' }, { label: 'Guaranteed To Age', value: '67' }] },
    { title: 'Cash value over time', metrics: [{ label: 'Year 5', value: '$42,000' }, { label: 'Year 10', value: '$96,500' }, { label: 'Year 20', value: '$176,204', highlight: true }, { label: 'Year 30', value: '$240,100' }] },
    { title: 'Three quick figures', metrics: [{ label: 'Client Age', value: '40' }, { label: 'Target Premium', value: '$3,018.18' }, { label: 'Premium Duration', value: '20 years' }] },
    { title: 'How it works', steps: [{ label: 'Apply', sub: 'Short online form' }, { label: 'Underwrite', sub: 'Health review' }, { label: 'Approve', sub: 'Policy issued' }, { label: 'Protect', sub: 'Coverage starts' }] },
    { title: 'What you get', cards: [{ title: 'Living Benefits', body: 'Access part of the death benefit early if you become seriously ill.' }, { title: 'Cash Value', body: 'Grows tax-deferred, linked to an index.' }, { title: 'Level Premium', body: 'Your payment stays the same for 20 years.' }] },
    { eyebrow: 'Next steps', title: 'Thank You', body: 'Reach out with any questions — we are here to help.' },
  ], { brandName: 'Acme Advisors' }),

  // ── HERO (one metric) ─────────────────────────────────────────────────────
  video('hero', [
    { title: LONG_TITLE, body: LONG_BODY, metrics: [{ label: LONG_LABEL, value: HUGE }] },
    { title: 'Index', body: LONG_BODY, metrics: [{ label: 'Index Allocation', value: LONG_VALUE }] },
    { title: 'Word', body: WORD, metrics: [{ label: WORD, value: WORD }] },
    { title: 'Age', metrics: [{ label: 'Policy In-Force To', value: 'Age 115 (Under Current Non-Guaranteed Assumptions)' }] },
    { title: 'Empty value', metrics: [{ label: 'Planned Premium', value: '' }] },
    { title: 'Huge number', metrics: [{ label: 'Total', value: '$123,456,789,012,345.67' }] },
  ]),

  // ── KPIS (1, 2, 3, 4 and more than 4) ─────────────────────────────────────
  video('kpis', [
    { kind: 'kpis', title: LONG_TITLE, metrics: [{ label: LONG_LABEL, value: LONG_VALUE, highlight: true }] },
    { title: HUGE_TITLE, metrics: [{ label: LONG_LABEL, value: HUGE, highlight: true }, { label: 'Index Allocation', value: LONG_VALUE }] },
    { title: WORD, metrics: [{ label: WORD, value: WORD, highlight: true }, { label: 'Index Allocation', value: LONG_VALUE }, { label: 'Total', value: HUGE }] },
    { title: LONG_TITLE, metrics: [{ label: LONG_LABEL, value: 'Age 115 (Under Current Non-Guaranteed Assumptions)', highlight: true }, { label: 'Address', value: '5105 Tollview Dr, Rolling Meadows, IL 60008' }, { label: 'Email', value: 'jonathan.montgomery-worthington@montgomeryworthingtonfinancial.com' }, { label: 'Total', value: HUGE }] },
    { title: 'Six metrics (engine shows four)', metrics: [{ label: 'Premium', value: '$10,000' }, { label: 'Duration', value: '20 years' }, { label: 'Rate', value: '6.94%' }, { label: 'Class', value: 'Preferred Non-Tobacco' }, { label: 'Age', value: '40' }, { label: 'Allocation', value: LONG_VALUE }] },
  ]),

  // ── BAR CHART (3–5 metrics in one unit) ───────────────────────────────────
  video('barchart', [
    { title: LONG_TITLE, metrics: [{ label: LONG_LABEL, value: HUGE }, { label: 'Year Ten Cash Surrender Value After Charges', value: '$987,654,321.00', highlight: true }, { label: 'Year Twenty', value: '$5,000.00' }] },
    { title: HUGE_TITLE, metrics: [{ label: 'Year 1', value: HUGE }, { label: 'Year 5', value: HUGE }, { label: 'Year 10', value: HUGE, highlight: true }, { label: 'Year 20', value: HUGE }, { label: 'Year 30', value: HUGE }] },
    { title: 'Word labels', metrics: [{ label: WORD, value: '99.99%' }, { label: WORD, value: '45.5%' }, { label: WORD, value: '12%' }, { label: WORD, value: '7.25%' }] },
    { title: 'Long suffix', metrics: [{ label: 'Premium', value: '$10,000 per year for twenty years' }, { label: 'Benefit', value: '$176,204 per year for twenty years' }, { label: 'Cash', value: '$96,500 per year for twenty years' }] },
  ]),

  // ── ICON ROW (3 numbers, mixed units; or kind: 'iconrow') ─────────────────
  video('iconrow', [
    { title: LONG_TITLE, metrics: [{ label: LONG_LABEL, value: HUGE }, { label: 'Guaranteed Minimum Interest Crediting Rate', value: '99.99% guaranteed minimum interest rate' }, { label: 'Premium Paying Period', value: '120 years and 11 months' }] },
    { kind: 'iconrow', title: HUGE_TITLE, metrics: [{ label: LONG_LABEL, value: LONG_VALUE }, { label: 'Total', value: HUGE }, { label: 'Word', value: WORD }, { label: 'Address', value: '5105 Tollview Dr, Rolling Meadows, IL 60008' }] },
    { kind: 'iconrow', title: 'Six metrics (engine shows four)', metrics: [{ label: 'Premium', value: '$10,000' }, { label: 'Duration', value: '20 years' }, { label: 'Rate', value: '6.94%' }, { label: 'Age', value: '40' }, { label: 'Class', value: '1 Preferred' }, { label: 'Allocation', value: '100%' }] },
    { title: 'Word', metrics: [{ label: WORD, value: '12 ' + WORD }, { label: 'Rate', value: '6.94%' }, { label: 'Age', value: '40' }] },
  ]),

  // ── TIMELINE (steps) ──────────────────────────────────────────────────────
  video('timeline', [
    { title: LONG_TITLE, steps: Array.from({ length: 6 }, (_, i) => ({ label: `Step ${i + 1}: Submit the Completed Application and Medical Records`, sub: 'The underwriter reviews your full medical history, prescriptions and lab results before making an offer.' })) },
    { title: 'Eight steps (engine shows six)', steps: Array.from({ length: 8 }, (_, i) => ({ label: `Stage ${i + 1}`, sub: 'Short note' })) },
    { title: 'Word steps', steps: [{ label: WORD, sub: WORD }, { label: 'Review', sub: LONG_BODY }, { label: 'Done' }] },
    { kind: 'timeline', title: 'One step', steps: [{ label: 'Only Step With A Rather Long Label', sub: LONG_BODY }] },
  ]),

  // ── CARDS ─────────────────────────────────────────────────────────────────
  video('cards', [
    { title: LONG_TITLE, cards: [{ title: LONG_TITLE, body: LONG_BODY + ' ' + LONG_BODY }] },
    { title: HUGE_TITLE, cards: [{ title: 'Living Benefits Rider With Accelerated Access', body: LONG_BODY }, { title: 'Cash Value', body: LONG_BODY + ' ' + LONG_BODY }, { title: 'Level Premium', body: LONG_BODY }] },
    { title: 'Five cards (engine shows three)', cards: Array.from({ length: 5 }, (_, i) => ({ title: `Card ${i + 1}`, body: 'Short body.' })) },
    { title: 'Word cards', cards: [{ title: WORD, body: WORD }, { title: 'Short', body: 'Fine.' }] },
  ]),

  // ── STATEMENT + EYEBROW ───────────────────────────────────────────────────
  video('statement', [
    { eyebrow: LONG_EYEBROW, title: LONG_TITLE, body: LONG_BODY },
    { eyebrow: WORD, title: WORD, body: WORD },
    { title: '', body: LONG_BODY + ' ' + LONG_BODY },
    { eyebrow: LONG_EYEBROW, title: HUGE_TITLE + ' ' + HUGE_TITLE, body: LONG_BODY + ' ' + LONG_BODY },
    { eyebrow: LONG_EYEBROW, title: LONG_TITLE, metrics: [{ label: LONG_LABEL, value: LONG_VALUE }, { label: 'Total', value: HUGE }] },
  ]),

  // ── BRAND NAME / LOGO over the opening and closing scenes ─────────────────
  // No logo image → the brand NAME shows as text on the intro and outro.
  video('brand-name', [
    { title: LONG_TITLE, body: LONG_BODY },
    { title: 'Middle', metrics: [{ label: 'Premium', value: '$10,000' }, { label: 'Benefit', value: '$176,204' }] },
    { title: LONG_TITLE, body: LONG_BODY },
  ], { brandName: LONG_BRAND }, true),
  video('brand-word', [
    { title: 'The policy at a glance', metrics: [{ label: 'Planned Premium', value: '$10,000/yr' }, { label: 'Death Benefit', value: '$176,204' }, { label: 'Duration', value: '20 years' }, { label: 'Guaranteed To Age', value: '67' }] },
    { title: 'Thank You', metrics: [{ label: 'Phone', value: '773-259-6908' }, { label: 'Address', value: '5105 Tollview Dr, Rolling Meadows, IL 60008' }] },
  ], { brandName: WORD + ' ' + WORD }, true),
  // A real logo image (wide), on a chip, with a background image.
  video('brand-logo', [
    { title: LONG_TITLE, body: LONG_BODY },
    { title: HUGE_TITLE, metrics: [{ label: LONG_LABEL, value: HUGE }, { label: 'Index Allocation', value: LONG_VALUE }] },
    { title: 'Thank You', body: LONG_BODY },
  ], { brandName: LONG_BRAND, logo: { light: 'infographic-logo.png' }, logoChip: true, bgImage: 'infographic-bg.png' }, true),
]
