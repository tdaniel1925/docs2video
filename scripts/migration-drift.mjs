// =============================================================================
// Which migrations in this repo never reached the live database?
//
// WHY THIS KEEPS MATTERING. Production does not run `supabase db push`. A
// migration file gets committed, everybody moves on, and the table or column it
// creates simply never exists. The code then calls it and Supabase answers with
// an error the app usually swallows — so the feature is quietly dead and looks
// merely broken. It has happened to prospect_demos, scene_count,
// script_revisions and try_demos.
//
// It also settles the opposite question. I had been telling the customer for
// several turns that pinning a chat needed a migration run. It did not — the
// column has been there all along, and the advice was repeated from a note
// rather than checked. This is what checking looks like.
//
// HOW IT CHECKS. Not by reading a ledger of what was applied — there isn't one,
// and a ledger would only tell you what somebody claimed. It asks the live
// database whether each table and column actually EXISTS. That is the only
// question that matters and the only answer that cannot be stale.
//
// READ ONLY. Every request is a SELECT with limit 0. Nothing is written,
// nothing is created, nothing is altered.
//
//   node scripts/migration-drift.mjs
// =============================================================================

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY) { console.log('Supabase details missing from .env.local'); process.exit(1) }

const head = { apikey: KEY, authorization: `Bearer ${KEY}` }

/** Does this table exist? */
async function tableExists(table) {
  const r = await fetch(`${URL_}/rest/v1/${table}?select=*&limit=0`, { headers: head })
  return r.ok
}

/** Does this column exist on this table? Asking for it by name is the test. */
async function columnExists(table, column) {
  const r = await fetch(`${URL_}/rest/v1/${table}?select=${encodeURIComponent(column)}&limit=0`, { headers: head })
  return r.ok
}

// Both places. One SQL file was left in supabase/ rather than supabase/migrations/,
// and a checker that only reads the tidy folder would miss it entirely.
const files = [
  ...fs.readdirSync('supabase').filter((f) => f.endsWith('.sql')).map((f) => path.join('supabase', f)),
  ...fs.readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).map((f) => path.join('supabase/migrations', f)),
].sort((a, b) => path.basename(a).localeCompare(path.basename(b)))

const problems = []
let checks = 0

for (const file of files) {
  const sql = fs.readFileSync(file, 'utf8')
  // Strip comments so a commented-out example is not mistaken for real DDL.
  const clean = sql.replace(/--.*$/gm, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')

  const wants = []

  for (const m of clean.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?/gi)) {
    wants.push({ kind: 'table', table: m[1] })
  }
  // ONE STATEMENT CAN ADD SEVERAL COLUMNS:
  //
  //   alter table videos
  //     add column if not exists slide_plan_url text,
  //     add column if not exists scene_preview_url text,
  //     add column if not exists total_scenes int;
  //
  // My first version matched only the first `add column` after the table name
  // and reported the file clean. It missed videos.apex_payout_via, which is
  // genuinely absent from the live database — a false green on the exact
  // question this script exists to answer. So the table name is found first,
  // then EVERY add-column up to the semicolon that ends the statement.
  for (const m of clean.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?([\s\S]*?);/gi)) {
    const table = m[1]
    for (const c of m[2].matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?"?([a-z0-9_]+)"?/gi)) {
      wants.push({ kind: 'column', table, column: c[1] })
    }
  }

  if (!wants.length) continue

  const missing = []
  for (const w of wants) {
    checks++
    const there = w.kind === 'table'
      ? await tableExists(w.table)
      : (await tableExists(w.table)) && (await columnExists(w.table, w.column))
    if (!there) missing.push(w.kind === 'table' ? `table ${w.table}` : `${w.table}.${w.column}`)
  }

  if (missing.length) problems.push({ file, missing: [...new Set(missing)] })
}

console.log(`Checked ${checks} table/column(s) named across ${files.length} migration files.\n`)

if (!problems.length) {
  console.log('Every table and column the migrations create is present in the live database.')
  process.exit(0)
}

// NAMED AND ORDERED, oldest first — that is the order to run them in.
console.log(`${problems.length} migration(s) have not reached the database:\n`)
for (const p of problems) {
  console.log(`  ${p.file}`)
  for (const m of p.missing) console.log(`      missing: ${m}`)
}
console.log('\nRun each of these by hand in the Supabase SQL editor, oldest first.')
process.exit(1)
