// "AI in Medicine" — 12 FULL-PAGE infographics.
//
// Not the split template. Every page is its own edge-to-edge composition with
// data visualisation drawn in code (rings, dot grids, funnels, timelines,
// flows), full-bleed colour fields, and typography set into the layout rather
// than stacked in a left column. No two pages share a layout.
//
// Art is used as a full-bleed or large integrated element, never a rounded
// card. All text/numbers are code-rendered — Gemini never draws a glyph.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ILLOS = join(HERE, '..', '.aimed-illos')
const VO = join(HERE, '..', '.aimed-vo')
const OUT = join(HERE, '..', 'out')
mkdirSync(OUT, { recursive: true })

const A = process.env.ACCENT || '#0E7C7B'   // accent
const A2 = '#14A08E'                         // accent light
const INK = '#12202A'
const PAPER = '#F7F6F2'

const img = (f) => {
  const p = join(ILLOS, `${f}.png`)
  return existsSync(p) ? 'data:image/png;base64,' + readFileSync(p).toString('base64') : ''
}
// Slides only by default. WITH_AUDIO=1 inlines the narration clips (and roughly
// triples the file size), which is why it is opt-in rather than automatic.
const WITH_AUDIO = process.env.WITH_AUDIO === '1'
const audio = (i) => {
  if (!WITH_AUDIO) return ''
  const p = join(VO, `${String(i).padStart(2, '0')}.mp3`)
  return existsSync(p) ? 'data:audio/mpeg;base64,' + readFileSync(p).toString('base64') : ''
}

// ── Chart primitives, drawn as inline SVG ─────────────────────────────────

/** Donut with the value written through the middle. */
const ring = (pct, label, size = 190, stroke = 18) => {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  return `<svg class="ring" viewBox="0 0 ${size} ${size}" style="width:${size}px;height:${size}px">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(18,32,42,.09)" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${A}" stroke-width="${stroke}"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c}"
      style="--dash:${c};--off:${c * (1 - pct / 100)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="50%" text-anchor="middle" dy=".08em" class="rt">${label}</text>
  </svg>`
}

/** 10×10 dot grid — n filled. The clearest way to show a small proportion. */
const dots = (n, total = 100, cols = 10) => {
  let s = ''
  for (let i = 0; i < total; i++) {
    const x = (i % cols) * 30 + 15, y = Math.floor(i / cols) * 30 + 15
    s += `<circle cx="${x}" cy="${y}" r="9" class="${i < n ? 'don' : 'doff'}" style="--d:${i * 8}ms"/>`
  }
  return `<svg class="dotgrid" viewBox="0 0 ${cols * 30} ${Math.ceil(total / cols) * 30}">${s}</svg>`
}

/** Horizontal bar with the figure inline. */
const bar = (pct, label, value) =>
  `<div class="barrow"><div class="bl">${label}</div>
    <div class="btrack"><div class="bfill" style="--w:${pct}%"></div></div>
    <div class="bv">${value}</div></div>`

/** Numbered stage in a left-to-right flow. */
const stage = (n, title, body) =>
  `<div class="stage"><div class="sn">${n}</div><div class="st">${title}</div><div class="sb">${body}</div></div>`

// ── The 12 pages ──────────────────────────────────────────────────────────
// Each returns full-page markup. `cls` sets the page's colour treatment.

const PAGES = [
  // 01 — COVER. Full-bleed art off the right edge, title set large into the
  // left, a data ticker across the bottom so the cover already reads as data.
  {
    cls: 'p-cover', vo: 0,
    html: `
      <div class="cbg" style="background-image:url('${img('cover')}')"></div>
      <div class="cveil"></div>
      <div class="cinner">
        <div class="ceyebrow">A field briefing · 2026</div>
        <h1 class="ctitle">AI in<br><em>Medicine</em></h1>
        <p class="clead">What works, what doesn't, and what it takes<br>to adopt it safely.</p>
        <div class="cby">
          <span class="cav">TD</span>
          <span><b>Trent Daniel</b><small>PrismGraphs · trent@prismgraphs.com</small></span>
        </div>
      </div>
      <div class="cticker">
        <div><b>1,000+</b><span>cleared devices</span></div>
        <div><b>66%</b><span>physicians using AI</span></div>
        <div><b>&lt;5%</b><span>models reaching patients</span></div>
        <div><b>1 hr/day</b><span>clinician time returned</span></div>
      </div>`,
  },

  // 02 — Three giant figures across the full width, each on its own ring.
  {
    cls: 'p-light', vo: 1,
    html: `
      <div class="phead"><span class="pnum">01</span><h2>It already left the lab</h2>
        <p>Adoption is broad but shallow — most of it is documentation, not diagnosis.</p></div>
      <div class="triptych">
        <div class="tcell"><div class="tfig">1,000<span>+</span></div>${ring(74, '74%', 150, 15)}
          <div class="tlab">FDA-cleared AI devices</div><div class="tsub">Three quarters are radiology</div></div>
        <div class="tcell hi"><div class="tfig">66<span>%</span></div>${ring(66, '2 in 3', 150, 15)}
          <div class="tlab">Physicians using AI</div><div class="tsub">Up from 38% a year earlier</div></div>
        <div class="tcell"><div class="tfig">3<span>×</span></div>${ring(100, '12 mo', 150, 15)}
          <div class="tlab">Growth in one year</div><div class="tsub">Fastest in documentation tools</div></div>
      </div>`,
  },

  // 03 — Full-width horizontal flow diagram.
  {
    cls: 'p-ink', vo: 2,
    html: `
      <div class="phead inv"><span class="pnum">02</span><h2>Three steps, every time</h2>
        <p>Underneath the branding, every clinical model does the same three things.</p></div>
      <div class="flow">
        ${stage('01', 'Learn', 'Patterns extracted from millions of prior records and images.')}
        <div class="farrow"></div>
        ${stage('02', 'Score', 'A new patient measured against those patterns.')}
        <div class="farrow"></div>
        ${stage('03', 'Surface', 'A ranked suggestion handed to a clinician — never an order.')}
      </div>
      <div class="floop"><span>The arrow always points back to a person</span></div>
      <div class="fkicker">The model proposes. The clinician disposes.</div>`,
  },

  // 04 — Half-page solid accent field with the hero figure; art bleeds right.
  {
    cls: 'p-split', vo: 3,
    html: `
      <div class="sleft">
        <span class="pnum inv">03</span>
        <div class="shero">20<span>%</span></div>
        <div class="sheroL">more cancers detected</div>
        <div class="sbars">
          ${bar(100, 'AI-supported reading', '+20%')}
          ${bar(56, 'Reading workload', '−44%')}
          ${bar(80, 'Trial population', '80k')}
        </div>
        <p class="snote">Screening mammography — where volume is high and the signal is subtle. It flags attention; the radiologist still makes the call.</p>
      </div>
      <div class="sright" style="background-image:url('${img('imaging')}')">
        <div class="stag">Imaging · strongest evidence</div>
      </div>`,
  },

  // 05 — Full-width timeline with a divergence.
  {
    cls: 'p-light', vo: 4,
    html: `
      <div class="phead"><span class="pnum">04</span><h2>Buying back hours</h2>
        <p>Risk models running quietly against the chart surface deterioration before it would be noticed.</p></div>
      <div class="tl">
        <div class="tlaxis"></div>
        <div class="tlpath a"><span class="tlp"></span><b>Model flags risk</b><small>T − 6 hrs</small></div>
        <div class="tlpath b"><span class="tlp"></span><b>Noticed clinically</b><small>T</small></div>
        <div class="tlband"><span>6 hours of runway</span></div>
      </div>
      <div class="duo">
        <div class="dcell"><div class="dfig">6<span> hrs</span></div><div class="dlab">Typical early warning</div></div>
        <div class="dcell"><div class="dfig">18<span>%</span></div><div class="dlab">Lower sepsis mortality</div></div>
        <div class="dnote">Value comes from earlier action, not a more accurate label. A warning nobody routes to a human is a warning that did nothing.</div>
      </div>`,
  },

  // 06 — Art bleeds left; figures stack right against a tinted field.
  {
    cls: 'p-splitR', vo: 5,
    html: `
      <div class="sright bleedL" style="background-image:url('${img('discovery')}')"></div>
      <div class="sleft tint">
        <span class="pnum">05</span>
        <h2 class="sh">Narrowing the search</h2>
        <div class="stack">
          <div class="srow"><b>200M<span>+</span></b><span>protein structures predicted</span></div>
          <div class="srow"><b>~30<span> mo</span></b><span>discovery to first trial</span></div>
        </div>
        <p class="snote">It shrinks the candidate space; it does not shorten the trial. Clinical validation remains the long, expensive, unavoidable part.</p>
      </div>`,
  },

  // 07 — One dominant figure + a 24-block day grid.
  {
    cls: 'p-accent', vo: 6,
    html: `
      <span class="pnum inv abs">06</span>
      <div class="bigwrap">
        <div class="bigfig">1<span> hr</span></div>
        <div class="bigsub">returned to the clinician, every day</div>
        <div class="daygrid">${Array.from({ length: 24 }, (_, i) =>
          `<i class="${i >= 17 && i < 18 ? 'on' : ''}" style="--d:${i * 30}ms"></i>`).join('')}</div>
        <div class="daylab">one hour of a 24-hour day, back in the room with the patient</div>
      </div>
      <div class="bigside">
        <div class="bs"><b>−30%</b><span>burnout scores</span></div>
        <div class="bs"><b>0</b><span>clinical decisions touched</span></div>
        <div class="bsnote">The quietest success is the biggest. It fixes the keyboard, not the medicine — which is the point.</div>
      </div>`,
  },

  // 08 — Funnel drawn in code.
  {
    cls: 'p-light', vo: 7,
    html: `
      <div class="phead"><span class="pnum">07</span><h2>Sorting the queue</h2>
        <p>Where AI touches the most patients and draws the least attention.</p></div>
      <div class="funnel">
        <div class="fq">${Array.from({ length: 18 }, (_, i) => `<i style="--d:${i * 45}ms"></i>`).join('')}</div>
        <div class="fgate"><span>triage</span></div>
        <div class="flanes">
          <div class="lane l1"><b>Critical</b><span>read first</span></div>
          <div class="lane l2"><b>Routine</b><span>scheduled</span></div>
          <div class="lane l3"><b>Deferred</b><span>batched</span></div>
        </div>
      </div>
      <div class="fkicker light">Unglamorous, high-volume, and consistently profitable.</div>`,
  },

  // 09 — The dot grid. The hardest number in the deck, shown plainly.
  {
    cls: 'p-ink', vo: 8,
    html: `
      <div class="dgwrap">
        <div class="dgleft">
          <span class="pnum inv">08</span>
          <h2 class="dgh">Most models never<br>reach a patient</h2>
          <div class="dgstat"><b>&lt;5<span>%</span></b><span>reach clinical use</span></div>
          <div class="dgstat sm"><b>2<span>%</span></b><span>externally validated</span></div>
          <p class="dgnote">The failure is rarely the math. A model trained in one health system quietly degrades in the next. Ask for external validation — not the internal test set.</p>
        </div>
        <div class="dgright">
          ${dots(5)}
          <div class="dgcap"><span class="key on"></span> reached a patient &nbsp;&nbsp; <span class="key"></span> did not</div>
        </div>
      </div>`,
  },

  // 10 — Three-panel band, each panel its own colour field.
  {
    cls: 'p-band', vo: 9,
    html: `
      <div class="phead"><span class="pnum">09</span><h2>Three ways it fails</h2></div>
      <div class="bands">
        <div class="band b1"><div class="bicon">◐</div><h3>Bias</h3>
          <p>A model trained on one population underserves another. The gap is invisible in aggregate accuracy.</p></div>
        <div class="band b2"><div class="bicon">◆</div><h3>Confident error</h3>
          <p>Fluent, well-formatted, and wrong. Confidence is not a measure of accuracy.</p></div>
        <div class="band b3"><div class="bicon">⬡</div><h3>Accountability</h3>
          <p>When a model contributes to harm, the liability question has no settled answer yet.</p></div>
      </div>`,
  },

  // 11 — Full-width checkpoint bar.
  {
    cls: 'p-light', vo: 10,
    html: `
      <div class="phead"><span class="pnum">10</span><h2>What good adoption looks like</h2>
        <p>The organisations doing this well are boring about it.</p></div>
      <div class="checks">
        <div class="ctrack2"></div>
        ${[
          ['Start low-stakes', 'Documentation before diagnosis — where a mistake is recoverable.'],
          ['Human sign-off', 'A clinician approves anything that touches care.'],
          ['Monitor for drift', 'Models decay as your population changes. Watch after go-live.'],
          ['Be able to explain', 'Any decision, to the patient it affected.'],
        ].map(([t, b], i) => `<div class="chk" style="--d:${i * 160}ms">
          <span class="cdot">${i + 1}</span><b>${t}</b><small>${b}</small></div>`).join('')}
      </div>`,
  },

  // 12 — BACK COVER. Contact block on a full field, art bleeding right.
  {
    cls: 'p-back', vo: 11,
    html: `
      <div class="cbg back" style="background-image:url('${img('close')}')"></div>
      <div class="cveil back"></div>
      <div class="binner">
        <div class="ceyebrow">Thank you</div>
        <h1 class="btitle">Let's talk<br>it through.</h1>
        <div class="bcard">
          <span class="cav lg">TD</span>
          <div><b>Trent Daniel</b><small>PrismGraphs</small></div>
        </div>
        <div class="bcontact">
          <div><span>Phone</span><b>1-555-014-2200</b></div>
          <div><span>Email</span><b>trent@prismgraphs.com</b></div>
          <div><span>Web</span><b>prismgraphs.com</b></div>
        </div>
        <div class="bmark">PRISMGRAPHS</div>
      </div>`,
  },
]

const clips = PAGES.map((p) => audio(p.vo))

// ── Document ──────────────────────────────────────────────────────────────
const css = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;overflow:hidden;background:${INK}}
body{font-family:'Inter',ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:${INK};-webkit-font-smoothing:antialiased}
.page{position:fixed;inset:0;opacity:0;pointer-events:none;transition:opacity .5s ease;display:flex;flex-direction:column;overflow:hidden}
.page.on{opacity:1;pointer-events:auto}
.p-light,.p-band,.p-split,.p-splitR{background:${PAPER}}
.p-ink{background:${INK};color:#EAF2F0}
.p-accent{background:linear-gradient(135deg,${A} 0%,#0a5d5c 100%);color:#fff}

/* page header */
.phead{padding:clamp(28px,4.2vh,48px) clamp(46px,5vw,86px) 0;flex:none}
.phead h2{font-size:clamp(30px,4.1vw,54px);font-weight:700;letter-spacing:-.03em;line-height:1.04;margin-top:10px}
.phead p{margin-top:12px;font-size:clamp(13px,1.25vw,16.5px);color:rgba(18,32,42,.56);max-width:60ch;line-height:1.55}
.phead.inv p{color:rgba(234,242,240,.6)}
.pnum{display:inline-block;font-size:11.5px;font-weight:800;letter-spacing:.22em;color:${A};border-bottom:2px solid ${A};padding-bottom:5px}
.pnum.inv{color:${A2};border-color:${A2}}
.pnum.abs{position:absolute;top:clamp(34px,5vh,56px);left:clamp(46px,5vw,86px);z-index:3}

/* ring + shared chart bits */
.ring .rt{font:800 26px 'Inter',sans-serif;fill:${INK};letter-spacing:-.02em}
.p-ink .ring .rt{fill:#EAF2F0}
.page.on .ring circle:nth-child(2){animation:dash 1.1s .25s cubic-bezier(.2,.8,.2,1) forwards}
@keyframes dash{to{stroke-dashoffset:var(--off)}}

/* 02 triptych */
.triptych{flex:1;display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(14px,1.6vw,26px);padding:clamp(18px,2.6vh,30px) clamp(46px,5vw,86px) clamp(34px,4.6vh,56px)}
.tcell{background:#fff;border:1px solid rgba(18,32,42,.07);border-radius:10px;padding:clamp(20px,3vh,34px);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;box-shadow:0 12px 34px rgba(18,32,42,.05)}
.tcell.hi{background:${INK};color:#EAF2F0;border-color:transparent}
.tcell.hi .tsub{color:rgba(234,242,240,.5)}
.tfig{font-size:clamp(46px,6.2vw,80px);font-weight:800;letter-spacing:-.045em;line-height:1;color:${A}}
.tcell.hi .tfig{color:${A2}}
.tfig span{font-size:.5em;vertical-align:super;margin-left:2px}
.tcell .ring{margin:clamp(12px,2vh,20px) 0}
.tlab{font-size:clamp(13px,1.3vw,16px);font-weight:700;letter-spacing:-.01em}
.tsub{font-size:12px;color:rgba(18,32,42,.45);margin-top:5px}

/* 03 flow */
/* Panels stretch to fill the band — centring them leaves a dead strip above. */
.flow{flex:1;display:flex;align-items:stretch;gap:0;padding:clamp(10px,1.6vh,20px) clamp(46px,5vw,86px)}
.stage{flex:1;display:flex;flex-direction:column;justify-content:center;background:rgba(255,255,255,.055);border:1px solid rgba(234,242,240,.1);border-radius:10px;padding:clamp(26px,4.6vh,54px)}
.sn{font-size:11px;font-weight:800;letter-spacing:.2em;color:${A2}}
.st{font-size:clamp(20px,2.4vw,30px);font-weight:700;margin:10px 0 10px;letter-spacing:-.02em}
.sb{font-size:clamp(12.5px,1.2vw,15px);color:rgba(234,242,240,.62);line-height:1.55}
.farrow{align-self:center;width:clamp(30px,4vw,64px);height:2px;background:linear-gradient(90deg,${A2},rgba(20,160,142,.25));flex:none;position:relative}
.farrow::after{content:'';position:absolute;right:0;top:-4px;border-left:8px solid ${A2};border-top:5px solid transparent;border-bottom:5px solid transparent}
.floop{padding:clamp(14px,2vh,22px) clamp(46px,5vw,86px) 0;text-align:center}
.floop span{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:rgba(234,242,240,.42);border-top:1px dashed rgba(234,242,240,.22);padding-top:12px;display:inline-block}
.fkicker{padding:clamp(14px,2vh,22px) clamp(46px,5vw,86px) clamp(30px,4vh,46px);font-size:clamp(15px,1.7vw,21px);font-weight:600;color:${A2};text-align:center;letter-spacing:-.015em}
.fkicker.light{color:${A}}

/* 04 / 06 split */
.p-split,.p-splitR{flex-direction:row}
.sleft{width:52%;padding:clamp(40px,6vh,70px) clamp(38px,4vw,64px);display:flex;flex-direction:column;justify-content:center;background:${INK};color:#EAF2F0}
.sleft.tint{background:${PAPER};color:${INK};width:46%}
.p-splitR{flex-direction:row-reverse}
.sright{flex:1;background-size:cover;background-position:center;position:relative}
.sright::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(18,32,42,.5),transparent 45%)}
.bleedL::after{background:linear-gradient(270deg,rgba(247,246,242,.9),transparent 42%)}
.stag{position:absolute;left:clamp(20px,2.4vw,34px);bottom:clamp(20px,3vh,34px);z-index:2;background:rgba(255,255,255,.92);color:${INK};font-size:11.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;padding:9px 15px;border-radius:6px}
.shero{font-size:clamp(78px,11vw,150px);font-weight:800;letter-spacing:-.06em;line-height:.9;color:${A2};margin-top:18px}
.shero span{font-size:.42em;vertical-align:super}
.sheroL{font-size:clamp(15px,1.7vw,21px);font-weight:600;margin-top:6px;color:#EAF2F0}
.sbars{margin:clamp(22px,3.4vh,38px) 0}
.barrow{display:flex;align-items:center;gap:14px;margin-bottom:12px}
.bl{width:44%;font-size:12.5px;color:rgba(234,242,240,.62);flex:none}
.sleft.tint .bl{color:rgba(18,32,42,.55)}
.btrack{flex:1;height:9px;border-radius:5px;background:rgba(234,242,240,.13);overflow:hidden}
.sleft.tint .btrack{background:rgba(18,32,42,.08)}
.bfill{height:100%;width:0;border-radius:5px;background:linear-gradient(90deg,${A},${A2})}
.page.on .bfill{animation:grow .95s .3s cubic-bezier(.2,.8,.2,1) forwards}
@keyframes grow{to{width:var(--w)}}
.bv{width:62px;text-align:right;font-size:14.5px;font-weight:800;color:${A2};flex:none}
.snote{font-size:clamp(12.5px,1.2vw,15px);line-height:1.62;color:rgba(234,242,240,.6);max-width:46ch}
.sleft.tint .snote{color:rgba(18,32,42,.55)}
.sh{font-size:clamp(28px,3.6vw,46px);font-weight:700;letter-spacing:-.03em;line-height:1.06;margin:14px 0 clamp(18px,2.6vh,28px)}
.stack{margin-bottom:clamp(18px,2.6vh,28px)}
.srow{display:flex;align-items:baseline;gap:14px;padding:14px 0;border-bottom:1px solid rgba(18,32,42,.09)}
.srow b{font-size:clamp(30px,4vw,50px);font-weight:800;letter-spacing:-.04em;color:${A};line-height:1}
.srow b span{font-size:.44em;vertical-align:super}
.srow>span{font-size:13.5px;color:rgba(18,32,42,.55)}

/* 05 timeline */
.tl{position:relative;margin:clamp(24px,3.6vh,44px) clamp(46px,5vw,86px) 0;height:clamp(120px,17vh,168px);flex:none}
.tlaxis{position:absolute;left:0;right:0;top:50%;height:2px;background:rgba(18,32,42,.14)}
.tlpath{position:absolute;top:50%;transform:translateY(-50%);text-align:center}
.tlpath.a{left:22%}.tlpath.b{left:66%}
.tlp{display:block;width:16px;height:16px;border-radius:50%;background:${A};margin:0 auto 10px;box-shadow:0 0 0 6px rgba(14,124,123,.14)}
.tlpath.b .tlp{background:rgba(18,32,42,.3);box-shadow:0 0 0 6px rgba(18,32,42,.06)}
.tlpath b{display:block;font-size:14.5px;font-weight:700}
.tlpath small{font-size:11.5px;color:rgba(18,32,42,.45);letter-spacing:.08em}
.tlband{position:absolute;left:24%;width:43%;top:50%;transform:translateY(-50%);height:38px;border-radius:6px;background:rgba(14,124,123,.1);border:1px dashed rgba(14,124,123,.4);display:flex;align-items:center;justify-content:center}
.tlband span{font-size:11.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:${A}}
.duo{flex:1;display:grid;grid-template-columns:1fr 1fr 1.5fr;gap:clamp(16px,2vw,30px);align-items:center;padding:0 clamp(46px,5vw,86px) clamp(34px,4.6vh,56px)}
.dcell{background:#fff;border:1px solid rgba(18,32,42,.07);border-radius:10px;padding:clamp(18px,2.6vh,30px);box-shadow:0 12px 34px rgba(18,32,42,.05)}
.dfig{font-size:clamp(38px,5vw,66px);font-weight:800;letter-spacing:-.05em;color:${A};line-height:1}
.dfig span{font-size:.36em;vertical-align:super;letter-spacing:-.01em}
.dlab{font-size:13px;color:rgba(18,32,42,.55);margin-top:8px}
.dnote{font-size:clamp(12.5px,1.2vw,15px);line-height:1.62;color:rgba(18,32,42,.55)}

/* 07 dominant figure */
.p-accent{flex-direction:row;align-items:center;padding:0 clamp(46px,5vw,86px)}
.bigwrap{flex:1.35}
.bigfig{font-size:clamp(96px,14vw,200px);font-weight:800;letter-spacing:-.06em;line-height:.86}
.bigfig span{font-size:.34em;vertical-align:super;letter-spacing:-.02em}
.bigsub{font-size:clamp(16px,1.9vw,24px);font-weight:600;opacity:.9;margin-top:4px}
.daygrid{display:grid;grid-template-columns:repeat(24,1fr);gap:5px;margin:clamp(24px,3.4vh,40px) 0 12px;max-width:560px}
.daygrid i{height:34px;border-radius:3px;background:rgba(255,255,255,.17);opacity:0}
.page.on .daygrid i{animation:pop .4s var(--d) forwards}
.daygrid i.on{background:#fff}
@keyframes pop{to{opacity:1}}
.daylab{font-size:12.5px;opacity:.72;letter-spacing:.02em}
.bigside{flex:1;padding-left:clamp(30px,4vw,60px);border-left:1px solid rgba(255,255,255,.18)}
.bs{margin-bottom:clamp(20px,3vh,32px)}
.bs b{display:block;font-size:clamp(34px,4.4vw,58px);font-weight:800;letter-spacing:-.045em;line-height:1}
.bs span{font-size:13.5px;opacity:.78}
.bsnote{font-size:clamp(12.5px,1.2vw,15px);line-height:1.62;opacity:.82;border-top:1px solid rgba(255,255,255,.2);padding-top:18px}

/* 08 funnel */
.funnel{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(12px,2vh,22px);padding:0 clamp(46px,5vw,86px)}
.fq{display:grid;grid-template-columns:repeat(9,1fr);gap:9px;width:min(420px,42vw)}
.fq i{height:17px;border-radius:3px;background:${A};opacity:0}
.page.on .fq i{animation:pop .35s var(--d) forwards}
.fgate{width:min(300px,32vw);height:44px;background:${INK};color:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center}
.fgate span{font-size:11.5px;font-weight:800;letter-spacing:.2em;text-transform:uppercase}
.flanes{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(12px,1.6vw,22px);width:100%}
.lane{border-radius:10px;padding:clamp(16px,2.4vh,26px);text-align:center;border:1px solid rgba(18,32,42,.08);background:#fff}
.lane b{display:block;font-size:clamp(16px,1.9vw,22px);font-weight:700;letter-spacing:-.02em}
.lane span{font-size:12.5px;color:rgba(18,32,42,.5)}
.lane.l1{background:${A};color:#fff;border-color:transparent}
.lane.l1 span{color:rgba(255,255,255,.8)}
.lane.l2{background:rgba(14,124,123,.13)}
/* 09 dot grid */
.dgwrap{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:clamp(24px,3.4vw,58px);align-items:center;padding:clamp(28px,4.4vh,50px) clamp(46px,5vw,86px) clamp(30px,4vh,46px)}
.dgh{font-size:clamp(30px,4.1vw,54px);font-weight:700;letter-spacing:-.03em;line-height:1.04;margin:14px 0 clamp(18px,2.6vh,28px)}
.dgstat{display:flex;align-items:baseline;gap:14px;margin-bottom:12px}
.dgstat b{font-size:clamp(40px,5.4vw,72px);font-weight:800;letter-spacing:-.05em;color:${A2};line-height:1}
.dgstat.sm b{font-size:clamp(26px,3.2vw,42px);color:rgba(234,242,240,.62)}
.dgstat b span{font-size:.42em;vertical-align:super}
.dgstat>span{font-size:13.5px;color:rgba(234,242,240,.6)}
.dgnote{font-size:clamp(12.5px,1.2vw,15px);line-height:1.62;color:rgba(234,242,240,.58);margin-top:16px;max-width:48ch}
.dgright{display:flex;flex-direction:column;align-items:center;gap:18px}
.dotgrid{width:min(400px,38vw)}
.dotgrid .doff{fill:rgba(234,242,240,.13)}
.dotgrid .don{fill:${A2}}
.dotgrid circle{opacity:0}
.page.on .dotgrid circle{animation:pop .3s var(--d) forwards}
.dgcap{font-size:11.5px;color:rgba(234,242,240,.5);letter-spacing:.06em;display:flex;align-items:center;gap:7px}
.key{width:11px;height:11px;border-radius:50%;background:rgba(234,242,240,.13);display:inline-block}
.key.on{background:${A2}}

/* 10 bands */
.bands{flex:1;display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-top:clamp(22px,3.4vh,40px)}
.band{padding:clamp(34px,5vh,60px) clamp(26px,2.8vw,46px);display:flex;flex-direction:column;justify-content:center}
.band h3{font-size:clamp(21px,2.6vw,32px);font-weight:700;letter-spacing:-.025em;margin:14px 0 12px}
.band p{font-size:clamp(12.5px,1.2vw,15px);line-height:1.62}
.bicon{font-size:30px;line-height:1}
.b1{background:${INK};color:#EAF2F0}.b1 .bicon{color:${A2}}.b1 p{color:rgba(234,242,240,.62)}
.b2{background:${A};color:#fff}.b2 p{color:rgba(255,255,255,.84)}
.b3{background:#E8E4DA}.b3 .bicon{color:${A}}.b3 p{color:rgba(18,32,42,.6)}

/* 11 checkpoints */
.checks{flex:1;display:grid;grid-template-columns:repeat(4,1fr);gap:clamp(14px,1.8vw,28px);align-items:start;padding:clamp(40px,6vh,70px) clamp(46px,5vw,86px) clamp(34px,4.6vh,56px);position:relative}
.ctrack2{position:absolute;left:clamp(46px,5vw,86px);right:clamp(46px,5vw,86px);top:calc(clamp(40px,6vh,70px) + 21px);height:2px;background:rgba(18,32,42,.12)}
.chk{position:relative;opacity:0;animation:none}
.page.on .chk{animation:rise .55s var(--d) cubic-bezier(.2,.8,.2,1) forwards}
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.cdot{width:42px;height:42px;border-radius:50%;background:${A};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;position:relative;z-index:2}
.chk b{display:block;font-size:clamp(15px,1.7vw,20px);font-weight:700;letter-spacing:-.02em;margin:16px 0 8px}
.chk small{font-size:clamp(12px,1.15vw,14px);color:rgba(18,32,42,.55);line-height:1.55}

/* cover + back */
.p-cover,.p-back{background:${INK}}
.cbg{position:absolute;inset:0 0 0 40%;background-size:cover;background-position:center;opacity:.95}
.cbg.back{inset:0 0 0 52%}
.cveil{position:absolute;inset:0;background:linear-gradient(90deg,${INK} 34%,rgba(18,32,42,.86) 48%,rgba(18,32,42,.15) 78%)}
.cveil.back{background:linear-gradient(90deg,${INK} 46%,rgba(18,32,42,.8) 58%,rgba(18,32,42,.1) 84%)}
.cinner,.binner{position:relative;z-index:2;padding:clamp(48px,8vh,92px) clamp(46px,5vw,86px);display:flex;flex-direction:column;justify-content:center;height:100%;color:#EAF2F0;max-width:64%}
.ceyebrow{font-size:11.5px;font-weight:800;letter-spacing:.24em;text-transform:uppercase;color:${A2};margin-bottom:20px}
.ctitle{font-size:clamp(52px,8.4vw,116px);font-weight:800;letter-spacing:-.055em;line-height:.92}
.ctitle em{font-style:normal;color:${A2}}
.clead{margin-top:20px;font-size:clamp(14px,1.6vw,20px);line-height:1.55;color:rgba(234,242,240,.68)}
.cby{display:flex;align-items:center;gap:14px;margin-top:clamp(26px,4vh,44px)}
.cav{width:48px;height:48px;border-radius:50%;background:rgba(20,160,142,.18);color:${A2};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;border:1px solid rgba(20,160,142,.4);flex:none}
.cav.lg{width:58px;height:58px;font-size:18px}
.cby b{display:block;font-size:16px}
.cby small{display:block;font-size:12.5px;color:rgba(234,242,240,.5);margin-top:2px}
.cticker{position:absolute;left:0;right:0;bottom:0;z-index:2;display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid rgba(234,242,240,.14);background:rgba(18,32,42,.72);backdrop-filter:blur(6px)}
.cticker div{padding:clamp(14px,2.2vh,22px) clamp(20px,2.4vw,34px);border-right:1px solid rgba(234,242,240,.1)}
.cticker div:last-child{border-right:none}
.cticker b{display:block;font-size:clamp(18px,2.2vw,28px);font-weight:800;color:${A2};letter-spacing:-.03em}
.cticker span{font-size:11.5px;color:rgba(234,242,240,.5)}
.btitle{font-size:clamp(40px,6.2vw,86px);font-weight:800;letter-spacing:-.05em;line-height:.98}
.bcard{display:flex;align-items:center;gap:15px;margin:clamp(24px,3.6vh,40px) 0 clamp(18px,2.6vh,28px)}
.bcard b{display:block;font-size:18px}
.bcard small{display:block;font-size:12.5px;color:rgba(234,242,240,.5);margin-top:2px}
.bcontact{display:grid;grid-template-columns:repeat(3,auto);gap:clamp(20px,3vw,48px);justify-content:start;border-top:1px solid rgba(234,242,240,.16);padding-top:clamp(18px,2.6vh,26px)}
.bcontact span{display:block;font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:rgba(234,242,240,.42);margin-bottom:6px}
.bcontact b{font-size:clamp(13px,1.3vw,16px);font-weight:600;color:${A2}}
.bmark{margin-top:clamp(26px,4vh,44px);font-size:11.5px;letter-spacing:.32em;color:rgba(234,242,240,.32)}

/* entrances */
.page.on .phead,.page.on .cinner,.page.on .binner,.page.on .sleft{animation:rise .6s .05s cubic-bezier(.2,.8,.2,1) both}

/* player */
/* Bottom-RIGHT, not centred — a centred bar lands squarely on the cover's
   data ticker and on any page whose closing line runs full width. */
#nav{position:fixed;right:20px;bottom:18px;z-index:60;display:flex;align-items:center;gap:9px;background:rgba(255,255,255,.93);border:1px solid rgba(18,32,42,.1);border-radius:10px;padding:7px 11px;box-shadow:0 10px 28px rgba(0,0,0,.2);backdrop-filter:blur(8px)}
#nav button{background:none;border:none;cursor:pointer;font:inherit;font-size:14px;color:${INK};padding:4px 7px;border-radius:6px;line-height:1;opacity:.75}
#nav button:hover{opacity:1;background:rgba(18,32,42,.06)}
#pos{font-size:12px;color:rgba(18,32,42,.55);font-variant-numeric:tabular-nums;min-width:44px;text-align:center}
#dots{display:flex;gap:5px}
#dots i{width:7px;height:7px;border-radius:50%;background:rgba(18,32,42,.2);cursor:pointer;transition:.2s}
#dots i.on{background:${A};transform:scale(1.35)}
#bar{position:fixed;left:0;top:0;height:3px;background:${A};width:0;z-index:70;transition:width .35s}
`

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI in Medicine</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>${css}</style></head><body>
<div id="bar"></div>
${PAGES.map((p, i) => `<section class="page ${p.cls}" data-i="${i}">${p.html}</section>`).join('\n')}
<div id="nav">
  <button onclick="go(idx-1)" title="Previous">‹</button>
  ${WITH_AUDIO ? `<button id="pp" onclick="toggle()" title="Play / pause">▶</button>` : ''}
  <span id="pos">1 / ${PAGES.length}</span>
  <span id="dots">${PAGES.map((_, i) => `<i onclick="go(${i})"></i>`).join('')}</span>
  <button onclick="go(idx+1)" title="Next">›</button>
  <button onclick="fs()" title="Fullscreen">⛶</button>
</div>
<script>
const CLIPS = ${JSON.stringify(clips)};
const N = ${PAGES.length};
let idx = 0, playing = false, au = null;
const pages = [...document.querySelectorAll('.page')];
const dots = [...document.querySelectorAll('#dots i')];

function paint(){
  pages.forEach((p,i)=>p.classList.toggle('on', i===idx));
  dots.forEach((d,i)=>d.classList.toggle('on', i===idx));
  document.getElementById('pos').textContent = (idx+1)+' / '+N;
  document.getElementById('bar').style.width = ((idx+1)/N*100)+'%';
}
function stop(){ if(au){ au.pause(); au = null; } }
function speak(){
  stop();
  if(!playing || !CLIPS[idx]) return;
  au = new Audio(CLIPS[idx]);
  au.play().catch(()=>{});
  au.onended = () => { if(playing && idx < N-1) go(idx+1); else if(playing) toggle(); };
}
function go(n){
  if(n < 0 || n >= N) return;
  idx = n; paint();
  // Restart entrance animations for the page we just landed on.
  const p = pages[idx]; p.classList.remove('on'); void p.offsetWidth; p.classList.add('on');
  speak();
}
function toggle(){
  const pp = document.getElementById('pp');
  if(!pp) return;                       // slides-only build has no player
  playing = !playing;
  pp.textContent = playing ? '❚❚' : '▶';
  if(playing) speak(); else stop();
}
function fs(){ document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); }
addEventListener('keydown', e => {
  if(e.key==='ArrowRight'||e.key==='PageDown') go(idx+1);
  if(e.key==='ArrowLeft'||e.key==='PageUp') go(idx-1);
  if(e.key===' '){ e.preventDefault(); toggle(); }
});
paint();
</script></body></html>`

const outFile = join(OUT, 'ai-in-medicine-infographic.html')
writeFileSync(outFile, html)
console.log('[deck] wrote', outFile, `(${(html.length / 1024 / 1024).toFixed(1)} MB)`)
