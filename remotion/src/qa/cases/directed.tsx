import { DirectedVideo } from '../../DirectedVideo'
import type { QACase } from '../types'

// SLIDE-DECK engine (videoStyle 'slides', the default): app /api/generate-video
// → render-service /generate-slides → render-service/slides.js writes the plan →
// DirectedVideo. Plans below are shaped exactly like slides.js writes them.
//
// Files: the engine hardcodes staticFile('dir-music.mp3') (a 5s silent mp3 in
// qa-public/, same as the render service's silent fallback). Voice files are
// <Audio> only and are never fetched for a still. Images live in
// qa-public/directed-qa/.

type Scene = Record<string, any>
type Plan = Record<string, any> & { scenes: Scene[] }

const LEN = 240   // frames per synthetic scene (8s)

/** When a scene has finished arriving: covers ~90, slides ~200 (8 bullets land by ~190). */
function settleAt(s: Scene): number {
  if (s.beat === 'intro') return 100
  if (s.beat === 'cta') return 120
  return 205
}

/** A synthetic deck: each scene LEN frames; scan its settled frame + one late frame. */
function deck(id: string, plan: Plan): QACase {
  const starts = plan.scenes.map((_, i) => i * LEN)
  const total = plan.scenes.length * LEN
  const frames = plan.scenes.flatMap((s, i) => [i * LEN + settleAt(s), i * LEN + LEN - 10])
  return {
    id: `directed-${id}`,
    component: DirectedVideo,
    props: { plan, starts, total, intensity: 'premium', bpm: 128 },
    durationInFrames: total,
    frames,
  }
}

/** A real deck with its real scene timings (frames): scan mid-scene and just before it leaves. */
function realDeck(id: string, plan: Plan, spans: [number, number][]): QACase {
  const starts = spans.map((s) => s[0])
  const total = spans[spans.length - 1][1]
  const frames = spans.flatMap(([a, b]) => [Math.min(a + 100, b - 30), b - 16])
  return {
    id: `directed-${id}`,
    component: DirectedVideo,
    props: { plan, starts, total, intensity: 'premium', bpm: 128 },
    durationInFrames: total,
    frames,
  }
}

// ---- scene builders (the shapes slides.js emits) ----
const intro = (id: number, heading = ''): Scene => ({ id, beat: 'intro', on_screen: heading, layout: { heading, align: 'center', media: 'full' }, blocks: [], visual: { type: 'kinetic' } })
const cta = (id: number, heading = 'Thank You'): Scene => ({ id, beat: 'cta', on_screen: heading, layout: { heading, align: 'center', media: 'full' }, blocks: [], visual: { type: 'kinetic' } })
const kinetic = (id: number, text: string, entrance: string): Scene => ({ id, beat: 'hook', on_screen: text, entrance, blocks: [], visual: { type: 'kinetic' } })
const slide = (id: number, heading: string | undefined, blocks: Scene[], layout: Scene = {}, beat = 'benefit'): Scene =>
  ({ id, beat, on_screen: heading || '', layout: { heading, align: 'left', media: 'right', ...layout }, blocks, visual: { type: 'slide' } })
const bullets = (items: (string | [string, string])[]) => ({ type: 'bullets', items: items.map((t) => (typeof t === 'string' ? { text: t, highlight: '' } : { text: t[0], highlight: t[1] })) })
const cards = (cs: Scene[], vs = false) => ({ type: 'cards', vs, cards: cs })
const figure = (f: Scene) => ({ type: 'figure', figure: f })
const chart = (c: Scene) => ({ type: 'chart', chart: c })

// ---- worst-case text ----
const UNBROKEN = 'Supercalifragilisticexpialidocious-Indemnification'
const T120 = 'Everything You Need to Know About Your Indexed Universal Life Illustration, Premium Schedule, Riders and Long-Term Projections'
const KICKER_LONG = 'Section three of seven — the part of your illustration most people skip, and really should not'
const LONG_VALUE = '100% High Cap Rate Acct (S&P 500 Index)'
const HUGE = '$1,234,567,890.00'
const CO_LONG = 'Konstantinopoulos-Worthington Comprehensive Financial Planning, Insurance & Retirement Income Solutions Group LLC'
const CLIENT_LONG = 'The Konstantinopoulos-Worthington Family Irrevocable Life Insurance Trust of 2026'
const NAME_LONG = 'Dr. Maximiliana Alexandrovna Konstantinopoulos-Worthington III'
const ROLE_LONG = 'Senior Vice President of Wealth Strategy, Retirement Income Planning & Estate Protection'
const CONTACT_LONG = '1-800-555-0199 | maximiliana.konstantinopoulos-worthington@comprehensivefinancialplanninggroup.com | www.comprehensivefinancialplanninggroup.com/book-a-consultation'
const CTA_LONG = 'Book a no-pressure thirty-minute review of your complete illustration with your advisor this week, before your next premium date'
const TAGLINE_LONG = 'One payment, no market risk, and an income stream powered by more than one hundred and twenty years of uninterrupted dividends'
const B_LONG = [
  'Your illustrated cash value is projected to grow on a tax-deferred basis every year the policy stays in force, compounding quietly in the background',
  `${UNBROKEN} protection applies to every claim filed under the endorsement schedule`,
  'Access it through policy loans or withdrawals whenever you need cash for college, a business opportunity, or a retirement income gap',
  'The 0% floor means a down-market year credits nothing — but it never subtracts from the value you have already built up over time',
  'Riders for chronic, critical and terminal illness let you draw on your own death benefit early when it matters most to your family',
  'Premiums stay flexible: pay more in strong years and less in lean ones, within the limits shown on page fourteen of the illustration',
  'Your advisor reviews the policy with you every year so the plan keeps pace with your income, your family and your goals',
  'Nothing here is promised; every figure is illustrated and hypothetical, based on the assumptions in the full illustration document',
]
const HL: [string, string][] = B_LONG.slice(0, 4).map((t, i) => [t, t.split(' ').slice(2, 4 + (i % 2)).join(' ')])

// ---- real production plans (saved <user>/<video>_plan.json, read-only), with
// their image files pointed at qa-public/directed-qa/ ----

// d8bb1e42 (2026-09-29): noir, business policy, cards + bullets, a DATE as a card value.
const REAL_d8bb1e42 = {"title":"Policy","look":"noir","chrome":{"company":"Naahaz Financial Inc","recipient":null,"footer":"1-773-259-6908 | Azizali.insurance@Gmail.com","glass":"vivid"},"intro":{"line1":"Policy","line2":"Prepared for you by your advisor","preparer":"Naahaz Financial Inc"},"cta":{"line":"Reach out to take the next step.","contact":"1-773-259-6908 | Azizali.insurance@Gmail.com"},"scenes":[{"id":1,"beat":"intro","on_screen":"Policy","layout":{"heading":"Policy","align":"center","media":"full"},"blocks":[],"visual":{"type":"kinetic"}},{"id":2,"beat":"benefit","on_screen":"Your Shop, Protected","layout":{"heading":"Your Shop, Protected","align":"left","media":"right"},"blocks":[{"type":"figure","figure":{"value":3228,"prefix":"$","suffix":"","label":"Estimated Annual Premium"}}],"visual":{"type":"slide"},"backdrop":"directed-qa/bg.png"},{"id":3,"beat":"benefit","on_screen":"One Policy, Full Coverage","layout":{"heading":"One Policy, Full Coverage","align":"left","media":"right"},"blocks":[{"type":"cards","vs":true,"cards":[{"label":"Estimated Annual Premium","value":"$3,228.00","accent":true,"cueFrame":20},{"label":"Policy Term","value":"Oct 10, 2026 – Oct 10, 2027","accent":false,"cueFrame":181}]},{"type":"bullets","items":[{"text":"Liability and cyber coverage, all in one policy","highlight":"","cueFrame":36},{"text":"Less than $9 per day for complete coverage","highlight":"","cueFrame":181}]}],"visual":{"type":"slide"},"backdrop":"directed-qa/bg.png"},{"id":4,"beat":"benefit","on_screen":"Liability: The Big One","layout":{"heading":"Liability: The Big One","align":"left","media":"right"},"blocks":[{"type":"cards","vs":true,"cards":[{"label":"Each Occurrence Limit","value":"$1,000,000","accent":true,"cueFrame":20},{"label":"General Aggregate Limit","value":"$2,000,000","accent":false,"cueFrame":335}]},{"type":"bullets","items":[{"text":"Covers slips, burns, foodborne illness claims","highlight":"","cueFrame":20},{"text":"$1M per incident, $2M total for the year","highlight":"","cueFrame":227},{"text":"Defense costs don't come out of your register","highlight":"","cueFrame":442}]}],"visual":{"type":"slide"},"backdrop":"directed-qa/bg.png"},{"id":5,"beat":"benefit","on_screen":"Physical Assets Covered","layout":{"heading":"Physical Assets Covered","align":"left","media":"right"},"blocks":[{"type":"cards","vs":true,"cards":[{"label":"Limit","value":"$400,000","accent":true,"cueFrame":20},{"label":"Deductible","value":"$1,000","accent":false,"cueFrame":255}]},{"type":"bullets","items":[{"text":"Covers equipment, inventory, and physical assets","highlight":"","cueFrame":20},{"text":"STRETCH® benefits for broader protection","highlight":"","cueFrame":166},{"text":"A fire or break-in doesn't mean starting from zero","highlight":"","cueFrame":376}]}],"visual":{"type":"slide"},"backdrop":"directed-qa/bg.png"},{"id":6,"beat":"benefit","on_screen":"Employment Claims Covered","layout":{"heading":"Employment Claims Covered","align":"left","media":"right"},"blocks":[{"type":"cards","vs":false,"cards":[{"label":"EPLI Limit Per Claim","value":"$25,000","accent":true,"cueFrame":20}]},{"type":"bullets","items":[{"text":"Covers wrongful termination, discrimination claims","highlight":"","cueFrame":20},{"text":"$25,000 per claim and in aggregate","highlight":"","cueFrame":136},{"text":"Expensive to fight even when you win — this plan responds","highlight":"","cueFrame":261}]}],"visual":{"type":"slide"},"backdrop":"directed-qa/bg.png"},{"id":7,"beat":"benefit","on_screen":"Cyber Threat Coverage","layout":{"heading":"Cyber Threat Coverage","align":"left","media":"right"},"blocks":[{"type":"cards","vs":false,"cards":[{"label":"Cyber Virus & Malware","value":"$50,000","accent":true,"cueFrame":20},{"label":"Digital Ransom & Extortion","value":"$10,000","accent":false,"cueFrame":216},{"label":"Annual Cyber Premium","value":"$62","accent":false,"cueFrame":421}]},{"type":"bullets","items":[{"text":"Credit card processing and digital records create real risk","highlight":"","cueFrame":20},{"text":"$50,000 policy year limit for virus and malware damage","highlight":"","cueFrame":165},{"text":"$10,000 sub-limit for digital ransom and extortion","highlight":"","cueFrame":319},{"text":"Only $62/year — about 17 cents a day","highlight":"","cueFrame":472}]}],"visual":{"type":"slide"},"backdrop":"directed-qa/bg.png"},{"id":8,"beat":"benefit","on_screen":"Data Breach Add-On","layout":{"heading":"Data Breach Add-On","align":"left","media":"right"},"blocks":[{"type":"cards","vs":false,"cards":[{"label":"Data Breach Annual Premium","value":"$270","accent":true,"cueFrame":20}]},{"type":"bullets","items":[{"text":"Covers forensic investigation and customer notification","highlight":"","cueFrame":20},{"text":"Includes legal defense if sued after a breach","highlight":"","cueFrame":165},{"text":"Costs otherwise land entirely on you","highlight":"","cueFrame":318}]}],"visual":{"type":"slide"},"backdrop":"directed-qa/bg.png"},{"id":9,"beat":"benefit","on_screen":"A Full Year of Coverage","layout":{"heading":"A Full Year of Coverage","align":"left","media":"right"},"blocks":[{"type":"cards","vs":false,"cards":[{"label":"Policy Term","value":"Oct 10, 2026 – Oct 10, 2027","accent":true,"cueFrame":20}]},{"type":"bullets","items":[{"text":"Coverage active every single day of the policy year","highlight":"","cueFrame":20},{"text":"Underwritten by The Hartford","highlight":"","cueFrame":183}]}],"visual":{"type":"slide"},"backdrop":"directed-qa/bg.png"},{"id":10,"beat":"benefit","on_screen":"One Bad Day, Covered","layout":{"heading":"One Bad Day, Covered","align":"left","media":"right"},"blocks":[{"type":"bullets","items":[{"text":"Here's the one thing to take with you: your business is your","highlight":"","cueFrame":20},{"text":"Thank you for watching.","highlight":"","cueFrame":300}]}],"visual":{"type":"slide"},"backdrop":"directed-qa/bg.png"},{"id":11,"beat":"cta","on_screen":"Thank You","layout":{"heading":"Thank You","align":"center","media":"full"},"blocks":[],"visual":{"type":"kinetic"}}]} as Plan
const SPANS_d8bb1e42: [number, number][] = [[15,126],[126,519],[519,900],[900,1590],[1590,2094],[2094,2517],[2517,3177],[3177,3684],[3684,4065],[4065,4431],[4431,4992]]

// 2e6a887e (2026-08-14): ledger, presenter photo + "Prepared for", media below,
// figures with word prefixes/suffixes and long labels.
const REAL_2e6a887e = {"title":"Your Coverage, Your Choice","look":"ledger","chrome":{"company":"Michele De Vahle","recipient":"Renee Hudson","footer":"1-813-546-3452 | mdevahle@gmail.com","glass":"vivid"},"intro":{"line1":"A closer look, just for you","line2":"And a permanent path forward","preparer":"Michele De Vahle","recipient":"Renee Hudson"},"cta":{"line":"Let's talk it through, no pressure","contact":null},"presenter":{"name":"Michele De Vahle","role":"Life Insurance Agent","photo":"directed-qa/presenter.png","onCover":true,"onClosing":true},"scenes":[{"id":1,"beat":"intro","on_screen":"Your Coverage, Your Choice","layout":{"heading":"Your Coverage, Your Choice","kicker":"A friendly guide","align":"center","media":"below"},"blocks":[{"type":"bullets","items":[{"text":"Losing job-based coverage is common, not a failure","highlight":"Not a failure","cueFrame":221},{"text":"A calm look at what fits you now","highlight":"Fits you now","cueFrame":383},{"text":"Protecting everything you've fought for","highlight":"Fought for","cueFrame":530}]}],"visual":{"type":"kinetic"}},{"id":2,"beat":"context","on_screen":"Three Paths To Compare","layout":{"heading":"Three Paths To Compare","kicker":"The big picture","align":"left","media":"below"},"blocks":[{"type":"bullets","items":[{"text":"Now is a smart moment to lock protection in","highlight":"Smart moment","cueFrame":131},{"text":"And an strategy","highlight":"Three main paths","cueFrame":243},{"text":"Different protection, flexibility, and long- value","highlight":"Long- value","cueFrame":371}]}],"visual":{"type":"slide"}},{"id":3,"beat":"audience","on_screen":"The Affordable Start","layout":{"heading":"The Affordable Start","kicker":"Option one","align":"left","media":"below"},"blocks":[{"type":"figure","figure":{"value":100,"prefix":"$","suffix":"–200/mo","label":"Estimated premium — ~$100K, 20-year (illustrated)"}},{"type":"bullets","items":[{"text":"Lowest-cost way to begin protecting your family","highlight":"Lowest-cost","cueFrame":37},{"text":"About $100K of coverage over a 20-year","highlight":"$100K coverage","cueFrame":216}]}],"visual":{"type":"slide"}},{"id":4,"beat":"context","on_screen":"But Expires","layout":{"heading":"But Expires","kicker":"The honest trade-off","align":"left","media":"below"},"blocks":[{"type":"cards","cards":[{"label":"NOW (age 46)","value":"$100–$200/mo","sub":"~$100K, 20-year","cueFrame":20},{"label":"RENEWAL (age 66)","value":"Significantly higher","sub":"Premiums rise sharply with age","accent":true,"cueFrame":251}]}],"visual":{"type":"slide"}},{"id":5,"beat":"compare","on_screen":"Steady But Slow","layout":{"heading":"Steady But Slow","kicker":"Option two","align":"left","media":"below"},"blocks":[{"type":"figure","figure":{"value":1,"suffix":"–3%","label":"Cash value growth rate"}},{"type":"bullets","items":[{"text":"Permanent coverage that never expires","highlight":"Never expires","cueFrame":48},{"text":"Around $100–$200/mo for ~$100K coverage","highlight":"$100–$200/mo","cueFrame":140},{"text":"Limited flexibility to adjust premiums or benefits","highlight":"Limited flexibility","cueFrame":300}]}],"visual":{"type":"slide"}},{"id":6,"beat":"benefit","on_screen":"A Permanent, Growing Option","layout":{"heading":"A Permanent, Growing Option","kicker":"Option three","align":"left","media":"below"},"blocks":[{"type":"cards","vs":true,"cards":[{"label":"THE FLOOR","value":"0%","sub":"Never loses in a down market","accent":true,"cueFrame":315},{"label":"THE CAP","value":"8–12%","sub":"Illustrated growth range","cueFrame":469}]}],"visual":{"type":"slide"}},{"id":7,"beat":"benefit","on_screen":"A Tax-Smart Savings Engine","layout":{"heading":"A Tax-Smart Savings Engine","kicker":"Why it's different","align":"left","media":"below"},"blocks":[{"type":"bullets","items":[{"text":"Cash value grows tax-deferred over time","highlight":"Tax-deferred","cueFrame":36},{"text":"Access it tax-free through policy loans","highlight":"Tax-free","cueFrame":120},{"text":"An advantage over a plain savings account","highlight":"Real advantage","cueFrame":195}]}],"visual":{"type":"slide"}},{"id":8,"beat":"benefit","on_screen":"Living Benefits, For You","layout":{"heading":"Living Benefits, For You","kicker":"Peace of mind","align":"left","media":"below"},"blocks":[{"type":"bullets","items":[{"text":"Access your own death benefit early if needed","highlight":"Access early","cueFrame":265},{"text":"Covers critical, chronic, or inal illness","highlight":"Living benefits","cueFrame":374},{"text":"Real peace of mind when it matters most","highlight":"Peace of mind","cueFrame":464}]}],"visual":{"type":"slide"}},{"id":9,"beat":"benefit","on_screen":"Flexibility As Life Evolves","layout":{"heading":"Flexibility As Life Evolves","kicker":"Built to adapt","align":"left","media":"below"},"blocks":[{"type":"bullets","items":[{"text":"Flexible premiums you can adjust over time","highlight":"Flexible premiums","cueFrame":83},{"text":"Adjustable death benefit as needs change","highlight":"Adjustable","cueFrame":127},{"text":"You stay in control of your plan","highlight":"In control","cueFrame":352}]}],"visual":{"type":"slide"}},{"id":10,"beat":"proof","on_screen":"An Illustrated Starting Point","layout":{"heading":"An Illustrated Starting Point","kicker":"Illustrated, not fixed","align":"left","media":"below"},"blocks":[{"type":"figure","figure":{"value":65000,"prefix":"~$","label":"Illustrated coverage at $100/mo — a starting point"}},{"type":"bullets","items":[{"text":"Your premium depends on the right coverage level","highlight":"Right coverage level","cueFrame":46},{"text":"We set it together in a budget conversation","highlight":"Budget conversation","cueFrame":154}]}],"visual":{"type":"slide"}},{"id":11,"beat":"proof","on_screen":"The Long- Upside","layout":{"heading":"The Long- Upside","kicker":"Projected, index-dependent","align":"left","media":"below"},"blocks":[{"type":"figure","figure":{"value":150000,"prefix":"$","suffix":"–$250K+","label":"Projected tax-free cash value at $300/mo over 25 yrs (illustrated savings, not death benefit)"}},{"type":"bullets","items":[{"text":"This is savings growth, not the death benefit","highlight":"Savings growth","cueFrame":598},{"text":"Results depend on actual index performance","highlight":"Index performs","cueFrame":718}]}],"visual":{"type":"slide"}},{"id":12,"beat":"compare","on_screen":"A Practical Pathway","layout":{"heading":"A Practical Pathway","kicker":"To permanent","align":"left","media":"below"},"blocks":[{"type":"cards","cards":[{"label":"START","value":"$100–$200/mo","sub":"~$100K coverage today","cueFrame":18},{"label":"CONVERT LATER","value":"5–10 yrs","sub":"To permanent, no starting over","accent":true,"cueFrame":234}]}],"visual":{"type":"slide"}},{"id":13,"beat":"context","on_screen":"Why Starting Now Matters","layout":{"heading":"Why Starting Now Matters","kicker":"The key takeaway","align":"left","media":"below"},"blocks":[{"type":"bullets","items":[{"text":"The most important step is simply to start","highlight":"Simply to start","cueFrame":105},{"text":"Waiting means higher premiums as you age","highlight":"Higher premiums","cueFrame":200},{"text":"Even today puts you ahead of waiting","highlight":"Ahead of waiting","cueFrame":388}]}],"visual":{"type":"slide"}},{"id":14,"beat":"cta","on_screen":"Let's Talk It Through","layout":{"heading":"Let's Talk It Through","kicker":"No pressure, ever","align":"center","media":"below"},"blocks":[{"type":"bullets","items":[{"text":"Review a full, personalized illustration together","highlight":"Full illustration","cueFrame":210},{"text":"Find the fit that honors your journey","highlight":"The right fit","cueFrame":281},{"text":"Reach out to your agent when you're ready","highlight":"Reach out","cueFrame":371}]}],"visual":{"type":"kinetic"}}]} as Plan
const SPANS_2e6a887e: [number, number][] = [[15,633],[633,1167],[1167,1617],[1617,1968],[1968,2391],[2391,2967],[2967,3459],[3459,4050],[4050,4485],[4485,5007],[5007,5823],[5823,6441],[6441,6918],[6918,7440]]

// ---- a line chart / bars spec the way the Director writes them ----
const LINE = (long: boolean) => ({
  kind: 'line', xMax: 30, yMax: 600000,
  xTicks: long ? [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30] : [0, 10, 20, 30],
  xLabel: long ? 'POLICY YEAR (ILLUSTRATED, NOT GUARANTEED — SEE THE FULL ILLUSTRATION LEDGER FOR EVERY YEAR)' : 'POLICY YEAR',
  series: [
    { name: long ? 'Illustrated cash value at the current assumed crediting rate' : 'Cash value', color: '__ACCENT__', area: true, points: [[0, 0], [10, 120000], [20, 310000], [30, 560000]] },
    { name: long ? 'S&P 500 price index reference (no dividends)' : 'S&P 500', color: '__ACCENT2__', points: [[0, 0], [10, 90000], [20, 260000], [30, 480000]] },
    { name: long ? `${UNBROKEN} floor` : '0% floor', color: '__MUTED__', dashed: true, points: [[0, 0], [30, 0]] },
  ],
  annotate: { x: 20, y: 310000, label: long ? 'Illustrated value at age sixty-five after twenty years' : 'Age 65', value: long ? '$1,234,567,890.00' : '$310,000' },
})
const BARS = (n: number, long: boolean) => ({
  kind: 'bars', yMax: long ? 1300000000 : 500000, unit: '$',
  bars: Array.from({ length: n }, (_, i) => ({
    label: long ? ['Total premiums paid over the life of the policy', 'Illustrated cash value', UNBROKEN, 'Net death benefit', 'Surrender value', 'Loan balance', 'Income taken', 'Remaining value'][i % 8] : ['Premiums paid', 'Illustrated value', 'Death benefit'][i % 3],
    value: long ? 1234567890 - i * 90000000 : [120000, 448627, 500000][i % 3],
    color: ['__MUTED__', '__ACCENT__', '__ACCENT2__'][i % 3],
  })),
})

const BRAND_PALETTE = { bg: '#0f1318', accent: '#e4572e', accent2: '#2a1f22', text: '#f2f4f1', muted: '#b7a39e' }

export const cases: QACase[] = [

  // ---------------- REAL (production plans, read-only) ----------------
  realDeck('real-d8bb1e42', REAL_d8bb1e42, SPANS_d8bb1e42),
  realDeck('real-2e6a887e', REAL_2e6a887e, SPANS_2e6a887e),

  // ---------------- NORMAL (typical lengths: the look must not change) ----------------
  deck('normal', {
    title: 'Your Coverage, Explained', look: 'ledger',
    chrome: { company: 'Harbor Financial Group', recipient: 'Jordan Lee', footer: '(555) 010-2030 | hello@harborfinancial.com', glass: 'vivid' },
    intro: { line1: 'Your Coverage, Explained', line2: 'A clear look at what your policy does for you', preparer: 'Harbor Financial Group', recipient: 'Jordan Lee' },
    cta: { line: "Let's review it together", contact: '(555) 010-2030 | hello@harborfinancial.com' },
    presenter: { name: 'Alex Morgan', role: 'Licensed Insurance Advisor', photo: 'directed-qa/presenter.png', onCover: true, onClosing: true },
    scenes: [
      intro(1, 'Your Coverage, Explained'),
      slide(2, 'Protection That Grows', [bullets([['Permanent coverage that never expires', 'never expires'], ['Cash value grows tax-deferred over time', 'tax-deferred'], ['Adjust premiums as life changes', 'Adjust premiums']])], { kicker: 'The big picture' }),
      slide(3, 'Your Key Numbers', [cards([{ label: 'Monthly premium', value: '$212/mo', accent: true }, { label: 'Death benefit', value: '$500,000' }, { label: 'Illustrated rate', value: '6.35%' }])]),
      slide(4, 'Projected at Age 65', [figure({ value: 448627, prefix: '$', label: 'Projected cash value' }), bullets(['Illustrated, not promised', 'Based on a 6.35% assumed rate'])], { kicker: 'The long view' }),
      slide(5, 'Term vs. Permanent', [cards([{ label: 'Term', value: '$42/mo', sub: 'Ends after 20 years' }, { label: 'Permanent', value: '$212/mo', sub: 'Lasts a lifetime', accent: true }], true), bullets(['Term is cheaper today', 'Permanent builds value you can use'])]),
      slide(6, 'What You Put In vs. What It Builds', [chart(BARS(3, false)), bullets(['Premiums paid over 20 years', 'Illustrated value at 65'])]),
      cta(7),
    ],
  }),

  // ---------------- WORST: covers + closings ----------------
  // Title-card cover (no logo) + presenter closing, every text slot at its longest.
  deck('worst-bookends-text', {
    title: T120, look: 'noir',
    chrome: { company: CO_LONG, recipient: CLIENT_LONG, footer: CONTACT_LONG, glass: 'vivid' },
    intro: { line1: T120, line2: TAGLINE_LONG, preparer: CO_LONG, recipient: CLIENT_LONG },
    cta: { line: CTA_LONG, contact: CONTACT_LONG },
    presenter: { name: NAME_LONG, role: ROLE_LONG, photo: 'directed-qa/presenter.png', onCover: true, onClosing: true },
    scenes: [intro(1, T120), kinetic(2, T120, 'rise'), kinetic(3, `${UNBROKEN} ${UNBROKEN}`, 'punchIn'), cta(4, T120)],
  }),
  // Logo cover (LogoReveal) + logo closing (LogoClose), long tagline / recipient / CTA / contact.
  deck('worst-bookends-logo', {
    title: T120, look: 'datamesh',
    chrome: { company: CO_LONG, logo: 'directed-qa/logo.png', recipient: CLIENT_LONG, footer: CONTACT_LONG, glass: 'subtle' },
    intro: { line1: T120, line2: TAGLINE_LONG, preparer: CO_LONG, recipient: CLIENT_LONG },
    cta: { line: CTA_LONG, contact: CONTACT_LONG },
    presenter: { name: NAME_LONG, role: ROLE_LONG, photo: 'directed-qa/presenter.png', onCover: false, onClosing: false },
    scenes: [intro(1, T120), kinetic(2, T120, 'wipe'), kinetic(3, T120, 'typewriter'), cta(4, T120)],
  }),
  // Company-name cover + company-name closing (no logo, no photo), light "paper" look.
  deck('worst-bookends-company', {
    title: T120, look: 'paper',
    chrome: { company: `${UNBROKEN} Advisors of North America Incorporated`, recipient: `${UNBROKEN} Holdings`, footer: `www.${UNBROKEN.toLowerCase()}-advisors-of-north-america.com/contact`, glass: 'subtle' },
    intro: { line1: T120, line2: TAGLINE_LONG, preparer: 'x', recipient: `${UNBROKEN} Holdings` },
    cta: { line: `${UNBROKEN} ${UNBROKEN}`, contact: 'maximiliana.konstantinopoulos-worthington@comprehensivefinancialplanninggroup.com' },
    scenes: [intro(1, T120), kinetic(2, T120, 'wordPan'), kinetic(3, T120.slice(0, 70), 'assemble'), cta(4)],
  }),

  // ---------------- WORST: bullet slides ----------------
  deck('worst-bullets', {
    title: 'Bullets', look: 'bokeh',
    chrome: { company: CO_LONG, recipient: CLIENT_LONG, footer: CONTACT_LONG, glass: 'vivid' },
    scenes: [
      // (C) bullets + icon side by side: longest heading, kicker, 8 bullets (writer path has no cap)
      slide(1, T120, [bullets(B_LONG)], { kicker: KICKER_LONG }),
      // (C) unbroken words everywhere
      slide(2, `${UNBROKEN} ${UNBROKEN}`, [bullets([UNBROKEN, `${UNBROKEN}${UNBROKEN}`, 'Short one', HL[0]])], { kicker: UNBROKEN }),
      // (D) media below: bullets then the icon underneath
      slide(3, T120, [bullets(HL)], { kicker: KICKER_LONG, media: 'below' }),
      // centered alignment, media below
      slide(4, T120, [bullets(B_LONG.slice(0, 5))], { align: 'center', media: 'below', kicker: KICKER_LONG }),
    ],
  }),

  // ---------------- WORST: data cards ----------------
  deck('worst-cards', {
    title: 'Cards', look: 'sweep',
    chrome: { company: 'Harbor Financial Group', recipient: 'Jordan Lee', footer: '(555) 010-2030', glass: 'vivid' },
    scenes: [
      // 2-card vs: long labels, long non-numeric value, huge number, long subs
      slide(1, T120, [cards([
        { label: 'Hypothetical illustrated index allocation for the first policy year', value: LONG_VALUE, sub: 'Every dollar allocated to the high cap rate account, reviewed annually with your advisor', accent: true },
        { label: 'Total illustrated death benefit', value: HUGE, sub: `${UNBROKEN} rider included` },
      ], true)], { kicker: KICKER_LONG }),
      // 5 cards, huge numbers + long labels
      slide(2, 'Five Numbers That Matter', [cards([
        { label: 'Annual premium (years 1-10)', value: '$1,234,567.89', sub: 'Illustrated' },
        { label: 'Death benefit', value: HUGE, accent: true },
        { label: 'Cash value at 65', value: '$987,654,321', sub: 'Projected at 6.35%' },
        { label: UNBROKEN, value: '100%' },
        { label: 'Income from age 66 to age 100', value: '$123,456/yr', sub: 'Via policy loans' },
      ])]),
      // 7 cards: more than the engine is meant to show
      slide(3, 'Seven Cards', [cards(Array.from({ length: 7 }, (_, i) => ({ label: `Tier ${i + 1} long descriptive label`, value: i % 2 ? '$1,234,567' : 'Included at no extra cost', sub: 'Illustrated value', accent: i === 1 })))]),
      // cards under a long heading and 4 long bullets (vertical space)
      slide(4, T120, [cards([{ label: 'Premium', value: '$3,228.00', accent: true }, { label: 'Deductible', value: '$1,000' }, { label: 'Limit', value: '$2,000,000' }]), bullets(B_LONG.slice(0, 4))], { kicker: KICKER_LONG }),
      // real-data style non-numbers: a date, ranges, words
      slide(5, 'A Full Year of Coverage', [cards([{ label: 'Policy Term', value: 'Oct 10, 2026 – Oct 10, 2027', accent: true }])]),
      slide(6, 'Ranges and Words', [cards([
        { label: 'NOW (age 46)', value: '$100–$200/mo', sub: '~$100K, 20-year' },
        { label: 'THE CAP', value: '8–12%', sub: 'Illustrated growth range' },
        { label: 'CONVERT LATER', value: '5–10 yrs', sub: 'To permanent' },
        { label: 'RENEWAL (age 66)', value: 'Significantly higher than today', accent: true },
      ])]),
    ],
  }),

  // ---------------- WORST: figures, charts, screenshots ----------------
  deck('worst-media', {
    title: 'Media', look: 'ledger', palette: BRAND_PALETTE,
    chrome: { company: CO_LONG, recipient: CLIENT_LONG, footer: CONTACT_LONG, glass: 'vivid' },
    scenes: [
      slide(1, T120, [figure({ value: 1234567890.12, prefix: '$', suffix: '/mo', label: 'Projected tax-free cash value at $300/mo over 25 yrs (illustrated savings, not death benefit)' }), bullets(B_LONG.slice(0, 4))], { kicker: KICKER_LONG }),
      slide(2, T120, [figure({ value: 150000, prefix: '~$', suffix: '–$250K+ projected', label: `${UNBROKEN} illustrated value` })], { media: 'below' }),
      slide(3, T120, [chart(LINE(true)), bullets(B_LONG.slice(0, 3))]),
      slide(4, T120, [chart(LINE(true))], { media: 'below' }),
      slide(5, 'Where The Money Goes', [chart(BARS(8, true)), bullets(['Premiums in', 'Value out'])]),
      slide(6, T120, [chart(BARS(3, true))], { media: 'below' }),
      slide(7, 'The Big Number', [chart({ kind: 'figure', value: 1234567890, prefix: '$', label: 'Illustrated total benefit paid to the trust over the life of the policy' }), bullets(['One', 'Two'])]),
      slide(8, T120, [{ type: 'screenshot', file: 'directed-qa/shot.png', pins: [{ x: 4, y: 6, label: 'Your personalized illustration dashboard with every year shown' }, { x: 97, y: 95, label: `${UNBROKEN} settings` }] }, bullets(B_LONG.slice(0, 3))], { kicker: KICKER_LONG }),
      slide(9, 'The Pricing Page', [{ type: 'screenshot', file: 'directed-qa/shot.png', pins: [{ x: 50, y: 50, label: 'Plans start here' }] }]),
    ],
  }),

  // ---------------- WORST: empty / missing optional fields ----------------
  deck('worst-empty', {
    title: '', look: 'noir',
    chrome: { glass: 'vivid' },
    scenes: [
      intro(1),
      slide(2, undefined, [bullets(['', 'Short'])]),
      slide(3, 'Heading only', []),
      slide(4, 'Empty cards', [cards([{ label: '', value: '' }, { label: 'Only a label', value: '' }, { label: '', value: '$5' }])]),
      slide(5, 'No label', [figure({ value: 42 }), bullets(['One bullet'])]),
      kinetic(6, '', 'rise'),
      cta(7, ''),
    ],
  }),

  // ---------------- every LOOK x glass (layout is shared; colors differ) ----------------
  ...(['ledger', 'bokeh', 'datamesh', 'paper', 'sweep', 'noir'] as const).map((look, i) => deck(`look-${look}`, {
    title: 'Look', look,
    chrome: { company: 'Harbor Financial Group', recipient: 'Jordan Lee', footer: '(555) 010-2030 | hello@harborfinancial.com', glass: i % 2 ? 'subtle' : 'vivid' },
    scenes: [
      slide(1, 'Premium Breakdown And What It Buys You Over Time', [cards([{ label: 'Annual premium', value: '$10,000.00', accent: true }, { label: 'Index allocation', value: LONG_VALUE }, { label: 'Death benefit', value: '$1,250,000' }]), bullets(HL.slice(0, 2))], { kicker: 'Option three' }),
      slide(2, 'Projected Cash Value at Age Sixty-Five', [figure({ value: 1234567, prefix: '$', label: 'Illustrated, not promised' }), bullets(HL.slice(0, 3))]),
    ],
  })),

  // ---------------- LEGACY scene kinds (not produced by slides.js today) ----------------
  // Standalone chart / figure / photo scenes: only a hand-made plan sent to
  // /render-directed can reach these (no app route calls it).
  deck('legacy-standalone', {
    title: 'Legacy', look: 'noir',
    chrome: { company: 'Harbor Financial Group', recipient: 'Jordan Lee', footer: '(555) 010-2030', glass: 'vivid' },
    scenes: [
      { id: 1, beat: 'proof', on_screen: T120, blocks: [], visual: { type: 'chart', chart: LINE(true) } },
      { id: 2, beat: 'proof', on_screen: T120, blocks: [], visual: { type: 'chart', chart: BARS(6, true) } },
      { id: 3, beat: 'proof', on_screen: T120, blocks: [], visual: { type: 'figure', figure: { value: 1234567890.12, prefix: '$', suffix: '/yr', label: T120 } } },
      { id: 4, beat: 'hook', on_screen: T120, blocks: [], visual: { type: 'gemini', file: 'directed-qa/bg.png' } },
    ],
  }),
]
