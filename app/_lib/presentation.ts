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
}

export type PresentationTemplate = {
  id: string
  name: string
  tagline: string
  /** CSS variable overrides applied on <body class="t-{id}"> (heritage = base). */
  vars: Record<string, string>
  /** swatch colors for the gallery card */
  swatch: [string, string, string]
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

export function buildPresentationHtml(opts: {
  title: string
  scenes: PresentationScene[]
  templateId: string
  brandName?: string
  primaryColor?: string
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
    const body = esc(s.narration).slice(0, 420)
    if (isCover) {
      return `<div class="wrap">
        <div class="kick"><span class="rule"></span>${esc(opts.brandName || 'A PRESENTATION')}${opts.recipientName ? ' · PREPARED FOR ' + esc(opts.recipientName).toUpperCase() : ''}<span class="rule r"></span></div>
        <h1>${esc(opts.title)}<span class="g">.</span></h1>
        <div class="lead">${body}</div>
        ${P.name ? `<div class="advisor">${P.photoUrl ? `<img src="${esc(P.photoUrl)}" alt="">` : ''}<span><span class="an">${esc(P.name)}</span></span></div>` : ''}
      </div>`
    }
    if (isClosing) {
      return `<div class="wrap">
        <div class="kick"><span class="rule"></span>THANK YOU<span class="rule r"></span></div>
        <h1 style="font-size:clamp(21px,2.9vw,36px)">${esc(s.title || 'Let’s talk')}<span class="g">.</span></h1>
        <div class="lead">${body}</div>
        ${P.name ? `<div class="advcard">${P.photoUrl ? `<img src="${esc(P.photoUrl)}" alt="">` : ''}<span><span class="an">${esc(P.name)}</span>${P.contactLine ? `<div class="ac">${esc(P.contactLine)}</div>` : ''}</span></div>` : ''}
        ${opts.shareActions ? `<div class="shareacts">
          <button class="sact" onclick="parent.postMessage({type:'act',kind:'pdf'},'*')">📄 <b>Download the source document</b></button>
          <button class="sact" onclick="parent.postMessage({type:'act',kind:'deck'},'*')">📑 <b>Download this deck</b></button>
          <button class="sact" onclick="parent.postMessage({type:'act',kind:'chat'},'*')">💬 <b>Ask a question</b></button>
        </div>` : ''}
      </div>`
    }
    const stat = detectStat(s.narration)
    if (stat) {
      return `<div class="wrap">
        <div class="kick"><span class="rule"></span>${esc(s.title || 'KEY FIGURE').toUpperCase()}<span class="rule r"></span></div>
        <div class="big">${esc(stat.value)}</div>
        <div class="lead">${body}</div>
      </div>`
    }
    return `<div class="wrap">
      <div class="kick"><span class="rule"></span>${String(i).padStart(2, '0')}<span class="rule r"></span></div>
      <h1 style="font-size:clamp(20px,2.9vw,34px)">${esc(s.title || opts.title)}</h1>
      <div class="lead" style="max-width:720px">${body}</div>
    </div>`
  })

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Montserrat:wght@400;600;700;800;900&display=swap" rel="stylesheet">
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
.sec{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(16px,3.5vh,36px) 6vw 96px;opacity:0;transform:translateY(18px);transition:opacity .55s ease,transform .55s cubic-bezier(.16,1,.3,1);pointer-events:none;overflow:hidden;z-index:3}
.sec.on{opacity:1;transform:none;pointer-events:auto}
.wrap{width:100%;max-width:1000px;margin:0 auto;text-align:center}
.wrap>*{opacity:0;transform:translateY(14px)}
.sec.on .wrap>*{animation:rv .55s cubic-bezier(.16,1,.3,1) forwards}
.sec.on .wrap>*:nth-child(2){animation-delay:.14s}.sec.on .wrap>*:nth-child(3){animation-delay:.26s}.sec.on .wrap>*:nth-child(4){animation-delay:.38s}
@keyframes rv{to{opacity:1;transform:none}}
.kick{display:inline-flex;align-items:center;gap:10px;font-weight:700;font-size:clamp(10px,1.1vw,13px);letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:12px}
.kick .rule{width:30px;height:1px;background:linear-gradient(90deg,transparent,var(--gold))}
.kick .rule.r{background:linear-gradient(90deg,var(--gold),transparent)}
h1{font-family:var(--serif);font-weight:700;font-size:clamp(26px,4.4vw,52px);line-height:1.08}
h1 .g{color:var(--gold)}
.lead{color:var(--soft);font-size:clamp(13px,1.55vw,18px);line-height:1.6;max-width:660px;margin:12px auto 0}
.big{display:inline-block;font-family:var(--serif);font-weight:700;font-size:clamp(44px,8vw,96px);line-height:1.18;color:var(--navy);letter-spacing:-.02em;font-variant-numeric:tabular-nums;padding:0 .05em .08em}
.advisor{display:inline-flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:8px 22px 8px 8px;box-shadow:0 8px 22px rgba(0,0,0,.09);margin-top:18px}
.advisor img{width:46px;height:46px;border-radius:50%;object-fit:cover;border:2px solid var(--gold-f)}
.advisor .an{font-family:var(--serif);font-weight:700;font-size:clamp(13px,1.4vw,16px);color:var(--navy)}
.advcard{display:inline-flex;align-items:center;gap:18px;background:var(--card);border:1px solid var(--gold-f);border-radius:16px;padding:16px 26px 16px 16px;box-shadow:0 16px 40px rgba(0,0,0,.12);margin-top:clamp(12px,2.4vh,22px);text-align:left}
.advcard img{width:clamp(64px,9vh,88px);height:clamp(64px,9vh,88px);border-radius:14px;object-fit:cover;border:2px solid var(--gold-f)}
.advcard .an{font-family:var(--serif);font-weight:700;font-size:clamp(16px,1.9vw,22px);color:var(--navy)}
.advcard .ac{font-size:clamp(12px,1.3vw,15px);color:var(--soft);margin-top:6px;line-height:1.5}
.shareacts{display:none;gap:12px;justify-content:center;margin-top:clamp(12px,2.2vh,20px);flex-wrap:wrap}
body.share .shareacts{display:flex}
.sact{display:inline-flex;align-items:center;gap:8px;background:var(--card);border:1.5px solid var(--gold-f);border-radius:12px;padding:11px 18px;cursor:pointer;transition:transform .18s;font:inherit;font-size:clamp(11.5px,1.2vw,13.5px);color:var(--navy)}
.sact:hover{transform:translateY(-3px);border-color:var(--gold)}
#bar{position:fixed;left:0;top:0;height:3px;background:var(--gold);width:0;z-index:40;transition:width .3s ease}
#nav{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;z-index:50;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:6px 10px;box-shadow:0 8px 24px rgba(0,0,0,.14)}
#nav button{background:var(--paper);border:none;color:var(--ink);font:inherit;font-weight:700;font-size:13px;height:32px;border-radius:16px;cursor:pointer;transition:all .18s;padding:0 14px}
#nav button.icon{width:32px;padding:0}#nav button:hover{background:var(--navy);color:var(--paper)}
#dots{display:flex;gap:5px;margin:0 4px}#dots i{width:7px;height:7px;border-radius:50%;background:color-mix(in srgb,var(--ink) 18%,transparent);cursor:pointer;transition:all .2s}#dots i.on{background:var(--gold);transform:scale(1.3)}
#nav .lab{font-size:11px;color:var(--faint);padding:0 6px;min-width:52px;text-align:center}
.corner{position:fixed;top:20px;left:28px;z-index:40;font-family:var(--serif);font-weight:700;font-size:14px;color:var(--navy)}
.corner .sm{color:var(--faint);font-family:var(--font);font-weight:400;font-size:11px;display:block}
</style></head><body class="themed">
<div id="glow"></div><div id="frame"></div><div id="bar"></div>
<div class="corner">${esc(opts.title)}${P.name ? `<span class="sm">Presented by ${esc(P.name)}</span>` : ''}</div>
<div id="app"></div>
<div id="nav"><button class="icon" id="prev">‹</button><span class="lab" id="lab"></span><button id="next">Next ›</button><div id="dots"></div>${opts.voClips?.length ? '<button id="voice">🔊 Voice on</button>' : ''}</div>
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
const voiceBtn=document.getElementById('voice');
function voStop(){if(voAudio){voAudio.pause();voAudio=null;}}
function voPlay(){voStop();if(!voiceOn)return;const b=VO[cur];if(!b)return;voAudio=new Audio('data:audio/mpeg;base64,'+b);voAudio.play().catch(()=>{});}
if(voiceBtn)voiceBtn.onclick=()=>{voiceOn=!voiceOn;voiceBtn.textContent=voiceOn?'🔊 Voice on':'🔇 Voice off';if(voiceOn)voPlay();else voStop();};
function go(i){
  if(i<0)i=0;if(i>=secs.length)i=secs.length-1;cur=i;
  secs.forEach(s=>s.classList.remove('on'));dotEls.forEach(d=>d.classList.remove('on'));
  secs[i].classList.add('on');dotEls[i].classList.add('on');
  lab.textContent=(i+1)+' / '+secs.length;
  bar.style.width=(i/(Math.max(secs.length-1,1))*100)+'%';
  document.getElementById('next').textContent=(i===secs.length-1?'Restart ↻':'Next ›');
  voPlay();
}
const RP=new URLSearchParams(location.search);
if(RP.get('share')==='1'){document.body.classList.add('share');}
if(RP.get('record')==='1'){
  document.getElementById('nav').style.display='none';
  voiceOn=false;document.body.style.pointerEvents='none';
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
}
