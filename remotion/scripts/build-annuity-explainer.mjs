// PDF → interactive presentation (v2 — "certificate of value" edition).
// Source figures extracted verbatim from demo-annuity.pdf; carrier + product
// names SCRUBBED; guaranteed vs non-guaranteed separated; every slide points
// to the full illustration. Jazz: guilloché engraving aesthetic (code-drawn,
// stroke-animated), 10-year growth curve (the PDF's own 7%-simple formula),
// paycheck chips + monthly/annual toggle, protections shield ring, paper
// grain + gold frame, full motion pass, and advisor narration (ElevenLabs,
// cached per line). Rebuild: node scripts/build-annuity-explainer.mjs
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs'
import { createHash } from 'crypto'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', 'out', 'annuity-explainer.html')
const VO_CACHE = join(HERE, '.annuity-vo-cache'); mkdirSync(VO_CACHE, { recursive: true })
const env = {}
for (const f of ['.env.local', '.env']) for (const base of [ROOT, join(HERE, '..')]) {
  const p = join(base, f)
  if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim()
  }
}
const ELEVEN = env.ELEVENLABS_API_KEY
const VOICE = env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'

const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US')
// ── The presenting advisor (in the product this comes from the user's
//    profile: uploaded photo + name + contact) ──
const PRESENTER = {
  name: 'Maria Alvarez, CLU®',
  title: 'Retirement Income Specialist',
  phone: '(832) 555-0164',
  email: 'maria@alvarezretirement.com',
}
const headshotPath = join(HERE, '..', 'public', 'advisor-headshot.png')
const HEADSHOT = existsSync(headshotPath)
  ? 'data:image/png;base64,' + readFileSync(headshotPath).toString('base64')
  : ''
// ── Extracted from the PDF (figures verbatim; names scrubbed) ──
const D = {
  client: 'Mrs. Danielle Reyes', age: 58, incomeAge: 68,
  premium: 485000, rollupPct: 7, years: 10,
  incomeBase68: 824500, income: 49470, payout: '6.0%',
  accum: [['Today', 485000], ['Year 5', 612300], ['Year 10', 781900]],
  cap: '9.5%', part: '100%', floor: '0%', surrender: '7 years',
}
const monthly = D.income / 12 // 4122.5 — pure arithmetic on the PDF's figure
// The curve: the PDF states 7.0% SIMPLE for 10 years — its own formula.
const curvePts = Array.from({ length: D.years + 1 }, (_, t) => ({
  age: D.age + t, v: Math.round(D.premium * (1 + (D.rollupPct / 100) * t)),
}))

// ── Advisor narration (compliant: no carrier/product names; figures kept) ──
const NARRATION = [
  `Welcome, ${D.client}. I'm Maria Alvarez, your advisor — I prepared this short walkthrough of your retirement income plan. Take it at your own pace, and keep your full illustration nearby for every detail.`,
  `Everything begins with your rollover: four hundred eighty-five thousand dollars, moving from your 401k to start working for your retirement at age fifty-eight.`,
  `On the guaranteed side, your income base grows seven percent simple every year for ten years — climbing to a projected eight hundred twenty-four thousand five hundred dollars by age sixty-eight.`,
  `That base funds a paycheck for life: forty-nine thousand four hundred seventy dollars a year beginning at sixty-eight — about four thousand one hundred twenty-two dollars a month, guaranteed for as long as you live.`,
  `Separately, your account value is illustrated — not guaranteed — at six hundred twelve thousand three hundred dollars by year five, and seven hundred eighty-one thousand nine hundred by year ten, depending on index performance.`,
  `Your principal is protected by a zero percent floor in down markets, with growth potential up to a nine and a half percent annual cap at one hundred percent participation. A seven-year surrender period applies.`,
  `This summary is illustrative only. Your complete illustration holds the full guarantees and disclosures. I'm here for every question — reach me anytime at the number below. Thank you, ${D.client}.`,
]
async function tts(text) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.1 } }),
  })
  if (!r.ok) throw new Error(`tts ${r.status}`)
  return Buffer.from(await r.arrayBuffer())
}
const VO = []
if (ELEVEN) {
  for (const line of NARRATION) {
    const key = createHash('md5').update(line).digest('hex')
    const f = join(VO_CACHE, `${key}.mp3`)
    try {
      let buf
      if (existsSync(f)) buf = readFileSync(f)
      else { buf = await tts(line); writeFileSync(f, buf); console.log('[vo]', line.slice(0, 44) + '…') }
      VO.push(buf.toString('base64'))
    } catch (e) { console.log('[vo] FAILED:', String(e.message).slice(0, 50)); VO.push('') }
  }
} else console.log('[vo] no ELEVENLABS_API_KEY — silent build')

// Guilloché rosette: layered rotated ellipses — classic engraved-certificate
// ornament, pure SVG, drawn by stroke animation.
const rosette = (size, rings, cls) => {
  const c = size / 2
  let paths = ''
  for (let i = 0; i < rings; i++) {
    const rot = (180 / rings) * i
    paths += `<ellipse cx="${c}" cy="${c}" rx="${c * 0.92}" ry="${c * 0.38}" transform="rotate(${rot} ${c} ${c})"/>`
  }
  return `<svg class="${cls}" viewBox="0 0 ${size} ${size}" fill="none">${paths}<circle cx="${c}" cy="${c}" r="${c * 0.16}"/></svg>`
}
// Growth curve SVG geometry (960x360 box, padded)
const CW = 960, CH = 340, PX = 70, PT = 30, PB = 46
const vMin = D.premium * 0.92, vMax = D.incomeBase68 * 1.04
const X = (t) => PX + (t / D.years) * (CW - PX * 2)
const Y = (v) => PT + (1 - (v - vMin) / (vMax - vMin)) * (CH - PT - PB)
const linePath = curvePts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ')
const areaPath = `${linePath} L${X(D.years).toFixed(1)},${CH - PB} L${X(0).toFixed(1)},${CH - PB} Z`

const HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Retirement Income Summary — ${D.client}</title><style>
:root{--paper:#f7f5ee;--card:#fffdf7;--ink:#1c2a44;--soft:#4d5a74;--faint:#8b94a8;--navy:#1c2a44;--gold:#a8842c;--gold-l:#c9a84c;--gold-f:#d9c07a;--green:#2f6b4f;--line:#e5e0d0;--font:-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Georgia,serif;--serif:Georgia,'Times New Roman',serif}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden;caret-color:transparent;-webkit-user-select:none;user-select:none}
button:focus{outline:none}
body{background:var(--paper);font-family:var(--font);color:var(--ink)}
#app{position:relative;width:100vw;height:100vh}
/* ── depth & texture: grain, vignette, drifting glow, gold hairline frame ── */
#grain{position:fixed;inset:0;z-index:1;pointer-events:none;opacity:.05}
#vignette{position:fixed;inset:0;z-index:1;pointer-events:none;background:radial-gradient(120% 100% at 50% 42%,transparent 55%,rgba(28,42,68,.10))}
#glow{position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(50% 45% at 24% 20%,rgba(201,168,76,.10),transparent 60%),radial-gradient(45% 50% at 80% 82%,rgba(28,42,68,.06),transparent 62%);animation:drift 18s ease-in-out infinite alternate}
@keyframes drift{from{transform:translate3d(-1.5%,-1%,0) scale(1.02)}to{transform:translate3d(1.8%,1.4%,0) scale(1.07)}}
#frame{position:fixed;inset:14px;z-index:2;pointer-events:none;border:1px solid rgba(168,132,44,.45);border-radius:4px}
#frame::after{content:'';position:absolute;inset:5px;border:1px solid rgba(168,132,44,.18);border-radius:2px}
.corner{position:fixed;z-index:2;width:34px;height:34px;pointer-events:none;border-color:var(--gold);border-style:solid;opacity:.75}
.c-tl{top:10px;left:10px;border-width:2px 0 0 2px}.c-tr{top:10px;right:10px;border-width:2px 2px 0 0}
.c-bl{bottom:10px;left:10px;border-width:0 0 2px 2px}.c-br{bottom:10px;right:10px;border-width:0 2px 2px 0}
/* ── slides ── */
.sec{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(16px,3.5vh,36px) 6vw 108px;opacity:0;transform:translateY(18px);transition:opacity .55s ease,transform .55s cubic-bezier(.16,1,.3,1);pointer-events:none;overflow:hidden;z-index:3}
.sec.on{opacity:1;transform:none;pointer-events:auto}
.wrap{width:100%;max-width:1020px;margin:0 auto;text-align:center}
.wrap>*{opacity:0;transform:translateY(16px)}
.sec.on .wrap>*{animation:rv .6s cubic-bezier(.16,1,.3,1) forwards}
.sec.on .wrap>*:nth-child(1){animation-delay:.05s}.sec.on .wrap>*:nth-child(2){animation-delay:.16s}.sec.on .wrap>*:nth-child(3){animation-delay:.27s}.sec.on .wrap>*:nth-child(4){animation-delay:.38s}.sec.on .wrap>*:nth-child(5){animation-delay:.49s}
@keyframes rv{to{opacity:1;transform:none}}
.kick{display:inline-flex;align-items:center;gap:10px;font-weight:700;font-size:clamp(10px,1.1vw,13px);letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:12px}
.kick .rule{width:34px;height:1px;background:linear-gradient(90deg,transparent,var(--gold))}
.kick .rule.r{background:linear-gradient(90deg,var(--gold),transparent)}
h1{font-family:var(--serif);font-weight:700;font-size:clamp(26px,4.4vw,52px);line-height:1.08;letter-spacing:-.01em}
h1 .g{color:var(--gold)}
.lead{color:var(--soft);font-size:clamp(13px,1.55vw,18px);line-height:1.55;max-width:660px;margin:12px auto 0}
/* line-height + bottom padding INSIDE the overflow box, or descenders
   ($ , y) clip — the perennial big-number rule. */
.big{position:relative;display:inline-block;font-family:var(--serif);font-weight:700;font-size:clamp(48px,9vw,108px);line-height:1.18;color:var(--navy);letter-spacing:-.02em;font-variant-numeric:tabular-nums;overflow:hidden;padding:0 .05em .08em}
.big .u{font-size:.38em;color:var(--faint);font-weight:400}
.big::after{content:'';position:absolute;inset:0;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.65) 50%,transparent 60%);transform:translateX(-130%)}
.sec.on .big::after{animation:sweep 1.3s ease-out .9s}
@keyframes sweep{to{transform:translateX(130%)}}
.tagline{font-size:clamp(12px,1.35vw,16px);color:var(--faint);margin-top:10px}
.gbadge{display:inline-block;padding:6px 18px;border-radius:4px;font-weight:700;font-size:clamp(10px,1.05vw,13px);letter-spacing:.14em;margin-bottom:14px}
.gbadge.guar{background:rgba(47,107,79,.09);color:var(--green);border:1px solid rgba(47,107,79,.3)}
.gbadge.hypo{background:rgba(168,132,44,.08);color:var(--gold);border:1px solid rgba(168,132,44,.35)}
/* rosette ornaments (stroke-draw) */
.rosette{stroke:var(--gold);stroke-width:.8;opacity:.55}
.rosette ellipse,.rosette circle{stroke-dasharray:900;stroke-dashoffset:900}
.sec.on .rosette ellipse,.sec.on .rosette circle{animation:draw 2.4s ease-out forwards}
@keyframes draw{to{stroke-dashoffset:0}}
.rose-hero{width:clamp(150px,20vh,220px);height:auto;margin:0 auto 6px}
.rose-side{position:absolute;width:340px;height:340px;opacity:.14;z-index:-1}
/* growth curve */
.curvebox{background:var(--card);border:1px solid var(--line);border-radius:14px;box-shadow:0 18px 44px rgba(28,42,68,.08);padding:clamp(10px,1.6vh,18px) clamp(10px,1.6vw,20px);margin:clamp(10px,2vh,20px) auto 0;max-width:960px}
.curvebox svg{width:100%;height:auto;display:block}
.axis{stroke:#d9d4c2;stroke-width:1}
.gridline{stroke:#ece8da;stroke-width:1;stroke-dasharray:3 5}
.agelbl{font:600 15px var(--font);fill:var(--faint)}
.vlbl{font:700 16px var(--serif);fill:var(--soft)}
.curve-area{fill:url(#goldfill);opacity:0}
.curve-line{stroke:var(--gold);stroke-width:3;fill:none;stroke-linecap:round;stroke-dasharray:1200;stroke-dashoffset:1200}
.sec.on .curve-line{animation:draw2 1.8s cubic-bezier(.4,0,.2,1) .3s forwards}
.sec.on .curve-area{animation:fadein .8s ease 1.7s forwards}
@keyframes draw2{to{stroke-dashoffset:0}}
@keyframes fadein{to{opacity:1}}
.enddot{fill:var(--gold);opacity:0}
.endlbl{font:700 24px var(--serif);fill:var(--navy);opacity:0}
.endtag{font:700 12px var(--font);fill:var(--green);letter-spacing:.1em;opacity:0}
.sec.on .enddot,.sec.on .endlbl,.sec.on .endtag{animation:fadein .5s ease 1.9s forwards}
.startlbl{font:700 20px var(--serif);fill:var(--soft)}
/* paychecks */
.paystack{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:clamp(12px,2vh,20px);max-width:760px;margin-left:auto;margin-right:auto}
.pay{background:var(--card);border:1px solid var(--gold-f);border-left:4px solid var(--gold);border-radius:8px;padding:8px 13px;text-align:left;box-shadow:0 6px 16px rgba(28,42,68,.07);opacity:0;transform:translateY(12px) rotate(-1deg)}
.sec.on .pay{animation:dealin .45s cubic-bezier(.34,1.4,.64,1) forwards;animation-delay:calc(.5s + var(--i)*.09s)}
@keyframes dealin{to{opacity:1;transform:none}}
.pay .pv{font-family:var(--serif);font-weight:700;font-size:clamp(13px,1.4vw,17px);color:var(--navy)}
.pay .pl{font-size:9.5px;color:var(--faint);letter-spacing:.06em;text-transform:uppercase}
/* monthly/annual toggle */
.viewtoggle{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;margin-top:14px}
.viewtoggle button{border:none;background:var(--card);color:var(--soft);font:600 12.5px var(--font);padding:8px 18px;cursor:pointer;transition:all .2s}
.viewtoggle button.on{background:var(--navy);color:#fff}
/* shield ring */
.ringwrap{position:relative;width:clamp(240px,38vh,340px);height:clamp(240px,38vh,340px);margin:clamp(10px,2vh,18px) auto 0}
.ringwrap svg{position:absolute;inset:0;width:100%;height:100%}
.ring{stroke:var(--gold);stroke-width:1.5;fill:none;opacity:.5;stroke-dasharray:1200;stroke-dashoffset:1200}
.sec.on .ring{animation:draw2 2s ease-out .3s forwards}
.ringcenter{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.ringcenter .rc0{font-family:var(--serif);font-weight:700;font-size:clamp(40px,7vh,64px);color:var(--green);line-height:1}
.ringcenter .rcl{font-size:clamp(10px,1.2vh,13px);color:var(--soft);font-weight:600;max-width:150px;text-align:center;margin-top:4px}
.orbit{position:absolute;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 13px;box-shadow:0 8px 20px rgba(28,42,68,.1);opacity:0;transform:scale(.7)}
.sec.on .orbit{animation:pop .5s cubic-bezier(.34,1.5,.64,1) forwards;animation-delay:calc(1s + var(--i)*.18s)}
@keyframes pop{to{opacity:1;transform:scale(1)}}
.orbit .ov{font-family:var(--serif);font-weight:700;font-size:clamp(15px,1.8vh,20px);color:var(--navy)}
.orbit .ol{font-size:clamp(9px,1.05vh,11px);color:var(--faint)}
.o-t{top:-6px;left:50%;transform:translateX(-50%) scale(.7)}
.sec.on .o-t{animation-name:popt}@keyframes popt{to{opacity:1;transform:translateX(-50%) scale(1)}}
.o-r{right:-64px;top:38%}.o-l{left:-64px;top:38%}.o-b{bottom:-4px;left:50%;transform:translateX(-50%) scale(.7)}
.sec.on .o-b{animation-name:popt}
/* refined bars (account value) */
.bars{position:relative;display:flex;align-items:flex-end;justify-content:center;gap:clamp(26px,5vw,64px);height:clamp(170px,32vh,290px);margin:clamp(12px,2.4vh,24px) auto 0;max-width:760px;border-bottom:1px solid #d9d4c2;padding-bottom:2px}
.bars .grid{position:absolute;left:0;right:0;border-top:1px dashed #e6e1d0}
.col{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;z-index:1}
.col .val{font-family:var(--serif);font-weight:700;font-size:clamp(15px,1.9vw,23px);color:var(--navy);margin-bottom:8px;font-variant-numeric:tabular-nums}
.col .bar{width:clamp(66px,9vw,116px);border-radius:6px 6px 0 0;height:0;transition:height 1.1s cubic-bezier(.22,1.2,.36,1)}
.col .bar.b1{background:linear-gradient(180deg,#33456b,var(--navy))}
.col .bar.b2{background:linear-gradient(180deg,var(--gold-l),var(--gold))}
.col .lbl{font-size:clamp(11px,1.15vw,14px);color:var(--soft);font-weight:600;margin-top:9px}
/* feature cards */
.feat{display:grid;grid-template-columns:repeat(2,minmax(220px,330px));gap:12px;justify-content:center;margin-top:clamp(12px,2vh,20px)}
.fcard{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 18px;text-align:left;box-shadow:0 6px 18px rgba(28,42,68,.05)}
.fcard .ft{font-weight:700;font-size:clamp(12.5px,1.35vw,15.5px);margin-bottom:3px}
.fcard .fd{font-size:clamp(11px,1.15vw,13px);color:var(--soft);line-height:1.45}
.chips{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:clamp(12px,2.2vh,22px)}
.chip{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 18px;text-align:left;box-shadow:0 6px 18px rgba(28,42,68,.06)}
.chip .cv{font-family:var(--serif);font-weight:700;font-size:clamp(15px,1.9vw,22px);color:var(--navy)}
.chip .cl{font-size:clamp(10px,1.05vw,12px);color:var(--faint);margin-top:2px}
/* presenter */
.advisor{display:inline-flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:8px 22px 8px 8px;box-shadow:0 8px 22px rgba(28,42,68,.08);margin-top:18px;text-align:left}
.advisor img{width:46px;height:46px;border-radius:50%;object-fit:cover;border:2px solid var(--gold-f)}
.advisor .an{font-family:var(--serif);font-weight:700;font-size:clamp(13px,1.4vw,16px);color:var(--navy)}
.advisor .at{font-size:clamp(10px,1.05vw,12px);color:var(--faint)}
.advcard{display:inline-flex;align-items:center;gap:20px;background:var(--card);border:1px solid var(--gold-f);border-radius:16px;padding:18px 30px 18px 18px;box-shadow:0 16px 40px rgba(28,42,68,.12);margin-top:clamp(12px,2.4vh,22px);text-align:left}
.advcard img{width:clamp(72px,10vh,96px);height:clamp(72px,10vh,96px);border-radius:14px;object-fit:cover;border:2px solid var(--gold-f)}
.advcard .an{font-family:var(--serif);font-weight:700;font-size:clamp(17px,2vw,23px);color:var(--navy)}
.advcard .at{font-size:clamp(11px,1.15vw,13px);color:var(--gold);font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin:2px 0 8px}
.advcard .ac{font-size:clamp(12px,1.3vw,15px);color:var(--soft);line-height:1.6}
.advcard .ac b{color:var(--navy)}
/* chrome */
#comply{position:fixed;bottom:60px;left:50%;transform:translateX(-50%);z-index:45;font-size:clamp(9px,.95vw,11px);color:var(--faint);text-align:center;max-width:78vw}
#bar{position:fixed;left:0;top:0;height:3px;background:var(--gold);width:0;z-index:40;transition:width .3s ease}
#nav{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;z-index:50;background:rgba(255,253,247,.95);border:1px solid var(--line);border-radius:999px;padding:6px 10px;box-shadow:0 8px 24px rgba(28,42,68,.12)}
#nav button{background:#efebdd;border:none;color:var(--ink);font:inherit;font-weight:700;font-size:13px;height:32px;border-radius:16px;cursor:pointer;transition:all .18s;padding:0 14px}
#nav button.icon{width:32px;padding:0}#nav button:hover{background:var(--navy);color:#fff}
#dots{display:flex;gap:5px;margin:0 4px}#dots i{width:7px;height:7px;border-radius:50%;background:rgba(28,42,68,.18);cursor:pointer;transition:all .2s}#dots i.on{background:var(--gold);transform:scale(1.3)}
#nav .lab{font-size:11px;color:var(--faint);padding:0 6px;min-width:52px;text-align:center}
.cornerhead{position:fixed;top:24px;left:32px;z-index:40;font-family:var(--serif);font-weight:700;font-size:15px;color:var(--navy)}
.cornerhead .sm{color:var(--faint);font-family:var(--font);font-weight:400;font-size:11px;display:block}
</style></head><body>
<div id="glow"></div>
<svg id="grain" width="100%" height="100%"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>
<div id="vignette"></div><div id="frame"></div>
<span class="corner c-tl"></span><span class="corner c-tr"></span><span class="corner c-bl"></span><span class="corner c-br"></span>
<div id="bar"></div>
<div class="cornerhead">Retirement Income Summary<span class="sm">Prepared by ${PRESENTER.name} for ${D.client}</span></div>
<div id="comply">A summary of your personal illustration. Values are illustrative — refer to your full illustration for complete details, guarantees, and disclosures. Consult your advisor.</div>
<div id="app"></div>
<div id="nav"><button class="icon" id="prev">‹</button><span class="lab" id="lab"></span><button id="next">Next ›</button><div id="dots"></div><button id="voice">🔊 Voice on</button></div>
<script>
const VO=${JSON.stringify(VO)};
const SLIDES=[
 {html:\`<div class="wrap">
   ${rosette(220, 7, 'rosette rose-hero')}
   <div class="kick"><span class="rule"></span>PREPARED FOR ${D.client.toUpperCase()}<span class="rule r"></span></div>
   <h1>Your Retirement<br>Income Plan<span class="g">.</span></h1>
   <div class="lead">A guided walkthrough of your personal illustration — how your rollover is designed to grow, protect, and pay you for life. Click Next to begin.</div>
   <div class="advisor">${HEADSHOT ? `<img src="${HEADSHOT}" alt="">` : ''}<span><span class="an">${PRESENTER.name}</span><br><span class="at">${PRESENTER.title}</span></span></div>
  </div>\`},
 {html:\`<div class="wrap">
   <div class="kick"><span class="rule"></span>WHERE YOU START · AGE ${D.age}<span class="rule r"></span></div>
   <div class="big" data-count="${D.premium}">$0</div>
   <div class="tagline">your 401(k) rollover — the single premium that funds everything that follows</div>
   <div class="chips"><div class="chip"><div class="cv">One premium</div><div class="cl">no further contributions required</div></div><div class="chip"><div class="cv">${D.years} years</div><div class="cl">of growth before income begins</div></div></div>
  </div>\`},
 {html:\`<div class="wrap">
   <span class="gbadge guar">✓ GUARANTEED</span>
   <h1 style="font-size:clamp(19px,2.7vw,32px)">Your income base climbs <span class="g">${D.rollupPct}.0% simple</span> — every year for ${D.years} years.</h1>
   <div class="curvebox"><svg viewBox="0 0 ${CW} ${CH}">
     <defs><linearGradient id="goldfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(201,168,76,.35)"/><stop offset="100%" stop-color="rgba(201,168,76,.02)"/></linearGradient></defs>
     ${[0.25, 0.5, 0.75].map((f) => `<line class="gridline" x1="${PX}" x2="${CW - PX}" y1="${(PT + f * (CH - PT - PB)).toFixed(0)}" y2="${(PT + f * (CH - PT - PB)).toFixed(0)}"/>`).join('')}
     <line class="axis" x1="${PX}" x2="${CW - PX}" y1="${CH - PB}" y2="${CH - PB}"/>
     ${curvePts.map((p, i) => `<text class="agelbl" x="${X(i).toFixed(0)}" y="${CH - PB + 26}" text-anchor="middle">${i === 0 ? 'Age ' + p.age : p.age}</text>`).join('')}
     <path class="curve-area" d="${areaPath}"/>
     <path class="curve-line" d="${linePath}"/>
     <text class="startlbl" x="${X(0).toFixed(0)}" y="${(Y(D.premium) - 16).toFixed(0)}" text-anchor="start">${fmt(D.premium)}</text>
     <circle class="enddot" cx="${X(D.years).toFixed(1)}" cy="${Y(D.incomeBase68).toFixed(1)}" r="7"/>
     <text class="endlbl" x="${(X(D.years) - 12).toFixed(0)}" y="${(Y(D.incomeBase68) - 18).toFixed(0)}" text-anchor="end">${fmt(D.incomeBase68)}</text>
     <text class="endtag" x="${(X(D.years) - 12).toFixed(0)}" y="${(Y(D.incomeBase68) + 4).toFixed(0)}" text-anchor="end">PROJECTED INCOME BASE</text>
   </svg></div>
   <div class="tagline">the guaranteed roll-up credited to your income base during deferral</div>
  </div>\`},
 {html:\`<div class="wrap">
   <span class="gbadge guar">✓ GUARANTEED · CANNOT BE OUTLIVED</span>
   <div class="big" id="incomeBig" data-count="${D.income}">$0<span class="u">/yr</span></div>
   <div class="tagline">beginning at age ${D.incomeAge} — a ${D.payout} payout on your income base, for life</div>
   <div class="viewtoggle"><button class="on" id="vt-y">Annual</button><button id="vt-m">Monthly</button></div>
   <div class="paystack">${Array.from({ length: 12 }, (_, i) => `<div class="pay" style="--i:${i}"><div class="pv">${fmt(monthly)}</div><div class="pl">${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i]}</div></div>`).join('')}</div>
   <div class="tagline" style="margin-top:8px">twelve paychecks a year — every year, for as long as you live</div>
  </div>\`},
 {html:\`<div class="wrap">
   <span class="gbadge hypo">HYPOTHETICAL · NON-GUARANTEED</span>
   <h1 style="font-size:clamp(19px,2.7vw,32px)">What your <span class="g">account value</span> could look like.</h1>
   <div class="bars">
     ${[0.25, 0.5, 0.75].map((f) => `<div class="grid" style="bottom:${f * 100}%"></div>`).join('')}
     ${D.accum.map(([l, v], i) => `<div class="col"><div class="val" data-count="${v}">$0</div><div class="bar ${i === 0 ? 'b1' : 'b2'}" data-h="${(v / (D.accum[2][1] * 1.06) * 100).toFixed(1)}"></div><div class="lbl">${l}</div></div>`).join('')}
   </div>
   <div class="tagline">illustrated values only — actual results depend on index performance</div>
  </div>\`},
 {html:\`<div class="wrap">
   <div class="kick"><span class="rule"></span>HOW YOUR MONEY IS PROTECTED<span class="rule r"></span></div>
   <h1 style="font-size:clamp(19px,2.6vw,30px)">Growth potential, with a <span class="g">floor under it.</span></h1>
   <div class="ringwrap">
     <svg viewBox="0 0 340 340"><circle class="ring" cx="170" cy="170" r="128"/><circle class="ring" cx="170" cy="170" r="118" style="opacity:.25"/></svg>
     <div class="ringcenter"><div class="rc0">${D.floor}</div><div class="rcl">floor — principal protected in down markets</div></div>
     <div class="orbit o-t" style="--i:0"><div class="ov">${D.cap}</div><div class="ol">annual cap</div></div>
     <div class="orbit o-r" style="--i:1"><div class="ov">${D.part}</div><div class="ol">participation</div></div>
     <div class="orbit o-l" style="--i:2"><div class="ov">${D.surrender}</div><div class="ol">surrender period</div></div>
     <div class="orbit o-b" style="--i:3"><div class="ov">Riders</div><div class="ol">death benefit · care waiver</div></div>
   </div>
   <div class="tagline" style="margin-top:10px">optional enhanced death benefit · nursing home &amp; terminal illness waiver — details in your full illustration</div>
  </div>\`},
 {html:\`<div class="wrap">
   ${rosette(150, 6, 'rosette rose-hero')}
   <div class="kick"><span class="rule"></span>IMPORTANT NOTES<span class="rule r"></span></div>
   <h1 style="font-size:clamp(21px,2.9vw,36px)">Review the full illustration<span class="g">.</span></h1>
   <div class="lead">This summary is illustrative and not a guarantee of future results. Your complete personal illustration — attached below — contains the full guarantees, assumptions, and disclosures. I'm the right person for every question.</div>
   <div class="advcard">${HEADSHOT ? `<img src="${HEADSHOT}" alt="">` : ''}<span><span class="an">${PRESENTER.name}</span><div class="at">${PRESENTER.title}</div><div class="ac"><b>📞 ${PRESENTER.phone}</b><br>✉️ ${PRESENTER.email}</div></span></div>
   <div class="chips"><div class="chip"><div class="cv">📎 Your full illustration</div><div class="cl">the governing document — always refer to it</div></div></div>
  </div>\`},
];
const app=document.getElementById('app');
SLIDES.forEach(s=>{const d=document.createElement('div');d.className='sec';d.innerHTML=s.html;app.appendChild(d);});
const secs=[...document.querySelectorAll('.sec')];
const dots=document.getElementById('dots');SLIDES.forEach((s,i)=>{const b=document.createElement('i');b.onclick=()=>go(i);dots.appendChild(b);});
const dotEls=[...dots.children],bar=document.getElementById('bar'),lab=document.getElementById('lab');
let cur=-1;

/* income toggle: annual ⇄ monthly — arithmetic on the illustration's figure */
const INCOME=${D.income}, MONTHLY=${monthly};
let incomeMode='y';
function setIncomeMode(m){
  incomeMode=m;
  document.getElementById('vt-y').classList.toggle('on',m==='y');
  document.getElementById('vt-m').classList.toggle('on',m==='m');
  const el=document.getElementById('incomeBig');
  countTo(el,m==='y'?INCOME:MONTHLY,m==='y'?'/yr':'/mo');
}
function countTo(el,to,unit){
  let s=null;const step=(ts)=>{if(!s)s=ts;const p=Math.min((ts-s)/900,1);const e=1-Math.pow(1-p,3);
    el.innerHTML='$'+(to%1&&p===1?to.toLocaleString('en-US',{minimumFractionDigits:2}):Math.round(to*e).toLocaleString('en-US'))+'<span class="u">'+unit+'</span>';
    if(p<1)requestAnimationFrame(step);};
  requestAnimationFrame(step);
}
function animate(sec){
  requestAnimationFrame(()=>{requestAnimationFrame(()=>{
    sec.querySelectorAll('.bar[data-h]').forEach(el=>{el.style.height=el.dataset.h+'%';});
    sec.querySelectorAll('[data-count]').forEach(el=>{
      const to=+el.dataset.count;const unit=el.querySelector('.u');const uHtml=unit?unit.outerHTML:'';
      let s=null;const step=(ts)=>{if(!s)s=ts;const p=Math.min((ts-s)/1200,1);const e=1-Math.pow(1-p,3);
        el.innerHTML='$'+Math.round(to*e).toLocaleString('en-US')+uHtml;if(p<1)requestAnimationFrame(step);};
      requestAnimationFrame(step);
    });
  });});
}
/* voice: the advisor walkthrough (Rachel), toggleable, plays per slide */
let voiceOn=true,voAudio=null;
const voiceBtn=document.getElementById('voice');
function voStop(){if(voAudio){voAudio.pause();voAudio=null;}}
function voPlay(){voStop();if(!voiceOn)return;const b64=VO[cur];if(!b64)return;
  voAudio=new Audio('data:audio/mpeg;base64,'+b64);voAudio.play().catch(()=>{});}
voiceBtn.onclick=()=>{voiceOn=!voiceOn;voiceBtn.textContent=voiceOn?'🔊 Voice on':'🔇 Voice off';if(voiceOn)voPlay();else voStop();};

function go(i){
  if(i<0)i=0;if(i>=secs.length)i=secs.length-1;cur=i;
  secs.forEach(s=>{s.classList.remove('on');s.querySelectorAll('.bar[data-h]').forEach(el=>el.style.height='0');});
  dotEls.forEach(d=>d.classList.remove('on'));
  secs[i].classList.add('on');dotEls[i].classList.add('on');
  lab.textContent=(i+1)+' / '+secs.length;
  bar.style.width=(i/(secs.length-1)*100)+'%';
  document.getElementById('next').textContent=(i===secs.length-1?'Restart ↻':'Next ›');
  if(i===3){document.getElementById('vt-y').onclick=()=>setIncomeMode('y');document.getElementById('vt-m').onclick=()=>setIncomeMode('m');incomeMode='y';document.getElementById('vt-y').classList.add('on');document.getElementById('vt-m').classList.remove('on');}
  animate(secs[i]);
  voPlay();
}
/* ── RECORD MODE (?record=1): the MP4 export path. Hides every player
   control, disables in-page audio, and exposes startShow(durationsMs) —
   the exporter drives slide timing and muxes the narration in post. ── */
const RP=new URLSearchParams(location.search);
if(RP.get('record')==='1'){
  document.getElementById('nav').style.display='none';
  voiceOn=false;
  document.body.style.pointerEvents='none';
  window.startShow=(durs)=>{go(0);let t=0;for(let i=1;i<durs.length&&i<secs.length;i++){t+=durs[i-1];setTimeout(((k)=>()=>go(k))(i),t);}};
}
document.getElementById('next').onclick=()=>{if(cur>=secs.length-1)go(0);else go(cur+1);};
document.getElementById('prev').onclick=()=>go(cur-1);
document.addEventListener('keydown',e=>{
  if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();if(cur>=secs.length-1)go(0);else go(cur+1);}
  if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();go(cur-1);}
});
go(0);
</script></body></html>`

writeFileSync(OUT, HTML)
// VO manifest for the MP4 exporter: clip file + measured duration per slide.
try {
  const { execFileSync } = await import('child_process')
  const clips = NARRATION.map((line) => {
    const key = createHash('md5').update(line).digest('hex')
    const file = join(VO_CACHE, `${key}.mp3`)
    const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim())
    return { file, durMs: Math.round(dur * 1000) }
  })
  writeFileSync(join(HERE, '..', 'out', 'annuity-vo-manifest.json'), JSON.stringify({ clips }, null, 2))
  console.log('[annuity v2] manifest:', clips.map((c) => (c.durMs / 1000).toFixed(1) + 's').join(' '))
} catch (e) { console.log('[annuity v2] manifest skipped:', String(e.message).slice(0, 60)) }
console.log('[annuity v2] wrote', OUT, '(' + Math.round(Buffer.byteLength(HTML) / 1024) + ' KB,', VO.filter(Boolean).length + '/' + NARRATION.length, 'VO clips)')
