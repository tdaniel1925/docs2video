// An Apex-branded interactive HTML deck — the same click-through format as
// jordyn.app/demo, rebuilt in Apex's brand.
//
//   node scripts/build-apex-deck.mjs        (FORCE=1 to regenerate art)
//
// Output: out/apex-deck.html — ONE self-contained file. Art and logo are
// inlined as base64 so it can be emailed, opened from disk, or dropped on any
// host with no asset paths to break. The Jordyn template pulls its art from
// /demo-illos at runtime; that's right for a live page and wrong for a sample
// you want to hand someone.
//
// Copy is lifted from reachtheapex.net and reachtheapex.net/jordyn — the four
// pillars, the two paths, the stat strip, the product line-up. Nothing about
// earnings is invented: the site says "uncapped income" and "$0 to get
// started", so that is exactly what this says. No projections, no examples of
// what anyone might make.
//
// Palette is sampled from the RENDERED site (navy #1e3a72, red #cc2027,
// off-white #f5f7fb) rather than its CSS, which still carries dead Bootstrap
// rules (#2b4c7e, #c2914a gold) that never paint.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const ART = join(HERE, '..', 'public', 'apex-deck')
mkdirSync(ART, { recursive: true })
const FORCE = process.env.FORCE === '1'
const log = (...a) => console.log('[apex-deck]', ...a)

const env = {}
for (const f of ['.env.local', '.env']) {
  const p = join(ROOT, f)
  if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim()
  }
}
const GEMINI = env.GEMINI_API_KEY
const IMG_MODEL = env.IMAGE_MODEL || 'gemini-3-pro-image-preview'

const PAPER = "Cut-paper craft collage illustration: handmade layered construction paper, visible torn and cut paper edges, soft realistic drop shadows between the paper layers, subtle paper grain and fibre texture. Strict palette: deep navy blue #1e3a72, bright red #cc2027, clean white, and cool off-white #f5f7fb. Confident, premium, editorial paper-craft style, generous negative space. NO text, NO letters, NO logos, NO words."
const ONE = "ONE single continuous scene in one frame — not a grid, not multiple panels, not a character sheet."

const SHOTS = {
  hero: `${PAPER} Two paper roads diverging from the foreground and rising toward the upper right, a confident paper figure standing at the fork looking up, a paper shield on one road and a small paper laptop on the other. Optimistic and open. ${ONE}`,
  licensed: `${PAPER} A paper insurance agent seated at a paper table handing a layered paper shield across to a small paper family, warm and trustworthy. ${ONE}`,
  training: `${PAPER} A paper mentor figure guiding a paper newcomer up a flight of layered paper stairs, a steadying hand, encouraging and supportive. ${ONE}`,
  tools: `${PAPER} A layered paper laptop with a small paper rising bar chart lifting out of the screen and a paper door opening beside it, momentum. NO people. ${ONE}`,
  carriers: `${PAPER} A single large layered paper shield standing upright with a small paper star badge at its centre, solid and protective. NO people. ${ONE}`,
  ownership: `${PAPER} A closed layered paper ledger book with a paper key resting on top of it and a small paper key-ring, ownership and permanence. NO people. ${ONE}`,
  stack: `${PAPER} Three layered paper blocks stacked into a small tower, each a different paper colour, with soft paper connector lines between them, a purpose-built system. NO people. ${ONE}`,
}

async function gen(key, prompt) {
  const f = join(ART, `${key}.png`)
  if (!FORCE && existsSync(f)) { log(`${key} cached`); return }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMG_MODEL}:generateContent?key=${GEMINI}`
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '4:3' } } }),
      })
      if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 110)}`)
      const j = await r.json()
      const img = (j.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data)
      if (!img) throw new Error('no image')
      writeFileSync(f, Buffer.from(img.inlineData.data, 'base64')); log(`${key} ok`); return
    } catch (e) {
      log(`${key} try${a + 1}: ${e.message}`)
      if (a < 2) await new Promise((s) => setTimeout(s, 2500)); else log(`${key} GIVE UP`)
    }
  }
}

const keys = Object.keys(SHOTS)
for (let i = 0; i < keys.length; i += 2) {
  await Promise.all(keys.slice(i, i + 2).map((k) => gen(k, SHOTS[k])))
}

const b64 = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`
const IMG = Object.fromEntries(keys.map((k) => [k, b64(join(ART, `${k}.png`))]))
const LOGO = b64(join(HERE, '..', 'public', 'apex', 'logo.png'))

const DATA = {
  brand: 'Apex Affinity Group',
  hero: {
    headline: 'Build a Life Insurance Business <span class="r">You Own.</span>',
    sub: 'Top-rated carriers, AI built for how insurance is really sold, and training that starts wherever you are.',
  },
  paths: [
    ['1', 'Already licensed?', 'Write with A-rated carriers your clients already know, from day one.', 'licensed'],
    ['2', 'Not licensed yet?', 'Get licensed with us. Onboarding, mentorship and licensing support from day one — 100% training included.', 'training'],
    ['3', 'Either way', 'Start today with an AI stack that opens doors cold calls don’t.', 'tools'],
  ],
  pillars: [
    { t: 'Insurance First', b: 'A real career with A-rated carriers your clients already trust.', e: 'Write for carriers people recognise.', i: 'carriers' },
    { t: 'Business Ownership', b: 'Your book of business is yours. Your renewals follow you.', e: 'You own it — not the agency.', i: 'ownership' },
    { t: 'Modern Technology', b: 'An AI stack built for how insurance is actually sold — not borrowed from another industry.', e: 'Built for your book and your conversations.', i: 'stack' },
    { t: 'Independent Growth', b: 'Grow at your pace, on your terms, with a team behind you.', e: 'Earn on your own sales, and on the team you build.', i: 'tools' },
  ],
  stack: {
    greeting: 'The AI stack — tap any tool',
    items: [
      { title: 'SmartViewz', meta: 'Open doors', body: 'Ask your whole book anything, and surface the conversations worth having this week.' },
      { title: 'Docs2Video', meta: 'Any document → video', body: 'Turn an illustration or a policy summary into a short video that a client will actually watch.' },
      { title: 'Jordyn', meta: '$129/mo rep pricing', body: 'Runs your inbox, answers your phone in your business name, and builds your pipeline while you sell. Nothing sends without your approval.' },
    ],
  },
  stats: [['$0', 'To Get Started'], ['A+', 'Rated Carriers'], ['100%', 'Training Included'], ['2', 'Paths to Succeed']],
  cta: 'Your place at Apex is waiting.',
  ctaSub: 'Two paths. One opportunity. Pick the one that fits you — or walk both. No cost to join, full training included.',
  contact: 'reachtheapex.net · (281) 269-2300 · info@theapexway.net',
}

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Apex Affinity Group — Two Paths. One Opportunity.</title><style>
:root{--navy:#1e3a72;--navy-d:#152a55;--red:#cc2027;--red-d:#a91820;--paper:#f5f7fb;--paper2:#e9edf6;--deeper:#d9e0ee;--ink:#16233f;--soft:#5a6b8a;--faint:#8d9ab2;--card:#ffffff;--font:-apple-system,'Segoe UI',Roboto,'Helvetica Neue',system-ui,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}html,body{height:100%}
html,body{caret-color:transparent;-webkit-user-select:none;user-select:none}
button:focus,button:focus-visible,a:focus{outline:none}
body{background:var(--paper);font-family:var(--font);color:var(--ink);overflow:hidden}
#app{position:relative;width:100%;height:100%}
#app::before{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;background:radial-gradient(60% 55% at 18% 22%,rgba(30,58,114,.10),transparent 60%),radial-gradient(55% 60% at 85% 78%,rgba(204,32,39,.08),transparent 62%);animation:drift 16s ease-in-out infinite alternate}
@keyframes drift{from{transform:translate3d(-1.5%,-1%,0) scale(1.02)}to{transform:translate3d(2%,1.5%,0) scale(1.07)}}
.sec{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:safe center;padding:clamp(16px,3.5vh,36px) 5vw 84px;opacity:0;transform:translateY(22px);transition:opacity .5s ease,transform .5s cubic-bezier(.16,1,.3,1);pointer-events:none;z-index:2;overflow-y:auto;overflow-x:hidden}
.sec.on{opacity:1;transform:none;pointer-events:auto}
.wrap{width:100%;max-width:1080px;margin:0 auto}
.wrap>*{opacity:0;transform:translateY(18px)}
.sec.on .wrap>*{animation:rv .55s cubic-bezier(.16,1,.3,1) forwards}
.sec.on .wrap>*:nth-child(1){animation-delay:.04s}.sec.on .wrap>*:nth-child(2){animation-delay:.13s}.sec.on .wrap>*:nth-child(3){animation-delay:.22s}.sec.on .wrap>*:nth-child(4){animation-delay:.31s}
@keyframes rv{to{opacity:1;transform:none}}
#mark{position:fixed;top:16px;left:20px;z-index:45;height:clamp(26px,3.4vh,38px);opacity:.96;pointer-events:none;filter:drop-shadow(0 4px 12px rgba(20,40,80,.18))}
.kick{display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:clamp(10px,1.2vw,14px);letter-spacing:.13em;text-transform:uppercase;color:var(--red);margin-bottom:12px}
.kick .dot{width:6px;height:6px;border-radius:50%;background:var(--red);animation:pulse 2s ease-in-out infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(204,32,39,.45)}50%{box-shadow:0 0 0 6px rgba(204,32,39,0)}}
.badge{display:inline-flex;align-items:center;gap:7px;padding:6px 14px;border-radius:9px;background:rgba(30,58,114,.10);color:var(--navy);font-weight:700;font-size:clamp(10px,1.2vw,13px);letter-spacing:.1em;margin-bottom:14px}
h1{font-weight:800;font-size:clamp(24px,4.6vw,52px);line-height:1.05;letter-spacing:-.02em;color:var(--navy)}
h1 .r,h2 .r{color:var(--red)}
h2{font-weight:800;font-size:clamp(19px,3vw,34px);line-height:1.1;letter-spacing:-.02em;color:var(--navy)}
.lead{font-size:clamp(13px,1.7vw,19px);color:var(--soft);line-height:1.5;max-width:660px;margin-top:10px}
.hero{display:grid;grid-template-columns:1.15fr .85fr;gap:clamp(18px,3.5vw,44px);align-items:center}
.illo{background:var(--card);border:1px solid rgba(30,58,114,.10);border-radius:18px;overflow:hidden;box-shadow:0 18px 46px rgba(20,40,80,.12);position:relative}
.illo img{width:100%;height:100%;object-fit:cover;display:block}
.illo.big{aspect-ratio:4/3;max-height:min(52vh,420px);width:auto;max-width:100%;margin:0 auto}
.sec.on .illo img{animation:kb 14s ease-out forwards}
@keyframes kb{from{transform:scale(1.06) translateY(1%)}to{transform:none}}
.illo::after{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.5) 50%,transparent 65%);transform:translateX(-120%)}
.sec.on .illo::after{animation:sweep 1.1s ease-out .35s}
@keyframes sweep{to{transform:translateX(120%)}}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(10px,1.5vw,20px);margin-top:clamp(12px,2vh,22px);width:100%}
.step{background:var(--card);border:1px solid rgba(30,58,114,.10);border-radius:15px;padding:clamp(12px,1.5vw,18px);box-shadow:0 10px 28px rgba(20,40,80,.07);text-align:left;transition:transform .22s}
.step:hover{transform:translateY(-4px)}
.step .si{height:clamp(60px,13vh,120px);border-radius:10px;overflow:hidden;margin-bottom:10px;background:var(--paper2)}
.step .si img{width:100%;height:100%;object-fit:cover}
.step .n{width:24px;height:24px;border-radius:7px;background:rgba(204,32,39,.12);color:var(--red-d);font-weight:800;display:flex;align-items:center;justify-content:center;font-size:13px;margin-bottom:8px}
.step .t{font-weight:800;font-size:clamp(13px,1.4vw,17px);margin-bottom:5px;color:var(--navy)}
.step .d{font-size:clamp(11px,1.15vw,14px);color:var(--soft);line-height:1.4}
.fgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:clamp(10px,1.4vw,18px);margin-top:clamp(12px,2vh,20px)}
.fcard{background:var(--card);border:1px solid rgba(30,58,114,.10);border-radius:15px;padding:clamp(12px,1.6vw,20px);box-shadow:0 10px 28px rgba(20,40,80,.07);display:flex;gap:14px;text-align:left;transition:transform .22s,box-shadow .22s}
.fcard:hover{transform:translateY(-4px);box-shadow:0 16px 36px rgba(20,40,80,.14)}
.fcard .fi{width:clamp(58px,7vw,86px);height:clamp(58px,7vw,86px);border-radius:12px;overflow:hidden;background:var(--paper2);flex:0 0 auto}
.fcard .fi img{width:100%;height:100%;object-fit:cover}
.fcard .ft{font-weight:800;font-size:clamp(13px,1.5vw,18px);margin-bottom:4px;color:var(--navy)}
.fcard .fb{font-size:clamp(11px,1.2vw,14px);color:var(--soft);line-height:1.4;margin-bottom:6px}
.fcard .fe{font-size:clamp(10px,1.1vw,13px);color:var(--soft);background:var(--paper);border:1px solid var(--deeper);border-radius:8px;padding:6px 9px;line-height:1.4}
.fcard .fe b{color:var(--red)}
.brief{background:var(--card);border:1px solid rgba(30,58,114,.12);border-radius:18px;box-shadow:0 14px 38px rgba(20,40,80,.10);padding:clamp(14px,2vw,24px);max-width:640px;margin:clamp(12px,2vh,20px) auto 0;text-align:left}
.brief .bg{font-weight:800;font-size:clamp(15px,1.8vw,21px);margin-bottom:10px;color:var(--navy)}
.bitem{width:100%;text-align:left;border:1px solid var(--deeper);background:var(--paper);border-radius:13px;padding:11px 13px;margin-bottom:8px;cursor:pointer;font:inherit;color:inherit;display:block;transition:border-color .2s}
.bitem:hover{border-color:rgba(204,32,39,.45)}
.bitem .bt{font-size:clamp(12px,1.3vw,15px);display:flex;justify-content:space-between;gap:10px;font-weight:700;color:var(--navy)}
.bitem .bm{color:var(--red);font-weight:600;font-size:clamp(10px,1.1vw,12px);white-space:nowrap}
.bopen{margin:2px 0 10px 8px;padding-left:12px;border-left:2px solid rgba(204,32,39,.35);animation:rv .4s ease forwards;text-align:left}
.bopen p{font-size:clamp(11px,1.2vw,13px);color:var(--soft);line-height:1.45}
.statrow{display:grid;grid-template-columns:repeat(4,1fr);gap:clamp(10px,1.5vw,18px);margin-top:clamp(14px,2.5vh,24px)}
.stat{background:var(--card);border:1px solid rgba(30,58,114,.10);border-radius:15px;padding:clamp(14px,2vw,22px) 10px;box-shadow:0 10px 28px rgba(20,40,80,.07)}
.stat .sv{font-weight:800;font-size:clamp(24px,3.6vw,44px);color:var(--red);line-height:1}
.stat .sl{font-size:clamp(10px,1.15vw,13px);color:var(--soft);margin-top:6px;font-weight:600}
.cta-box{background:var(--navy);color:#fff;border-radius:20px;padding:clamp(20px,3.5vw,40px);text-align:center;max-width:680px;margin:0 auto;box-shadow:0 22px 54px rgba(20,40,80,.32)}
.cta-box .ch{font-weight:800;font-size:clamp(18px,2.8vw,30px);margin-bottom:8px}
.cta-box p{color:rgba(255,255,255,.85);font-size:clamp(12px,1.4vw,15px);line-height:1.5;margin-bottom:16px}
.cta-btn{display:inline-block;padding:12px 26px;border-radius:12px;background:var(--red);color:#fff;font-weight:700;font-size:clamp(13px,1.5vw,16px);text-decoration:none;transition:transform .18s}
.cta-btn:hover{transform:translateY(-2px)}
.cta-box .cc{margin-top:14px;font-size:clamp(10px,1.15vw,13px);color:rgba(255,255,255,.7)}
.center{text-align:center}
#bar{position:fixed;left:0;top:0;height:3px;background:var(--red);width:0;z-index:40;transition:width .35s ease}
#nav{position:fixed;bottom:14px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;z-index:50;background:rgba(255,255,255,.95);border:1px solid rgba(30,58,114,.14);border-radius:999px;padding:6px 10px;backdrop-filter:blur(8px);box-shadow:0 8px 24px rgba(20,40,80,.16)}
#nav button{background:var(--paper2);border:none;color:var(--navy);font:inherit;font-weight:700;font-size:13px;height:34px;border-radius:17px;cursor:pointer;transition:all .18s;display:flex;align-items:center;justify-content:center;padding:0 15px}
#nav button.icon{width:34px;padding:0}#nav button:hover{background:var(--red);color:#fff}
#dots{display:flex;gap:5px;margin:0 4px}#dots i{width:8px;height:8px;border-radius:50%;background:rgba(30,58,114,.20);cursor:pointer;transition:all .2s}#dots i.on{background:var(--red);transform:scale(1.3)}
#nav .lab{font-size:11px;color:var(--faint);padding:0 6px;min-width:96px;text-align:center}
@media(max-width:760px){.hero{grid-template-columns:1fr}.fgrid{grid-template-columns:1fr}.steps{grid-template-columns:1fr}.statrow{grid-template-columns:repeat(2,1fr)}.illo.big{max-height:32vh}}
</style></head><body>
<div id="bar"></div><img id="mark" src="${LOGO}" alt="Apex Affinity Group">
<div id="app"></div>
<div id="nav"><button class="icon" id="prev">‹</button><span class="lab" id="lab"></span><button id="next">Next ›</button><div id="dots"></div></div>
<script>
const DATA = ${JSON.stringify(DATA)};
const IMG = ${JSON.stringify(IMG)};
const esc = (s) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

const SECTIONS = [
  { name: "The opportunity", html: () => \`
    <div class="wrap hero">
      <div>
        <div class="badge">● TWO PATHS · ONE OPPORTUNITY</div>
        <h1>\${DATA.hero.headline}</h1>
        <div class="lead">\${esc(DATA.hero.sub)}</div>
      </div>
      <div class="illo big"><img src="\${IMG.hero}" alt=""></div>
    </div>\` },
  { name: "Where you start", html: () => \`
    <div class="wrap center">
      <div class="kick" style="justify-content:center"><span class="dot"></span>Where are you starting?</div>
      <h2>Licensed or not, there's <span class="r">a path here for you.</span></h2>
      <div class="steps">
        \${DATA.paths.map(s=>\`<div class="step"><div class="si"><img src="\${IMG[s[3]]}" alt=""></div><div class="n">\${s[0]}</div><div class="t">\${esc(s[1])}</div><div class="d">\${esc(s[2])}</div></div>\`).join("")}
      </div>
    </div>\` },
  { name: "What you get", html: () => \`
    <div class="wrap center">
      <div class="kick" style="justify-content:center"><span class="dot"></span>Insurance first. Technology second. Ownership always.</div>
      <h2>What you're actually <span class="r">building.</span></h2>
      <div class="fgrid">
        \${DATA.pillars.map(f=>\`<div class="fcard"><div class="fi"><img src="\${IMG[f.i]}" alt=""></div><div><div class="ft">\${esc(f.t)}</div><div class="fb">\${esc(f.b)}</div><div class="fe"><b>—</b> \${esc(f.e)}</div></div></div>\`).join("")}
      </div>
    </div>\` },
  { name: "The AI stack", html: () => \`
    <div class="wrap center">
      <div class="kick" style="justify-content:center"><span class="dot"></span>Interactive · tap a tool</div>
      <h2>AI that <span class="r">actually sells.</span></h2>
      <div class="lead" style="margin:6px auto 0">Built for how insurance is really sold — not borrowed from another industry.</div>
      <div class="brief">
        <div class="bg">\${esc(DATA.stack.greeting)}</div>
        <div id="bitems"></div>
      </div>
    </div>\` },
  { name: "No barrier", html: () => \`
    <div class="wrap center">
      <div class="kick" style="justify-content:center"><span class="dot"></span>No cost to join</div>
      <h2>You'll never have to <span class="r">figure it out alone.</span></h2>
      <div class="lead" style="margin:6px auto 0">Onboarding, mentorship and licensing support from day one.</div>
      <div class="statrow">
        \${DATA.stats.map(s=>\`<div class="stat"><div class="sv">\${esc(s[0])}</div><div class="sl">\${esc(s[1])}</div></div>\`).join("")}
      </div>
    </div>\` },
  { name: "Get started", html: () => \`
    <div class="wrap">
      <div class="cta-box">
        <div class="ch">\${esc(DATA.cta)}</div>
        <p>\${esc(DATA.ctaSub)}</p>
        <a class="cta-btn" href="https://reachtheapex.net" target="_blank" rel="noopener">Get Started →</a>
        <div class="cc">\${esc(DATA.contact)}</div>
      </div>
    </div>\` },
];

const app = document.getElementById("app");
SECTIONS.forEach((s)=>{const d=document.createElement("div");d.className="sec";d.innerHTML=s.html();app.appendChild(d);});
const secs=[...document.querySelectorAll(".sec")];
const dots=document.getElementById("dots");
SECTIONS.forEach((s,i)=>{const b=document.createElement("i");b.onclick=()=>go(i);dots.appendChild(b);});
const dotEls=[...dots.children], bar=document.getElementById("bar"), lab=document.getElementById("lab");
let cur=-1, openIdx=null;

function renderStack(){
  const box=document.getElementById("bitems"); if(!box) return;
  box.innerHTML=(DATA.stack.items||[]).map((it,i)=>\`
    <button class="bitem" data-i="\${i}"><span class="bt"><span>\${esc(it.title)}</span><span class="bm">\${esc(it.meta)}</span></span></button>
    \${openIdx===i?\`<div class="bopen"><p>\${esc(it.body)}</p></div>\`:""}\`).join("");
  box.querySelectorAll(".bitem").forEach(b=>b.onclick=()=>{const i=+b.dataset.i;openIdx=openIdx===i?null:i;renderStack();});
}

function go(i){
  if(i<0)i=0; if(i>=secs.length)i=secs.length-1; cur=i;
  secs.forEach(s=>s.classList.remove("on")); dotEls.forEach(d=>d.classList.remove("on"));
  secs[i].classList.add("on"); dotEls[i].classList.add("on");
  lab.textContent=(i+1)+" / "+secs.length+" · "+SECTIONS[i].name;
  bar.style.width=(i/(secs.length-1)*100)+"%";
  if(SECTIONS[i].name==="The AI stack"){openIdx=null;renderStack();}
  document.getElementById("next").textContent=(i===secs.length-1?"Restart ↻":"Next ›");
  secs[i].querySelectorAll(".wrap>*, .illo").forEach(el=>{el.style.animation="none";void el.offsetWidth;el.style.animation="";});
}
document.getElementById("next").onclick=()=>{ if(cur>=secs.length-1)go(0); else go(cur+1); };
document.getElementById("prev").onclick=()=>go(cur-1);
document.addEventListener("keydown",e=>{
  if(e.key==="ArrowRight"||e.key==="PageDown"){e.preventDefault();if(cur>=secs.length-1)go(0);else go(cur+1);}
  if(e.key==="ArrowLeft"||e.key==="PageUp"){e.preventDefault();go(cur-1);}
});
go(0);
<\/script></body></html>`

const out = join(HERE, '..', 'out', 'apex-deck.html')
writeFileSync(out, html)
log(`built ${out} (${(html.length / 1e6).toFixed(2)} MB self-contained)`)
