// The presentation director — the HTML-first engine behind the "Interactive
// Presentation" and "Slide Deck" output types. Takes the wizard's scenes +
// a template + brand/presenter and emits ONE self-contained HTML file:
// one-window (no scrollbars), click-through, animated, optionally narrated.
// Modes: default player · ?record=1 (controls hidden, exporter drives timing
// — the MP4 path) · ?share=1 (inline end-of-show actions) · ?theme= override.

export type PresentationScene = {
  title?: string
  narration: string
  _role?: 'cover' | 'closing'
  /** Structured visual content from the wizard's script step — this is what
   *  renders on the slide. Narration is for the EARS, slideData for the EYES. */
  slideData?: {
    headline?: string
    stats?: { label?: string; value?: string }[]
    bullets?: string[]
    cta?: string
  }
}

export type PresentationTemplate = {
  id: string
  name: string
  tagline: string
  /** CSS variable overrides applied on <body class="t-{id}"> (heritage = base). */
  vars: Record<string, string>
  /** swatch colors for the gallery card */
  swatch: [string, string, string]
  /** optional template-specific decoration CSS (scoped by the author to body.t-{id}) */
  css?: string
}

export const PRESENTATION_TEMPLATES: PresentationTemplate[] = [
  {
    id: 'heritage', name: 'Heritage', tagline: 'Engraved certificate — cream, navy & gold',
    vars: {}, swatch: ['#f7f5ee', '#1c2a44', '#a8842c'],
  },
  {
    id: 'warm', name: 'Warm Editorial', tagline: 'Cozy modern — cream & terracotta',
    vars: {
      '--paper': '#faf9f5', '--card': '#fffdf8', '--ink': '#3d3929', '--navy': '#3d3929',
      '--soft': '#6b6759', '--faint': '#9c988a', '--gold': '#c96442', '--gold-l': '#e0906f',
      '--gold-f': '#eec4ae', '--line': '#e8e6dc', '--serif': "'Plus Jakarta Sans',sans-serif",
    }, swatch: ['#faf9f5', '#3d3929', '#c96442'],
  },
  {
    id: 'bold', name: 'Corporate Bold', tagline: 'Clean & confident — navy and red',
    vars: {
      '--paper': '#f4f6fa', '--card': '#ffffff', '--ink': '#15233f', '--navy': '#1e3a70',
      '--soft': '#4a5a78', '--faint': '#8b96ab', '--gold': '#c0272d', '--gold-l': '#e0454b',
      '--gold-f': '#f0b9bb', '--line': '#dde3ec', '--serif': "'Montserrat',sans-serif",
    }, swatch: ['#f4f6fa', '#1e3a70', '#c0272d'],
  },
  {
    id: 'midnight', name: 'Midnight', tagline: 'Premium dark — navy & luminous gold',
    vars: {
      '--paper': '#0f1729', '--card': '#1a2439', '--ink': '#e8edf8', '--navy': '#eef2fb',
      '--soft': '#a9b4cc', '--faint': '#69758f', '--gold': '#d9b64c', '--gold-l': '#eccf7e',
      '--gold-f': '#8a7534', '--line': 'rgba(255,255,255,.13)', '--serif': "Georgia,'Times New Roman',serif",
    }, swatch: ['#0f1729', '#eef2fb', '#d9b64c'],
  },
  {
    id: 'mint', name: 'Fresh Mint', tagline: 'The house style — cream & mint green',
    vars: {
      '--paper': '#f4f1ec', '--card': '#fffefb', '--ink': '#232920', '--navy': '#2b3427',
      '--soft': '#5c6656', '--faint': '#98a08f', '--gold': '#6da33f', '--gold-l': '#a5cd7c',
      '--gold-f': '#c7e8a8', '--line': '#e4e0d5', '--serif': "'Plus Jakarta Sans',sans-serif",
    }, swatch: ['#f4f1ec', '#2b3427', '#6da33f'],
  },
  {
    // HIDDEN template (not in the wizard gallery — API/partner only): the
    // jordyn.app demo-deck look. Warm cream + clay, peach pill kickers,
    // Georgia serif, soft rounded cards, sage second accent. Used by the
    // Jordyn integration so its decks match the site's own demo.
    id: 'jordyn', name: 'Jordyn', tagline: 'Warm editorial — cream, clay & peach (jordyn.app house style)',
    vars: {
      '--paper': '#faf9f5', '--card': '#fffdf8', '--ink': '#3d3929', '--navy': '#3d3929',
      '--soft': '#6b6759', '--faint': '#9c988a', '--gold': '#c96442', '--gold-l': '#e0906f',
      '--gold-f': '#f5e6df', '--line': '#e8e6dc',
      // jordyn.app's own stack: Quicksand 600 for display, system sans for body.
      '--serif': "'Quicksand',ui-rounded,'Segoe UI',system-ui,sans-serif",
      '--font': "ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif",
    }, swatch: ['#faf9f5', '#3d3929', '#c96442'],
    css: `
body.t-jordyn #glow{background:radial-gradient(44% 40% at 20% 16%,color-mix(in srgb,var(--gold-f) 85%,transparent),transparent 62%),radial-gradient(36% 34% at 84% 82%,rgba(125,140,111,.16),transparent 65%)}
body.t-jordyn #frame{border:none;inset:0}
body.t-jordyn .kick{background:var(--gold-f);color:var(--gold);border-radius:999px;padding:8px 18px;letter-spacing:.12em}
body.t-jordyn .kick .rule{display:none}
body.t-jordyn .kick .num{background:var(--gold);color:var(--card);border-radius:999px}
body.t-jordyn h1.h2::after{background:linear-gradient(90deg,var(--gold),var(--gold-l))}
body.t-jordyn .stat{border-radius:16px;border-color:var(--line);border-left:3px solid var(--gold);box-shadow:0 14px 34px rgba(61,57,41,.09)}
body.t-jordyn .bullets li{border-radius:14px;box-shadow:0 8px 22px rgba(61,57,41,.05)}
body.t-jordyn .bullets .mk{color:#7d8c6f}
body.t-jordyn .ghost{color:color-mix(in srgb,var(--gold) 7%,transparent)}
body.t-jordyn .cbar{background:linear-gradient(90deg,var(--gold),#7d8c6f)}
body.t-jordyn .advcard,body.t-jordyn .advisor{border-radius:18px;border-color:var(--gold-f)}
body.t-jordyn .advisor{border-radius:999px}
body.t-jordyn .advcard img{border-radius:14px;border-color:var(--gold-f)}
body.t-jordyn .startbtn{background:linear-gradient(115deg,var(--gold),var(--gold-l));border-radius:999px}
body.t-jordyn .sact{border-radius:999px;border-color:var(--gold-f)}
body.t-jordyn #nav{border-color:var(--line)}
body.t-jordyn .big.grad{background:linear-gradient(115deg,var(--ink) 25%,var(--gold) 65%,var(--ink) 95%);background-size:220% 220%;-webkit-background-clip:text;background-clip:text}
/* Quicksand is a rounded geometric sans — it needs a touch more tracking and
   a lighter display weight than the serif stacks the other templates use. */
body.t-jordyn h1,body.t-jordyn h2{font-weight:600;letter-spacing:-.015em}
body.t-jordyn .big{font-weight:600;letter-spacing:-.02em}
body.t-jordyn .stat .v{font-weight:600}
body.t-jordyn .an{font-weight:600;letter-spacing:-.01em}
`,
  },
  {
    // Port of the classic "stock-certificate" Gemini style: engraved parchment,
    // guilloché security patterns, ornate double frame, formal navy serif.
    id: 'certificate', name: 'Certificate', tagline: 'Engraved stock certificate — parchment, guilloché & seal',
    vars: {
      '--paper': '#f5f0e0', '--card': '#fbf8ee', '--ink': '#1a1a3a', '--navy': '#1a1a3a',
      '--soft': '#4a4a63', '--faint': '#8b8878', '--gold': '#8a6d2f', '--gold-l': '#b3924a',
      '--gold-f': '#d8c48c', '--line': '#d9d0b8', '--serif': "Georgia,'Times New Roman',serif",
    }, swatch: ['#f5f0e0', '#1a1a3a', '#8a6d2f'],
    css: `
body.t-certificate::before{content:'';position:fixed;inset:0;z-index:1;pointer-events:none;background-image:repeating-linear-gradient(45deg,rgba(26,26,58,.022) 0 1px,transparent 1px 7px),repeating-linear-gradient(-45deg,rgba(26,26,58,.022) 0 1px,transparent 1px 7px)}
body.t-certificate #frame{inset:10px;border:3px double color-mix(in srgb,var(--gold) 85%,transparent);border-radius:0;box-shadow:inset 0 0 0 5px #f5f0e0,inset 0 0 0 6px color-mix(in srgb,var(--gold) 50%,transparent)}
body.t-certificate #frame::before,body.t-certificate #frame::after{content:'❦';position:absolute;font-size:20px;color:color-mix(in srgb,var(--gold) 75%,transparent);line-height:1}
body.t-certificate #frame::before{top:8px;left:12px}
body.t-certificate #frame::after{bottom:8px;right:12px;transform:rotate(180deg)}
body.t-certificate #glow{background:radial-gradient(46% 42% at 22% 18%,color-mix(in srgb,var(--gold-l) 14%,transparent),transparent 60%),url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cg fill='none' stroke='%231a1a3a' stroke-opacity='.10'%3E%3Ccircle cx='100' cy='100' r='96'/%3E%3Ccircle cx='100' cy='100' r='72'/%3E%3Ccircle cx='100' cy='100' r='34'/%3E%3Cellipse cx='100' cy='100' rx='96' ry='32'/%3E%3Cellipse cx='100' cy='100' rx='96' ry='32' transform='rotate(30 100 100)'/%3E%3Cellipse cx='100' cy='100' rx='96' ry='32' transform='rotate(60 100 100)'/%3E%3Cellipse cx='100' cy='100' rx='96' ry='32' transform='rotate(90 100 100)'/%3E%3Cellipse cx='100' cy='100' rx='96' ry='32' transform='rotate(120 100 100)'/%3E%3Cellipse cx='100' cy='100' rx='96' ry='32' transform='rotate(150 100 100)'/%3E%3C/g%3E%3C/svg%3E") no-repeat calc(100% + 120px) calc(100% + 120px)/440px 440px}
body.t-certificate h1{letter-spacing:.01em}
body.t-certificate h1.h2::after{background:none;width:auto;height:auto;content:'✦ ✦ ✦';color:var(--gold);font-size:10px;letter-spacing:9px;left:50%;transform:translateX(-50%)}
body.t-certificate .wl h1.h2::after{left:0;transform:none}
body.t-certificate .kick{letter-spacing:.26em}
body.t-certificate .kick .num{border-radius:0;background:var(--navy);color:#f5f0e0}
body.t-certificate .stat{border:1px solid color-mix(in srgb,var(--gold) 55%,transparent);border-left:1px solid color-mix(in srgb,var(--gold) 55%,transparent);border-radius:0;box-shadow:inset 0 0 0 3px #fbf8ee,inset 0 0 0 4px color-mix(in srgb,var(--gold) 30%,transparent),0 10px 26px rgba(26,26,58,.07)}
body.t-certificate .bullets li{border-radius:0;border-color:color-mix(in srgb,var(--gold) 40%,transparent)}
body.t-certificate .bullets .mk{content:'❧'}
body.t-certificate .advcard{border-radius:0;border:1px solid color-mix(in srgb,var(--gold) 60%,transparent);box-shadow:inset 0 0 0 3px #fbf8ee,inset 0 0 0 4px color-mix(in srgb,var(--gold) 30%,transparent),0 16px 40px rgba(26,26,58,.1)}
body.t-certificate .advcard img{border-radius:0}
body.t-certificate .advcard .an,body.t-certificate .advisor .an{font-family:'Pinyon Script',cursive;font-weight:400;font-size:clamp(22px,2.6vw,30px)}
body.t-certificate .startbtn{border-radius:0}
body.t-certificate .big.grad{background:none;-webkit-background-clip:initial;background-clip:initial;color:var(--navy);border-bottom:3px double color-mix(in srgb,var(--gold) 70%,transparent)}
body.t-certificate #nav{border-radius:0}
body.t-certificate #nav button{border-radius:0}
body.t-certificate .big.grad{animation:none}
body.t-certificate #fx i{display:block;position:absolute;bottom:-8px;width:4px;height:4px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--gold-l) 80%,transparent),rgba(179,146,74,0) 70%);animation:mote linear infinite}
body.t-certificate #fx i:nth-child(1){left:6%;animation-duration:16s;animation-delay:0s}
body.t-certificate #fx i:nth-child(2){left:14%;animation-duration:21s;animation-delay:3s;width:3px;height:3px}
body.t-certificate #fx i:nth-child(3){left:24%;animation-duration:18s;animation-delay:7s}
body.t-certificate #fx i:nth-child(4){left:33%;animation-duration:24s;animation-delay:1s;width:5px;height:5px}
body.t-certificate #fx i:nth-child(5){left:42%;animation-duration:17s;animation-delay:9s;width:3px;height:3px}
body.t-certificate #fx i:nth-child(6){left:51%;animation-duration:22s;animation-delay:4s}
body.t-certificate #fx i:nth-child(7){left:60%;animation-duration:19s;animation-delay:11s}
body.t-certificate #fx i:nth-child(8){left:68%;animation-duration:25s;animation-delay:2s;width:5px;height:5px}
body.t-certificate #fx i:nth-child(9){left:76%;animation-duration:16s;animation-delay:8s;width:3px;height:3px}
body.t-certificate #fx i:nth-child(10){left:84%;animation-duration:23s;animation-delay:5s}
body.t-certificate #fx i:nth-child(11){left:91%;animation-duration:18s;animation-delay:12s}
body.t-certificate #fx i:nth-child(12){left:97%;animation-duration:21s;animation-delay:6s;width:3px;height:3px}
@keyframes mote{0%{transform:translateY(0);opacity:0}8%{opacity:.75}85%{opacity:.5}100%{transform:translateY(-104vh);opacity:0}}
`,
  },
]

// ── Brand accent ───────────────────────────────────────────────────────────
// A deck's entire accent system is three variables: --gold (the accent itself),
// --gold-l (its lighter partner, for gradients) and --gold-f (the faint wash
// used behind cards, avatars and the cover slab). Paper, ink and card stay
// template-owned — so swapping in a brand color re-tints the deck without
// touching the typography or the warmth that makes the layout work.

function hexRgb(hex: string): [number, number, number] | null {
  const h = String(hex ?? '').trim().replace(/^#/, '')
  const s = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  if (!/^[0-9a-f]{6}$/i.test(s)) return null
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
}
const rgbHex = (c: [number, number, number]) =>
  '#' + c.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('')

/** WCAG relative luminance. */
function lum(c: [number, number, number]): number {
  const [r, g, b] = c.map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: [number, number, number], b: [number, number, number]) => {
  const [hi, lo] = lum(a) > lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)]
  return (hi + 0.05) / (lo + 0.05)
}
const mix = (a: [number, number, number], b: [number, number, number], t: number) =>
  a.map((v, i) => v + (b[i] - v) * t) as [number, number, number]

/** Resolve a brand color into an accent that is actually legible on this
 *  template's paper. A bright yellow or pale mint would vanish as a kicker and
 *  make the CTA button unreadable, so we walk it toward the ink (or, on a dark
 *  template, toward white) until it clears a 3.2:1 ratio. */
function usableAccent(hex: string, paper: [number, number, number], ink: [number, number, number]): [number, number, number] {
  let c = hexRgb(hex)!
  const target: [number, number, number] = lum(paper) > 0.4 ? ink : [255, 255, 255]
  for (let i = 0; i < 12 && contrast(c, paper) < 3.2; i++) c = mix(c, target, 0.12)
  return c
}

/** The `--gold*` trio for a brand color, or '' when there's no usable override. */
function accentVars(hex: string | undefined, t: PresentationTemplate): string {
  if (!hex || !hexRgb(hex)) return ''
  const paper = hexRgb(t.vars['--paper'] ?? '') ?? [247, 245, 238]
  const ink = hexRgb(t.vars['--navy'] ?? t.vars['--ink'] ?? '') ?? [28, 42, 68]
  const gold = usableAccent(hex, paper, ink)
  const dark = lum(paper) <= 0.4
  // Light partner brightens on light paper, deepens on dark paper.
  const light = mix(gold, dark ? [255, 255, 255] : [255, 255, 255], dark ? 0.34 : 0.3)
  // The faint wash is the accent dissolved into the paper it sits on, so it
  // reads as a tint of the page rather than a foreign block of color.
  const faint = mix(paper, gold, dark ? 0.34 : 0.18)
  return `;--gold:${rgbHex(gold)};--gold-l:${rgbHex(light)};--gold-f:${rgbHex(faint)}`
}

/** Resolved core colors for a template (exports: PPTX/PDF builders).
 *  `accent` overrides the template's own accent with the brand color, using
 *  the same legibility guard the HTML deck applies. */
export function templateTokens(templateId: string, accent?: string): { paper: string; ink: string; accent: string; card: string; soft: string } {
  const t = PRESENTATION_TEMPLATES.find((x) => x.id === templateId) ?? PRESENTATION_TEMPLATES[0]
  const v = t.vars
  const brand = accentVars(accent, t).match(/--gold:(#[0-9a-f]{6})/i)?.[1]
  return {
    paper: v['--paper'] ?? '#f7f5ee',
    ink: v['--navy'] ?? '#1c2a44',
    accent: brand ?? v['--gold'] ?? '#a8842c',
    card: v['--card'] ?? '#fffdf7',
    soft: v['--soft'] ?? '#4d5a74',
  }
}

/** The jordyn.app house illustration library (pre-generated Gemini art in the
 *  site's own style, served from the live site — zero per-deck image cost).
 *  Content slides keyword-match into it; each illustration is used once. */
const JORDYN_ILLO_BASE = 'https://jordyn.app/demo-illos/'
const JORDYN_ILLOS: { f: string; k: string[] }[] = [
  { f: 'illo-email.png', k: ['email', 'inbox', 'follow-up', 'followup', 'reply', 'message'] },
  { f: 'illo-clients.png', k: ['client', 'contact', 'relationship', 'book of business', 'crm', 'customer'] },
  { f: 'illo-brain.png', k: ['brain', 'industry', 'learn', 'knowledge', 'smart', ' ai ', 'intelligen', 'fluent'] },
  { f: 'illo-pipeline.png', k: ['pipeline', 'case', 'deal', 'track', 'progress', 'stage'] },
  { f: 'illo-paperwork.png', k: ['paperwork', 'document', 'proposal', 'rfp', 'letter', 'draft', 'write'] },
  { f: 'illo-automation.png', k: ['automat', 'workflow', 'hands-free', 'busywork', 'routine', 'save'] },
  { f: 'illo-booking.png', k: ['book', 'schedul', 'calendar', 'meeting', 'appointment', 'demo'] },
  { f: 'illo-campaigns.png', k: ['campaign', 'market', 'nurtur', 'outreach', 'sequence', 'social'] },
  { f: 'illo-invoice.png', k: ['invoice', 'payment', 'bill', 'stripe', 'pay', 'revenue'] },
  { f: 'illo-phone.png', k: ['phone', 'call', 'voice', 'line', 'answer'] },
  { f: 'illo-memory.png', k: ['memory', 'remember', 'history', 'context', 'never forget'] },
  { f: 'illo-integrations.png', k: ['integrat', 'connect', 'tools', 'stack', 'works with'] },
  { f: 'illo-security.png', k: ['secur', 'privacy', 'compliance', 'safe', 'protect'] },
  { f: 'illo-pricing.png', k: ['pricing', 'cost', 'price', 'plan', 'credit'] },
  { f: 'illo-step1.png', k: ['step one', 'first', 'setup', 'minutes', 'start'] },
  { f: 'illo-step2.png', k: ['step two', 'second', 'build'] },
  { f: 'illo-step3.png', k: ['step three', 'third', 'grow', 'scale'] },
  { f: 'illo-cta.png', k: ['next step', 'ready', 'today', 'talk', 'reach out'] },
]
/** Art generated for this specific slide, if the pipeline made any. Accepts an
 *  https URL or an inlined data URI, on the scene or inside slideData. Custom
 *  art always wins over the keyword-matched house library — that's the whole
 *  point of paying to generate it. */
function sceneArt(s: PresentationScene): string | null {
  const sd = (s.slideData ?? {}) as { imageUrl?: string }
  const raw = (s as { imageUrl?: string }).imageUrl ?? sd.imageUrl
  const v = String(raw ?? '').trim()
  if (!v) return null
  // Anything that isn't a plain image reference is a script-injection vector
  // in an `src` attribute — reject rather than escape.
  return /^(https:\/\/|data:image\/(png|jpeg|webp);base64,)/i.test(v) ? v : null
}

function pickJordynIllo(text: string, used: Set<string>): string | null {
  const hay = ` ${text.toLowerCase()} `
  let best: { f: string; score: number } | null = null
  for (const il of JORDYN_ILLOS) {
    if (used.has(il.f)) continue
    const score = il.k.reduce((a, k) => a + (hay.includes(k) ? 1 : 0), 0)
    if (score > 0 && (!best || score > best.score)) best = { f: il.f, score }
  }
  if (!best) {
    // No keyword hit — fall back to a generic unused one so slides still get art.
    const generic = ['illo-brain.png', 'illo-clients.png', 'illo-pipeline.png', 'illo-automation.png', 'illo-paperwork.png']
      .find((f) => !used.has(f))
    if (!generic) return null
    best = { f: generic, score: 0 }
  }
  used.add(best.f)
  return JORDYN_ILLO_BASE + best.f
}

const esc = (s: string) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** First strong money/percent figure in the narration → hero-stat layout. */
function detectStat(text: string): { value: string; rest: string } | null {
  const m = text.match(/\$[\d,]+(?:\.\d+)?(?:\s*(?:per|\/)\s*(?:year|yr|month|mo))?|\b\d{1,3}(?:,\d{3})+\b|\b\d+(?:\.\d+)?%/)
  if (!m) return null
  return { value: m[0], rest: text }
}

/** A phone number in any common shape — these must never wrap mid-number and
 *  must never take the giant serif hero treatment (they read as broken). */
function isPhone(v: string): boolean {
  const d = String(v ?? '').replace(/\D/g, '')
  return (d.length === 10 || (d.length === 11 && d.startsWith('1'))) && /[\d)][\s.\-]/.test(String(v))
}

/** True only for SHORT, genuinely numeric values ("$176,204", "98%", "20 Years",
 *  "67"). A phrase like "100% S&P 500 Index High Cap Rate Acct" or a text value
 *  like "Preferred Non-Tobacco" must NOT render as a hero number — set in 68px
 *  serif they wrap to three lines and look like a rendering failure. */
function isHeroNumber(v?: string): boolean {
  const s = String(v ?? '').trim()
  if (!s || s.length > 14 || isPhone(s)) return false
  // leading figure + at most one short unit word (Years, mo, day, %, x)
  return /^[~≈<>]?\s*\$?\d[\d,]*(?:\.\d+)?\s*(?:%|x|[a-z]{1,5}(?:\/[a-z]{1,4})?|\/[a-z]{1,4})?$/i.test(s)
}

/** Stats that share ONE unit ($ or %) and parse numerically → animated bar
 *  chart rows. Mixed units (an age next to a premium) stay as cards. */
function chartable(stats: { label?: string; value?: string }[]): { label: string; num: number; disp: string }[] | null {
  if (!stats || stats.length < 3) return null
  const rows: { label: string; num: number; disp: string }[] = []
  const units = new Set<string>()
  for (const s of stats) {
    const v = String(s.value ?? '').trim()
    const m = v.match(/^[~≈]?\s*(\$)?([\d,]+(?:\.\d+)?)\s*(%)?$/)
    if (!m) return null
    units.add(m[1] ? '$' : m[3] ? '%' : '#')
    rows.push({ label: s.label || '', num: parseFloat(m[2].replace(/,/g, '')), disp: v })
  }
  if (units.size !== 1 || rows.every((r) => r.num === rows[0].num)) return null
  return rows
}

/**
 * The scenes that actually become slides.
 *
 * A trailing "Take the next step / Call us" scene immediately before the
 * closing repeats the same contact details twice in a row, so the deck folds it
 * away — the closing card already carries the name, phone and email.
 *
 * WHY THIS IS EXPORTED, and it is the whole point. The rule used to live inside
 * the HTML builder, so the deck knew about it and nothing else did. The app's
 * own page counted the stored scenes instead and told the customer "Slide 1 of
 * 12" while the player underneath it said "1 / 11".
 *
 * That is not just an untidy number. The page lists a chip per scene to jump
 * around with, so the last chip pointed at a slide that does not exist. Two
 * definitions of "a slide" is the bug; the mismatched count is how you notice.
 *
 * Anything that counts, lists or links to slides must call this — never
 * `scenes.length`.
 */
export function visibleScenes(scenes: PresentationScene[]): PresentationScene[] {
  const list = [...scenes]
  if (list.length < 3) return list
  const last = list[list.length - 1]
  const prev = list[list.length - 2]
  const isClosing = last?._role === 'closing' || /thank you/i.test(last?.title ?? '')
  const ctaish = /next step|call |contact|reach out|get started|talk to/i.test(
    `${prev?.title ?? ''} ${prev?.slideData?.headline ?? ''}`)
  const prevThin = (prev?.slideData?.bullets?.length ?? 0) === 0
  if (isClosing && ctaish && prevThin) list.splice(list.length - 2, 1)
  return list
}

export function buildPresentationHtml(opts: {
  title: string
  scenes: PresentationScene[]
  templateId: string
  brandName?: string
  primaryColor?: string
  /** short subtitle under the cover title (from the source document) */
  subtitle?: string
  presenter?: { name?: string; photoUrl?: string; contactLine?: string }
  recipientName?: string
  /** brand logo shown in the corner (user-supplied; never AI-generated) */
  logoUrl?: string
  /** standing footnote printed small on every slide — required for regulated
   *  (insurance/financial) decks so the disclosure travels with the content. */
  disclaimer?: string
  /** base64 mp3 per scene (interactive) — omit for silent decks */
  voClips?: string[]
  /** show the share-mode action row on the closing slide */
  shareActions?: boolean
  /** granular gate: show "Download the source document" only when there IS one */
  hasSourceDoc?: boolean
  /** granular gate: show "Download this deck" only when a deck/PDF export exists */
  hasDeckDownload?: boolean
}): string {
  const t = PRESENTATION_TEMPLATES.find((x) => x.id === opts.templateId) ?? PRESENTATION_TEMPLATES[0]
  const P = opts.presenter ?? {}
  // The presenter always gets a visual anchor: their photo when they've
  // uploaded one, otherwise an initials monogram — so the slot is designed
  // for a photo rather than a name floating in a lopsided pill.
  const initials = (P.name ?? '')
    .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
  const avatar = P.photoUrl
    ? `<img class="av" src="${esc(P.photoUrl)}" alt="">`
    : initials ? `<span class="av mono">${esc(initials)}</span>` : ''
  /** Presenter block — `lg` is the closing-card size. */
  const byline = (lg = false) => P.name
    ? `<div class="byline${lg ? ' lg' : ''}">${avatar}<span class="bt">
        <span class="an">${esc(P.name)}</span>
        ${P.contactLine ? `<span class="ac">${esc(P.contactLine)}</span>` : '<span class="ac">Your advisor</span>'}
      </span></div>`
    : ''
  // Brand accent last so it wins over the template's own --gold trio.
  const themeVars = Object.entries(t.vars).map(([k, v]) => `${k}:${v}`).join(';')
    + accentVars(opts.primaryColor, t)
  // Jordyn house style pairs every slide with an on-style illustration.
  const wantIllos = t.id === 'jordyn'
  const usedIllos = new Set<string>()
  const disc = opts.disclaimer
    ? `<div class="disc">${esc(opts.disclaimer)}</div>`
    : ''

  const scenes = visibleScenes(opts.scenes)

  const slides = scenes.map((s, i) => {
    const isCover = s._role === 'cover' || i === 0
    const isClosing = s._role === 'closing' || i === scenes.length - 1
    const sd = s.slideData ?? {}
    const stats = (sd.stats ?? []).filter((x) => x && (x.value || x.label)).slice(0, 6)
    const bullets = (sd.bullets ?? []).filter(Boolean).slice(0, 6)
    const heading = sd.headline || s.title || opts.title
    if (isCover) {
      const words = esc(opts.title).split(' ').map((w, k) =>
        `<span class="wd" style="animation-delay:${(0.2 + k * 0.09).toFixed(2)}s">${w}</span>`).join(' ')
      const coverInner = `
        ${opts.recipientName ? `<div class="forwhom">Prepared for<b>${esc(opts.recipientName)}</b></div>` : ''}
        <h1>${words}<span class="g">.</span></h1>
        ${opts.subtitle ? `<div class="lead">${esc(opts.subtitle).slice(0, 180)}</div>` : ''}
        ${byline()}
        ${opts.voClips?.length ? `<div><button class="startbtn" onclick="startPres()">▶&nbsp;&nbsp;Start presentation</button></div>` : ''}
        ${opts.brandName ? `<div class="bymark">${esc(opts.brandName)}</div>` : ''}`
      const coverArt = sceneArt(s)
      if (coverArt || wantIllos) {
        if (!coverArt) usedIllos.add('illo-hero.png')
        const src = coverArt ?? `${JORDYN_ILLO_BASE}illo-hero.png`
        return `<div class="wrap wl willo cover"><div>${coverInner}</div><div class="illocard hero"><img src="${src}" alt=""></div></div>`
      }
      return `<div class="wrap cover ctr">${coverInner}</div>`
    }
    if (isClosing) {
      // Prefer the written headline over the scene title — the title is often
      // just the filing label ("Thank you") while the headline is the actual
      // parting line the deck was built toward.
      const closeHead = sd.headline || s.title || 'Let’s talk'
      const closeInner = `
        <div class="kick"><span class="rule"></span>THANK YOU<span class="rule r"></span></div>
        <h1 style="font-size:clamp(21px,2.9vw,36px)">${esc(closeHead)}<span class="g">.</span></h1>
        <div class="lead">${esc(sd.cta || 'We appreciate your time.')}</div>
        ${byline(true)}
        ${opts.brandName ? `<div class="bymark">${esc(opts.brandName)}</div>` : ''}
        ${opts.shareActions ? `<div class="shareacts">
          ${opts.hasSourceDoc !== false ? `<button class="sact" onclick="parent.postMessage({type:'act',kind:'pdf'},'*')">📄 <b>Download the source document</b></button>` : ''}
          ${opts.hasDeckDownload !== false ? `<button class="sact" onclick="parent.postMessage({type:'act',kind:'deck'},'*')">📑 <b>Download this deck</b></button>` : ''}
          <button class="sact" onclick="parent.postMessage({type:'act',kind:'chat'},'*')">💬 <b>Ask a question</b></button>
        </div>` : ''}`
      const closeArt = sceneArt(s)
      // A back cover carrying real contact details earns the same weight as
      // the front cover — art beside it, not a lone card in an empty field.
      if (closeArt) {
        return `<div class="wrap wl willo cover"><div>${closeInner}</div>
          <div class="illocard hero"><img src="${closeArt}" alt=""></div></div>`
      }
      return `<div class="wrap">${closeInner}</div>`
    }

    // ── Content slides render slideData, NOT the narration. Layout picked by
    // shape: hero (1 stat) · split (stats + bullets, two columns) · cards ·
    // chart · list. Ghost numeral + accent bar give each slide depth. ──
    const num = String(i).padStart(2, '0')
    // Don't echo the headline in the kicker — "01 DECISION AT 40" above
    // "Decision at 40" reads as a duplication bug, not a label.
    const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '')
    const kickText = norm(s.title ?? '') && norm(s.title ?? '') !== norm(heading) ? esc(s.title ?? '').toUpperCase() : ''
    const kick = `<div class="kick"><span class="num">${num}</span>${kickText}<span class="rule r"></span></div>`
    const ghost = `<div class="ghost">${num}</div>`
    // Numbers COUNT UP on slide entry (cinematic data reveal). The static text
    // stays as fallback; JS replaces it with a ticker when the slide activates.
    const cnt = (v?: string) => {
      const raw = String(v ?? '').trim()
      const m = raw.match(/^([~≈]?\s*\$?)([\d,]+)((?:\.\d+)?.*)$/)
      if (!m) return esc(raw)
      const n = parseInt(m[2].replace(/,/g, ''), 10)
      if (!isFinite(n) || n < 10) return esc(raw)
      return `<span class="cnt" data-pre="${esc(m[1])}" data-num="${n}" data-suf="${esc(m[3])}">${esc(raw)}</span>`
    }
    // Text values ("Preferred Non-Tobacco") and phone numbers get their own
    // treatment — the numeric serif style breaks them across lines.
    const statsHtml = (cls: string) => stats.map((x) => {
      const v = String(x.value ?? '')
      const kind = isPhone(v) ? 'v tel' : isHeroNumber(v) ? 'v' : 'v txt'
      // Non-breaking hyphen so "Preferred Non-Tobacco" never splits after the
      // dash (phones keep real hyphens — .tel is nowrap anyway).
      const shown = isHeroNumber(v) ? cnt(v) : esc(isPhone(v) ? v : v.replace(/(\w)-(\w)/g, '$1‑$2'))
      return `<div class="stat ${cls}"><div class="${kind}">${shown}</div><div class="l">${esc(x.label ?? '')}</div></div>`
    }).join('')
    const bulletsHtml = (two: boolean) => `<ul class="bullets${two ? ' two' : ''}">${bullets.map((b) =>
      `<li><span class="mk">◆</span><span>${esc(b)}</span></li>`).join('')}</ul>`

    const chart = chartable(stats)
    if (chart) {
      const max = Math.max(...chart.map((r) => r.num))
      const chartHtml = `<div class="chart">${chart.map((r) =>
        `<div class="crow"><span class="cl">${esc(r.label)}</span><div class="ctrack"><div class="cbar" style="width:${Math.max(6, Math.round((r.num / max) * 100))}%"></div></div><span class="cval">${cnt(r.disp)}</span></div>`).join('')}</div>`
      return `<div class="wrap">${ghost}${kick}<h1 class="h2">${esc(heading)}</h1>${chartHtml}${bullets.length ? bulletsHtml(false) : ''}</div>`
    }
    const slideText = `${s.title ?? ''} ${heading} ${bullets.join(' ')} ${s.narration ?? ''}`
    // Art made FOR this slide always beats the keyword-matched house library.
    const illo = sceneArt(s)
      ?? (wantIllos && !chartable(stats) ? pickJordynIllo(slideText, usedIllos) : null)
    const illoCard = illo ? `<div class="illocard"><img src="${illo}" alt=""></div>` : ''

    const one = stats.length === 1 ? String(stats[0].value ?? '') : ''
    const heroSolo = one && isHeroNumber(one)
    const telSolo = one && isPhone(one)

    // A single phone number — big and readable, but sans + nowrap so it can
    // never break mid-number the way the serif hero treatment does.
    if (telSolo && !bullets.length) {
      const inner = `${kick}<h1 class="h2">${esc(heading)}</h1>
        <div class="tel big-tel">${esc(one)}</div>${stats[0].label && !/phone/i.test(stats[0].label) ? `<div class="bl">${esc(stats[0].label)}</div>` : ''}`
      return illo
        ? `<div class="wrap wl willo">${ghost}<div>${inner}</div>${illoCard}</div>`
        : `<div class="wrap">${ghost}${inner}</div>`
    }
    if (heroSolo && !bullets.length) {
      const inner = `${kick}<h1 class="h2">${esc(heading)}</h1>
        <div class="big grad">${cnt(one)}</div>${stats[0].label ? `<div class="bl">${esc(stats[0].label)}</div>` : ''}`
      return illo
        ? `<div class="wrap wl willo">${ghost}<div>${inner}</div>${illoCard}</div>`
        : `<div class="wrap">${ghost}${inner}</div>`
    }
    if (stats.length >= 1 && bullets.length >= 2) {
      // With art made for this slide, keep the art rather than the two-column
      // split — figures stack under the bullets on the left. Only when the
      // content is light enough to share the column without crowding.
      if (illo && !heroSolo && bullets.length <= 2 && stats.length <= 3) {
        return `<div class="wrap wl willo">${ghost}<div>${kick}<h1 class="h2">${esc(heading)}</h1>
          ${bulletsHtml(false)}<div class="statrow">${statsHtml('slim')}</div></div>${illoCard}</div>`
      }
      // Split: bullets on one side, figures on the other. A lone hero-worthy
      // number leads; anything else stacks as cards.
      const lead = heroSolo
        ? `<div class="big grad" style="font-size:clamp(36px,5.6vw,64px)">${cnt(one)}</div>${stats[0].label ? `<div class="bl">${esc(stats[0].label)}</div>` : ''}`
        : bulletsHtml(false)
      const side = heroSolo ? bulletsHtml(false) : statsHtml('slim')
      return `<div class="wrap wl">${ghost}${kick}<h1 class="h2">${esc(heading)}</h1>
        <div class="cols">
          <div>${lead}</div>
          <div class="sidestats">${side}</div>
        </div></div>`
    }
    if (stats.length >= 1) {
      const grid = `<div class="statgrid">${statsHtml('')}</div>${bullets.length ? bulletsHtml(false) : ''}`
      return illo
        ? `<div class="wrap wl willo">${ghost}<div>${kick}<h1 class="h2">${esc(heading)}</h1>${grid}</div>${illoCard}</div>`
        : `<div class="wrap">${ghost}${kick}<h1 class="h2">${esc(heading)}</h1>${grid}</div>`
    }
    if (bullets.length) {
      if (illo) return `<div class="wrap wl willo">${ghost}<div>${kick}<h1 class="h2">${esc(heading)}</h1>${bulletsHtml(false)}</div>${illoCard}</div>`
      return `<div class="wrap wl">${ghost}${kick}<h1 class="h2">${esc(heading)}</h1>${bulletsHtml(bullets.length > 4)}</div>`
    }
    // Nothing structured on this scene → fall back to a short summary line.
    const stat = detectStat(s.narration)
    const fallInner = `${kick}<h1 class="h2">${esc(heading)}</h1>
      ${stat && isHeroNumber(stat.value) ? `<div class="big grad">${cnt(stat.value)}</div>` : ''}
      <div class="lead" style="max-width:720px">${esc(s.narration).slice(0, 300)}</div>`
    if (illo) return `<div class="wrap wl willo">${ghost}<div>${fallInner}</div>${illoCard}</div>`
    return `<div class="wrap">${ghost}${fallInner}</div>`
  })

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Montserrat:wght@400;600;700;800;900&family=Quicksand:wght@400;500;600;700&family=Pinyon+Script&display=swap" rel="stylesheet">
<style>
:root{--paper:#f7f5ee;--card:#fffdf7;--ink:#1c2a44;--navy:#1c2a44;--soft:#4d5a74;--faint:#8b94a8;--gold:#a8842c;--gold-l:#c9a84c;--gold-f:#d9c07a;--line:#e5e0d0;--font:-apple-system,'Segoe UI',Roboto,sans-serif;--serif:Georgia,'Times New Roman',serif}
body.themed{${themeVars}}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden;caret-color:transparent;-webkit-user-select:none;user-select:none}
button:focus{outline:none}
body{background:var(--paper);font-family:var(--font);color:var(--ink)}
#app{position:relative;width:100vw;height:100vh}
#glow{position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(50% 45% at 24% 20%,color-mix(in srgb,var(--gold) 10%,transparent),transparent 60%);animation:drift 18s ease-in-out infinite alternate}
@keyframes drift{from{transform:translate3d(-1.5%,-1%,0) scale(1.02)}to{transform:translate3d(1.8%,1.4%,0) scale(1.07)}}
#frame{position:fixed;inset:14px;z-index:2;pointer-events:none;border:1px solid color-mix(in srgb,var(--gold) 45%,transparent);border-radius:4px}
/* SAFE CENTERING, not justify-content:center. A flex-centered child that grows
   taller than its container overflows out of BOTH ends equally — straight
   through the padding — which is how slide bullets ended up underneath the nav
   pill and slide titles underneath the fixed corner block. margin:auto on the
   child centers identically when content fits, but respects the padding when it
   does not.
   The paddings are the chrome lanes, measured: the corner block (logo plus two
   text lines) reaches ~72px from the top, so the floor is 88px; the nav pill
   occupies up to 56px from the bottom with the standing disclaimer beside it,
   so the floor is 128px. */
.sec{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;padding:clamp(88px,12vh,110px) 6vw 128px;opacity:0;transform:translateY(18px) scale(1.012);transition:opacity .55s ease,transform .55s cubic-bezier(.16,1,.3,1),filter .5s ease;pointer-events:none;overflow:hidden;z-index:3}
.sec.on{opacity:1;transform:none;pointer-events:auto}
.sec.leaving{opacity:0;transform:scale(.985);filter:blur(6px)}
.wrap{position:relative;width:100%;max-width:1020px;margin:auto;text-align:center}
.wrap.wl{text-align:left}
.wrap.wl .kick{margin-left:0}
/* Ghost numeral: pushed to the bleed edge and faint, so it reads as a design
   mark rather than a smudge peeking out from behind the cards. */
.ghost{position:absolute;right:-6vw;bottom:-8vh;top:auto;font-family:var(--serif);font-weight:700;font-size:clamp(200px,38vh,360px);line-height:1;color:color-mix(in srgb,var(--ink) 3.5%,transparent);pointer-events:none;user-select:none;z-index:0;opacity:0;transition:opacity 1.2s ease .3s}
.sec.on .ghost{opacity:1;animation:gfloat 11s ease-in-out 1.2s infinite alternate}
@keyframes gfloat{from{transform:translateY(0)}to{transform:translateY(-1.4%) rotate(.6deg)}}
.wrap>*:not(.ghost){position:relative;z-index:1}
.wd{display:inline-block;opacity:0;transform:translateY(.45em);animation:wrise .6s cubic-bezier(.16,1,.3,1) forwards}
@keyframes wrise{to{opacity:1;transform:none}}
.wrap>*:not(.ghost){opacity:0;transform:translateY(14px)}
.sec.on .wrap>*:not(.ghost){animation:rv .55s cubic-bezier(.16,1,.3,1) forwards}
.sec.on .wrap>*:nth-child(2){animation-delay:.12s}.sec.on .wrap>*:nth-child(3){animation-delay:.24s}.sec.on .wrap>*:nth-child(4){animation-delay:.36s}
@keyframes rv{to{opacity:1;transform:none}}
/* card cascades with a settle tilt */
.sec.on .statgrid .stat,.sec.on .sidestats>*,.sec.on .bullets li{opacity:0;transform:translateY(18px) rotateX(9deg);animation:rvc .65s cubic-bezier(.16,1,.3,1) forwards}
.sec.on .statgrid .stat:nth-child(1){animation-delay:.34s}.sec.on .statgrid .stat:nth-child(2){animation-delay:.44s}.sec.on .statgrid .stat:nth-child(3){animation-delay:.54s}.sec.on .statgrid .stat:nth-child(4){animation-delay:.64s}.sec.on .statgrid .stat:nth-child(5){animation-delay:.74s}.sec.on .statgrid .stat:nth-child(6){animation-delay:.84s}
.sec.on .sidestats>*:nth-child(1){animation-delay:.4s}.sec.on .sidestats>*:nth-child(2){animation-delay:.52s}.sec.on .sidestats>*:nth-child(3){animation-delay:.64s}.sec.on .sidestats>*:nth-child(4){animation-delay:.76s}
.sec.on .bullets li:nth-child(1){animation-delay:.4s}.sec.on .bullets li:nth-child(2){animation-delay:.52s}.sec.on .bullets li:nth-child(3){animation-delay:.64s}.sec.on .bullets li:nth-child(4){animation-delay:.76s}.sec.on .bullets li:nth-child(5){animation-delay:.88s}.sec.on .bullets li:nth-child(6){animation-delay:1s}
@keyframes rvc{to{opacity:1;transform:none}}
/* accent bar draws itself */
h1.h2::after{transform:translateX(-50%) scaleX(0);transform-origin:center}
.wl h1.h2::after{transform:scaleX(0);transform-origin:left}
.sec.on h1.h2::after{animation:draw .7s cubic-bezier(.16,1,.3,1) .35s forwards}
.sec.on .wl h1.h2::after{animation-name:drawl}
@keyframes draw{to{transform:translateX(-50%) scaleX(1)}}
@keyframes drawl{to{transform:scaleX(1)}}
/* chart bars stagger */
.sec.on .crow:nth-child(1) .cbar{animation-delay:.35s}.sec.on .crow:nth-child(2) .cbar{animation-delay:.47s}.sec.on .crow:nth-child(3) .cbar{animation-delay:.59s}.sec.on .crow:nth-child(4) .cbar{animation-delay:.71s}.sec.on .crow:nth-child(5) .cbar{animation-delay:.83s}
.kick{display:inline-flex;align-items:center;gap:10px;font-weight:700;font-size:clamp(10px,1.1vw,13px);letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:clamp(10px,1.8vh,16px)}
.kick .rule{width:30px;height:1px;background:linear-gradient(90deg,transparent,var(--gold))}
.kick .rule.r{width:44px;background:linear-gradient(90deg,var(--gold),transparent)}
.kick .num{background:var(--gold);color:var(--paper);border-radius:6px;padding:3px 9px;letter-spacing:.06em;font-size:.92em}
h1{font-family:var(--serif);font-weight:700;font-size:clamp(26px,4.4vw,52px);line-height:1.08}
h1 .g{color:var(--gold)}
.lead{color:var(--soft);font-size:clamp(15px,1.8vw,21px);line-height:1.6;max-width:680px;margin:12px auto 0}
.big{display:inline-block;font-family:var(--serif);font-weight:700;font-size:clamp(44px,8vw,96px);line-height:1.18;color:var(--navy);letter-spacing:-.02em;font-variant-numeric:tabular-nums;padding:0 .05em .08em}
h1.h2{font-size:clamp(21px,3.1vw,38px);padding-bottom:clamp(12px,2.2vh,20px);margin-bottom:clamp(4px,1vh,10px);position:relative}
h1.h2::after{content:'';position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:56px;height:3px;border-radius:2px;background:linear-gradient(90deg,var(--gold),var(--gold-l))}
.wl h1.h2::after{left:0;transform:none}
.big.grad{background:linear-gradient(115deg,var(--navy) 25%,var(--gold) 60%,var(--navy) 95%);background-size:220% 220%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:gshift 7s ease-in-out infinite alternate}
@keyframes gshift{from{background-position:0% 50%}to{background-position:100% 50%}}
.cols{display:grid;grid-template-columns:1.15fr .85fr;gap:clamp(18px,3vw,44px);align-items:start;margin-top:clamp(12px,2.4vh,22px);text-align:left}
.sidestats{display:flex;flex-direction:column;gap:clamp(8px,1.5vh,13px)}
.stat.slim{max-width:none;width:100%;padding:clamp(9px,1.6vh,15px) clamp(14px,1.6vw,20px)}
.cols .bullets{margin:0;max-width:none}
.wrap.willo{display:grid;grid-template-columns:1.08fr .92fr;gap:clamp(20px,3.5vw,56px);align-items:center;text-align:left}
.wrap.willo .kick{margin-left:0}
.wrap.willo .bullets{margin-left:0;margin-right:0;max-width:none}
.wrap.willo .lead{margin-left:0}
/* Single frame — the art already sits on its own soft field, so an outer card
   plus an inner panel double-frames it. */
.illocard{position:relative;border-radius:22px;overflow:hidden;box-shadow:0 18px 44px color-mix(in srgb,var(--ink) 9%,transparent);display:flex;align-items:center;justify-content:center;background:var(--card)}
.illocard img{width:100%;max-height:52vh;object-fit:cover;display:block}
/* Cover art sits on a soft offset accent slab — gives the opening some depth
   instead of a flat card floating on an empty field. */
.illocard.hero{border-radius:28px;max-height:64vh}
.illocard.hero img{max-height:64vh}
.wrap.cover .illocard.hero::after{content:'';position:absolute;inset:0;border-radius:28px;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ink) 6%,transparent);pointer-events:none}
.wrap.cover>*:last-child{position:relative}
.wrap.cover>*:last-child::before{content:'';position:absolute;inset:6% -4% -7% 7%;border-radius:32px;background:color-mix(in srgb,var(--gold-f) 62%,transparent);transform:rotate(-2deg);z-index:-1}
.bl{font-size:clamp(11px,1.2vw,14px);letter-spacing:.14em;text-transform:uppercase;color:var(--faint);font-weight:700;margin-top:4px}
.statgrid{display:flex;gap:clamp(8px,1.4vw,16px);justify-content:center;flex-wrap:wrap;margin-top:clamp(10px,2.2vh,20px)}
/* Figures sharing a column with bullets, alongside a slide's own artwork. */
.statrow{display:flex;gap:clamp(8px,1.2vw,14px);flex-wrap:wrap;margin-top:clamp(10px,2vh,18px)}
.statrow .stat{flex:1 1 0;min-width:0}
.stat{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:12px;padding:clamp(10px,1.8vh,18px) clamp(14px,1.8vw,24px);min-width:130px;max-width:250px;text-align:left;box-shadow:0 10px 26px rgba(0,0,0,.08)}
.stat .v{font-family:var(--serif);font-weight:700;font-size:clamp(20px,2.7vw,36px);line-height:1.18;padding-bottom:.06em;color:var(--navy);font-variant-numeric:tabular-nums}
/* Text values ("Preferred Non-Tobacco") — sans, smaller, no hyphen breaks. */
.stat .v.txt{font-family:var(--font);font-weight:700;font-size:clamp(16px,1.9vw,24px);line-height:1.35;letter-spacing:-.01em;hyphens:none;overflow-wrap:break-word}
/* Phone numbers — never break mid-number. */
.tel{font-family:var(--font);font-weight:800;letter-spacing:-.01em;white-space:nowrap;color:var(--navy);font-variant-numeric:tabular-nums}
.big-tel{font-size:clamp(30px,5vw,60px);line-height:1.2;padding-bottom:.06em;margin-top:2vh}
.stat .v.tel{font-size:clamp(16px,2vw,26px)}
.stat .l{font-size:clamp(11px,1.2vw,14px);letter-spacing:.08em;text-transform:uppercase;color:var(--faint);font-weight:700;margin-top:5px}
.bullets{display:grid;grid-template-columns:1fr;gap:clamp(8px,1.5vh,13px);max-width:760px;margin:clamp(10px,2.2vh,20px) auto 0;padding:0;text-align:left}
.wl>.bullets{margin-left:0;margin-right:0}
.bullets.two{grid-template-columns:1fr 1fr;max-width:940px}
.bullets.tight{margin-top:clamp(8px,1.6vh,14px)}
.bullets li{list-style:none;display:flex;gap:10px;align-items:flex-start;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:clamp(10px,1.7vh,16px) clamp(14px,1.6vw,20px);font-size:clamp(14px,1.65vw,19px);line-height:1.55;color:var(--soft)}
.bullets .mk{color:var(--gold);font-size:.72em;line-height:2;flex:none}
.chart{max-width:780px;margin:clamp(12px,2.4vh,22px) auto 0;display:grid;gap:clamp(8px,1.4vh,12px);text-align:left;width:100%}
.crow{display:grid;grid-template-columns:minmax(90px,190px) 1fr auto;gap:12px;align-items:center}
.crow .cl{font-size:clamp(12px,1.3vw,15px);font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--faint);text-align:right}
.ctrack{background:color-mix(in srgb,var(--ink) 8%,transparent);border-radius:8px;overflow:hidden}
.cbar{height:clamp(12px,2vh,18px);border-radius:8px;background:linear-gradient(90deg,var(--gold),var(--gold-l));transform-origin:left;transform:scaleX(0)}
.sec.on .cbar{animation:grow 1s cubic-bezier(.16,1,.3,1) forwards}
@keyframes grow{to{transform:scaleX(1)}}
.crow .cval{font-family:var(--serif);font-weight:700;font-size:clamp(15px,1.75vw,21px);color:var(--navy);font-variant-numeric:tabular-nums}
/* Presenter block — photo (or initials monogram) + name + contact, on a
   baseline grid. Replaces the old pill, whose one-sided padding left the
   name visibly off-centre whenever no photo was supplied. */
.byline{display:inline-flex;align-items:center;gap:clamp(11px,1.3vw,16px);margin-top:clamp(16px,3vh,26px);text-align:left}
.byline .av{flex:none;width:clamp(44px,5.4vh,56px);height:clamp(44px,5.4vh,56px);border-radius:50%;object-fit:cover;display:inline-flex;align-items:center;justify-content:center;background:var(--gold-f);color:var(--gold);border:2px solid var(--card);box-shadow:0 0 0 1.5px var(--gold-f),0 8px 20px color-mix(in srgb,var(--ink) 12%,transparent)}
.byline .av.mono{font-family:var(--serif);font-weight:700;font-size:clamp(15px,1.7vw,19px);letter-spacing:.02em}
.byline .bt{display:flex;flex-direction:column;gap:2px;min-width:0}
.byline .an{font-family:var(--serif);font-weight:700;font-size:clamp(15px,1.65vw,19px);line-height:1.25;color:var(--navy)}
.byline .ac{font-size:clamp(11.5px,1.15vw,13.5px);line-height:1.4;color:var(--faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.byline.lg{margin-top:clamp(18px,3.4vh,30px);background:var(--card);border:1px solid var(--line);border-radius:18px;padding:clamp(12px,1.8vh,18px) clamp(20px,2.4vw,28px);box-shadow:0 16px 40px color-mix(in srgb,var(--ink) 10%,transparent)}
.byline.lg .av{width:clamp(52px,6.6vh,68px);height:clamp(52px,6.6vh,68px)}
.byline.lg .an{font-size:clamp(17px,2vw,23px)}
.byline.lg .ac{font-size:clamp(12px,1.25vw,15px)}
/* Cover: quiet "prepared for" line, brand mark set low as a signature. */
.forwhom{font-size:clamp(11px,1.15vw,13px);letter-spacing:.16em;text-transform:uppercase;color:var(--faint);font-weight:600;margin-bottom:clamp(10px,1.8vh,16px)}
.forwhom b{color:var(--gold);font-weight:700;margin-left:.6em;letter-spacing:.1em}
.bymark{margin-top:clamp(18px,3.6vh,32px);font-size:clamp(10.5px,1.1vw,12.5px);letter-spacing:.2em;text-transform:uppercase;color:color-mix(in srgb,var(--faint) 80%,transparent);font-weight:600}
.wrap.cover h1{font-size:clamp(30px,4.9vw,62px);line-height:1.04}
.wrap.cover .lead{margin-top:clamp(10px,1.8vh,18px);max-width:30ch}
.wrap.ctr{text-align:center}
.wrap.ctr .byline{justify-content:center}
.startbtn{display:inline-flex;align-items:center;margin-top:clamp(16px,3vh,28px);background:linear-gradient(115deg,var(--gold),var(--gold-l));color:var(--paper);border:none;border-radius:10px;padding:clamp(12px,2vh,16px) clamp(24px,3vw,38px);font:inherit;font-weight:800;font-size:clamp(14px,1.6vw,17px);letter-spacing:.02em;cursor:pointer;box-shadow:0 14px 34px color-mix(in srgb,var(--gold) 40%,transparent);transition:transform .18s,box-shadow .18s}
.startbtn:hover{transform:translateY(-2px);box-shadow:0 18px 40px color-mix(in srgb,var(--gold) 52%,transparent)}
.startbtn{animation:pulse 2.6s ease-in-out infinite}
@keyframes pulse{0%,100%{box-shadow:0 14px 34px color-mix(in srgb,var(--gold) 40%,transparent)}50%{box-shadow:0 14px 44px color-mix(in srgb,var(--gold) 62%,transparent)}}
body.started .startbtn{display:none}
#fx{position:fixed;inset:0;z-index:2;pointer-events:none;overflow:hidden}
#fx i{display:none}
.advcard{display:inline-flex;align-items:center;gap:18px;background:var(--card);border:1px solid var(--gold-f);border-radius:16px;padding:16px 26px 16px 16px;box-shadow:0 16px 40px rgba(0,0,0,.12);margin-top:clamp(12px,2.4vh,22px);text-align:left}
.advcard img{width:clamp(64px,9vh,88px);height:clamp(64px,9vh,88px);border-radius:14px;object-fit:cover;border:2px solid var(--gold-f)}
.advcard .an{font-family:var(--serif);font-weight:700;font-size:clamp(16px,1.9vw,22px);color:var(--navy)}
.advcard .ac{font-size:clamp(12px,1.3vw,15px);color:var(--soft);margin-top:6px;line-height:1.5}
.shareacts{display:none;gap:12px;justify-content:center;margin-top:clamp(12px,2.2vh,20px);flex-wrap:wrap}
body.share .shareacts{display:flex}
.sact{display:inline-flex;align-items:center;gap:8px;background:var(--card);border:1.5px solid var(--gold-f);border-radius:12px;padding:11px 18px;cursor:pointer;transition:transform .18s;font:inherit;font-size:clamp(11.5px,1.2vw,13.5px);color:var(--navy)}
.sact:hover{transform:translateY(-3px);border-color:var(--gold)}
#bar{position:fixed;left:0;top:0;height:3px;background:var(--gold);width:0;z-index:40;transition:width .3s ease}
/* 22px, not 12px: the decorative border is inset 14px, and at 12px the pill's
   bottom edge crossed it by 2px. Small enough that nobody would report it, big
   enough to look like an accident rather than a choice — and a check that has
   to carry an exception for it stops being worth reading. The .sec bottom
   padding is 128px, which still clears the pill at its new height. */
#nav{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:6px;z-index:50;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:6px 10px;box-shadow:0 8px 24px rgba(0,0,0,.14);white-space:nowrap;max-width:94vw}
#nav button{flex:none;display:inline-flex;align-items:center;justify-content:center;background:var(--paper);border:none;color:var(--ink);font:inherit;font-weight:700;font-size:15px;width:32px;height:32px;line-height:1;border-radius:50%;cursor:pointer;transition:all .18s;padding:0}
#nav button:hover{background:var(--navy);color:var(--paper)}
#dots{display:flex;gap:5px;margin:0 4px;flex:none}#dots i{width:7px;height:7px;border-radius:50%;background:color-mix(in srgb,var(--ink) 18%,transparent);cursor:pointer;transition:all .2s}#dots i.on{background:var(--gold);transform:scale(1.3)}
#nav .lab{flex:none;font-size:11px;font-weight:700;color:var(--faint);padding:0 4px;min-width:40px;text-align:center}
.corner{position:fixed;top:20px;left:34px;z-index:40;display:flex;align-items:center;gap:12px;font-family:var(--serif);font-weight:700;font-size:14px;color:var(--navy);transition:opacity .4s;max-width:56vw}
.corner .logo{height:clamp(26px,3.4vh,36px);width:auto;object-fit:contain;display:block}
.corner .ct{display:block;line-height:1.25}
.corner .sm{color:var(--faint);font-family:var(--font);font-weight:400;font-size:11px;display:block}
body.oncover .corner .ct{opacity:0;transition:opacity .4s}
/* Standing disclosure — travels with every slide on regulated decks. */
/* Capped so it can never run underneath the centred nav pill. The pill's half
   width is at most ~180px, so the disclaimer's right edge stops before the
   pill's left edge at any viewport. A disclaimer a client cannot read is a
   compliance failure, not a styling one — this text exists to be legible. */
/* INSIDE THE FRAME. The decorative border is inset 14px from every edge, and
   this was pinned 6px from the bottom — so the last line of the disclosure sat
   ON the border and past it, which is what "text spilling out of the borders"
   looks like. 26px clears the border with a real gap; 34px on the left already
   did. The frame inset and this offset are related, so if one moves the other
   has to. */
.disc{position:fixed;left:34px;bottom:26px;z-index:35;font-family:var(--font);font-size:10.5px;line-height:1.45;color:color-mix(in srgb,var(--soft) 78%,transparent);text-align:left;pointer-events:none;max-width:min(62ch,calc(50vw - 190px))}
${t.css ?? ''}
</style></head><body class="themed t-${t.id}">
<div id="glow"></div><div id="fx"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div id="frame"></div><div id="bar"></div>
<div class="corner">${opts.logoUrl ? `<img class="logo" src="${esc(opts.logoUrl)}" alt="">` : ''}<span class="ct">${esc(opts.title)}${P.name ? `<span class="sm">Presented by ${esc(P.name)}</span>` : ''}</span></div>${disc}
<div id="app"></div>
<div id="nav"><button id="prev" title="Previous">‹</button><span class="lab" id="lab"></span><button id="next" title="Next">›</button><div id="dots"></div>${opts.voClips?.length ? '<button id="pp" title="Pause / resume narration">⏸</button><button id="voice" title="Voice on/off">🔊</button>' : ''}<button id="fs" title="Fullscreen">⛶</button></div>
<script>
const SLIDES=${JSON.stringify(slides)};
const VO=${JSON.stringify(opts.voClips ?? [])};
const app=document.getElementById('app');
SLIDES.forEach(h=>{const d=document.createElement('div');d.className='sec';d.innerHTML=h;app.appendChild(d);});
const secs=[...document.querySelectorAll('.sec')];
const dots=document.getElementById('dots');
SLIDES.forEach((_,i)=>{const b=document.createElement('i');b.onclick=()=>go(i);dots.appendChild(b);});
const dotEls=[...dots.children],bar=document.getElementById('bar'),lab=document.getElementById('lab');
let cur=-1;
let voiceOn=VO.length>0,voAudio=null;
// Narration is gated behind the Start button: browsers block autoplay until a
// user gesture, so without it the first slide's voice silently failed.
let started=VO.length===0,autoAdv=false;
window.startPres=()=>{started=true;autoAdv=true;document.body.classList.add('started');go(0);};
const voiceBtn=document.getElementById('voice');
function voStop(){if(voAudio){voAudio.pause();voAudio=null;}}
function voPlay(){voStop();if(!voiceOn||!started)return;const b=VO[cur];if(!b)return;voAudio=new Audio('data:audio/mpeg;base64,'+b);voAudio.onended=()=>{if(autoAdv&&cur<secs.length-1)setTimeout(()=>{if(autoAdv&&!(voAudio&&!voAudio.paused))go(cur+1);},700);};voAudio.play().catch(()=>{});}
if(voiceBtn)voiceBtn.onclick=()=>{voiceOn=!voiceOn;voiceBtn.textContent=voiceOn?'🔊':'🔇';if(voiceOn)voPlay();else voStop();};
const fsBtn=document.getElementById('fs');
if(fsBtn)fsBtn.onclick=()=>{if(document.fullscreenElement){document.exitFullscreen().catch(()=>{});}else{document.documentElement.requestFullscreen().catch(()=>{});}};
const ppBtn=document.getElementById('pp');
if(ppBtn)ppBtn.onclick=()=>{if(!voAudio)return;if(voAudio.paused){voAudio.play().catch(()=>{});ppBtn.textContent='⏸';}else{voAudio.pause();ppBtn.textContent='▶';}};
function countUps(sec){
  sec.querySelectorAll('.cnt').forEach(el=>{
    const n=+el.dataset.num,pre=el.dataset.pre||'',suf=el.dataset.suf||'';
    if(!isFinite(n))return;
    const t0=performance.now(),D=1150,d0=380;
    el.textContent=pre+'0'+suf;
    const tick=(t)=>{
      if(!sec.classList.contains('on'))return;
      const p=Math.min(1,Math.max(0,(t-t0-d0)/D));
      const e=1-Math.pow(1-p,3);
      el.textContent=pre+Math.round(n*e).toLocaleString('en-US')+suf;
      if(p<1)requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
/**
 * SHRINK A SLIDE THAT DOES NOT FIT.
 *
 * Every size here already uses clamp(), so the type scales with the WINDOW. It
 * does not scale with the CONTENT — and the content is written by a model out
 * of somebody's document, so one slide gets four bullets and the next gets nine
 * of two lines each. At the clamp minimum that still runs past the bottom of
 * the frame, and .sec hides its overflow: the last bullets are simply gone, and
 * the ones above collide with the nav pill.
 *
 * Centring was already handled — see the note on .sec. This is the other half,
 * how MUCH there is, which no amount of viewport maths can know in advance.
 *
 * Scales the whole block rather than restyling parts of it, so the proportions
 * survive: a slide at 0.82 looks like the same slide, whereas shrinking only
 * the bullets would wreck its balance. Measured against the real box in the
 * real browser, and re-run on resize, because a deck opened on a laptop gets
 * dragged onto a projector.
 */
function fitSlide(sec){
  if(!sec)return;
  const w=sec.querySelector('.wrap');if(!w)return;
  // Measure unscaled every time. Measuring an already-scaled block and scaling
  // again compounds, and the slide creeps smaller on every visit.
  w.style.transform='';w.style.transformOrigin='center center';
  const cs=getComputedStyle(sec);
  const room=sec.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom);
  const need=w.scrollHeight;
  if(!room||!need||need<=room+1)return;
  // 0.62 floor: below that the type is too small to read on a phone, and a
  // slide nobody can read is no better than one that is clipped. Hitting the
  // floor means the deck is genuinely carrying too much for one slide.
  w.style.transform='scale('+Math.max(0.62,room/need)+')';
}
function fitAll(){secs.forEach(fitSlide);}
addEventListener('resize',function(){clearTimeout(window.__fitT);window.__fitT=setTimeout(fitAll,120);});
// Webfonts land after the first paint and change every measurement, so measure
// again once they have.
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fitAll);
function go(i){
  if(i<0)i=0;if(i>=secs.length)i=secs.length-1;
  const prev=cur;cur=i;
  if(prev>=0&&prev!==i&&secs[prev]){const L=secs[prev];L.classList.add('leaving');setTimeout(()=>L.classList.remove('leaving'),600);}
  secs.forEach(s=>s.classList.remove('on'));dotEls.forEach(d=>d.classList.remove('on'));
  secs[i].classList.add('on');dotEls[i].classList.add('on');
  // Measured while it is VISIBLE. A hidden .sec still has a size here, but the
  // count-up numbers below have not run yet and a slide whose figures grow from
  // "0" to "$1,000,000" measures short before they do.
  fitSlide(secs[i]);
  countUps(secs[i]);
  lab.textContent=(i+1)+' / '+secs.length;
  bar.style.width=(i/(Math.max(secs.length-1,1))*100)+'%';
  document.getElementById('next').textContent=(i===secs.length-1?'↻':'›');
  document.getElementById('next').title=(i===secs.length-1?'Restart':'Next');
  document.body.classList.toggle('oncover',i===0);
  const pp=document.getElementById('pp');if(pp)pp.textContent='⏸';
  voPlay();
}
const RP=new URLSearchParams(location.search);
if(RP.get('share')==='1'){document.body.classList.add('share');}
if(RP.get('record')==='1'){
  document.getElementById('nav').style.display='none';
  document.body.classList.add('started');
  voiceOn=false;document.body.style.pointerEvents='none';
  window.startShow=(durs)=>{go(0);let t=0;for(let i=1;i<durs.length&&i<secs.length;i++){t+=durs[i-1];setTimeout(((k)=>()=>go(k))(i),t);}};
}
// Any manual navigation is a user gesture → audio is unlocked; browse mode
// (no auto-advance) as opposed to the Start button's play-through mode.
const unlock=()=>{if(!started){started=true;document.body.classList.add('started');}};
document.getElementById('next').onclick=()=>{unlock();if(cur>=secs.length-1)go(0);else go(cur+1);};
document.getElementById('prev').onclick=()=>{unlock();go(cur-1);};
dotEls.forEach((d,i)=>{d.onclick=()=>{unlock();go(i);};});
document.addEventListener('keydown',e=>{
  if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();unlock();if(cur>=secs.length-1)go(0);else go(cur+1);}
  if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();unlock();go(cur-1);}
});
go(0);
</script></body></html>`
}
