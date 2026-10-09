import { KitVideo } from '../../kit/KitVideo'
import { KIT_LOOKS, kitTimeline, type KitBrand, type KitPlan, type KitScene, type Look } from '../../kit/spec'
import type { QACase } from '../types'

// THE SCENE KIT (videoStyle 'kit'): app plans (app/_lib/kit-planner.ts) →
// render-service /generate-kit → KitVideo. Every scene type, in every ready
// look, with NORMAL content, WORST-CASE long content (the planner's word
// limits and then some — a model will one day ignore them) and SHORTEST
// content (a one-word heading must not leave a half-empty frame broken).
//
// Rendered in still mode (no audio; every scene 240 frames), scanned once
// when the scene has settled and once just before it cuts away.

const F = 'kit-qa'
const withLogo: KitBrand = { name: 'Your Agency', logo: { light: `${F}/logo-light.png`, dark: `${F}/logo-dark.png` }, presenter: { name: 'Jordan Avery', role: 'Licensed Agent', photo: `${F}/presenter.png` } }
const anyLogo: KitBrand = { name: 'Your Agency', logo: { any: `${F}/logo-any.png` } }
const nameOnly: KitBrand = { name: 'Northside Family Insurance Planning Group of the Greater Metro Area' }

let nid = 1
const id = () => nid++
const N = (s: string) => s

const normal = (): KitScene[] => [
  { id: id(), type: 'title', narration: N('Hi'), headline: 'Your Coverage at a Glance', sub: 'A simple walk-through of the plan we built for your family' },
  { id: id(), type: 'bignumber', narration: N('x'), label: 'Paid to your family', figure: { value: 500000, prefix: '$' }, context: 'Tax-free, if something happens to you', landOn: 'five hundred' },
  { id: id(), type: 'comparison', narration: N('x'), heading: 'What changes for your family', left: { label: 'Without it', figure: { value: 610000, prefix: '$' }, points: ['Mortgage still owed', 'College on hold'] }, right: { label: 'With it', figure: { value: 110000, prefix: '$' }, points: ['Mortgage paid off', 'College on track'] }, verdict: 'The plan closes most of the gap on day one.' },
  { id: id(), type: 'chart', narration: N('x'), heading: 'Where the money goes', kind: 'bar', prefix: '$', points: [{ label: 'Mortgage', value: 310000 }, { label: 'College', value: 120000 }, { label: 'Income', value: 70000 }], highlight: 0, takeaway: 'Most of it clears the mortgage.' },
  { id: id(), type: 'timeline', narration: N('x'), heading: 'How it works over time', steps: [{ when: 'Today', label: 'Coverage starts' }, { when: 'Age 45', label: 'Kids finish college' }, { when: 'Age 65', label: 'Coverage ends' }] },
  { id: id(), type: 'checklist', narration: N('x'), heading: 'Why it fits', items: ['Pays off the mortgage', 'Keeps college plans on track', 'Premium never goes up'] },
  { id: id(), type: 'quote', narration: N('x'), quote: 'The best time to protect your family is while everything is going well.', attribution: 'Your advisor' },
  { id: id(), type: 'cta', narration: N('x'), headline: 'Questions? Let’s talk', action: 'Book a 15-minute call', contact: { phone: '555-0142', email: 'hello@example.com', website: 'example.com' } },
]

const LONG = 'Comprehensive Lifetime Protection And Wealth Accumulation Strategy Overview For Families'
const long = (): KitScene[] => [
  { id: id(), type: 'title', narration: 'x', headline: `${LONG} With Extraordinarily Long Supplementary Headline Words`, sub: 'A deliberately overlong subtitle that keeps going well past what any reasonable planner would ever write for a cover line, to prove it shrinks rather than spills' },
  { id: id(), type: 'bignumber', narration: 'x', label: 'Total projected death benefit payable to all named beneficiaries combined', figure: { value: 123456789012.5, prefix: '$' }, context: 'Before any outstanding policy loans, withdrawals, riders or adjustments described in the full illustration document below' },
  { id: id(), type: 'comparison', narration: 'x', heading: `${LONG} compared side by side, with both of the options laid out`, left: { label: 'Option one: the current arrangement as it stands today', figure: { value: 9876543210, prefix: '$', suffix: '/yr' }, points: ['An extremely long point that runs well past the nine word limit set', 'Another long point with many many words in it here', 'A third point that is also far too long to fit'] }, right: { label: 'Option two: the recommended arrangement going forward', figure: { value: 1234567890, prefix: '$', suffix: '/yr' }, points: ['An extremely long point that runs well past the nine word limit set', 'Another long point with many many words in it here', 'A third point that is also far too long to fit'] }, verdict: 'A very long verdict sentence that explains in far more words than needed which of the two options comes out ahead and why that matters so much' },
  { id: id(), type: 'chart', narration: 'x', heading: `${LONG} by category`, kind: 'bar', prefix: '$', points: [{ label: 'Mortgage and home equity loan balance', value: 3100000 }, { label: 'College tuition for three children', value: 1200000 }, { label: 'Replacement income for ten years', value: 7000000 }, { label: 'Final expenses and estate settlement', value: 45000 }, { label: 'Emergency fund', value: 99999 }, { label: 'Charitable giving commitments', value: 1500000 }], takeaway: 'A takeaway line that is also much longer than it should ever be, to check it wraps and shrinks' },
  { id: id(), type: 'chart', narration: 'x', heading: `${LONG} share`, kind: 'donut', suffix: '%', points: [{ label: 'Mortgage and home equity loan balance', value: 41.5 }, { label: 'College tuition for three children', value: 22.25 }, { label: 'Replacement income for ten years', value: 18 }, { label: 'Final expenses and estate settlement', value: 9 }, { label: 'Emergency fund', value: 5 }, { label: 'Charitable giving commitments', value: 4.25 }], takeaway: 'A takeaway line that is also much longer than it should ever be' },
  { id: id(), type: 'chart', narration: 'x', heading: `${LONG} over the years`, kind: 'line', prefix: '$', points: [{ label: 'Year one of the plan', value: 12000 }, { label: 'Year five', value: 98000 }, { label: 'Year ten of the plan', value: 260000 }, { label: 'Year fifteen', value: 510000 }, { label: 'Year twenty of the plan', value: 1250000 }, { label: 'Year thirty', value: 3400000 }] },
  { id: id(), type: 'timeline', narration: 'x', heading: `${LONG} timeline`, steps: [{ when: 'Today, the day you sign', label: 'Coverage starts the moment the first premium payment is received' }, { when: 'Within thirty days', label: 'Your policy documents arrive in the mail for review' }, { when: 'Age forty-five', label: 'The children are expected to finish their college education' }, { when: 'Age fifty-five', label: 'The mortgage on the family home is fully paid off' }, { when: 'Age sixty-five', label: 'The level premium term ends and you can convert' }] },
  { id: id(), type: 'checklist', narration: 'x', heading: `${LONG} reasons`, items: ['Pays off the entire mortgage balance so your family keeps the home they love', 'Keeps every single college plan on track for all three of the children', 'The premium never goes up for the whole length of the level term period', 'You can convert to permanent coverage later without a new medical exam'] },
  { id: id(), type: 'quote', narration: 'x', quote: 'The best time to protect your family is while everything is going well, because once something changes the options narrow quickly and the price goes up for everyone involved in the decision.', attribution: 'Your advisor, with many years of experience helping families plan ahead' },
  { id: id(), type: 'cta', narration: 'x', headline: 'Questions about any part of this plan? Let’s talk it through together', action: 'Book a fifteen-minute call with your advisor this week', contact: { booking: 'calendly.example.com/your-agency-team/fifteen-minute-review-call', phone: '(555) 014-2000 extension 12345', email: 'the.whole.team.inbox@your-agency-long-domain.example.com', website: 'www.your-agency-insurance-and-planning.example.com' } },
]

const short = (): KitScene[] => [
  { id: id(), type: 'title', narration: 'x', headline: 'Hi' },
  { id: id(), type: 'bignumber', narration: 'x', label: 'Fee', figure: { value: 0, prefix: '$' } },
  { id: id(), type: 'comparison', narration: 'x', heading: 'Cost', left: { label: 'Now', figure: { value: 9, prefix: '$' } }, right: { label: 'Later', figure: { value: 5, prefix: '$' } } },
  { id: id(), type: 'chart', narration: 'x', heading: 'Split', kind: 'donut', suffix: '%', points: [{ label: 'A', value: 60 }, { label: 'B', value: 40 }] },
  { id: id(), type: 'chart', narration: 'x', heading: 'Up', kind: 'line', points: [{ label: '1', value: 1 }, { label: '2', value: 3 }] },
  { id: id(), type: 'chart', narration: 'x', heading: 'Two', kind: 'bar', points: [{ label: 'A', value: 2 }, { label: 'B', value: 5 }] },
  { id: id(), type: 'timeline', narration: 'x', heading: 'Steps', steps: [{ when: 'Now', label: 'Sign' }, { when: 'Later', label: 'Done' }] },
  { id: id(), type: 'checklist', narration: 'x', heading: 'Why', items: ['Simple'] },
  { id: id(), type: 'quote', narration: 'x', quote: 'Start now.' },
  { id: id(), type: 'cta', narration: 'x', headline: 'Call', action: 'Call' },
]

function plan(look: Look, brand: KitBrand, scenes: KitScene[], recipient?: string): KitPlan {
  return { version: 1, title: 'QA', look, brand, recipient, scenes }
}

function kitCase(name: string, p: KitPlan): QACase {
  const tl = kitTimeline(p.scenes, p.look.feel, { preview: true })
  const frames = tl.starts.flatMap((s, i) => [s + 150, s + tl.durations[i] - tl.cut - 6])
  return { id: `kit-${name}`, component: KitVideo, props: { plan: p, still: true, timeline: tl }, durationInFrames: tl.total, frames }
}

const looks = Object.values(KIT_LOOKS)
export const cases: QACase[] = [
  ...looks.map((l) => kitCase(`${l.id}-normal`, plan(l, withLogo, normal(), 'The Rivera Family'))),
  ...looks.map((l) => kitCase(`${l.id}-long`, plan(l, nameOnly, long(), 'The Extraordinarily Long Family Name Household Trust of Springfield'))),
  ...looks.map((l) => kitCase(`${l.id}-short`, plan(l, anyLogo, short()))),
  // logo modes: a white card always / the name as words
  kitCase('plate-logo', plan({ ...KIT_LOOKS['animated-slides'], logoMode: 'plate' }, withLogo, normal().slice(0, 3), 'The Rivera Family')),
  kitCase('text-logo', plan({ ...KIT_LOOKS.editorial, logoMode: 'text' }, withLogo, normal().slice(0, 3), 'The Rivera Family')),
]
