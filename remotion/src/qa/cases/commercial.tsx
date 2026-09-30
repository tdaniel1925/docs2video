import { TemplateCommercial, commercialDuration } from '../../templates/TemplateCommercial'
import { TemplateFintech, fintechDuration } from '../../templates/TemplateFintech'
import type { QACase } from '../types'

// =============================================================================
// COMMERCIAL engine — TemplateCommercial (every commercial the app makes:
// /create/commercial, /api/v1/commercials, admin prospect pipeline → render
// service /generate-commercial → render-service/commercial.js director) and
// TemplateFintech (only reachable through the render service's
// /render-commercial route, which nothing in the app calls today).
//
// Props are shaped exactly like commercial.js builds them. Test images live in
// qa-public/commercial-qa/ (small copies of real director output). No audio
// files: stills never load them.
// =============================================================================

const FPS = 30
const ASSET = 'commercial-qa'
const INTRO = 90

// Every style the director can pick (commercial.js STYLE_IDS).
const STYLES = [
  'fintech', 'luxury', 'tech', 'upbeat', 'emerald', 'redblueprint', 'data', 'playful', 'casino', 'clean',
  'glitchcore', 'cinematic', 'noir', 'retro', 'vibrant', 'editorial', 'brutalist', 'aurora', 'sport', 'corporate', 'neon', 'organic',
] as const

// A palette the way commercial.js buildBrand() makes one.
const BRAND = {
  bg: '#0a0e16', bg2: '#111828', panel: '#191c26', accent: '#3b6fd8', accentHi: '#89a9e8',
  accent2: '#e01f26', cream: '#f4f1ea', mute: '#9fa2ad', white: '#ffffff',
}

type Beat = { kind: string; dur?: number } & Record<string, unknown>

/** When each beat has finished animating in (and the late look before it fades). */
function framesFor(beats: Beat[]): number[] {
  const out = [70]   // intro: logo landed, before its hand-off fade
  let t = INTRO
  for (const b of beats) {
    const len = Math.round((b.dur ?? 4) * FPS)
    out.push(t + len - 14)                                   // settled + late: every reveal done, head not yet fading
    if (b.kind === 'quote') out.push(t + Math.max(10, len - 34) - 6)   // the hot word before it shatters (aggressive styles)
    t += len
  }
  return out
}

function commercial(id: string, styleId: string, beats: Beat[], extra: Record<string, unknown> = {}): QACase {
  const props = {
    styleId, brand: BRAND,
    wordmark: { pre: 'Smart', post: 'Viewz' }, logoLetter: 'S',
    assetDir: ASSET,
    music: { file: 'music.mp3', frames: 900 },
    introFrames: INTRO, duck: { loud: 0.2, duck: 0.08 }, bug: true,
    ...extra,
    beats: beats.map((b) => ({ dur: 4, ...b })),
  }
  return {
    id: `commercial-${id}`,
    component: TemplateCommercial,
    props,
    durationInFrames: commercialDuration(props as any),
    frames: framesFor(props.beats as Beat[]),
  }
}

// ---------------------------------------------------------------- worst case --
const WORD = 'Supercalifragilisticexpialidocious-Indemnification'
const HEAD = `${WORD} protection for every family on the block, with coverage that grows as your household grows and changes over time`
const KICKER = 'The biggest problem facing independent insurance agencies in 2026 and beyond'
const SUB = 'A plain-English walkthrough of how the program works, who it is for, and exactly what you can expect in the first ninety days'
const LABEL = '100% High Cap Rate Acct (S&P 500 Index)'
const URL_LONG = 'www.supercalifragilisticexpialidocious-indemnification-partners.com/get-a-quote?ref=commercial'
const CONTACT_LONG = 'call (888) 533-6275 ext. 4410 or email hello@supercalifragilisticexpialidocious-indemnification.com'
const LONG_BRAND = { wordmark: { pre: `${WORD} `, post: 'Partners of Greater North Texas' }, logoLetter: 'S' }

const gridItem = (i: number) => ({
  icon: ['🔌', '💬', '🚀', '📊', '🛡️', '💰'][i % 6],
  title: i % 2 ? `${WORD} review` : 'Cross-sell opportunities surfaced automatically from your entire book of business',
  desc: 'Find the money already sitting in your book — every lapse, every renewal, every family that is under-covered today',
})

const WORST: Beat[] = [
  { kind: 'shot', img: 'gen/shot1.png', kicker: KICKER, pre: 'What if ', hot: `${WORD} coverage`, post: ' finally paid you every single month, without another spreadsheet or a single cold call?', sub: SUB },
  { kind: 'meet', sub: `${WORD} — ${SUB}` },
  { kind: 'stats', kicker: KICKER, pre: 'The numbers behind ', hot: `${WORD} results for agencies nationwide`, stats: [
    { value: 1234567890.12, prefix: '$', suffix: '/mo', label: LABEL },
    { value: 99.99, suffix: '%', label: 'Customer satisfaction across all fifty states and territories' },
    { value: 1234567, label: WORD },
    { value: 42, suffix: ' per month', label: 'Policies written per agent' },
  ] },
  { kind: 'grid', kicker: KICKER, hot: `${WORD} for everyone who sells`, items: [0, 1, 2].map(gridItem) },
  { kind: 'grid', kicker: 'Twelve reasons', hot: 'Everything you get on day one', items: Array.from({ length: 12 }, (_, i) => gridItem(i)) },
  { kind: 'chat', chat: {
    q: `Which of my ${WORD} policies are about to lapse this month, and which of those clients also have a teenager about to start driving?`,
    a: `Twelve policies are flagged. Start with the Hendersons — their ${WORD} rider lapses on the 14th and their daughter turns sixteen in March, so bundle the auto quote. Then call the Okafors and the Delgados; both missed a draft. Full list with phone numbers is at ${URL_LONG} and I have drafted the three emails for you to review before they go out this afternoon.`,
  } },
  { kind: 'quote', pre: 'When the unexpected happens, ', hot: `${WORD} coverage`, post: ' is what keeps your family whole, your mortgage paid, and your plans on track for the long run.' },
  { kind: 'split', variant: 0, split: { leftLabel: 'Spreadsheets, sticky notes and endless follow-up calls', leftSub: SUB, rightLabel: WORD, rightSub: 'Instant answers for every client in your book, live dashboards, zero waiting', both: 'One platform that replaces every tool you juggle today, from quoting to renewals to claims' } },
  { kind: 'split', variant: 1, split: { leftLabel: 'Spreadsheets, sticky notes and endless follow-up calls', leftSub: SUB, rightLabel: WORD, rightSub: 'Instant answers for every client in your book, live dashboards, zero waiting', both: 'One platform that replaces every tool you juggle today, from quoting to renewals to claims' } },
  { kind: 'split', variant: 2, split: { leftLabel: 'Spreadsheets, sticky notes and endless follow-up calls', leftSub: SUB, rightLabel: WORD, rightSub: 'Instant answers for every client in your book, live dashboards, zero waiting', both: 'One platform that replaces every tool you juggle today, from quoting to renewals to claims' } },
  { kind: 'bignumber', kicker: KICKER, sub: SUB, big: { value: 1234567890.12, prefix: '$', suffix: '/mo', label: `Total ${WORD} benefit protection provided to families across the country since 1998` } },
  { kind: 'steps', kicker: KICKER, hot: `${WORD} in six easy steps`, steps: Array.from({ length: 6 }, (_, i) => ({
    title: i % 2 ? WORD : 'Connect every data source you already use',
    desc: 'SmartOffice sync, any CSV upload, or a direct carrier feed — whatever you already have works on day one',
  })) },
  { kind: 'showcase', shot: 'site.png', kicker: KICKER, hot: HEAD, sub: SUB },
  { kind: 'cta', variant: 0, cta: { headline: `Book your free, no-obligation policy review with a licensed ${WORD} specialist today`, button: 'Schedule My Free Consultation With A Licensed Agent Today', url: URL_LONG } },
  { kind: 'cta', variant: 1, cta: { headline: `Book your free, no-obligation policy review with a licensed ${WORD} specialist today`, button: 'Schedule My Free Consultation With A Licensed Agent Today', url: CONTACT_LONG } },
  { kind: 'cta', variant: 2, cta: { headline: `Book your free, no-obligation policy review with a licensed ${WORD} specialist today`, button: 'Schedule My Free Consultation With A Licensed Agent Today', url: URL_LONG } },
]

// Nothing optional filled in: empty lists, missing blocks, no kicker/sub,
// no wordmark. Must render without crashing or stray boxes.
const EMPTY: Beat[] = [
  { kind: 'shot', img: 'gen/shot1.png' },
  { kind: 'meet' },
  { kind: 'stats', stats: [] },
  { kind: 'grid', items: [] },
  { kind: 'chat' },
  { kind: 'quote' },
  { kind: 'split' },
  { kind: 'bignumber', hot: 'Just the phrase' },
  { kind: 'steps', steps: [] },
  { kind: 'showcase' },
  { kind: 'cta' },
]

// ---------------------------------------------------------------- normal ----
const NORMAL: Beat[] = [
  { kind: 'shot', img: 'gen/shot1.png', kicker: 'THE PROBLEM', pre: 'Your data is ', hot: 'sitting idle', sub: 'Every report takes a week' },
  { kind: 'meet', sub: 'AI answers for your whole book' },
  { kind: 'stats', kicker: 'BY THE NUMBERS', hot: 'Real results', stats: [{ value: 12, suffix: 'k', label: 'AGENTS' }, { value: 98, suffix: '%', label: 'RETENTION' }, { value: 355829, prefix: '$', label: 'SAVED' }] },
  { kind: 'grid', kicker: 'WHY IT WORKS', items: [{ icon: '🔌', title: 'Connect Data', desc: 'SmartOffice sync or any CSV' }, { icon: '💬', title: 'Ask Anything', desc: 'Plain English, no spreadsheets' }, { icon: '🚀', title: 'Act & Win', desc: 'Spot cross-sells fast' }] },
  { kind: 'grid', kicker: 'YOUR EDGE', hot: 'Agents actually want this.', items: [{ icon: '💰', title: 'Cross-sells surfaced', desc: 'Find the money in your book' }, { icon: '⚠️', title: 'Risk flagged early', desc: 'Compliance scoring' }, { icon: '📊', title: 'Live dashboards', desc: 'Always current' }, { icon: '🗣️', title: 'Plain-English queries', desc: 'No digging' }] },
  { kind: 'chat', chat: { q: 'Which policies are about to lapse this month?', a: '12 policies flagged — here is who to call first.' } },
  { kind: 'quote', pre: 'Look like the ', hot: 'sharpest agent', post: ' in the room' },
  { kind: 'split', variant: 0, split: { leftLabel: 'OLD WAY', leftSub: 'Spreadsheets & waiting', rightLabel: 'SMARTVIEWZ', rightSub: 'Instant answers', both: 'Ask. Know. Win.' } },
  { kind: 'split', variant: 1, split: { leftLabel: 'GUESSING', leftSub: 'hunches, missed deals', rightLabel: 'KNOWING', rightSub: 'instant answers', both: 'Ask. Know. Win.' } },
  { kind: 'split', variant: 2, split: { leftLabel: 'TRADING TIME', leftSub: 'The old way', rightLabel: 'RESIDUAL INCOME', rightSub: 'The Apex way', both: 'Build income that keeps paying' } },
  { kind: 'bignumber', kicker: 'MEMBER PRICING', sub: 'Free to join', big: { value: 149, prefix: '$', suffix: '/mo', label: 'SMARTVIEWZ' } },
  { kind: 'steps', kicker: 'HOW IT WORKS', steps: [{ title: 'Connect Data', desc: 'Upload any CSV' }, { title: 'Ask Anything', desc: 'Plain-English questions' }, { title: 'Act & Win', desc: 'Open doors, close deals' }] },
  { kind: 'showcase', shot: 'site.png', kicker: 'SEE IT LIVE', hot: 'See it live.', sub: 'Ask anything, instantly.' },
  { kind: 'cta', variant: 0, cta: { headline: 'Your unfair advantage starts now.', button: 'Get SmartViewz', url: 'theapexway.net' } },
  { kind: 'cta', variant: 1, cta: { headline: 'Start earning every month.', button: 'Talk to Your Apex Rep', url: 'call 888-533-6275' } },
  { kind: 'cta', variant: 2, cta: { headline: 'Order in and dig in', button: 'Order Now', url: 'dominos.com' } },
]

// ------------------------------------------------------------------ real ----
// Real director output kept in remotion/public (commercial-*-props.json) —
// commercial props are not stored in the database (the render service deletes
// the props file after each render). Images swapped for the small QA copies.
const REAL_APEXSHOW: Beat[] = [
  { dur: 6.26, kind: 'shot', img: 'gen/shot1.png', kicker: 'pattern-interrupt', pre: '', hot: 'never asked', post: '', sub: 'Money and clients hiding in plain sight' },
  { dur: 8.21, kind: 'meet', kicker: 'MEET', pre: 'Your book,', hot: 'talking back', post: '.', sub: 'English — SmartViewz — ask your book anything' },
  { dur: 8.81, kind: 'chat', kicker: 'ASK, IT ANSWERS', chat: { q: 'Which policies are about to lapse this month?', a: "12 policies flagged — here's who to call first." } },
  { dur: 7.05, kind: 'steps', kicker: 'CONNECT, ASK, MOVE', steps: [{ title: 'Connect Data', desc: 'SmartOffice sync or any CSV' }, { title: 'Ask Anything', desc: 'Plain English, no reports' }, { title: 'Act & Win', desc: 'Answers in seconds' }] },
  { dur: 8.67, kind: 'grid', kicker: 'YOUR EDGE', items: [{ icon: '💰', title: 'Cross-sells surfaced', desc: 'Find the money already in your book' }, { icon: '⚠️', title: 'Risk flagged early', desc: 'Compliance scoring, before it hurts' }, { icon: '📊', title: 'Live dashboards', desc: 'Production and org, always current' }, { icon: '🗣️', title: 'Plain-English queries', desc: 'No spreadsheets, no digging' }] },
  { dur: 4.22, kind: 'split', hot: 'Interrogate your book', sub: 'Stop digging, start asking', variant: 1, split: { leftLabel: 'OLD WAY', leftSub: 'Manual reports, slow, always a step behind', rightLabel: 'SMARTVIEWZ', rightSub: 'Ask, answer, act — in seconds', both: 'The sharpest agent in the room' } },
  { dur: 7.33, kind: 'bignumber', kicker: 'MEMBER PRICING', sub: '$149/mo — free to join Apex', big: { value: 149, prefix: '$', suffix: '/mo', label: 'SMARTVIEWZ · $0 TO JOIN APEX', decimals: 0 } },
  { dur: 7.51, kind: 'cta', variant: 2, cta: { headline: 'Your unfair advantage starts now.', button: 'Get SmartViewz', url: 'theapexway.net' } },
]
const REAL_APEXSHOW_BRAND = { bg: '#111319', bg2: '#1d222e', panel: '#21232a', accent: '#6d7fa2', accentHi: '#a7b2c7', accent2: '#e11e29', cream: '#f4f1ea', mute: '#9fa2ad', white: '#ffffff' }

const REAL_DOMINOS: Beat[] = [
  { dur: 5.14, kind: 'shot', img: 'gen/shot2.png', kicker: 'HUNGRY?', pre: 'Craving hits. ', hot: 'We deliver.', post: '', sub: 'Pizza, pasta, wings & more' },
  { dur: 5.01, kind: 'meet', kicker: "MEET DOMINO'S", pre: 'Your order, ', hot: 'your way.', sub: 'Carryout or delivery, always' },
  { dur: 4.12, kind: 'grid', items: [{ icon: '🍕', title: 'Full menu', desc: 'Pizza, pasta, sandwiches & wings' }, { icon: '📍', title: 'Find a spot', desc: 'Locate the nearest store fast' }, { icon: '🚗', title: 'Delivery or pickup', desc: "However you're hungry" }, { icon: '🏷️', title: 'Deals inbox', desc: 'Email & text offers' }] },
  { dur: 4.08, kind: 'chat', chat: { q: "Where's my order right now?", a: 'Track it live from oven to your door.' } },
  { dur: 3.47, kind: 'split', variant: 0, split: { leftLabel: 'THE OLD WAY', leftSub: 'Guess and wait', rightLabel: "THE DOMINO'S WAY", rightSub: 'Order & track live', both: 'Hot food, zero mystery' } },
  { dur: 3.7, kind: 'quote', pre: 'Great food, ', hot: 'even better deals.', post: '' },
  { dur: 3.19, kind: 'cta', variant: 1, cta: { headline: 'Order in and dig in', button: 'Order Now', url: 'dominos.com' } },
]
const REAL_DOMINOS_BRAND = { bg: '#1a0b10', bg2: '#30121d', panel: '#2d1820', accent: '#e21737', accentHi: '#ee7487', accent2: '#e63a55', cream: '#f4f1ea', mute: '#9fa2ad', white: '#ffffff' }

const REAL_APEXOPP: Beat[] = [
  { dur: 7.7, kind: 'shot', img: 'gen/shot1.png', kicker: 'THE OPPORTUNITY', pre: 'What if you got paid ', hot: 'every single month?', sub: 'Not once. Every month a client stays.' },
  { dur: 8.7, kind: 'meet', sub: 'Recurring income, powered by AI' },
  { dur: 12.7, kind: 'grid', kicker: 'Why it sells itself', hot: 'Agents actually want this.', items: [{ icon: '🤖', title: 'SmartViewz', desc: 'AI that answers any question about their book' }, { icon: '💸', title: '$0 to join Apex', desc: 'No barrier — anyone can start' }, { icon: '📈', title: 'Real demand', desc: 'Every agent needs an edge' }] },
  { dur: 7.8, kind: 'split', split: { leftLabel: 'TRADING TIME', leftSub: 'The old way', rightLabel: 'RESIDUAL INCOME', rightSub: 'The Apex way', both: 'Build income that keeps paying' } },
  { dur: 7, kind: 'quote', pre: 'Every agent you bring on ', hot: 'pays you month after month.', sub: "That's the power of recurring revenue." },
  { dur: 7.3, kind: 'cta', cta: { headline: 'Start earning every month.', button: 'Talk to Your Apex Rep', url: 'call 888-533-6275' } },
]
const REAL_APEXOPP_BRAND = { bg: '#0d1117', bg2: '#16241c', panel: '#182c22', accent: '#f2c14e', accentHi: '#ffe08a', accent2: '#34d399', cream: '#f4f1ea', mute: '#9fb0a6', white: '#ffffff' }

const REAL_APEXTORN: Beat[] = [
  { dur: 7.61, kind: 'shot', img: 'gen/shot1.png', kicker: 'Bold claim', pre: '', hot: 'learned to talk', post: '', sub: "It's whispering leads to whoever asked first" },
  { dur: 4.96, kind: 'meet', kicker: 'MEET', pre: 'Your book,', hot: 'it talks back.', sub: 'SmartViewz — ask your book anything, get answers in seconds' },
  { dur: 8.25, kind: 'chat', kicker: 'JUST ASK', sub: "English — Who's about to lapse? Where's my next sale?", chat: { q: 'Who in my book is about to lapse?', a: '12 policies at risk this month — with cross-sell openings on 5 of them.' } },
  { dur: 6.44, kind: 'steps', kicker: 'HOW IT WORKS', steps: [{ title: 'Connect Data', desc: 'Upload any CSV — no SmartOffice required' }, { title: 'Ask Anything', desc: 'Plain-English questions, instant answers' }, { title: 'Act & Win', desc: 'Open doors, close deals' }] },
  { dur: 9.88, kind: 'grid', kicker: 'YOUR EDGE', items: [{ icon: '🎯', title: 'Spot lapsing policies', desc: 'Find your next sale hiding in your book' }, { icon: '⚠️', title: 'Surface cross-sell', desc: 'Catch policies before they slip away' }, { icon: '🛡️', title: 'Catch compliance risk', desc: 'Flags risk early' }, { icon: '📊', title: 'No waiting on reports', desc: 'Production and org health, always current' }] },
  { dur: 10.25, kind: 'split', hot: 'Move on answers', sub: 'The line nobody can catch', variant: 2, split: { leftLabel: 'GUESSING', leftSub: 'hunches, spreadsheets, missed deals', rightLabel: 'KNOWING', rightSub: 'instant answers, doors opening', both: 'Ask. Know. Win.' } },
  { dur: 5.52, kind: 'cta', kicker: 'GET THE EDGE', variant: 0, cta: { headline: "Join Apex free — that's SmartViewz", button: 'Get SmartViewz', url: 'apexaffinitygroup.com' } },
]
const REAL_APEXTORN_BRAND = { bg: '#0a0e16', bg2: '#111828', panel: '#191c26', accent: '#1f3d7a', accentHi: '#798baf', accent2: '#e01f26', cream: '#f4f1ea', mute: '#9fa2ad', white: '#ffffff' }

// Logo shapes: wide (real), square (real, tiny), tall (worst). Intro, meet and
// every closing layout, where the logo is biggest.
const LOGO_BEATS: Beat[] = [
  { kind: 'meet', sub: 'AI answers for your whole book' },
  { kind: 'cta', variant: 0, cta: { headline: 'Book your free, no-obligation policy review with a licensed specialist today', button: 'Schedule My Free Consultation', url: URL_LONG } },
  { kind: 'cta', variant: 1, cta: { headline: 'Book your free, no-obligation policy review with a licensed specialist today', button: 'Schedule My Free Consultation', url: CONTACT_LONG } },
  { kind: 'cta', variant: 2, cta: { headline: 'Book your free, no-obligation policy review with a licensed specialist today', button: 'Schedule My Free Consultation', url: URL_LONG } },
]

// Representative styles for the normal look: one per font / hero treatment.
const NORMAL_STYLES = ['fintech', 'luxury', 'upbeat', 'redblueprint', 'playful', 'casino', 'glitchcore', 'editorial', 'brutalist']

// ---------------------------------------------------------- TemplateFintech ----
const FT_BRAND = { bg: '#070b14', bg2: '#0e1628', panel: '#141c2e', accent: '#3b82f6', accentHi: '#93c5fd', cyan: '#22d3ee', green: '#34d399', cream: '#f4f1ea', mute: '#94a3b8', white: '#ffffff' }
function fintechTemplate(id: string, beats: Beat[], extra: Record<string, unknown> = {}): QACase {
  const props = {
    brand: FT_BRAND, wordmark: { pre: 'Smart', post: 'Viewz' }, logoLetter: 'S', assetDir: ASSET,
    music: { file: 'music.mp3', frames: 900 }, introFrames: INTRO, duck: { loud: 0.2, duck: 0.08 },
    ...extra,
    beats: beats.map((b) => ({ dur: 4, ...b })),
  }
  return {
    id: `commercial-fintechtpl-${id}`,
    component: TemplateFintech,
    props,
    durationInFrames: fintechDuration(props as any),
    frames: framesFor(props.beats as Beat[]),
  }
}
const FT_WORST: Beat[] = [
  { kind: 'shot', img: 'gen/shot1.png', kicker: KICKER, pre: 'What if ', hot: `${WORD} coverage`, post: ' finally paid you every single month, without another spreadsheet or a single cold call?', sub: SUB },
  { kind: 'meet', sub: `${WORD} — ${SUB}` },
  { kind: 'stats', kicker: KICKER, pre: 'The numbers behind ', hot: `${WORD} results`, stats: WORST[2].stats as unknown[] },
  { kind: 'chat', chat: WORST[5].chat },
  { kind: 'cta', cta: (WORST[13] as any).cta },
]
const FT_NORMAL: Beat[] = [
  { kind: 'shot', img: 'gen/shot1.png', kicker: 'THE PROBLEM', pre: 'Your data is ', hot: 'sitting idle', sub: 'Every report takes a week' },
  { kind: 'meet', sub: 'AI answers for your whole book' },
  { kind: 'stats', kicker: 'BY THE NUMBERS', hot: 'Real results', stats: (NORMAL[2] as any).stats },
  { kind: 'chat', chat: (NORMAL[5] as any).chat },
  { kind: 'cta', cta: (NORMAL[13] as any).cta },
]

export const cases: QACase[] = [
  // Real director output.
  commercial('real-apexshow', 'redblueprint', REAL_APEXSHOW, { brand: REAL_APEXSHOW_BRAND, logo: 'logo.png' }),
  commercial('real-dominos1', 'playful', REAL_DOMINOS, { brand: REAL_DOMINOS_BRAND, logo: 'logo-small.png', wordmark: { pre: 'Domi', post: "no's" }, logoLetter: 'D' }),
  commercial('real-apexopp', 'upbeat', REAL_APEXOPP, { brand: REAL_APEXOPP_BRAND, wordmark: { pre: 'Apex ', post: 'Affinity' }, logoLetter: 'A' }),
  commercial('real-apextorn', 'data', REAL_APEXTORN, { brand: REAL_APEXTORN_BRAND, logo: 'logo.png' }),
  // Typical lengths — the look must not change.
  ...NORMAL_STYLES.map((st) => commercial(`normal-${st}`, st, NORMAL)),
  // Worst case, every beat kind and layout, in every style (fonts, caps and
  // hero treatments all change how wide the words run).
  ...STYLES.map((st) => commercial(`worst-${st}`, st, WORST, LONG_BRAND)),
  // Nothing optional filled in.
  commercial('empty-fintech', 'fintech', EMPTY, { wordmark: undefined, logoLetter: undefined }),
  commercial('empty-sport', 'sport', EMPTY, { wordmark: undefined, logoLetter: undefined }),
  // Logo shapes.
  commercial('logo-wide', 'fintech', LOGO_BEATS, { logo: 'logo.png' }),
  commercial('logo-square', 'playful', LOGO_BEATS, { logo: 'logo-square.png' }),
  commercial('logo-tall', 'luxury', LOGO_BEATS, { logo: 'logo-tall.png' }),
  // TemplateFintech (render service /render-commercial only).
  fintechTemplate('normal', FT_NORMAL),
  fintechTemplate('worst', FT_WORST, { wordmark: LONG_BRAND.wordmark }),
]
