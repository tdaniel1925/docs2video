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

    // ── Content slides render slideData, NOT the narration ──
    const kick = `<div class="kick"><span class="rule"></span>${String(i).padStart(2, '0')} · ${esc(s.title || '').toUpperCase()}<span class="rule r"></span></div>`
    const h = `<h1 class="h2">${esc(heading)}</h1>`
    const parts: string[] = [kick, h]

    const chart = chartable(stats)
    if (chart) {
      const max = Math.max(...chart.map((r) => r.num))
      parts.push(`<div class="chart">${chart.map((r) =>
        `<div class="crow"><span class="cl">${esc(r.label)}</span><div class="ctrack"><div class="cbar" style="width:${Math.max(6, Math.round((r.num / max) * 100))}%"></div></div><span class="cval">${esc(r.disp)}</span></div>`
      ).join('')}</div>`)
    } else if (stats.length === 1 && stats[0].value) {
      parts.push(`<div class="big">${esc(stats[0].value)}</div>${stats[0].label ? `<div class="bl">${esc(stats[0].label)}</div>` : ''}`)
    } else if (stats.length > 1) {
      parts.push(`<div class="statgrid">${stats.map((x) =>
        `<div class="stat"><div class="v">${esc(x.value ?? '')}</div><div class="l">${esc(x.label ?? '')}</div></div>`
      ).join('')}</div>`)
    }

    if (bullets.length) {
      parts.push(`<ul class="bullets${bullets.length > 4 ? ' two' : ''}${stats.length ? ' tight' : ''}">${bullets.map((b) =>
        `<li><span class="mk">◆</span><span>${esc(b)}</span></li>`
      ).join('')}</ul>`)
    }

    // Nothing structured on this scene → fall back to a short summary line.
    if (!stats.length && !bullets.length) {
      const stat = detectStat(s.narration)
      if (stat) parts.push(`<div class="big">${esc(stat.value)}</div>`)
      parts.push(`<div class="lead" style="max-width:720px">${esc(s.narration).slice(0, 300)}</div>`)
    }

    return `<div class="wrap">${parts.join('\n')}</div>`
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
h1.h2{font-size:clamp(20px,3vw,36px)}
.bl{font-size:clamp(11px,1.2vw,14px);letter-spacing:.14em;text-transform:uppercase;color:var(--faint);font-weight:700;margin-top:4px}
.statgrid{display:flex;gap:clamp(8px,1.4vw,16px);justify-content:center;flex-wrap:wrap;margin-top:clamp(10px,2.2vh,20px)}
.stat{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:12px;padding:clamp(10px,1.8vh,18px) clamp(14px,1.8vw,24px);min-width:130px;max-width:250px;text-align:left;box-shadow:0 10px 26px rgba(0,0,0,.08)}
.stat .v{font-family:var(--serif);font-weight:700;font-size:clamp(18px,2.4vw,32px);line-height:1.18;padding-bottom:.06em;color:var(--navy);font-variant-numeric:tabular-nums}
.stat .l{font-size:clamp(9.5px,1vw,12px);letter-spacing:.08em;text-transform:uppercase;color:var(--faint);font-weight:700;margin-top:4px}
.bullets{display:grid;grid-template-columns:1fr;gap:clamp(7px,1.3vh,12px);max-width:760px;margin:clamp(10px,2.2vh,20px) auto 0;padding:0;text-align:left}
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
.corner{position:fixed;top:20px;left:28px;z-index:40;font-family:var(--serif);font-weight:700;font-size:14px;color:var(--navy)}
.corner .sm{color:var(--faint);font-family:var(--font);font-weight:400;font-size:11px;display:block}
</style></head><body class="themed">
<div id="glow"></div><div id="frame"></div><div id="bar"></div>
<div class="corner">${esc(opts.title)}${P.name ? `<span class="sm">Presented by ${esc(P.name)}</span>` : ''}</div>
<div id="app"></div>
<div id="nav"><button id="prev" title="Previous">‹</button><span class="lab" id="lab"></span><button id="next" title="Next">›</button><div id="dots"></div>${opts.voClips?.length ? '<button id="voice" title="Voice on/off">🔊</button>' : ''}<button id="fs" title="Fullscreen">⛶</button></div>
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
if(voiceBtn)voiceBtn.onclick=()=>{voiceOn=!voiceOn;voiceBtn.textContent=voiceOn?'🔊':'🔇';if(voiceOn)voPlay();else voStop();};
const fsBtn=document.getElementById('fs');
if(fsBtn)fsBtn.onclick=()=>{if(document.fullscreenElement){document.exitFullscreen().catch(()=>{});}else{document.documentElement.requestFullscreen().catch(()=>{});}};
function go(i){
  if(i<0)i=0;if(i>=secs.length)i=secs.length-1;cur=i;
  secs.forEach(s=>s.classList.remove('on'));dotEls.forEach(d=>d.classList.remove('on'));
  secs[i].classList.add('on');dotEls[i].classList.add('on');
  lab.textContent=(i+1)+' / '+secs.length;
  bar.style.width=(i/(Math.max(secs.length-1,1))*100)+'%';
  document.getElementById('next').textContent=(i===secs.length-1?'↻':'›');
  document.getElementById('next').title=(i===secs.length-1?'Restart':'Next');
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
