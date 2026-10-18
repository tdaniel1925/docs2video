// =============================================================================
// Fixed content for the presentation overflow check (deck-overflow-check.mjs).
//
// Every word here is typed in, not generated — the check makes no AI calls and
// touches no database. The WORST decks carry the longest, ugliest content a
// model reading somebody's document could plausibly hand us, one scene per
// slide layout the deck engine has, so every layout gets punished. The NORMAL
// deck is ordinary content, to prove the look did not change at normal lengths.
//
// Shaped to the REAL builder signature (scenes with slideData) — see
// app/_lib/presentation.ts.
// =============================================================================

import zlib from 'node:zlib'

// ── A tiny PNG encoder, so the art slides have real images without a file ──
const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
export function makePng(w, h, tint = [120, 160, 200]) {
  const row = w * 3 + 1
  const raw = Buffer.alloc(row * h)
  for (let y = 0; y < h; y++) {
    raw[y * row] = 0
    for (let x = 0; x < w; x++) {
      const o = y * row + 1 + x * 3
      raw[o] = Math.min(255, tint[0] + ((x * 90) / w) | 0)
      raw[o + 1] = tint[1]
      raw[o + 2] = Math.max(0, tint[2] - ((y * 90) / h) | 0)
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type, 'latin1'), data])
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
    return Buffer.concat([len, td, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ])
}
const dataUri = (buf) => 'data:image/png;base64,' + buf.toString('base64')
export const ART_SQUARE = dataUri(makePng(240, 240))
export const ART_WIDE = dataUri(makePng(320, 180, [200, 150, 110]))
export const ART_TALL = dataUri(makePng(180, 320, [110, 180, 140]))
export const LOGO_WIDE = dataUri(makePng(400, 90, [30, 60, 110]))

// ── The punishing strings ──
export const LONG_WORD = 'Supercalifragilisticexpialidocious-Indemnification'
export const UNBROKEN = 'Pneumonoultramicroscopicsilicovolcanoconiosis'
export const T120 = 'Understanding Every Single Part Of Your Commercial General Liability Policy And Every Endorsement That Applies To Your Business Operations This Year'
export const LONG_VALUE = '100% High Cap Rate Acct (S&P 500 Index)'
export const HUGE = '$1,234,567,890.00'
export const HUGE_HERO = '$1,234,567,890' // 14 chars — the longest value that still takes the giant hero style
export const LONG_URL = 'https://www.northside-insurance-group-financial-services.com/advisors/maximilian-montgomery-worthington/appointments'
export const LONG_EMAIL = 'maximilian.montgomery-worthington@northside-insurance-group-financial.com'
export const LONG_PRESENTER = 'Maximilian Alexander Montgomery-Worthington III, CLU, ChFC, CFP®'
export const LONG_CONTACT = `1-800-555-0199  ·  ${LONG_EMAIL}  ·  ${LONG_URL}`
export const LONG_CLIENT = 'Evolv 28 — Aether Holdings International Family Limited Partnership & Irrevocable Life Insurance Trust'
export const LONG_BRAND = 'Northside Insurance Group Financial Services & Retirement Planning Associates LLC'
export const REG_DISCLAIMER = 'Prepared by your agent for education only. Figures shown are illustrated and not guarantees. Refer to your full illustration for complete terms, values and conditions.'

const LONG_BULLETS = [
  'Bodily injury and property damage arising out of your premises and completed operations, subject to the limits shown on the declarations page and every endorsement attached to it',
  `Personal and advertising injury, including ${LONG_WORD} for libel, slander and infringement of copyright in your advertisement`,
  `Medical payments for injuries occurring on premises you own or rent — details at ${LONG_URL}`,
  `Damage to premises rented to you where caused by fire: ${UNBROKEN}${UNBROKEN}`,
  'Defence costs, which are paid in addition to the limits of insurance and are not eroded by them in any way at all',
  'Supplementary payments including bail bonds, reasonable expenses incurred at our request and post-judgment interest',
  'SEVENTH BULLET — OVER THE LIMIT OF SIX, MUST NOT SHOW',
  'EIGHTH BULLET — OVER THE LIMIT OF SIX, MUST NOT SHOW',
  'NINTH BULLET — OVER THE LIMIT OF SIX, MUST NOT SHOW',
]

const LONG_LABEL = 'Total Projected Accumulation Value At Age 100 Under Current Non-Guaranteed Assumptions'

/** Presenter/brand/cover options shared by the worst decks. */
export const WORST_OPTS = {
  title: `${T120} ${LONG_WORD}`,
  subtitle: `A plain-English walk-through of every coverage, limit, exclusion and endorsement in your policy, written for ${LONG_CLIENT}, with ${UNBROKEN} examples and far more words than a subtitle should ever carry`,
  brandName: LONG_BRAND,
  recipientName: LONG_CLIENT,
  presenter: { name: LONG_PRESENTER, photoUrl: undefined, contactLine: LONG_CONTACT },
  logoUrl: LOGO_WIDE,
  disclaimer: REG_DISCLAIMER,
  primaryColor: '#e8d44d', // a pale brand yellow — exercises the accent guard
}

/** One scene per content layout (no art). */
export function worstScenes() {
  return [
    { _role: 'cover', narration: 'Welcome.', title: 'Cover', slideData: { headline: T120 } },
    // bullets, two-column (>4), MORE than the 6 the layout accepts
    { narration: 'Here is what it covers.', title: 'Coverage Details And Every Exclusion You Need To Know About Before Your Renewal Date', slideData: { headline: T120, bullets: LONG_BULLETS } },
    // bullets, single column (<=4), headline is one unbroken word
    { narration: 'Three things.', title: 'Three', slideData: { headline: `${UNBROKEN} ${LONG_WORD}`, bullets: LONG_BULLETS.slice(0, 3).map((b) => b + ' ' + b) } },
    // split: lone hero number + bullets
    { narration: 'The big number.', title: 'The Number', slideData: { headline: T120, stats: [{ label: LONG_LABEL, value: HUGE_HERO }], bullets: LONG_BULLETS } },
    // split: stat cards + bullets, MORE stats than accepted, long text values
    { narration: 'Side by side.', title: 'Side By Side', slideData: {
      headline: T120,
      stats: [
        { label: LONG_LABEL, value: LONG_VALUE },
        { label: 'Face Amount', value: HUGE },
        { label: 'Call Your Agent', value: '1-800-555-0199' },
        { label: 'Rate Class', value: 'Preferred Non-Tobacco Plus With Waiver Of Premium Rider' },
        { label: LONG_WORD, value: LONG_WORD },
        { label: 'Sixth — the last one shown', value: '$6' },
        { label: 'SEVENTH — OVER THE LIMIT, MUST NOT SHOW', value: '$7' },
      ],
      bullets: LONG_BULLETS,
    } },
    // stat grid (+1 bullet), MORE stats than accepted
    { narration: 'Grid.', title: 'Every Limit', slideData: {
      headline: 'Every Limit, Deductible And Endorsement At A Glance For Your Commercial Property',
      stats: [
        { label: LONG_LABEL, value: LONG_VALUE },
        { label: 'Face Amount With Every Rider And Endorsement Included', value: HUGE },
        { label: 'Participation', value: '98%' },
        { label: UNBROKEN, value: UNBROKEN },
        { label: 'Contact', value: LONG_EMAIL },
        { label: 'Website', value: LONG_URL },
        { label: 'SEVENTH — OVER THE LIMIT, MUST NOT SHOW', value: '$7' },
        { label: 'EIGHTH — OVER THE LIMIT, MUST NOT SHOW', value: '$8' },
      ],
      bullets: [LONG_BULLETS[0]],
    } },
    // stat grid with empty / half-empty fields
    { narration: 'Some fields are missing.', title: '', slideData: {
      headline: '',
      stats: [{ label: 'Premium' }, { value: '$250' }, { label: '', value: '' }, { value: '   ' }, { label: 'Only A Label With No Value At All To Show' }],
      bullets: ['', null, 'Short'],
    } },
    // hero solo
    { narration: 'One number.', title: 'The Headline Number', slideData: { headline: T120, stats: [{ label: LONG_LABEL + ' ' + LONG_WORD, value: HUGE_HERO }] } },
    // phone solo
    { narration: 'Call us.', title: 'Reach Us', slideData: { headline: `${T120} ${LONG_WORD}`, stats: [{ label: 'Call The Northside Insurance Group Claims And Customer Service Hotline Any Time Day Or Night', value: '1-800-555-0199' }] } },
    // chart ($), MORE rows than accepted, huge + tiny values, long labels
    { narration: 'Chart.', title: 'Growth', slideData: {
      headline: T120,
      stats: [
        { label: LONG_LABEL, value: '$1,234,567,890' },
        { label: UNBROKEN, value: '$12' },
        { label: 'Year 10 Cash Value', value: '$250,000' },
        { label: 'Year 20 Cash Value', value: '$9,999,999' },
        { label: 'Year 30', value: '$1' },
        { label: 'Year 40', value: '$75,000' },
        { label: 'SEVENTH — OVER THE LIMIT, MUST NOT SHOW', value: '$80,000' },
      ],
    } },
    // chart (%) + bullets
    { narration: 'Chart and list.', title: 'Rates', slideData: {
      headline: T120,
      stats: [{ label: UNBROKEN, value: '100%' }, { label: 'Floor Rate Guaranteed Every Single Year', value: '4.5%' }, { label: 'Cap', value: '12%' }],
      bullets: LONG_BULLETS,
    } },
    // fallback: nothing structured, narration carries a money figure
    { narration: `Over the life of the policy your projected accumulation reaches $1,234,567 by age one hundred, assuming current non-guaranteed rates hold. ${LONG_BULLETS[0]} ${LONG_BULLETS[1]} ${LONG_BULLETS[2]}`, title: T120 },
    // fallback: nothing structured, no figure, one unbroken run
    { narration: `${UNBROKEN}${UNBROKEN}${UNBROKEN} ${LONG_BULLETS.join(' ')}`, title: 'Summary' },
    { _role: 'closing', narration: 'Thank you.', title: 'Thank You', slideData: {
      headline: `${T120} ${LONG_WORD}`,
      cta: `Call ${LONG_PRESENTER} at 1-800-555-0199 or email ${LONG_EMAIL} to book your annual review — ${UNBROKEN}`,
    } },
  ]
}

/** Every layout again, this time with art made for the slide (the two-column
 *  "willo" variants) — plus cover and closing art. */
export function worstArtScenes() {
  const base = worstScenes()
  const art = [ART_SQUARE, ART_WIDE, ART_TALL]
  const withArt = base.map((s, i) => ({ ...s, imageUrl: art[i % art.length] }))
  // The light variant that keeps art beside bullets + a figure row (<=2 bullets, <=3 stats).
  withArt.splice(2, 0, { narration: 'Light.', title: 'Light Slide', imageUrl: ART_TALL, slideData: {
    headline: T120,
    bullets: LONG_BULLETS.slice(0, 2),
    stats: [{ label: LONG_LABEL, value: LONG_VALUE }, { label: 'Face', value: HUGE }, { label: UNBROKEN, value: '98%' }],
  } })
  return withArt
}

/** Ordinary content — the look at normal lengths must be unchanged. */
export const NORMAL_OPTS = {
  title: 'Your Indexed Universal Life Illustration',
  subtitle: 'A plain-English walk through your policy values',
  brandName: 'Northside Insurance Group',
  recipientName: 'Maria Gonzalez',
  presenter: { name: 'Jordan Blake', contactLine: '1-555-201-4410  ·  jordan@northside.com' },
}
export function normalScenes() {
  return [
    { _role: 'cover', narration: 'Welcome.', title: 'Cover', slideData: { headline: 'Your Indexed Universal Life Illustration' } },
    { narration: 'What it does.', title: 'What It Does', slideData: { headline: 'What Your Policy Does For You', bullets: ['Pays a tax-free death benefit to your family', 'Builds cash value you can borrow against', 'Credits interest linked to a market index', 'Protects you from market losses with a 0% floor'] } },
    { narration: 'Numbers.', title: 'Your Numbers', slideData: { headline: 'The Numbers That Matter', stats: [{ label: 'Death Benefit', value: '$500,000' }, { label: 'Monthly Premium', value: '$412' }, { label: 'Rate Class', value: 'Preferred Non-Tobacco' }] } },
    { narration: 'Split.', title: 'Premium And Protection', slideData: { headline: 'Premium And Protection', stats: [{ label: 'Annual Premium', value: '$4,944' }, { label: 'Crediting Floor', value: '0%' }], bullets: ['Premiums are flexible within limits', 'Loans reduce the death benefit if unpaid'] } },
    { narration: 'At 65 your value is $176,204.', title: 'At Retirement', slideData: { headline: 'Projected Value At Age 65', stats: [{ label: 'Cash Value At 65', value: '$176,204' }] } },
    { narration: 'Growth.', title: 'Growth Over Time', slideData: { headline: 'How Your Value Grows', stats: [{ label: 'Year 10', value: '$42,300' }, { label: 'Year 20', value: '$118,900' }, { label: 'Year 30', value: '$261,450' }] } },
    { narration: 'Call.', title: 'Questions', slideData: { headline: 'Questions? Call Me Directly', stats: [{ label: 'Office', value: '1-555-201-4410' }] } },
    { narration: 'Your policy protects your family and grows over time.', title: 'In Short' },
    { _role: 'closing', narration: 'Thank you.', title: 'Thank You', slideData: { headline: 'Let’s Review It Together', cta: 'Book a 20-minute call this week' } },
  ]
}

/** Every optional field missing. */
export const EMPTY_OPTS = { title: 'Presentation' }
export function emptyScenes() {
  return [
    { _role: 'cover', narration: '' },
    { narration: '', slideData: {} },
    { narration: 'Only narration here.', slideData: { headline: '', stats: [], bullets: [] } },
    { _role: 'closing', narration: '', slideData: {} },
  ]
}
