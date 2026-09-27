// Repair brand logos saved as PUBLIC links into the PRIVATE 'creation-assets'
// bucket (audit 2026-09-26, H13). Those links never load, so the logos show as
// broken everywhere. For each affected brand this copies the file into the
// public 'logos' bucket (same path) and points the brand row at the new link.
//
// Dry run by default — it only reports. Add --apply to copy and update.
//
//   node scripts/fix-private-logo-urls.mjs
//   node scripts/fix-private-logo-urls.mjs --apply
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(2) }
const APPLY = process.argv.includes('--apply')

const db = createClient(url, key, { auth: { persistSession: false } })
const MARK = '/storage/v1/object/public/creation-assets/'
const COLS = ['logo_url', 'logo_file_url', 'logo_light_url', 'logo_dark_url']

// Ask only for columns that exist (a missing column fails the whole select).
const present = []
for (const c of COLS) {
  const { error } = await db.from('brands').select(`id, ${c}`).limit(1)
  if (!error) present.push(c)
}
if (!present.length) { console.error('brands has none of', COLS.join(', ')); process.exit(2) }

const { data: brands, error } = await db.from('brands').select(['id', ...present].join(', '))
if (error) { console.error('select failed:', error.message); process.exit(1) }

let found = 0, fixed = 0, failed = 0
for (const b of brands) {
  const patch = {}
  for (const c of present) {
    const v = b[c]
    if (typeof v !== 'string' || !v.includes(MARK)) continue
    found++
    const path = decodeURIComponent(v.split(MARK)[1].split('?')[0])
    const newUrl = db.storage.from('logos').getPublicUrl(path).data.publicUrl
    console.log(`${APPLY ? 'fix ' : 'would fix'} brand ${b.id} ${c}: ${path}`)
    if (!APPLY) continue
    const { data: blob, error: dlErr } = await db.storage.from('creation-assets').download(path)
    if (dlErr || !blob) { console.error(`  download failed: ${dlErr?.message}`); failed++; continue }
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const { error: upErr } = await db.storage.from('logos').upload(path, bytes, { contentType: blob.type || 'image/png', upsert: true })
    if (upErr) { console.error(`  upload failed: ${upErr.message}`); failed++; continue }
    patch[c] = newUrl
  }
  if (APPLY && Object.keys(patch).length) {
    const { error: updErr } = await db.from('brands').update(patch).eq('id', b.id)
    if (updErr) { console.error(`  brand ${b.id} update failed: ${updErr.message}`); failed++ }
    else fixed += Object.keys(patch).length
  }
}

console.log(`\n${found} broken logo link(s) found${APPLY ? `, ${fixed} fixed, ${failed} failed` : ' (dry run — add --apply to fix)'}`)
process.exit(failed ? 1 : 0)
