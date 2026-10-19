// SELF-FIX RISK: may this verified fix ship on its own, or does the owner
// approve it? Ported from Jordyn (scripts/self-fix-risk.mjs, owner 2026-10-08)
// for Docs2Video (2026-10-19). Runs in .github/workflows/self-fix.yml AFTER
// the type check and the full test suite passed — pure rules over the diff,
// never the agent's opinion of its own work.
//
// It only matters if the owner turns auto-ship ON (repo variable
// SELF_FIX_AUTO_SHIP=on). With it off — the default here — every fix waits
// for the owner's merge, whatever this says.
//
// CLI: node scripts/self-fix-risk.mjs <base-ref>   → prints JSON {tier, reasons}

const MAX_FILES = 6
const MAX_LINES = 200

/** Paths where a mistake costs money, locks people out, leaks data, emails
 *  the wrong people, or changes every video at once. */
export const SENSITIVE = [
  [/^supabase\//, 'the database'],
  [/^proxy\.ts$|^middleware\.ts$/, 'sign-in and page access'],
  [/^next\.config\./, 'app configuration'],
  [/^vercel\.json$/, 'deploy configuration'],
  [/^package(-lock)?\.json$/, 'packages'],
  [/^\.github\//, 'the GitHub workflows'],
  [/^scripts\/self-fix-risk\.mjs$/, 'this auto-ship rule itself'],
  [/^app\/_lib\/support\//, 'the self-fix pipeline'],
  [/^app\/api\/support\//, 'the self-fix pipeline'],
  [/(stripe|billing|credit|price|pricing|plan-pricing|wallet|checkout|refund|payout|subscribe|invoice)/i, 'money'],
  [/(auth|login|signup|password|session|secret|crypto|token|impersonat)/i, 'sign-in and security'],
  [/^app\/_lib\/supabase\//, 'the database connection'],
  [/(email|resend|send-video|share-send|smtp)/i, 'email sending'],
  [/(delete|account)/i, 'accounts and deleting'],
  [/^app\/api\/admin\/|^app\/\(dashboard\)\/admin\//, 'the admin back office'],
  [/^render-service\//, 'the render service (deployed separately)'],
]

const isTest = (p) => /^tests\//.test(p) || /\.test\.tsx?$/.test(p)

/** files: [{ path, added, removed, status }] (status A/M/D/R from git). */
export function classifyFix(files) {
  const reasons = []
  if (!files.length) reasons.push('the fix changed nothing')
  const code = files.filter((f) => !isTest(f.path))
  const tests = files.filter((f) => isTest(f.path))
  if (code.length > MAX_FILES) reasons.push(`it changes ${code.length} files (auto-ship allows ${MAX_FILES})`)
  const lines = code.reduce((n, f) => n + (f.added || 0) + (f.removed || 0), 0)
  if (lines > MAX_LINES) reasons.push(`it changes ${lines} lines of code (auto-ship allows ${MAX_LINES})`)
  for (const f of files) if (f.status === 'D') reasons.push(`it deletes ${f.path}`)
  const testRemoved = tests.reduce((n, f) => n + (f.removed || 0), 0)
  const testAdded = tests.reduce((n, f) => n + (f.added || 0), 0)
  if (testRemoved > 20 && testRemoved > testAdded) reasons.push('it removes more test lines than it adds')
  const hit = new Set()
  for (const f of code)
    for (const [re, label] of SENSITIVE)
      if (re.test(f.path) && !hit.has(label)) {
        hit.add(label)
        reasons.push(`it touches ${label} (${f.path})`)
      }
  return { tier: reasons.length ? 'major' : 'low', reasons }
}

/** Parse `git diff --numstat` + `--name-status` output. */
export function parseDiff(numstat, nameStatus) {
  const status = new Map()
  for (const line of nameStatus.split('\n').filter(Boolean)) {
    const parts = line.split('\t')
    status.set(parts[parts.length - 1], parts[0][0])
  }
  return numstat
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [a, r, ...rest] = line.split('\t')
      const path = rest.join('\t').replace(/^.*=> /, '').replace(/[{}]/g, '')
      return { path, added: a === '-' ? 0 : Number(a), removed: r === '-' ? 0 : Number(r), status: status.get(path) ?? 'M' }
    })
}

// CLI
if (process.argv[1] && /self-fix-risk\.mjs$/.test(process.argv[1])) {
  const { execSync } = await import('node:child_process')
  const base = process.argv[2] || 'origin/main'
  const numstat = execSync(`git diff --numstat ${base}...HEAD`, { encoding: 'utf8' })
  const names = execSync(`git diff --name-status ${base}...HEAD`, { encoding: 'utf8' })
  process.stdout.write(JSON.stringify(classifyFix(parseDiff(numstat, names))) + '\n')
}
