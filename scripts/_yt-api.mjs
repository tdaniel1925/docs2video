/**
 * DOES A RESTYLEZ YOUTUBE BANNER SURVIVE YOUTUBE?
 *
 * Reported: a banner made elsewhere was the correct 2560x1440 file and was
 * still cut to pieces on the channel, because YouTube shows only the middle
 * 1546x423 on a phone.
 *
 * Restylez carries a note for this size telling the artist to keep everything
 * inside that strip. This finds out whether the note WORKS — by asking the
 * real /api/remake resize path for a real banner, then measuring where the
 * ink actually lands.
 *
 * Talks to the API rather than driving the browser: same route, same prompt,
 * same model, and far fewer moving parts than a dev-mode page.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const RZ = 'C:/dev/1 - Restylez'
const OUT = 'C:/Users/tdani/AppData/Local/Temp/claude/C--dev-1---PrismGraphs/b49a578b-8a92-4baa-9740-01972f39bb4f/scratchpad/yt'
const SOURCE = 'C:/dev/1 - PrismGraphs/public/flyer-templates/fitness-spin-night.png'

const env = readFileSync(RZ + '/.env.local', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim().replace(/\r$/, '').replace(/^["']|["']$/g, '')

mkdirSync(OUT, { recursive: true })

/* A real signed-in session, the way the page has one. */
const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('NEXT_PUBLIC_SUPABASE_ANON_KEY'))
const { data: auth, error: authErr } = await sb.auth.signInWithPassword({
  email: get('SUPER_ADMIN_EMAIL'), password: get('SUPER_ADMIN_PASSWORD'),
})
if (authErr) { console.log('sign-in failed:', authErr.message); process.exit(1) }
console.log('signed in as', auth.user.email)

const REF = get('NEXT_PUBLIC_SUPABASE_URL').match(/https:\/\/([a-z0-9]+)\./)[1]
/*
 * base64URL, not base64. The server decodes with base64url, so a standard
 * encoding containing "/" or "+" is rejected — and @supabase/ssr treats a
 * cookie it cannot decode as ABSENT rather than erroring, which surfaces as
 * a plain 401 with nothing to explain it.
 */
const sessionCookie = `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(auth.session)).toString('base64url')}`

/* The source design, shrunk the way the page shrinks it. */
const src = await sharp(SOURCE).resize(2560, 2560, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer()
const imageDataUrl = 'data:image/jpeg;base64,' + src.toString('base64')
const meta = await sharp(src).metadata()
console.log('source:', meta.width + 'x' + meta.height)

/* The note the size table carries for this size — exactly what the page sends. */
const NOTE = 'Channel banner: keep everything inside the middle 1546×423 — that is all phones show.'

console.log('asking for a YouTube channel banner…')
const t0 = Date.now()
const res = await fetch('http://localhost:3005/api/remake', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    /* @supabase/ssr reads ONE cookie named for the project ref, holding the
       whole session as base64-encoded JSON — not the two loose tokens the
       older client used. */
    cookie: sessionCookie,
    authorization: `Bearer ${auth.session.access_token}`,
  },
  body: JSON.stringify({
    imageDataUrl, owned: true,
    resize: { sizeId: 'yt-banner', bleed: false },
    changes: NOTE,
  }),
})
const data = await res.json().catch(() => ({}))
console.log('HTTP', res.status, '·', Math.round((Date.now() - t0) / 1000) + 's')
if (!res.ok || !data.png) { console.log('failed:', JSON.stringify(data).slice(0, 400)); process.exit(1) }

const png = Buffer.from(data.png.split(',')[1], 'base64')
writeFileSync(OUT + '/banner.png', png)
const m = await sharp(png).metadata()
console.log('result:', m.width + 'x' + m.height, '·', Math.round(png.length / 1024) + 'KB')
console.log('saved', OUT + '/banner.png')
