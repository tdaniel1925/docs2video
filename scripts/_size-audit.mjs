/**
 * DOES THE FINISHED FILE SURVIVE THE PLATFORM?
 *
 * A file can be the exact published dimensions and still arrive useless: a
 * YouTube banner was a correct 2560x1440 and lost every word to the crop.
 * That size has been withdrawn. This checks whether any of the others have
 * the same gap between "right file" and "usable result".
 *
 *   node scripts/_size-audit.mjs            # the cropped ones
 *   node scripts/_size-audit.mjs ig-story   # just one
 *
 * Only sizes the platform CROPS or OVERLAYS are worth a render. Eleven of the
 * sixteen social and banner sizes are shown whole; those cannot fail this way
 * and are skipped rather than burned through.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const RZ = 'C:/dev/1 - Restylez'
const OUT = 'C:/Users/tdani/AppData/Local/Temp/claude/C--dev-1---PrismGraphs/b49a578b-8a92-4baa-9740-01972f39bb4f/scratchpad/audit'
const SOURCE = 'C:/dev/1 - PrismGraphs/public/flyer-templates/fitness-spin-night.png'

/*
 * The part each platform guarantees to show, from their own published specs.
 * `safe` is centred unless `anchor` says otherwise.
 */
const CHECK = {
  'ig-story': { safe: [1080, 1420], why: 'top and bottom carry the name and the reply bar' },
  'fb-cover': { safe: [1093, 615], why: 'mobile crops narrower than desktop' },
  'x-header': { safe: [1200, 380], why: 'the profile picture covers the bottom-left' },
  'li-company': { safe: [1000, 191], why: 'the company logo overlays the left' },
}

const env = readFileSync(RZ + '/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')
mkdirSync(OUT, { recursive: true })

const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('NEXT_PUBLIC_SUPABASE_ANON_KEY'))
const { data: auth, error } = await sb.auth.signInWithPassword({
  email: get('SUPER_ADMIN_EMAIL'), password: get('SUPER_ADMIN_PASSWORD'),
})
if (error) { console.log('sign-in failed:', error.message); process.exit(1) }

const REF = get('NEXT_PUBLIC_SUPABASE_URL').match(/https:\/\/([a-z0-9]+)\./)[1]
const cookie = `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(auth.session)).toString('base64url')}`

const src = await sharp(SOURCE).resize(2560, 2560, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer()
const imageDataUrl = 'data:image/jpeg;base64,' + src.toString('base64')

/** How much ink falls inside a centred window. */
async function keptInside(png, safeW, safeH) {
  const img = sharp(png)
  const { width: W, height: H } = await img.metadata()
  const { data, info } = await img.clone().removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const ch = info.channels
  const at = (x, y) => { const i = (y * info.width + x) * ch; return [data[i], data[i + 1], data[i + 2]] }
  /* Background from the corners — a design's corners are background by
     construction, which is what makes them croppable. */
  const corners = [at(4, 4), at(W - 5, 4), at(4, H - 5), at(W - 5, H - 5)]
  const bg = [0, 1, 2].map((c) => Math.round(corners.reduce((n, p) => n + p[c], 0) / corners.length))
  const isInk = (x, y) => {
    const [r, g, b] = at(x, y)
    return Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) > 126
  }
  /* The window, scaled to whatever the delivered file actually is. */
  const sw = Math.round(W * (safeW / W > 1 ? 1 : safeW / W) * (W / W))
  const x0 = (W - Math.min(W, safeW)) / 2, y0 = (H - Math.min(H, safeH)) / 2
  const x1 = x0 + Math.min(W, safeW), y1 = y0 + Math.min(H, safeH)
  let total = 0, inside = 0
  for (let y = 0; y < H; y += 4) {
    for (let x = 0; x < W; x += 4) {
      if (!isInk(x, y)) continue
      total++
      if (x >= x0 && x < x1 && y >= y0 && y < y1) inside++
    }
  }
  return { pct: total ? Math.round((inside / total) * 100) : 0, total, W, H }
}

const only = process.argv[2]
const ids = only ? [only] : Object.keys(CHECK)

console.log('size          file        kept   verdict')
for (const id of ids) {
  const spec = CHECK[id]
  if (!spec) { console.log(id + ': not in the cropped list — the platform shows it whole'); continue }

  const res = await fetch('http://localhost:3005/api/remake', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie, authorization: `Bearer ${auth.session.access_token}` },
    body: JSON.stringify({ imageDataUrl, owned: true, resize: { sizeId: id, bleed: false } }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.png) { console.log(id.padEnd(13) + 'FAILED  ' + JSON.stringify(data).slice(0, 90)); continue }

  const png = Buffer.from(data.png.split(',')[1], 'base64')
  writeFileSync(`${OUT}/${id}.png`, png)
  const { pct, W, H } = await keptInside(png, spec.safe[0], spec.safe[1])
  const verdict = pct >= 90 ? 'OK' : pct >= 75 ? 'some loss' : 'BADLY CROPPED'
  console.log(id.padEnd(13) + `${W}x${H}`.padEnd(12) + (pct + '%').padStart(5) + '   ' + verdict)
}
console.log('')
console.log('images in ' + OUT)
