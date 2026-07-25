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
body.t-certificate #frame{inset:10px;border:3px double rgba(138,109,47,.85);border-radius:0;box-shadow:inset 0 0 0 5px #f5f0e0,inset 0 0 0 6px rgba(138,109,47,.5)}
body.t-certificate #frame::before,body.t-certificate #frame::after{content:'❦';position:absolute;font-size:20px;color:rgba(138,109,47,.75);line-height:1}
body.t-certificate #frame::before{top:8px;left:12px}
body.t-certificate #frame::after{bottom:8px;right:12px;transform:rotate(180deg)}
body.t-certificate #glow{background:radial-gradient(46% 42% at 22% 18%,rgba(179,146,74,.14),transparent 60%),url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cg fill='none' stroke='%231a1a3a' stroke-opacity='.10'%3E%3Ccircle cx='100' cy='100' r='96'/%3E%3Ccircle cx='100' cy='100' r='72'/%3E%3Ccircle cx='100' cy='100' r='34'/%3E%3Cellipse cx='100' cy='100' rx='96' ry='32'/%3E%3Cellipse cx='100' cy='100' rx='96' ry='32' transform='rotate(30 100 100)'/%3E%3Cellipse cx='100' cy='100' rx='96' ry='32' transform='rotate(60 100 100)'/%3E%3Cellipse cx='100' cy='100' rx='96' ry='32' transform='rotate(90 100 100)'/%3E%3Cellipse cx='100' cy='100' rx='96' ry='32' transform='rotate(120 100 100)'/%3E%3Cellipse cx='100' cy='100' rx='96' ry='32' transform='rotate(150 100 100)'/%3E%3C/g%3E%3C/svg%3E") no-repeat calc(100% + 120px) calc(100% + 120px)/440px 440px}
body.t-certificate h1{letter-spacing:.01em}
body.t-certificate h1.h2::after{background:none;width:auto;height:auto;content:'✦ ✦ ✦';color:var(--gold);font-size:10px;letter-spacing:9px;left:50%;transform:translateX(-50%)}
body.t-certificate .wl h1.h2::after{left:0;transform:none}
body.t-certificate .kick{letter-spacing:.26em}
body.t-certificate .kick .num{border-radius:0;background:var(--navy);color:#f5f0e0}
body.t-certificate .stat{border:1px solid rgba(138,109,47,.55);border-left:1px solid rgba(138,109,47,.55);border-radius:0;box-shadow:inset 0 0 0 3px #fbf8ee,inset 0 0 0 4px rgba(138,109,47,.3),0 10px 26px rgba(26,26,58,.07)}
body.t-certificate .bullets li{border-radius:0;border-color:rgba(138,109,47,.4)}
body.t-certificate .bullets .mk{content:'❧'}
body.t-certificate .advcard{border-radius:0;border:1px solid rgba(138,109,47,.6);box-shadow:inset 0 0 0 3px #fbf8ee,inset 0 0 0 4px rgba(138,109,47,.3),0 16px 40px rgba(26,26,58,.1)}
body.t-certificate .advcard img{border-radius:0}
body.t-certificate .advcard .an,body.t-certificate .advisor .an{font-family:'Pinyon Script',cursive;font-weight:400;font-size:clamp(22px,2.6vw,30px)}
body.t-certificate .startbtn{border-radius:0}
body.t-certificate .big.grad{background:none;-webkit-background-clip:initial;background-clip:initial;color:var(--navy);border-bottom:3px double rgba(138,109,47,.7)}
body.t-certificate #nav{border-radius:0}
body.t-certificate #nav button{border-radius:0}
`,
  },
]

/** Resolved core colors for a template (exports: PPTX/PDF builders). */
export function templateTokens(templateId: string): { paper: string; ink: string; accent: string; card: string; soft: string } {
  const t = PRESENTATION_TEMPLATES.find((x) => x.id === templateId) ?? PRESENTATION_TEMPLATES[0]
  const v = t.vars
  return {
    paper: v['--paper'] ?? '#f7f5ee',
    ink: v['--navy'] ?? '#1c2a44',
    accent: v['--gold'] ?? '#a8842c',
    card: v['--card'] ?? '#fffdf7',
    soft: v['--soft'] ?? '#4d5a74',
  }
}

const esc = (s: string) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** First strong money/percent figure in the narration → hero-stat layout. */
function detectStat(text: string): { value: string; rest: string } | null {
  const m = text.match(/\$[\d,]+(?:\.\d+)?(?:\s*(?:per|\/)\s*(?:year|yr|month|mo))?|\b\d{1,3}(?:,\d{3})+\b|\b\d+(?:\.\d+)?%/)
  if (!m) return null
  return { value: m[0], rest: text }
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
  /** base64 mp3 per scene (interactive) — omit for silent decks */
  voClips?: string[]
  /** show the share-mode action row on the closing slide */
  shareActions?: boolean
}): string {
  const t = PRESENTATION_TEMPLATES.find((x) => x.id === opts.templateId) ?? PRESENTATION_TEMPLATES[0]
  const P = opts.presenter ?? {}
  const themeVars = Object.entries(t.vars).map(([k, v]) => `${k}:${v}`).join(';')

  const slides = opts.scenes.map((s, i) => {
    const isCover = s._role === 'cover' || i === 0
    const isClosing = s._role === 'closing' || i === opts.scenes.length - 1
    const sd = s.slideData ?? {}
    const stats = (sd.stats ?? []).filter((x) => x && (x.value || x.label)).slice(0, 6)
    const bullets = (sd.bullets ?? []).filter(Boolean).slice(0, 6)
    const heading = sd.headline || s.title || opts.title
    if (isCover) {
      return `<div class="wrap">
        <div class="kick"><span class="rule"></span>${esc(opts.brandName || 'A PRESENTATION')}${opts.recipientName ? ' · PREPARED FOR ' + esc(opts.recipientName).toUpperCase() : ''}<span class="rule r"></span></div>
        <h1>${esc(opts.title)}<span class="g">.</span></h1>
        ${opts.subtitle ? `<div class="lead">${esc(opts.subtitle).slice(0, 180)}</div>` : ''}
        ${P.name ? `<div class="advisor">${P.photoUrl ? `<img src="${esc(P.photoUrl)}" alt="">` : ''}<span><span class="an">${esc(P.name)}</span></span></div>` : ''}
        ${opts.voClips?.length ? `<div><button class="startbtn" onclick="startPres()">▶&nbsp;&nbsp;Start presentation</button></div>` : ''}
      </div>`
    }
    if (isClosing) {
      return `<div class="wrap">
        <div class="kick"><span class="rule"></span>THANK YOU<span class="rule r"></span></div>
        <h1 style="font-size:clamp(21px,2.9vw,36px)">${esc(s.title || 'Let’s talk')}<span class="g">.</span></h1>
        <div class="lead">${esc(sd.cta || 'We appreciate your time.')}</div>
        ${P.name ? `<div class="advcard">${P.photoUrl ? `<img src="${esc(P.photoUrl)}" alt="">` : ''}<span><span class="an">${esc(P.name)}</span>${P.contactLine ? `<div class="ac">${esc(P.contactLine)}</div>` : ''}</span></div>` : ''}
        ${opts.shareActions ? `<div class="shareacts">
          <button class="sact" onclick="parent.postMessage({type:'act',kind:'pdf'},'*')">📄 <b>Download the source document</b></button>
          <button class="sact" onclick="parent.postMessage({type:'act',kind:'deck'},'*')">📑 <b>Download this deck</b></button>
          <button class="sact" onclick="parent.postMessage({type:'act',kind:'chat'},'*')">💬 <b>Ask a question</b></button>
        </div>` : ''}
      </div>`
    }

    // ── Content slides render slideData, NOT the narration. Layout picked by
    // shape: hero (1 stat) · split (stats + bullets, two columns) · cards ·
    // chart · list. Ghost numeral + accent bar give each slide depth. ──
    const num = String(i).padStart(2, '0')
    const kick = `<div class="kick"><span class="num">${num}</span>${esc(s.title || '').toUpperCase()}<span class="rule r"></span></div>`
    const ghost = `<div class="ghost">${num}</div>`
    const statsHtml = (cls: string) => stats.map((x) =>
      `<div class="stat ${cls}"><div class="v">${esc(x.value ?? '')}</div><div class="l">${esc(x.label ?? '')}</div></div>`).join('')
    const bulletsHtml = (two: boolean) => `<ul class="bullets${two ? ' two' : ''}">${bullets.map((b) =>
      `<li><span class="mk">◆</span><span>${esc(b)}</span></li>`).join('')}</ul>`

    const chart = chartable(stats)
    if (chart) {
      const max = Math.max(...chart.map((r) => r.num))
      const chartHtml = `<div class="chart">${chart.map((r) =>
        `<div class="crow"><span class="cl">${esc(r.label)}</span><div class="ctrack"><div class="cbar" style="width:${Math.max(6, Math.round((r.num / max) * 100))}%"></div></div><span class="cval">${esc(r.disp)}</span></div>`).join('')}</div>`
      return `<div class="wrap">${ghost}${kick}<h1 class="h2">${esc(heading)}</h1>${chartHtml}${bullets.length ? bulletsHtml(false) : ''}</div>`
    }
    if (stats.length === 1 && stats[0].value && !bullets.length) {
      return `<div class="wrap">${ghost}${kick}<h1 class="h2">${esc(heading)}</h1>
        <div class="big grad">${esc(stats[0].value)}</div>${stats[0].label ? `<div class="bl">${esc(stats[0].label)}</div>` : ''}</div>`
    }
    if (stats.length >= 1 && bullets.length >= 2) {
      // Split: headline over two columns — bullets left, stat stack right.
      return `<div class="wrap wl">${ghost}${kick}<h1 class="h2">${esc(heading)}</h1>
        <div class="cols">
          <div>${stats.length === 1 && stats[0].value ? `<div class="big grad" style="font-size:clamp(36px,5.6vw,68px)">${esc(stats[0].value)}</div>${stats[0].label ? `<div class="bl">${esc(stats[0].label)}</div>` : ''}` : bulletsHtml(false)}</div>
          <div class="sidestats">${stats.length === 1 ? bulletsHtml(false) : statsHtml('slim')}</div>
        </div></div>`
    }
    if (stats.length > 1) {
      return `<div class="wrap">${ghost}${kick}<h1 class="h2">${esc(heading)}</h1><div class="statgrid">${statsHtml('')}</div>${bullets.length ? bulletsHtml(false) : ''}</div>`
    }
    if (bullets.length) {
      return `<div class="wrap wl">${ghost}${kick}<h1 class="h2">${esc(heading)}</h1>${bulletsHtml(bullets.length > 4)}</div>`
    }
    // Nothing structured on this scene → fall back to a short summary line.
    const stat = detectStat(s.narration)
    return `<div class="wrap">${ghost}${kick}<h1 class="h2">${esc(heading)}</h1>
      ${stat ? `<div class="big grad">${esc(stat.value)}</div>` : ''}
      <div class="lead" style="max-width:720px">${esc(s.narration).slice(0, 300)}</div></div>`
  })

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Montserrat:wght@400;600;700;800;900&family=Pinyon+Script&display=swap" rel="stylesheet">
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
.sec{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(58px,10vh,92px) 6vw 104px;opacity:0;transform:translateY(18px);transition:opacity .55s ease,transform .55s cubic-bezier(.16,1,.3,1);pointer-events:none;overflow:hidden;z-index:3}
.sec.on{opacity:1;transform:none;pointer-events:auto}
.wrap{position:relative;width:100%;max-width:1020px;margin:0 auto;text-align:center}
.wrap.wl{text-align:left}
.wrap.wl .kick{margin-left:0}
.ghost{position:absolute;right:-2vw;top:50%;transform:translateY(-52%);font-family:var(--serif);font-weight:700;font-size:clamp(180px,34vh,320px);line-height:1;color:color-mix(in srgb,var(--ink) 5%,transparent);pointer-events:none;user-select:none;z-index:0}
.wrap>*:not(.ghost){position:relative;z-index:1}
.wrap>*{opacity:0;transform:translateY(14px)}
.sec.on .wrap>*{animation:rv .55s cubic-bezier(.16,1,.3,1) forwards}
.sec.on .wrap>*:nth-child(2){animation-delay:.14s}.sec.on .wrap>*:nth-child(3){animation-delay:.26s}.sec.on .wrap>*:nth-child(4){animation-delay:.38s}
@keyframes rv{to{opacity:1;transform:none}}
.kick{display:inline-flex;align-items:center;gap:10px;font-weight:700;font-size:clamp(10px,1.1vw,13px);letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:clamp(10px,1.8vh,16px)}
.kick .rule{width:30px;height:1px;background:linear-gradient(90deg,transparent,var(--gold))}
.kick .rule.r{width:44px;background:linear-gradient(90deg,var(--gold),transparent)}
.kick .num{background:var(--gold);color:var(--paper);border-radius:6px;padding:3px 9px;letter-spacing:.06em;font-size:.92em}
h1{font-family:var(--serif);font-weight:700;font-size:clamp(26px,4.4vw,52px);line-height:1.08}
h1 .g{color:var(--gold)}
.lead{color:var(--soft);font-size:clamp(13px,1.55vw,18px);line-height:1.6;max-width:660px;margin:12px auto 0}
.big{display:inline-block;font-family:var(--serif);font-weight:700;font-size:clamp(44px,8vw,96px);line-height:1.18;color:var(--navy);letter-spacing:-.02em;font-variant-numeric:tabular-nums;padding:0 .05em .08em}
h1.h2{font-size:clamp(21px,3.1vw,38px);padding-bottom:clamp(12px,2.2vh,20px);margin-bottom:clamp(4px,1vh,10px);position:relative}
h1.h2::after{content:'';position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:56px;height:3px;border-radius:2px;background:linear-gradient(90deg,var(--gold),var(--gold-l))}
.wl h1.h2::after{left:0;transform:none}
.big.grad{background:linear-gradient(115deg,var(--navy) 30%,var(--gold) 90%);-webkit-background-clip:text;background-clip:text;color:transparent}
.cols{display:grid;grid-template-columns:1.15fr .85fr;gap:clamp(18px,3vw,44px);align-items:start;margin-top:clamp(12px,2.4vh,22px);text-align:left}
.sidestats{display:flex;flex-direction:column;gap:clamp(8px,1.5vh,13px)}
.stat.slim{max-width:none;width:100%;padding:clamp(9px,1.6vh,15px) clamp(14px,1.6vw,20px)}
.cols .bullets{margin:0;max-width:none}
.bl{font-size:clamp(11px,1.2vw,14px);letter-spacing:.14em;text-transform:uppercase;color:var(--faint);font-weight:700;margin-top:4px}
.statgrid{display:flex;gap:clamp(8px,1.4vw,16px);justify-content:center;flex-wrap:wrap;margin-top:clamp(10px,2.2vh,20px)}
.stat{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:12px;padding:clamp(10px,1.8vh,18px) clamp(14px,1.8vw,24px);min-width:130px;max-width:250px;text-align:left;box-shadow:0 10px 26px rgba(0,0,0,.08)}
.stat .v{font-family:var(--serif);font-weight:700;font-size:clamp(18px,2.4vw,32px);line-height:1.18;padding-bottom:.06em;color:var(--navy);font-variant-numeric:tabular-nums}
.stat .l{font-size:clamp(9.5px,1vw,12px);letter-spacing:.08em;text-transform:uppercase;color:var(--faint);font-weight:700;margin-top:4px}
.bullets{display:grid;grid-template-columns:1fr;gap:clamp(8px,1.5vh,13px);max-width:760px;margin:clamp(10px,2.2vh,20px) auto 0;padding:0;text-align:left}
.wl>.bullets{margin-left:0;margin-right:0}
.bullets.two{grid-template-columns:1fr 1fr;max-width:940px}
.bullets.tight{margin-top:clamp(8px,1.6vh,14px)}
.bullets li{list-style:none;display:flex;gap:10px;align-items:flex-start;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:clamp(8px,1.5vh,14px) clamp(12px,1.4vw,18px);font-size:clamp(12px,1.35vw,15.5px);line-height:1.5;color:var(--soft)}
.bullets .mk{color:var(--gold);font-size:.72em;line-height:2;flex:none}
.chart{max-width:780px;margin:clamp(12px,2.4vh,22px) auto 0;display:grid;gap:clamp(8px,1.4vh,12px);text-align:left;width:100%}
.crow{display:grid;grid-template-columns:minmax(90px,190px) 1fr auto;gap:12px;align-items:center}
.crow .cl{font-size:clamp(10.5px,1.1vw,13px);font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--faint);text-align:right}
.ctrack{background:color-mix(in srgb,var(--ink) 8%,transparent);border-radius:8px;overflow:hidden}
.cbar{height:clamp(12px,2vh,18px);border-radius:8px;background:linear-gradient(90deg,var(--gold),var(--gold-l));transform-origin:left;transform:scaleX(0)}
.sec.on .cbar{animation:grow 1s cubic-bezier(.16,1,.3,1) forwards}
@keyframes grow{to{transform:scaleX(1)}}
.crow .cval{font-family:var(--serif);font-weight:700;font-size:clamp(13px,1.5vw,18px);color:var(--navy);font-variant-numeric:tabular-nums}
.advisor{display:inline-flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:8px 22px 8px 8px;box-shadow:0 8px 22px rgba(0,0,0,.09);margin-top:18px}
.advisor img{width:46px;height:46px;border-radius:50%;object-fit:cover;border:2px solid var(--gold-f)}
.advisor .an{font-family:var(--serif);font-weight:700;font-size:clamp(13px,1.4vw,16px);color:var(--navy)}
.startbtn{display:inline-flex;align-items:center;margin-top:clamp(16px,3vh,28px);background:linear-gradient(115deg,var(--gold),var(--gold-l));color:var(--paper);border:none;border-radius:10px;padding:clamp(12px,2vh,16px) clamp(24px,3vw,38px);font:inherit;font-weight:800;font-size:clamp(14px,1.6vw,17px);letter-spacing:.02em;cursor:pointer;box-shadow:0 14px 34px color-mix(in srgb,var(--gold) 40%,transparent);transition:transform .18s,box-shadow .18s}
.startbtn:hover{transform:translateY(-2px);box-shadow:0 18px 40px color-mix(in srgb,var(--gold) 52%,transparent)}
body.started .startbtn{display:none}
.advcard{display:inline-flex;align-items:center;gap:18px;background:var(--card);border:1px solid var(--gold-f);border-radius:16px;padding:16px 26px 16px 16px;box-shadow:0 16px 40px rgba(0,0,0,.12);margin-top:clamp(12px,2.4vh,22px);text-align:left}
.advcard img{width:clamp(64px,9vh,88px);height:clamp(64px,9vh,88px);border-radius:14px;object-fit:cover;border:2px solid var(--gold-f)}
.advcard .an{font-family:var(--serif);font-weight:700;font-size:clamp(16px,1.9vw,22px);color:var(--navy)}
.advcard .ac{font-size:clamp(12px,1.3vw,15px);color:var(--soft);margin-top:6px;line-height:1.5}
.shareacts{display:none;gap:12px;justify-content:center;margin-top:clamp(12px,2.2vh,20px);flex-wrap:wrap}
body.share .shareacts{display:flex}
.sact{display:inline-flex;align-items:center;gap:8px;background:var(--card);border:1.5px solid var(--gold-f);border-radius:12px;padding:11px 18px;cursor:pointer;transition:transform .18s;font:inherit;font-size:clamp(11.5px,1.2vw,13.5px);color:var(--navy)}
.sact:hover{transform:translateY(-3px);border-color:var(--gold)}
#bar{position:fixed;left:0;top:0;height:3px;background:var(--gold);width:0;z-index:40;transition:width .3s ease}
#nav{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:6px;z-index:50;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:6px 10px;box-shadow:0 8px 24px rgba(0,0,0,.14);white-space:nowrap;max-width:94vw}
#nav button{flex:none;display:inline-flex;align-items:center;justify-content:center;background:var(--paper);border:none;color:var(--ink);font:inherit;font-weight:700;font-size:15px;width:32px;height:32px;line-height:1;border-radius:50%;cursor:pointer;transition:all .18s;padding:0}
#nav button:hover{background:var(--navy);color:var(--paper)}
#dots{display:flex;gap:5px;margin:0 4px;flex:none}#dots i{width:7px;height:7px;border-radius:50%;background:color-mix(in srgb,var(--ink) 18%,transparent);cursor:pointer;transition:all .2s}#dots i.on{background:var(--gold);transform:scale(1.3)}
#nav .lab{flex:none;font-size:11px;font-weight:700;color:var(--faint);padding:0 4px;min-width:40px;text-align:center}
.corner{position:fixed;top:22px;left:34px;z-index:40;font-family:var(--serif);font-weight:700;font-size:14px;color:var(--navy);transition:opacity .4s}
.corner .sm{color:var(--faint);font-family:var(--font);font-weight:400;font-size:11px;display:block}
body.oncover .corner{opacity:0}
${t.css ?? ''}
</style></head><body class="themed t-${t.id}">
<div id="glow"></div><div id="frame"></div><div id="bar"></div>
<div class="corner">${esc(opts.title)}${P.name ? `<span class="sm">Presented by ${esc(P.name)}</span>` : ''}</div>
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
function go(i){
  if(i<0)i=0;if(i>=secs.length)i=secs.length-1;cur=i;
  secs.forEach(s=>s.classList.remove('on'));dotEls.forEach(d=>d.classList.remove('on'));
  secs[i].classList.add('on');dotEls[i].classList.add('on');
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
