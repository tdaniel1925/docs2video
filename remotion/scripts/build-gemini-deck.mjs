// Wraps the 12 fully-Gemini-rendered slides in a minimal viewer.
// The viewer adds NOTHING to the slides — no text, no overlays, no layout.
// Each page is the raw generated image, letterboxed on black, so what you
// judge is exactly what the model produced.
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, '..', '.gem-slides')
const OUT = join(HERE, '..', 'out')
mkdirSync(OUT, { recursive: true })

const files = readdirSync(SRC).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort()
if (!files.length) { console.error('no slides in', SRC); process.exit(1) }

// The files carry a .png extension but the API returns JPEG bytes — declare the
// real type so browsers don't have to sniff it.
const uri = (f) => 'data:image/jpeg;base64,' + readFileSync(join(SRC, f)).toString('base64')

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI in Medicine — full-page Gemini slides</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;background:#0b0f13;overflow:hidden;font:14px ui-sans-serif,system-ui,sans-serif;color:#cbd5d8}
.s{position:fixed;inset:0;display:none;align-items:center;justify-content:center}
.s.on{display:flex}
.s img{max-width:100%;max-height:100%;width:auto;height:auto;display:block}
#nav{position:fixed;right:18px;bottom:16px;display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.94);color:#12202a;border-radius:10px;padding:7px 12px;box-shadow:0 10px 30px rgba(0,0,0,.4);z-index:10}
#nav button{background:none;border:none;font:inherit;font-size:15px;cursor:pointer;color:#12202a;padding:3px 7px;border-radius:6px;opacity:.75}
#nav button:hover{opacity:1;background:rgba(18,32,42,.07)}
#pos{font-variant-numeric:tabular-nums;min-width:46px;text-align:center;font-size:12.5px}
#grid{position:fixed;inset:0;background:#0b0f13;overflow:auto;padding:22px;display:none;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px;z-index:20}
#grid.on{display:grid}
#grid figure{background:#141a20;border-radius:8px;overflow:hidden;cursor:pointer}
#grid img{width:100%;display:block}
#grid figcaption{padding:7px 10px;font-size:11.5px;color:#8a99a0}
#hint{position:fixed;left:18px;bottom:18px;font-size:11.5px;color:#5d6c74;z-index:10}
</style></head><body>
${files.map((f, i) => `<div class="s${i === 0 ? ' on' : ''}"><img src="${uri(f)}" alt=""></div>`).join('\n')}
<div id="grid">${files.map((f, i) => `<figure onclick="go(${i});grid()"><img src="${uri(f)}" alt=""><figcaption>${f}</figcaption></figure>`).join('')}</div>
<div id="nav">
  <button onclick="go(i-1)">‹</button>
  <span id="pos">1 / ${files.length}</span>
  <button onclick="go(i+1)">›</button>
  <button onclick="grid()" title="Contact sheet">▦</button>
  <button onclick="fs()" title="Fullscreen">⛶</button>
</div>
<div id="hint">← → to page · G for the contact sheet</div>
<script>
const S=[...document.querySelectorAll('.s')], N=S.length; let i=0;
function go(n){ if(n<0||n>=N) return; i=n; S.forEach((s,k)=>s.classList.toggle('on',k===i));
  document.getElementById('pos').textContent=(i+1)+' / '+N; }
function grid(){ document.getElementById('grid').classList.toggle('on'); }
function fs(){ document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen(); }
addEventListener('keydown',e=>{ if(e.key==='ArrowRight')go(i+1); if(e.key==='ArrowLeft')go(i-1);
  if(e.key.toLowerCase()==='g')grid(); if(e.key==='Escape')document.getElementById('grid').classList.remove('on'); });
</script></body></html>`

const outFile = join(OUT, 'ai-in-medicine-gemini.html')
writeFileSync(outFile, html)
console.log('[deck] wrote', outFile, `(${files.length} slides, ${(html.length / 1024 / 1024).toFixed(1)} MB)`)
