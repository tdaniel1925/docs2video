// Put a blind rating sheet online.
//
//   node -r dotenv/config logo-lab/publish.mjs steer dotenv_config_path=.env.local
//
// One big contact sheet is fine on a desktop and useless on a phone, and
// typing "1:4 2:2 3:5 …" for forty-eight logos by hand is the kind of chore
// that quietly ends an experiment. So this builds a page with tap-to-rate
// buttons that produces the string for you.
//
// It emits ONLY the number and the image. No variant, no brand, no filename
// that hints at either — the whole value of the exercise is that the rater
// cannot see what produced what.
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { RUNS, readJson, save } from './lib.mjs'

const experiment = process.argv[2]
if (!experiment) { console.error('usage: publish.mjs <experiment>'); process.exit(2) }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('missing supabase env'); process.exit(2) }
const db = createClient(url, key, { auth: { persistSession: false } })

const order = readJson(`${RUNS}/${experiment}-KEY.json`, null)
if (!order) { console.error(`no key for "${experiment}" — build the sheet first`); process.exit(1) }

const results = readJson('logo-lab/results.json', { images: [] })
const BUCKET = 'videos'

const tiles = []
const failures = []
for (const entry of order) {
  const img = results.images.find((x) => x.id === entry.id)
  if (!img?.file) continue
  // Named by POSITION, never by variant — the filename must not leak the answer.
  const path = `logo-rate/${experiment}/${String(entry.n).padStart(3, '0')}.png`
  const body = readFileSync(img.file)

  // RETRY. A transient network blip dropped three logos from the first sheet
  // and said nothing, which is worse than it sounds: images vanishing from a
  // blind experiment is missing data, and if the drops correlate with anything
  // at all the result is quietly biased.
  let ok = false, why = ''
  for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
    try {
      const { error } = await db.storage.from(BUCKET)
        .upload(path, body, { contentType: 'image/png', upsert: true })
      if (!error) { ok = true; break }
      why = error.message
    } catch (e) { why = e.message }
    if (!ok) await new Promise((r) => setTimeout(r, 400 * attempt))
  }
  if (!ok) { failures.push(`#${entry.n} (${why})`); continue }
  tiles.push({ n: entry.n, url: db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl })
}

const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rate the logos — ${experiment}</title>
<style>
 body{font:16px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;background:#F4F1EC;color:#23201c;margin:0;padding:20px 16px 140px}
 .wrap{max-width:1100px;margin:0 auto}
 h1{font-size:24px;margin:0 0 4px}
 .sub{color:#6b6459;margin:0 0 8px;font-size:15px}
 .scale{background:#fff;border:1px solid #ddd6cc;border-radius:10px;padding:12px 14px;margin:0 0 22px;font-size:14px;color:#6b6459}
 .scale b{color:#23201c}
 .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}
 .cell{background:#fff;border:1px solid #ddd6cc;border-radius:10px;padding:10px}
 .cell img{width:100%;aspect-ratio:1;object-fit:contain;background:#fff;display:block;border-radius:6px}
 .n{font-size:12px;font-weight:800;color:#6b6459;margin:6px 0 8px}
 .btns{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}
 .btns button{padding:9px 0;border:1px solid #ddd6cc;background:#fff;border-radius:7px;font:inherit;
   font-size:14px;font-weight:700;cursor:pointer;color:#23201c}
 .btns button.on{background:#23201c;color:#fff;border-color:transparent}
 .bar{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid #ddd6cc;padding:12px 16px;
   display:flex;gap:12px;align-items:center;flex-wrap:wrap}
 .bar .count{font-weight:700}
 .bar textarea{flex:1;min-width:260px;font:13px ui-monospace,Menlo,monospace;padding:8px;border:1px solid #ddd6cc;border-radius:8px;height:44px}
 .bar button{padding:11px 18px;border:none;border-radius:8px;background:#23201c;color:#fff;font:inherit;font-weight:700;cursor:pointer}
</style></head><body><div class="wrap">
<h1>Rate the logos</h1>
<p class="sub">${tiles.length} logos. You cannot see which prompt made which — that is the point.</p>
<div class="scale"><b>Would you show this to a client?</b><br>
 <b>1</b> janky &nbsp;·&nbsp; <b>2</b> weak &nbsp;·&nbsp; <b>3</b> passable &nbsp;·&nbsp;
 <b>4</b> good &nbsp;·&nbsp; <b>5</b> I'd put my name on it<br>
 Skip any you are unsure about — a missing rating is better than a guessed one.</div>
<div class="grid">
${tiles.map((t) => `<div class="cell"><img src="${t.url}" alt="" loading="lazy"><div class="n">#${t.n}</div>
<div class="btns" data-n="${t.n}">${[1, 2, 3, 4, 5].map((v) => `<button data-v="${v}">${v}</button>`).join('')}</div></div>`).join('\n')}
</div></div>
<div class="bar">
 <span class="count">0 / ${tiles.length}</span>
 <textarea readonly placeholder="Your ratings appear here as you tap"></textarea>
 <button id="copy">Copy</button>
</div>
<script>
 const scores = {};
 const out = document.querySelector('textarea');
 const count = document.querySelector('.count');
 function refresh(){
   const parts = Object.keys(scores).map(Number).sort((a,b)=>a-b).map(n=>n+':'+scores[n]);
   out.value = parts.join(' ');
   count.textContent = parts.length + ' / ${tiles.length}';
 }
 document.querySelectorAll('.btns').forEach(g=>{
   g.addEventListener('click', e=>{
     const b = e.target.closest('button'); if(!b) return;
     scores[g.dataset.n] = Number(b.dataset.v);
     [...g.children].forEach(x=>x.classList.toggle('on', x===b));
     refresh();
   });
 });
 document.getElementById('copy').addEventListener('click', async ()=>{
   out.select();
   try{ await navigator.clipboard.writeText(out.value); }catch{ document.execCommand('copy'); }
   const b = document.getElementById('copy'); const t = b.textContent;
   b.textContent = 'Copied'; setTimeout(()=>b.textContent=t, 1200);
 });
</script></body></html>`

save(`public/logo-rate-${experiment}.html`, Buffer.from(html))
// Report the count against what was EXPECTED. The first run said "45 logos
// uploaded" and looked like a success; it was three short, and nothing in that
// sentence would ever have told you.
if (failures.length) console.log(`\n  COULD NOT UPLOAD ${failures.length}: ${failures.join(', ')}`)
console.log(`\n  ${tiles.length} of ${order.length} logos uploaded`)
console.log(`  wrote public/logo-rate-${experiment}.html`)
console.log(`  live at https://docs2video.com/logo-rate-${experiment}.html once deployed\n`)
