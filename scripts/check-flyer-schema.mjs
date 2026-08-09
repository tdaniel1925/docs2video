// Does production actually have what the flyer history needs?
//
// This project's migrations are run BY HAND — a committed .sql file proves
// nothing about the live database, and a missing table shows up as a feature
// that silently saves nothing. So check rather than assume.
//
//   node scripts/check-flyer-schema.mjs
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(2) }

const db = createClient(url, key, { auth: { persistSession: false } })
let bad = 0

// NOT `head: true`. A HEAD request against a table that does not exist comes
// back clean, so the first version of this script cheerfully reported that a
// table named `table_that_cannot_possibly_exist_xyz` was present. Ask for an
// actual row: a missing relation then fails loudly with PGRST205.
for (const table of ['flyer_rounds', 'flyer_designs', 'flyer_chats']) {
  const { error } = await db.from(table).select('id').limit(1)
  if (error) { console.log(`  MISSING  ${table} — ${error.message}`); bad++ }
  else console.log(`  ok       ${table}`)
}

// A table can exist while a column added later does not, and naming a missing
// column fails the WHOLE query — which in this codebase has killed a feature
// outright more than once. Check the column, not just the table.
{
  const { error } = await db.from('flyer_rounds').select('id, chat_id').limit(1)
  if (error) { console.log(`  MISSING  flyer_rounds.chat_id — ${error.message}`); bad++ }
  else console.log('  ok       flyer_rounds.chat_id')
}

const { data: buckets, error: bErr } = await db.storage.listBuckets()
if (bErr) { console.log(`  ?        buckets — ${bErr.message}`); bad++ }
else {
  const has = buckets.some((b) => b.name === 'creation-assets')
  console.log(`  ${has ? 'ok      ' : 'MISSING '} creation-assets bucket`)
  if (!has) bad++
}

console.log(bad
  ? `\n${bad} thing(s) missing — run supabase/migrations/20260809_flyer_designs.sql in the SQL editor.`
  : '\nProduction is ready for saved flyer history.')
process.exit(bad ? 1 : 0)
