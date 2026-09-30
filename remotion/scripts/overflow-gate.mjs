// =============================================================================
// The release gate: every QA case, strict mode, in small batches.
//
//   npm run qa:overflow:gate
//
// Runs scripts/overflow-qa.mjs with QA_OVERLAP=1 (text over text, text under a
// logo) and QA_SEQUENCE=4 (warm-up frames in the same tab, like a real render)
// over EVERY case — in batches, each in its own process. One long run crashed
// Remotion's renderer after ~700 frames (its console source-map reader runs
// out of memory), so the gate never asks one process for more than a batch.
//
// Passes only if every batch passes. Each batch includes the planted-broken
// self-test, so a batch whose guard stopped working fails on its own.
// =============================================================================
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const QA = path.join(ROOT, 'scripts', 'overflow-qa.mjs')
const BATCH = Number(process.env.QA_BATCH || 8)
const env = { ...process.env, QA_OVERLAP: '1', QA_SEQUENCE: process.env.QA_SEQUENCE || '4', QA_PARALLEL: process.env.QA_PARALLEL || '6' }

const list = spawnSync(process.execPath, [QA, '--list'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 })
const ids = (list.stdout || '').split('\n').map((l) => l.trim().split(/\s+/)[0]).filter((id) => id && id.startsWith('QA-') && !id.startsWith('QA-selftest'))
if (!ids.length) { console.log('No QA cases found.'); process.exit(1) }

const batches = []
for (let i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH))
console.log(`Release gate: ${ids.length} case(s) in ${batches.length} batch(es), strict mode.`)

const results = []
for (const [n, batch] of batches.entries()) {
  const run = spawnSync(process.execPath, [QA, ...batch], { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 1 << 28 })
  const out = `${run.stdout || ''}${run.stderr || ''}`
  const verdict = out.split('\n').find((l) => /^(PASS|FAIL) — /.test(l)) || `CRASHED (exit ${run.status})`
  const selftest = /Self-test: caught all/.test(out)
  // Overflow and not-checked lines; the shrink warnings ("Fit 24 < 30") are not failures.
  const problems = out.split('\n').filter((l) => /^\s+QA-\S+ f\S+\s+/.test(l) && !/\sFit(Box)? \d+ < \d+/.test(l))
  const ok = run.status === 0 && verdict.startsWith('PASS') && selftest
  results.push({ n: n + 1, ok, verdict, selftest, problems })
  console.log(`  batch ${n + 1}/${batches.length} ${ok ? 'ok  ' : 'FAIL'} ${verdict}${selftest ? '' : '  [self-test did not pass]'}`)
  for (const p of problems.slice(0, 20)) console.log(`     ${p.trim()}`)
}

const failed = results.filter((r) => !r.ok)
console.log(failed.length
  ? `\nGATE FAIL — ${failed.length} of ${results.length} batch(es) failed.`
  : `\nGATE PASS — all ${ids.length} case(s) in ${results.length} batch(es): nothing off screen, cut off, out of its box, over other text, or under a logo; every batch's self-test caught its planted faults.`)
process.exit(failed.length ? 1 : 0)
