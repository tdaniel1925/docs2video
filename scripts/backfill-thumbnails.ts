// Library thumbnails for videos finished BEFORE thumbnails were made
// (option A, 2026-10-18). Same making as the cron (app/_lib/video-thumbnail-make.ts):
// the engine's drawn cover, or a frame from the middle of the cover scene.
//
//   npx jiti scripts/backfill-thumbnails.ts                 dry run: what it WOULD do (no writes)
//   npx jiti scripts/backfill-thumbnails.ts --apply         make them (asks nothing; run with the owner's OK)
//   npx jiti scripts/backfill-thumbnails.ts --apply --limit 50 --user <uuid>
//
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
// Prints ids and counts only — never a key. Safe to run twice: a video with a
// made cover is skipped. A person's own chosen thumbnail is never replaced.
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { backfillPlan } from '../app/_lib/video-thumbnail'
import { THUMB_COLUMNS, makeCover, type ThumbRow } from '../app/_lib/video-thumbnail-make'

const ROOT = path.resolve(__dirname, '..')
const args = process.argv.slice(2)
const apply = args.includes('--apply')
const limit = Number(args[args.indexOf('--limit') + 1]) > 0 && args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : 500
const user = args.includes('--user') ? args[args.indexOf('--user') + 1] : null

function env(): Record<string, string> {
  const file = path.join(ROOT, '.env.local')
  if (!fs.existsSync(file)) return {}
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => {
    const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
  }))
}

async function main() {
  const e = { ...env(), ...process.env } as Record<string, string | undefined>
  const url = e.NEXT_PUBLIC_SUPABASE_URL, key = e.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { console.error('Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (in .env.local).'); process.exit(1) }
  const admin = createClient(url, key, { auth: { persistSession: false } })

  let q = admin.from('videos').select(THUMB_COLUMNS)
    .eq('status', 'completed')
    .or('draft_data->thumbnail->>cover.is.null,draft_data->thumbnail->>cover.eq.')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (user) q = q.eq('user_id', user)
  const { data, error } = await q
  if (error) { console.error('Could not read videos:', error.message); process.exit(1) }
  const rows = (data ?? []) as unknown as ThumbRow[]
  const { make, skip } = backfillPlan(rows)
  const stills = make.filter((m) => m.plan.kind === 'still').length
  console.log(`${rows.length} finished videos without a cover · ${make.length} to make (${stills} from the drawn cover, ${make.length - stills} from a film frame) · ${skip.length} skipped`)
  for (const s of skip.slice(0, 20)) console.log(`  skip ${s.id}: ${s.why}`)

  if (!apply) { console.log('Dry run — nothing written. Add --apply to make them.'); return }
  let ok = 0, failed = 0
  for (const m of make) {
    const row = rows.find((r) => r.id === m.id)!
    try { if (await makeCover(admin, row)) ok++; else failed++ } catch (err) {
      failed++
      console.log(`  fail ${m.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
    if ((ok + failed) % 10 === 0) console.log(`  … ${ok + failed}/${make.length}`)
  }
  console.log(`Done: ${ok} made, ${failed} failed.`)
}

main().catch((err) => { console.error(err instanceof Error ? err.message : err); process.exit(1) })
