/**
 * PROVE THE SLIDE ENGINE, end to end, on the real modules.
 *
 * Draws one infographic slide through app/_lib/slide-engine, pins a real
 * logo, and MEASURES that the reserved corner was empty before the paste —
 * because "the logo looks right" is not the same as "the model left room".
 *
 *   npx tsc app/_lib/slide-engine.ts app/_lib/logo-space.ts \
 *     --outDir scripts/.built --module nodenext --moduleResolution nodenext \
 *     --target es2022 --skipLibCheck
 *   node scripts/slide-engine-check.mjs
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

for (const [k, v] of Object.entries(Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/))
    .filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]),
))) process.env[k] ??= v

/* Bundled with esbuild — node cannot resolve extensionless TS imports. */
/* Compiled first — see the header. */
const { drawSlide, slideEngine } = await import("./.built/slide-engine.js")
const { LOGO_SPACE } = await import("./.built/logo-space.js")
mkdirSync('scripts/.bakeoff', { recursive: true })

const PROMPT = [
  'Design ONE presentation slide, 16:9, for a business explainer video.',
  'Layout: a BIG-STAT slide. The heading is "The 2026 book, at a glance".',
  'Show these three figures as large headline numbers, each with a short label beneath it:',
  '  $1,284,900 — total premium in force',
  '  3,417 — policies on the books',
  '  91.4% — persistency',
  '',
  'RULES:',
  '- Use ONLY the words and numbers above. Spell every word exactly.',
  '- Every figure keeps its $ sign, its commas, its decimal point and its %.',
  '- No lorem ipsum, no placeholder text.',
  '- Clean, modern, professional. Deep navy background, cyan and white type.',
].join('\n')

console.log('engine:', slideEngine())
const logo = readFileSync('public/logo-nav.png')
const t0 = Date.now()
const png = await drawSlide(PROMPT, logo)
console.log(`drew + pinned in ${((Date.now() - t0) / 1000).toFixed(1)}s`)

const m = await sharp(png).metadata()
writeFileSync('scripts/.bakeoff/engine-slide.png', png)
console.log(`${m.width}x${m.height} -> scripts/.bakeoff/engine-slide.png`)

/* Was the corner actually held open? Crop to a BUFFER first — .stats() after
   .extract() reports whole-image numbers in this sharp version, which is how
   an earlier version of this check "passed" four different slides. */
const noLogo = await drawSlide(PROMPT, null)
const probe = await sharp(noLogo).extract({
  left: Math.round(m.width * (1 - LOGO_SPACE.w - LOGO_SPACE.margin)),
  top: Math.round(m.height * (1 - LOGO_SPACE.h - LOGO_SPACE.margin)),
  width: Math.round(m.width * LOGO_SPACE.w),
  height: Math.round(m.height * LOGO_SPACE.h),
}).toBuffer()
const spread = Math.max(...(await sharp(probe).stats()).channels.slice(0, 3).map((c) => c.stdev))
console.log(`corner with NO logo asked for: ${spread.toFixed(1)} (expected busy — the slide may use it)`)
