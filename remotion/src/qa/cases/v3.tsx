import { V3Video } from '../../v3/V3Video'
import type { QACase } from '../types'

// The V3 engine: the "cinematic" style (a picture behind every scene) and the
// "aurora" style (one moving code-drawn backdrop, no pictures). Props are
// shaped exactly as render-service/server.js /render-v3 writes them (theme via
// v3Theme, brandName, recipient, frame, look, logo, presenter + presenterOnCover
// /Closing, scenes[] with placement / heroMetric / bullets / closing) — minus
// audio. Images live in qa-public/ (v3-scene-bg.png, v3-logo-wide.png,
// v3-presenter.png). Names in the "real" cases are swapped for same-length
// stand-ins; every other word is exactly what production rendered.

/** render-service/server.js v3Theme(), copied. */
function v3Theme(brandAccents?: string[]) {
  const base = {
    name: 'Modern Fintech', ink: '#070D1A', inkSoft: '#0C1730',
    glass: 'rgba(120,170,255,0.06)', glassEdge: 'rgba(120,170,255,0.22)',
    textPrimary: '#EAF2FF', textMuted: '#8FA6C8',
    accents: ['#3B82F6', '#22D3EE', '#8B5CF6'], mode: 'dark' as const,
  }
  const guard = (hex?: string) => {
    const h = (hex || '').replace('#', '')
    if (h.length < 6) return hex
    let r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    if (lum >= 0.42) return hex
    r = Math.round(r + (255 - r) * 0.55); g = Math.round(g + (255 - g) * 0.55); b = Math.round(b + (255 - b) * 0.55)
    return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')
  }
  if (brandAccents?.length) {
    const g = brandAccents.map(guard)
    base.accents = [g[0] || base.accents[0], g[1] || base.accents[1], g[2] || base.accents[2]]
    base.glassEdge = (g[0] || '#3B82F6') + '47'
  }
  return base
}

const OPEN = 105   // V3Video's branded cold-open
const LEN = 180    // frames per scene
// Cold-open: name, rule and "Prepared for" have all settled by ~80 (it fades out from 95).
// Scenes: the longest kinetic title, the lower-third and every count-up have
// landed by ~110; 130 is safely settled. `late` = 6 frames before the cut, when
// the exit transition (fade / push / whip / zoom) is under way.
type Scene = Record<string, unknown>
const video = (id: string, props: Record<string, unknown>, scenes: Scene[], opts: { late?: boolean } = {}): QACase => {
  const first = scenes[0] as { title?: string } | undefined
  const presenter = props.presenter as { name?: string } | undefined
  const hasOpen = !!(props.brandName || presenter?.name || first?.title)
  const start = hasOpen ? OPEN : 0
  const frames: number[] = hasOpen ? [85] : []
  scenes.forEach((_, i) => {
    frames.push(start + i * LEN + 130)
    if (opts.late && i < scenes.length - 1) frames.push(start + i * LEN + LEN - 6)
  })
  // The closing card holds to the very end.
  frames.push(start + scenes.length * LEN - 1)
  return {
    id: `v3-${id}`,
    component: V3Video,
    props: { ...props, scenes: scenes.map((s) => ({ durationInFrames: LEN, ...s })) },
    durationInFrames: start + scenes.length * LEN,
    frames,
  }
}

const IMG = 'v3-scene-bg.png'
const PHOTO = 'v3-presenter.png'
const LOGO = 'v3-logo-wide.png'

/* ---------------------------------- real ---------------------------------- */

// Video 34326336 ("cinematic", 2026-08-23), person profile with photo on cover
// + closing, 10 scenes capped to 9 by buildV3Payload. Scene 1 was promoted to
// the hero number; middle scenes are glass panels (metric bullets + 2 text bullets).
const REAL_CINEMATIC = video('real-34326336', {
  theme: v3Theme(['#1B365D', '#FFB347', '#C7E8A8']),
  brandName: 'Morgan Ellsworth',
  recipient: 'Jamie Carter',
  frame: { eyebrow: 'Morgan Ellsworth', tag: 'August 2026', footer: ['Monthly Premium', 'Death Benefit (If I Die Tomorrow)', 'Face Amount / Death Protection'] },
  presenter: { name: 'Morgan Ellsworth', role: 'Life Insurance Agent', photo: PHOTO },
  presenterOnCover: true, presenterOnClosing: true,
}, [
  { title: 'Your Personalized Illustration', image: IMG, placement: 'center' },
  { title: 'Your Plan, Simply Explained', image: IMG, placement: 'left', heroMetric: { value: '$100.00', label: 'Your Plan, Simply Explained', caption: 'Monthly Premium', tone: 'hero' } },
  { title: 'Coverage Starts Immediately', image: IMG, placement: 'right', bullets: [{ text: 'Monthly Premium', value: '$100.00' }, { text: 'Daily Cost', value: '~$3/day' }, { text: 'Policy in force from day one' }, { text: 'Less than a daily cup of coffee' }] },
  { title: 'Protection That Grows With You', image: IMG, placement: 'bottom', bullets: [{ text: 'Immediate Death Benefit', value: '$100,041' }, { text: 'Net Death Benefit at Age 79', value: '$131,461' }, { text: 'Beneficiaries receive $100,041 upon death — immediately' }, { text: 'Death Benefit Option B (Increasing) adds accumulated cash value' }] },
  { title: 'Living Benefits: Cash Value', image: IMG, placement: 'bottom', bullets: [{ text: 'Projected Cash Value at Age 65', value: '$17,273' }, { text: 'Accessible via loans or withdrawals while alive' }, { text: 'Non-guaranteed — based on current charges and interest' }] },
  { title: 'Know the Guaranteed Floor', image: IMG, placement: 'left', bullets: [{ text: 'Projected Cash Value at Age 65', value: '$17,273' }, { text: 'Guaranteed Cash Value at Age 65', value: '$2,831' }, { text: 'Projected value is NOT guaranteed' }, { text: 'Guaranteed minimum at age 65 is only $2,831' }] },
  { title: 'Accelerated Living Benefits', image: IMG, placement: 'right', bullets: [{ text: 'Terminal Illness Benefit (Age 65)', value: '$95,927' }, { text: 'Chronic Illness Monthly Benefit (Age 65)', value: '$1,559/month' }, { text: 'Access funds while still living upon qualifying diagnosis' }, { text: 'Terminal illness: $95,927 lump sum at age 65' }] },
  { title: 'Three Scenarios, One Plan', image: IMG, placement: 'bottom', bullets: [{ text: 'Daily Cost', value: '~$3/day' }, { text: 'Covers you if you die too soon' }, { text: 'Covers you if serious illness strikes' }] },
  { title: 'Thank You', image: IMG, placement: 'center', closing: { headline: 'Thank You', cta: 'Reach out with any questions — we\'re here to help.', contact: { phone: '1-555-555-0142', email: 'morgan.ellsworth@example.com', website: 'www.example.com' } } },
], { late: true })

// Video b41b08f7 ("aurora", 2026-08-18). The document's only "metric" was the
// sentence "Help 1,000 people become millionaires" — it became both the giant
// hero number and a bullet value.
const REAL_AURORA = video('real-b41b08f7', {
  theme: v3Theme(['#1B365D', '#FFB347', '#C7E8A8']),
  brandName: 'Jordan Whitfield',
  look: 'aurora',
  frame: { eyebrow: 'Jordan Whitfield', tag: 'August 2026', footer: ['Vision Goal'] },
  presenter: { name: 'Jordan Whitfield', photo: PHOTO },
  presenterOnCover: true, presenterOnClosing: true,
}, [
  { title: 'New of: to the', placement: 'center' },
  { title: 'A Season of Ownership', placement: 'left', heroMetric: { value: 'Help 1,000 people become millionaires', label: 'A Season of Ownership', caption: 'Vision Goal', tone: 'hero' } },
  { title: 'Introducing Valor', placement: 'right', bullets: [{ text: 'Deep gratitude for the past — this isn\'t a move away' }, { text: 'Moving toward an independent agency built with intention' }] },
  { title: 'The Core Mission', placement: 'bottom', bullets: [{ text: 'Vision Goal', value: 'Help 1,000 people become millionaires' }, { text: 'Goal is not just writing policies' }, { text: 'Built on real financial knowledge and disciplined stewardship' }] },
  { title: 'Valor / 3 Mark Model', placement: 'bottom', bullets: [{ text: 'Independent agency model under the 3 Mark opportunity' }, { text: 'Ownership over culture, standards, team, and business economics' }] },
  { title: 'Real Ownership Benefits', placement: 'left', bullets: [{ text: 'Residual and renewal economics — participate directly' }, { text: 'Own your book of business: a job becomes an asset' }] },
  { title: 'Flexible Career Paths', placement: 'right', bullets: [{ text: 'Success never requires recruiting a single person' }, { text: 'Path 1: Professional Producer' }] },
  { title: 'Culture & Expanding Vision', placement: 'bottom', bullets: [{ text: 'Kingdom-minded culture: integrity, stewardship, excellence, accountability' }, { text: 'Clients over production — professionals over recruiters' }] },
  { title: 'Thank You', placement: 'center', closing: { headline: 'Thank You', cta: 'Reach out with any questions — we\'re here to help.', contact: { phone: '1-555-555-0187', email: 'jordan@example.com' } } },
])

/* --------------------------------- normal --------------------------------- */

// Typical company video with a logo: proves the look is unchanged at normal lengths.
const NORMAL = video('normal', {
  theme: v3Theme(['#0F766E', '#F59E0B', '#38BDF8']),
  brandName: 'Harbor Financial Group',
  recipient: 'The Patel Family',
  frame: { eyebrow: 'Harbor Financial Group', tag: 'September 2026', footer: ['Death Benefit', 'Annual Premium', 'Cash Value'] },
  logo: { light: LOGO, dark: LOGO }, logoChip: false,
}, [
  { title: 'Your Coverage, Explained', image: IMG, placement: 'center' },
  { title: 'The Number That Matters', image: IMG, placement: 'left', heroMetric: { value: '$176,204', label: 'Death benefit on day one', caption: 'Death Benefit', tone: 'hero' } },
  { title: 'What You Pay Each Year', image: IMG, placement: 'right', bullets: [{ text: 'Annual Premium', value: '$10,000' }, { text: 'Cash Value at 65', value: '$84,310' }, { text: 'Premiums stay level for life' }] },
  { title: 'Protection Starts Today', eyebrow: 'Day One', body: 'Your family is covered the moment the policy is issued.', image: IMG, placement: 'bottom' },
  { title: 'Built To Grow Over Time', image: IMG, placement: 'left' },
  { title: 'Two Numbers To Remember', image: IMG, placement: 'right', metrics: [{ label: 'Death Benefit', value: '$176,204' }, { label: 'Annual Premium', value: '$10,000/yr' }] },
  { title: 'Thank You', image: IMG, placement: 'center', closing: { headline: 'Thank You', cta: 'Call us any time with questions.', value: { label: 'Death Benefit', value: '$176,204' }, contact: { phone: '1-555-555-0100', email: 'hello@harborfinancial.com', website: 'harborfinancial.com' } } },
])

/* ------------------------------- worst case -------------------------------- */

const LONG_TITLE = 'Why Your Indexed Universal Life Policy\'s Guaranteed Minimum Crediting Rate Protects Your Family Even When the Market Falls Sharply'
const WORD = 'Supercalifragilisticexpialidocious-Indemnification'
const SOLID = 'Supercalifragilisticexpialidociousindemnificationprovisions'
const LONG_VALUE = '100% High Cap Rate Acct (S&P 500 Index)'
const HUGE = '$1,234,567,890.00'
const LONG_LABEL = 'Hypothetical Illustrated Non-Guaranteed Cash Surrender Value at Policy Year Thirty-Five (Age 100)'
const LONG_BULLET = 'Accelerated death benefit riders for chronic, critical and terminal illness can advance a portion of the face amount while you are living, subject to an actuarial discount and administrative charges'
const LONG_BODY = 'Non-guaranteed values assume the current illustrated rate continues unchanged for decades, which it will not; review the policy every year with your licensed professional so that small adjustments keep the plan on track.'
const LONG_EYEBROW = 'Section Four: Understanding the Non-Guaranteed Elements of Your Illustration'
const LONG_NAME = 'Maximiliana Alexandra Worthington-Fairbanks III'
const LONG_ROLE = 'Senior Vice President, Wealth Preservation & Estate Planning Strategies for Multi-Generational Families'
const LONG_CLIENT = 'Dr. Bartholomew Christopher Montgomery-Vanderbilt and the Montgomery-Vanderbilt Family Irrevocable Trust'
const LONG_BRAND = 'Worthington-Fairbanks Wealth Preservation & Multi-Generational Estate Planning Partners of Greater New England, LLC'
const LONG_CONTACT = {
  phone: '+1 (555) 123-4567 ext. 8910',
  email: 'maximiliana.worthington-fairbanks@worthingtonfairbankswealthpartners.com',
  website: 'https://www.worthingtonfairbankswealthpartners.com/advisors/maximiliana-worthington-fairbanks',
}
const LONG_FRAME = {
  eyebrow: LONG_BRAND,
  tag: 'Source: 2026 Annual Policy Review Illustration — Prepared September 2026',
  footer: [LONG_LABEL, 'Guaranteed Minimum Crediting Rate of 1.00% Applies to Every Indexed Account', 'Riders: Chronic, Critical & Terminal Illness', 'A fourth chip the engine must drop'],
}
const SIX_BULLETS = [
  { text: LONG_LABEL, value: HUGE },
  { text: 'Index Allocation', value: LONG_VALUE },
  { text: LONG_BULLET, value: '$1,559/month' },
  { text: LONG_BULLET },
  { text: 'A fifth bullet the engine must drop' },
  { text: 'A sixth bullet the engine must drop' },
]
const FIVE_METRICS = [
  { label: LONG_LABEL, value: HUGE },
  { label: 'Index Allocation', value: LONG_VALUE },
  { label: 'Chronic Illness Monthly Benefit (Age 65)', value: '$1,559/month, paid monthly while the chronic illness continues' },
  { label: 'Fourth metric the engine drops', value: '$4' },
  { label: 'Fifth metric the engine drops', value: '$5' },
]

// Every layout at once, long everything. Logo on, so its corner is exercised.
const longScenes = (img?: string): Scene[] => [
  { title: LONG_TITLE, eyebrow: LONG_EYEBROW, body: LONG_BODY, image: img, placement: 'center' },
  { title: `${WORD} ${LONG_TITLE}`, body: LONG_BODY, image: img, placement: 'bottom' },
  { title: LONG_TITLE, eyebrow: LONG_EYEBROW, body: LONG_BODY, image: img, placement: 'left' },
  { title: LONG_TITLE, body: LONG_BODY, image: img, placement: 'right' },
  { title: LONG_TITLE, body: LONG_BODY, image: img, placement: 'top', metrics: FIVE_METRICS },
  { title: LONG_TITLE, eyebrow: LONG_EYEBROW, image: img, placement: 'left', heroMetric: { value: LONG_VALUE, label: LONG_TITLE, caption: LONG_LABEL, tone: 'hero' } },
  { title: 'Huge number', image: img, placement: 'right', heroMetric: { value: HUGE, label: LONG_LABEL, caption: 'Projected Death Benefit', tone: 'neutral' } },
  { title: LONG_TITLE, eyebrow: LONG_EYEBROW, image: img, placement: 'right', bullets: SIX_BULLETS },
  { title: `${WORD} and the ${SOLID}`, image: img, placement: 'bottom', bullets: [{ text: SOLID, value: HUGE }, { text: WORD, value: LONG_VALUE }, { text: LONG_BULLET }, { text: LONG_BULLET, value: '$95,927' }] },
  { title: LONG_TITLE, image: img, placement: 'center', closing: { headline: LONG_TITLE, cta: LONG_BULLET, value: { label: LONG_LABEL, value: LONG_VALUE }, contact: LONG_CONTACT } },
]

const LONG_PROPS = {
  brandName: LONG_BRAND,
  recipient: LONG_CLIENT,
  frame: LONG_FRAME,
  presenter: { name: LONG_NAME, role: LONG_ROLE, photo: PHOTO },
  presenterOnCover: true, presenterOnClosing: true,
  logo: { light: LOGO, dark: LOGO }, logoChip: true,
}

const LONG_CINEMATIC = video('long-cinematic', { theme: v3Theme(), ...LONG_PROPS }, longScenes(IMG), { late: true })

const LONG_AURORA = video('long-aurora', { theme: v3Theme(['#1B365D', '#FFB347', '#C7E8A8']), ...LONG_PROPS, look: 'aurora', presenterOnClosing: false }, [
  longScenes()[0], longScenes()[5], longScenes()[7], longScenes()[8], longScenes()[9],
])

// One unbroken word in every slot, and no brand name: the cold-open falls back
// to the presenter's name, the closing card to the brand-less logo.
const LONG_WORDS = video('long-words', {
  theme: v3Theme(),
  recipient: SOLID,
  presenter: { name: SOLID, role: SOLID, photo: PHOTO },
  presenterOnCover: true, presenterOnClosing: false,
  frame: { eyebrow: SOLID, tag: SOLID, footer: [SOLID, WORD, SOLID] },
}, [
  { title: SOLID, eyebrow: SOLID, body: SOLID, image: IMG, placement: 'center' },
  { title: SOLID, body: SOLID, image: IMG, placement: 'left', metrics: [{ label: SOLID, value: SOLID }] },
  { title: SOLID, image: IMG, placement: 'right', heroMetric: { value: SOLID, label: SOLID, caption: SOLID } },
  { title: SOLID, eyebrow: SOLID, image: IMG, placement: 'right', bullets: [{ text: SOLID, value: SOLID }, { text: SOLID }] },
  { title: SOLID, image: IMG, placement: 'center', closing: { headline: SOLID, cta: SOLID, value: { label: SOLID, value: SOLID }, contact: { phone: SOLID, email: `${SOLID}@${SOLID}.com`, website: `${SOLID}.com` } } },
])

// Empty / missing optional fields: no brand, no presenter, no frame, no cover
// title (so no cold-open), a bullet list whose only bullet is empty, a closing
// card with nothing but a headline.
const EMPTY = video('empty', {
  theme: v3Theme(),
}, [
  { title: '', placement: 'center' },
  { title: 'Only a value', placement: 'left', heroMetric: { value: '42' } },
  { title: 'Empty bullets', placement: 'right', bullets: [{ text: '' }] },
  { title: 'A', placement: 'bottom' },
  { title: '', placement: 'center', closing: {} },
])

export const cases: QACase[] = [REAL_CINEMATIC, REAL_AURORA, NORMAL, LONG_CINEMATIC, LONG_AURORA, LONG_WORDS, EMPTY]
