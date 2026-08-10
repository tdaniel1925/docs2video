// Put the logo samples somewhere Trent can just click.
//
//   node -r dotenv/config scripts/logo-publish.mjs dotenv_config_path=.env.local
//
// Uploads the originals, the traced vectors and a comparison page to the
// public bucket, then prints ONE link. Local file paths are useless for
// reviewing work on a phone or sending to anyone else.
import { readFileSync, readdirSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('missing supabase env'); process.exit(2) }
const db = createClient(url, key, { auth: { persistSession: false } })

const BUCKET = 'videos' // already public — the old flyer wizard used it
const DIR = 'logo-lab'
const LOCAL = '.logo-lab'

const { data: buckets } = await db.storage.listBuckets()
const b = buckets?.find((x) => x.name === BUCKET)
if (!b) { console.error(`no ${BUCKET} bucket`); process.exit(1) }
if (!b.public) console.log(`NOTE: ${BUCKET} is not public — links may not open`)

const pub = (p) => db.storage.from(BUCKET).getPublicUrl(p).data.publicUrl

async function put(path, body, contentType) {
  const { error } = await db.storage.from(BUCKET)
    .upload(path, body, { contentType, upsert: true })
  if (error) throw new Error(`${path}: ${error.message}`)
  return pub(path)
}

const BRIEFS = [
  ['meridian', 'Meridian — architecture', 'Geometric wordmark. Hairlines: the hardest thing to trace.'],
  ['thicket', 'Thicket — botanical skincare', 'The gap between the leaves reads as a droplet.'],
  ['halden', 'Halden & Co. — private wealth', 'Pure typography. No icon at all.'],
  ['northbound', 'Northbound — outdoor outfitter', 'Compass needle and mountain resolved into one form.'],
]
const ENGINES = [['gptimage2', 'GPT Image 2', '~95s · ~18c'], ['nanobanana', 'Nano Banana', '~5s · ~4c']]

const links = {}
for (const f of readdirSync(LOCAL).filter((x) => x.endsWith('.png'))) {
  links[f] = await put(`${DIR}/${f}`, readFileSync(`${LOCAL}/${f}`), 'image/png')
}
for (const f of readdirSync(`${LOCAL}/vector`)) {
  const type = f.endsWith('.svg') ? 'image/svg+xml' : 'image/png'
  links[`vector/${f}`] = await put(`${DIR}/vector/${f}`, readFileSync(`${LOCAL}/vector/${f}`), type)
}

const card = (id, eng) => {
  const orig = links[`${id}-${eng}.png`]
  const trace = links[`vector/${id}-${eng}-traced.png`]
  const svg = links[`vector/${id}-${eng}.svg`]
  if (!orig) return ''
  return `<div class="pair">
    <div><img src="${orig}" alt=""><span>what the AI drew</span></div>
    <div><img src="${trace}" alt=""><span>after conversion to vector</span></div>
    <a class="dl" href="${svg}" download>Download the SVG</a>
  </div>`
}

const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Logo test — samples</title>
<style>
 body{font:16px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;background:#F4F1EC;color:#23201c;margin:0;padding:28px}
 .wrap{max-width:1080px;margin:0 auto}
 h1{font-size:26px;margin:0 0 6px} .sub{color:#6b6459;margin:0 0 28px}
 h2{font-size:19px;margin:34px 0 2px} .note{color:#6b6459;margin:0 0 14px;font-size:14px}
 .eng{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6b6459;margin:18px 0 8px}
 .pair{background:#fff;border:1px solid #ddd6cc;border-radius:10px;padding:14px;display:grid;
       grid-template-columns:1fr 1fr;gap:14px;align-items:start;margin-bottom:10px}
 .pair img{width:100%;display:block;border:1px solid #eee;border-radius:8px;background:#fff}
 .pair span{display:block;font-size:12px;color:#6b6459;margin-top:6px}
 .dl{grid-column:1/-1;text-align:center;padding:9px;border-radius:8px;background:#23201c;color:#fff;
     text-decoration:none;font-size:13px;font-weight:700}
 @media(max-width:640px){.pair{grid-template-columns:1fr}}
</style></head><body><div class="wrap">
<h1>Logo test — can this be agency quality?</h1>
<p class="sub">Eight logos, two engines, one pass, nothing cherry-picked. Left is what the AI drew; right is the
same thing after being converted to a real vector file. The SVG is the deliverable — it scales to a building.</p>
${BRIEFS.map(([id, title, note]) => `
 <h2>${title}</h2><p class="note">${note}</p>
 ${ENGINES.map(([eng, label, cost]) => `<div class="eng">${label} · ${cost}</div>${card(id, eng)}`).join('')}
`).join('')}
<p class="sub" style="margin-top:34px">Conversion runs inside the app — pure JavaScript, no outside service.
Each finished vector is 6–19&nbsp;KB.</p>
</div></body></html>`

// THE PAGE CANNOT LIVE IN STORAGE. Supabase serves uploaded HTML as
// text/plain on purpose, so the browser shows the source code instead of the
// page. The images are served correctly, so they stay there and only the page
// moves into the app, where it is a few KB and renders properly.
const { writeFileSync, mkdirSync: mk } = await import('fs')
mk('public', { recursive: true })
writeFileSync('public/logo-lab.html', html)
console.log(`\n  wrote public/logo-lab.html — live at https://docs2video.com/logo-lab.html once deployed\n`)
